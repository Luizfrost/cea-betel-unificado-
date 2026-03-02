// ============================================
// DATABASE POSTGRESQL - NEON (FUNCIONANDO!)
// ============================================

import pkg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

class Database {
    constructor() {
        // SUA STRING DE CONEXÃO JÁ ESTÁ NO .env
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false // Obrigatório para Neon
            },
            max: 5, // máximo de conexões
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        console.log('📦 Conectando ao Neon PostgreSQL...');
        this.inicializar();
    }

    async inicializar() {
        try {
            // Testar conexão
            const client = await this.pool.connect();
            console.log('✅ Conectado ao Neon com sucesso!');
            console.log('📍 Região: São Paulo (Brasil)');
            client.release();

            await this.criarTabelas();
            
        } catch (error) {
            console.error('❌ Erro ao conectar ao Neon:', error.message);
            console.error('❌ Verifique sua DATABASE_URL no arquivo .env');
            process.exit(1);
        }
    }

    async criarTabelas() {
        console.log('📋 Criando tabelas...');

        // Tabela de membros
        await this.query(`
            CREATE TABLE IF NOT EXISTS membros (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                senha VARCHAR(255) NOT NULL,
                data_nascimento DATE,
                telefone VARCHAR(20),
                funcao VARCHAR(100),
                permissoes JSONB DEFAULT '{"verEscalas":true,"verAvisos":true,"verEventos":true,"verAniversariantes":true}',
                reset_token VARCHAR(255),
                reset_expires TIMESTAMP,
                ativo BOOLEAN DEFAULT true,
                data_cadastro DATE DEFAULT CURRENT_DATE
            )
        `);

        // Tabela de escalas
        await this.query(`
            CREATE TABLE IF NOT EXISTS escalas (
                id SERIAL PRIMARY KEY,
                data DATE NOT NULL,
                horario TIME NOT NULL,
                funcao VARCHAR(50) NOT NULL,
                membro1_id INTEGER REFERENCES membros(id),
                membro2_id INTEGER REFERENCES membros(id),
                observacoes TEXT
            )
        `);

        // Tabela de avisos
        await this.query(`
            CREATE TABLE IF NOT EXISTS avisos (
                id SERIAL PRIMARY KEY,
                titulo VARCHAR(255) NOT NULL,
                mensagem TEXT NOT NULL,
                importancia VARCHAR(10) CHECK (importancia IN ('alta', 'media', 'baixa')),
                data DATE NOT NULL,
                autor VARCHAR(255),
                fixado BOOLEAN DEFAULT false,
                notificado BOOLEAN DEFAULT false
            )
        `);

        // Tabela de financeiro
        await this.query(`
            CREATE TABLE IF NOT EXISTS financeiro (
                id SERIAL PRIMARY KEY,
                tipo VARCHAR(10) CHECK (tipo IN ('dizimo', 'oferta', 'outros')),
                membro_id INTEGER REFERENCES membros(id),
                valor DECIMAL(10,2) NOT NULL,
                data DATE NOT NULL,
                descricao TEXT,
                comprovante TEXT
            )
        `);

        // Tabela de eventos
        await this.query(`
            CREATE TABLE IF NOT EXISTS eventos (
                id SERIAL PRIMARY KEY,
                titulo VARCHAR(255) NOT NULL,
                data DATE NOT NULL,
                horario TIME,
                descricao TEXT,
                local VARCHAR(255)
            )
        `);

        // Tabela de admin
        await this.query(`
            CREATE TABLE IF NOT EXISTS admin (
                id SERIAL PRIMARY KEY,
                usuario VARCHAR(50) UNIQUE NOT NULL,
                senha VARCHAR(255) NOT NULL,
                nome VARCHAR(255),
                email VARCHAR(255),
                pix VARCHAR(255),
                ultimo_acesso TIMESTAMP
            )
        `);

        // Tabela de configurações
        await this.query(`
            CREATE TABLE IF NOT EXISTS configuracoes (
                chave VARCHAR(100) PRIMARY KEY,
                valor TEXT
            )
        `);

        // Tabela de logs
        await this.query(`
            CREATE TABLE IF NOT EXISTS logs (
                id SERIAL PRIMARY KEY,
                usuario VARCHAR(255),
                acao VARCHAR(255),
                dados TEXT,
                data DATE DEFAULT CURRENT_DATE,
                hora TIME DEFAULT CURRENT_TIME
            )
        `);

        console.log('✅ Tabelas criadas/verificadas');
        
        await this.inserirDadosIniciais();
    }

    async inserirDadosIniciais() {
        // Criar admin padrão
        const admin = await this.get("SELECT * FROM admin WHERE usuario = 'admin'");
        
        if (!admin) {
            const salt = bcrypt.genSaltSync(10);
            const hash = bcrypt.hashSync('admin123', salt);
            
            await this.run(
                "INSERT INTO admin (usuario, senha, nome, email) VALUES ($1, $2, $3, $4)",
                ['admin', hash, 'Administrador', 'admin@ceabetel.com.br']
            );
            console.log('✅ Admin criado: admin / admin123');
        }

        // Criar membros de exemplo
        const membrosCount = await this.get("SELECT COUNT(*) as total FROM membros");
        
        if (parseInt(membrosCount.total) === 0) {
            const salt = bcrypt.genSaltSync(10);
            const permissoes = JSON.stringify({
                verEscalas: true,
                verAvisos: true,
                verEventos: true,
                verAniversariantes: true
            });
            
            const membrosExemplo = [
                ['João Silva', 'joao@email.com', bcrypt.hashSync('123456', salt), '1985-03-15', '(11) 99999-9999', 'Recepcionista', permissoes],
                ['Maria Oliveira', 'maria@email.com', bcrypt.hashSync('123456', salt), '1990-07-22', '(11) 98888-8888', 'Louvor', permissoes],
                ['Pedro Santos', 'pedro@email.com', bcrypt.hashSync('123456', salt), '1982-11-30', '(11) 97777-7777', 'Palavra', permissoes]
            ];

            for (const m of membrosExemplo) {
                await this.run(
                    "INSERT INTO membros (nome, email, senha, data_nascimento, telefone, funcao, permissoes, data_cadastro) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE)",
                    m
                );
            }
            console.log('✅ Membros de exemplo criados');
        }

        // Configurações padrão
        const configs = [
            ['proximo_culto', 'Domingo, 19:00'],
            ['nome_igreja', 'CEA Betel Bertioga'],
            ['pix', 'chave-pix@ceabetel.com.br']
        ];

        for (const [chave, valor] of configs) {
            const exists = await this.get("SELECT * FROM configuracoes WHERE chave = $1", [chave]);
            if (!exists) {
                await this.run(
                    "INSERT INTO configuracoes (chave, valor) VALUES ($1, $2)",
                    [chave, valor]
                );
            }
        }
    }

    // Métodos auxiliares (use estes em todo o seu código)
    async query(sql, params = []) {
        try {
            const result = await this.pool.query(sql, params);
            return result.rows;
        } catch (error) {
            console.error('❌ Erro na query:', error.message);
            throw error;
        }
    }

    async get(sql, params = []) {
        try {
            const result = await this.pool.query(sql, params);
            return result.rows[0] || null;
        } catch (error) {
            console.error('❌ Erro no get:', error.message);
            throw error;
        }
    }

    async run(sql, params = []) {
        try {
            const result = await this.pool.query(sql, params);
            return { 
                id: result.rows[0]?.id || null, 
                changes: result.rowCount 
            };
        } catch (error) {
            console.error('❌ Erro no run:', error.message);
            throw error;
        }
    }
}

export default new Database();