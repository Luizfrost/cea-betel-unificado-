// ============================================
// DATABASE CONFIGURATION - CEA BETEL BERTIOGA
// ============================================

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Database {
    constructor() {
        // Verificar ambiente
        const isProduction = process.env.NODE_ENV === 'production';
        
        // CAMINHO CORRIGIDO - GARANTA QUE ESTÁ ASSIM
        if (isProduction) {
            // Render persistent disk - caminho EXATO
            this.dbPath = '/data/cea-betel.db';
            console.log('📦 Ambiente: Produção (Render)');
            console.log(`📂 Caminho do banco: ${this.dbPath}`);
        } else {
            // Local development
            this.dbPath = path.join(__dirname, 'cea-betel.db');
            console.log('💻 Ambiente: Desenvolvimento Local');
            console.log(`📂 Caminho do banco: ${this.dbPath}`);
        }
        
        // GARANTIR que a pasta existe (CRÍTICO para produção)
        const dbDir = path.dirname(this.dbPath);
        console.log(`📁 Diretório do banco: ${dbDir}`);
        
        if (!fs.existsSync(dbDir)) {
            try {
                fs.mkdirSync(dbDir, { recursive: true });
                console.log(`📁 Pasta criada: ${dbDir}`);
            } catch (error) {
                console.error('❌ Erro ao criar pasta:', error);
                throw error;
            }
        } else {
            console.log(`✅ Pasta existe: ${dbDir}`);
        }
        
        // Verificar permissões de escrita
        try {
            fs.accessSync(dbDir, fs.constants.W_OK);
            console.log('✅ Permissão de escrita OK');
        } catch (error) {
            console.error('❌ Sem permissão de escrita:', error);
            console.error('❌ Verifique se o disco persistente está montado em /data');
            throw error;
        }
        
        // Inicializar banco
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('❌ Erro ao abrir banco:', err);
                throw err;
            }
            console.log('✅ Banco de dados conectado!');
        });
        
        this.inicializar();
    }

    inicializar() {
        this.db.serialize(() => {
            // Tabela de membros (com permissões)
            this.db.run(`CREATE TABLE IF NOT EXISTS membros (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT,
                email TEXT UNIQUE,
                senha TEXT,
                data_nascimento TEXT,
                telefone TEXT,
                funcao TEXT,
                permissoes TEXT DEFAULT '{"verEscalas":true,"verAvisos":true,"verEventos":true,"verAniversariantes":true}',
                reset_token TEXT,
                reset_expires TEXT,
                ativo INTEGER DEFAULT 1,
                data_cadastro TEXT
            )`);

            // Tabela de escalas
            this.db.run(`CREATE TABLE IF NOT EXISTS escalas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT,
                horario TEXT,
                funcao TEXT,
                membro1_id INTEGER,
                membro2_id INTEGER,
                observacoes TEXT,
                FOREIGN KEY (membro1_id) REFERENCES membros(id),
                FOREIGN KEY (membro2_id) REFERENCES membros(id)
            )`);

            // Tabela de avisos
            this.db.run(`CREATE TABLE IF NOT EXISTS avisos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                titulo TEXT,
                mensagem TEXT,
                importancia TEXT CHECK(importancia IN ('alta', 'media', 'baixa')),
                data TEXT,
                autor TEXT,
                fixado INTEGER DEFAULT 0,
                notificado INTEGER DEFAULT 0
            )`);

            // Tabela de dízimos e ofertas
            this.db.run(`CREATE TABLE IF NOT EXISTS financeiro (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo TEXT CHECK(tipo IN ('dizimo', 'oferta', 'outros')),
                membro_id INTEGER,
                valor REAL,
                data TEXT,
                descricao TEXT,
                comprovante TEXT,
                FOREIGN KEY (membro_id) REFERENCES membros(id)
            )`);

            // Tabela de eventos
            this.db.run(`CREATE TABLE IF NOT EXISTS eventos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                titulo TEXT,
                data TEXT,
                horario TEXT,
                descricao TEXT,
                local TEXT
            )`);

            // Tabela de configurações
            this.db.run(`CREATE TABLE IF NOT EXISTS configuracoes (
                chave TEXT PRIMARY KEY,
                valor TEXT
            )`);

            // Tabela de admin
            this.db.run(`CREATE TABLE IF NOT EXISTS admin (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario TEXT UNIQUE,
                senha TEXT,
                nome TEXT,
                email TEXT,
                pix TEXT,
                ultimo_acesso TEXT
            )`);

            // Tabela de logs
            this.db.run(`CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario TEXT,
                acao TEXT,
                dados TEXT,
                data TEXT,
                hora TEXT
            )`);

            // Tabela de inscrições push
            this.db.run(`CREATE TABLE IF NOT EXISTS push_subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                membro_id INTEGER,
                subscription TEXT,
                data TEXT,
                FOREIGN KEY (membro_id) REFERENCES membros(id)
            )`);

            // Criar admin padrão
            this.criarAdminPadrao();
            
            // Criar membros de exemplo
            this.criarMembrosExemplo();
            
            // Criar dados de exemplo
            this.criarDadosExemplo();
        });
    }

    criarAdminPadrao() {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync('admin123', salt);
        
        this.db.get("SELECT * FROM admin WHERE usuario = 'admin'", (err, row) => {
            if (!row) {
                this.db.run(
                    "INSERT INTO admin (usuario, senha, nome, email) VALUES (?, ?, ?, ?)",
                    ['admin', hash, 'Administrador', 'admin@ceabetel.com.br']
                );
                console.log('✅ Admin criado: admin / admin123');
            }
        });
    }

    criarMembrosExemplo() {
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
            ['Pedro Santos', 'pedro@email.com', bcrypt.hashSync('123456', salt), '1982-11-30', '(11) 97777-7777', 'Palavra', permissoes],
            ['Ana Costa', 'ana@email.com', bcrypt.hashSync('123456', salt), '1988-12-05', '(11) 96666-6666', 'Dízimo', permissoes]
        ];

        membrosExemplo.forEach(([nome, email, senha, data_nascimento, telefone, funcao, permissoes]) => {
            this.db.get("SELECT * FROM membros WHERE email = ?", [email], (err, row) => {
                if (!row) {
                    this.db.run(
                        "INSERT INTO membros (nome, email, senha, data_nascimento, telefone, funcao, permissoes, data_cadastro) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        [nome, email, senha, data_nascimento, telefone, funcao, permissoes, new Date().toISOString().split('T')[0]]
                    );
                }
            });
        });
    }

    criarDadosExemplo() {
        // Escalas de exemplo
        this.db.get("SELECT * FROM escalas", (err, row) => {
            if (!row) {
                const escalas = [
                    ['2025-03-09', '19:00', 'Abertura', 1, null],
                    ['2025-03-09', '19:00', 'Dízimo', 2, null],
                    ['2025-03-09', '19:00', 'Palavra', 3, null],
                    ['2025-03-09', '19:00', 'Recepção', 1, 2],
                ];

                escalas.forEach(([data, horario, funcao, membro1, membro2]) => {
                    this.db.run(
                        "INSERT INTO escalas (data, horario, funcao, membro1_id, membro2_id) VALUES (?, ?, ?, ?, ?)",
                        [data, horario, funcao, membro1, membro2]
                    );
                });
            }
        });

        // Avisos de exemplo
        this.db.get("SELECT * FROM avisos", (err, row) => {
            if (!row) {
                const avisos = [
                    ['Culto de Celebração', 'Neste domingo teremos um culto especial!', 'alta', new Date().toISOString().split('T')[0], 'Secretaria'],
                    ['Reunião de Oração', 'Toda quarta-feira às 20h.', 'media', new Date().toISOString().split('T')[0], 'Pastor'],
                    ['Campanha do Agasalho', 'Participe trazendo sua doação.', 'alta', new Date().toISOString().split('T')[0], 'Ação Social']
                ];

                avisos.forEach(([titulo, mensagem, importancia, data, autor]) => {
                    this.db.run(
                        "INSERT INTO avisos (titulo, mensagem, importancia, data, autor) VALUES (?, ?, ?, ?, ?)",
                        [titulo, mensagem, importancia, data, autor]
                    );
                });
            }
        });

        // Eventos de exemplo
        this.db.get("SELECT * FROM eventos", (err, row) => {
            if (!row) {
                const eventos = [
                    ['Culto de Domingo', '2025-03-09', '19:00', 'Culto de celebração', 'Templo Principal'],
                    ['Escola Bíblica', '2025-03-12', '20:00', 'Estudo de Romanos', 'Sala 2'],
                    ['Culto de Jovens', '2025-03-15', '19:30', 'Louvor e adoração', 'Auditório']
                ];

                eventos.forEach(([titulo, data, horario, descricao, local]) => {
                    this.db.run(
                        "INSERT INTO eventos (titulo, data, horario, descricao, local) VALUES (?, ?, ?, ?, ?)",
                        [titulo, data, horario, descricao, local]
                    );
                });
            }
        });

        // Financeiro de exemplo
        this.db.get("SELECT * FROM financeiro", (err, row) => {
            if (!row) {
                const financeiro = [
                    ['dizimo', 1, 150.00, '2025-03-01', 'Dízimo mensal', null],
                    ['oferta', 2, 75.50, '2025-03-01', 'Oferta de gratidão', null],
                    ['dizimo', 3, 200.00, '2025-03-02', 'Dízimo', null],
                    ['oferta', 1, 100.00, '2025-03-02', 'Oferta missionária', null],
                    ['outros', null, 500.00, '2025-03-03', 'Doação anônima', null]
                ];

                financeiro.forEach(([tipo, membro_id, valor, data, descricao, comprovante]) => {
                    this.db.run(
                        "INSERT INTO financeiro (tipo, membro_id, valor, data, descricao, comprovante) VALUES (?, ?, ?, ?, ?, ?)",
                        [tipo, membro_id, valor, data, descricao, comprovante]
                    );
                });
            }
        });

        // Configurações
        const configuracoes = [
            ['proximo_culto', 'Domingo, 19:00'],
            ['nome_igreja', 'CEA Betel Bertioga'],
            ['pix', 'chave-pix@ceabetel.com.br'],
            ['email_smtp', 'smtp.gmail.com'],
            ['email_port', '587'],
            ['email_user', 'ceabetel@gmail.com'],
            ['email_pass', ''],
            ['vapid_public_key', ''],
            ['vapid_private_key', '']
        ];

        configuracoes.forEach(([chave, valor]) => {
            this.db.get("SELECT * FROM configuracoes WHERE chave = ?", [chave], (err, row) => {
                if (!row) {
                    this.db.run(
                        "INSERT INTO configuracoes (chave, valor) VALUES (?, ?)",
                        [chave, valor]
                    );
                }
            });
        });
    }

    // Métodos auxiliares
    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    }
}

export default new Database();