// ============================================
// DATABASE POSTGRESQL - NEON (GRATUITO)
// ============================================

import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

class Database {
    constructor() {
        // Verificar se está em produção ou desenvolvimento
        this.isProduction = process.env.NODE_ENV === 'production';
        
        // Configuração do pool de conexões
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: this.isProduction ? { rejectUnauthorized: false } : false,
            max: 20, // máximo de conexões simultâneas
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        console.log(`📦 Conectando ao PostgreSQL (${this.isProduction ? 'Produção' : 'Desenvolvimento'})`);
        
        // Testar conexão e criar tabelas
        this.inicializar();
    }

    async inicializar() {
        try {
            // Testar conexão
            const client = await this.pool.connect();
            console.log('✅ Conectado ao PostgreSQL com sucesso!');
            client.release();

            // Criar tabelas
            await this.criarTabelas();
            
        } catch (error) {
            console.error('❌ Erro ao conectar ao banco:', error.message);
            console.error('❌ Verifique sua DATABASE_URL no arquivo .env');
            process.exit(1);
        }
    }

    async criarTabelas() {
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

        // Tabela de configurações
        await this.query(`
            CREATE TABLE IF NOT EXISTS configuracoes (
                chave VARCHAR(100) PRIMARY KEY,
                valor TEXT
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

        // Inserir dados iniciais
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

        // Verificar se existem membros
        const membros = await this.query("SELECT COUNT(*) FROM membros");
        
        if (parseInt(membros[0].count) === 0) {
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

    // Método para queries que retornam múltiplas linhas
    async query(sql, params = []) {
        try {
            const result = await this.pool.query(sql, params);
            return result.rows;
        } catch (error) {
            console.error('❌ Erro na query:', error.message);
            throw error;
        }
    }

    // Método para queries que retornam uma única linha
    async get(sql, params = []) {
        try {
            const result = await this.pool.query(sql, params);
            return result.rows[0] || null;
        } catch (error) {
            console.error('❌ Erro no get:', error.message);
            throw error;
        }
    }

    // Método para inserts/updates/deletes
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