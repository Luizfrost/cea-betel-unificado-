import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Database {
    constructor() {
       this.dbPath = process.env.NODE_ENV === 'production' 
  ? '/data/cea-betel.db' 
  : path.join(__dirname, 'cea-betel.db');
        this.db = new sqlite3.Database(this.dbPath);
        this.inicializar();
    }

    inicializar() {
        this.db.serialize(() => {
            // Tabela de membros
            this.db.run(`CREATE TABLE IF NOT EXISTS membros (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT,
                email TEXT UNIQUE,
                senha TEXT,
                data_nascimento TEXT,
                telefone TEXT,
                funcao TEXT,
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
                fixado INTEGER DEFAULT 0
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
                ultimo_acesso TEXT
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
                    "INSERT INTO admin (usuario, senha, nome) VALUES (?, ?, ?)",
                    ['admin', hash, 'Administrador']
                );
                console.log('✅ Admin criado: admin / admin123');
            }
        });
    }

    criarMembrosExemplo() {
        const salt = bcrypt.genSaltSync(10);
        const membrosExemplo = [
            ['João Silva', 'joao@email.com', bcrypt.hashSync('123456', salt), '1985-03-15', '(11) 99999-9999', 'Recepcionista'],
            ['Maria Oliveira', 'maria@email.com', bcrypt.hashSync('123456', salt), '1990-07-22', '(11) 98888-8888', 'Louvor'],
            ['Pedro Santos', 'pedro@email.com', bcrypt.hashSync('123456', salt), '1982-11-30', '(11) 97777-7777', 'Palavra'],
            ['Ana Souza', 'ana@email.com', bcrypt.hashSync('123456', salt), '1995-12-10', '(11) 96666-6666', 'Abertura'],
            ['Carlos Lima', 'carlos@email.com', bcrypt.hashSync('123456', salt), '1988-05-20', '(11) 95555-5555', 'Dízimo']
        ];

        membrosExemplo.forEach(([nome, email, senha, data_nascimento, telefone, funcao]) => {
            this.db.get("SELECT * FROM membros WHERE email = ?", [email], (err, row) => {
                if (!row) {
                    this.db.run(
                        "INSERT INTO membros (nome, email, senha, data_nascimento, telefone, funcao, data_cadastro) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        [nome, email, senha, data_nascimento, telefone, funcao, new Date().toISOString().split('T')[0]]
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
                    ['2025-03-02', '19:00', 'Abertura', 4, null],
                    ['2025-03-02', '19:00', 'Dízimo', 5, null],
                    ['2025-03-02', '19:00', 'Palavra', 3, null],
                    ['2025-03-02', '19:00', 'Recepção', 1, 2],
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
                    ['Culto de Celebração', 'Neste domingo teremos um culto especial com a participação do grupo musical.', 'alta', new Date().toISOString().split('T')[0], 'Secretaria'],
                    ['Reunião de Oração', 'Toda quarta-feira às 20h. Sua presença é importante!', 'media', new Date().toISOString().split('T')[0], 'Pastor'],
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
                    ['Culto de Domingo', '2025-03-02', '19:00', 'Culto de celebração com Santa Ceia', 'Templo Principal'],
                    ['Escola Bíblica', '2025-03-05', '20:00', 'Estudo do livro de Romanos', 'Sala 2'],
                ];

                eventos.forEach(([titulo, data, horario, descricao, local]) => {
                    this.db.run(
                        "INSERT INTO eventos (titulo, data, horario, descricao, local) VALUES (?, ?, ?, ?, ?)",
                        [titulo, data, horario, descricao, local]
                    );
                });
            }
        });

        // Configurações
        this.db.get("SELECT * FROM configuracoes WHERE chave = 'proximo_culto'", (err, row) => {
            if (!row) {
                this.db.run(
                    "INSERT INTO configuracoes (chave, valor) VALUES (?, ?)",
                    ['proximo_culto', 'Domingo, 19:00']
                );
            }
        });
    }

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