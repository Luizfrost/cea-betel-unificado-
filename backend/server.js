import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const JWT_SECRET = 'cea-betel-secret-2025';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// ========== ROTAS PÚBLICAS (APP MEMBROS) ==========

// Login do membro
app.post('/api/membros/login', async (req, res) => {
    const { email, senha } = req.body;
    
    try {
        const membro = await db.get(
            "SELECT * FROM membros WHERE email = ? AND ativo = 1",
            [email]
        );
        
        if (!membro) {
            return res.status(401).json({ erro: 'E-mail não encontrado' });
        }
        
        const senhaValida = bcrypt.compareSync(senha, membro.senha);
        if (!senhaValida) {
            return res.status(401).json({ erro: 'Senha incorreta' });
        }
        
        res.json({
            id: membro.id,
            nome: membro.nome,
            email: membro.email,
            funcao: membro.funcao,
            data_nascimento: membro.data_nascimento
        });
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// Home do membro
app.get('/api/membros/home/:membroId', async (req, res) => {
    const { membroId } = req.params;
    
    try {
        const [culto, avisos, escalaHoje] = await Promise.all([
            db.get("SELECT valor FROM configuracoes WHERE chave = 'proximo_culto'"),
            db.query("SELECT * FROM avisos WHERE importancia = 'alta' ORDER BY data DESC LIMIT 3"),
            db.get(
                "SELECT * FROM escalas WHERE data = date('now') AND (membro1_id = ? OR membro2_id = ?)",
                [membroId, membroId]
            )
        ]);
        
        res.json({
            proximoCulto: culto?.valor || 'Domingo, 19:00',
            estaEscalado: !!escalaHoje,
            avisosImportantes: avisos || []
        });
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// Escalas do membro
app.get('/api/membros/escalas/:membroId', async (req, res) => {
    const { membroId } = req.params;
    
    try {
        const escalas = await db.query(`
            SELECT e.*, 
                   m1.nome as membro1_nome,
                   m2.nome as membro2_nome
            FROM escalas e
            LEFT JOIN membros m1 ON e.membro1_id = m1.id
            LEFT JOIN membros m2 ON e.membro2_id = m2.id
            WHERE e.membro1_id = ? OR e.membro2_id = ?
            ORDER BY e.data DESC
        `, [membroId, membroId]);
        
        res.json(escalas);
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// Avisos para membros
app.get('/api/membros/avisos', async (req, res) => {
    try {
        const avisos = await db.query(`
            SELECT * FROM avisos 
            ORDER BY 
                CASE importancia 
                    WHEN 'alta' THEN 1 
                    WHEN 'media' THEN 2 
                    WHEN 'baixa' THEN 3 
                END,
                data DESC
        `);
        res.json(avisos);
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// Aniversariantes do mês
app.get('/api/membros/aniversariantes', async (req, res) => {
    const mesAtual = new Date().getMonth() + 1;
    
    try {
        const aniversariantes = await db.query(`
            SELECT nome, data_nascimento 
            FROM membros 
            WHERE strftime('%m', data_nascimento) = ? 
            ORDER BY strftime('%d', data_nascimento)
        `, [mesAtual.toString().padStart(2, '0')]);
        
        res.json(aniversariantes);
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// Eventos do mês
app.get('/api/membros/eventos', async (req, res) => {
    const mesAtual = new Date().getMonth() + 1;
    const anoAtual = new Date().getFullYear();
    
    try {
        const eventos = await db.query(`
            SELECT * FROM eventos 
            WHERE strftime('%m', data) = ? AND strftime('%Y', data) = ?
            ORDER BY data, horario
        `, [mesAtual.toString().padStart(2, '0'), anoAtual.toString()]);
        
        res.json(eventos);
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// ========== ROTAS ADMIN ==========

// Login admin
app.post('/api/admin/login', async (req, res) => {
    const { usuario, senha } = req.body;
    
    try {
        const admin = await db.get(
            "SELECT * FROM admin WHERE usuario = ?",
            [usuario]
        );
        
        if (!admin) {
            return res.status(401).json({ erro: 'Usuário não encontrado' });
        }
        
        const senhaValida = bcrypt.compareSync(senha, admin.senha);
        if (!senhaValida) {
            return res.status(401).json({ erro: 'Senha incorreta' });
        }
        
        const token = jwt.sign(
            { id: admin.id, usuario: admin.usuario, nome: admin.nome },
            JWT_SECRET,
            { expiresIn: '8h' }
        );
        
        // Atualizar último acesso
        await db.run(
            "UPDATE admin SET ultimo_acesso = datetime('now') WHERE id = ?",
            [admin.id]
        );
        
        res.json({
            token,
            admin: {
                id: admin.id,
                usuario: admin.usuario,
                nome: admin.nome
            }
        });
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// Middleware de autenticação admin
const autenticarAdmin = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ erro: 'Token não fornecido' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ erro: 'Token inválido' });
    }
};

// Dashboard admin
app.get('/api/admin/dashboard', autenticarAdmin, async (req, res) => {
    try {
        const [membros, escalas, avisos, eventos] = await Promise.all([
            db.get("SELECT COUNT(*) as total FROM membros"),
            db.get("SELECT COUNT(*) as total FROM escalas WHERE data >= date('now')"),
            db.get("SELECT COUNT(*) as total FROM avisos WHERE importancia = 'alta'"),
            db.get("SELECT COUNT(*) as total FROM eventos WHERE data >= date('now')")
        ]);
        
        res.json({
            membros: membros?.total || 0,
            escalas: escalas?.total || 0,
            avisos: avisos?.total || 0,
            eventos: eventos?.total || 0
        });
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// CRUD Membros (admin)
app.get('/api/admin/membros', autenticarAdmin, async (req, res) => {
    try {
        const membros = await db.query("SELECT * FROM membros ORDER BY nome");
        res.json(membros);
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.post('/api/admin/membros', autenticarAdmin, async (req, res) => {
    const { nome, email, senha, data_nascimento, telefone, funcao } = req.body;
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(senha || '123456', salt);
    const data_cadastro = new Date().toISOString().split('T')[0];
    
    try {
        const result = await db.run(
            "INSERT INTO membros (nome, email, senha, data_nascimento, telefone, funcao, data_cadastro) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [nome, email, hash, data_nascimento, telefone, funcao, data_cadastro]
        );
        res.json({ id: result.id, success: true });
    } catch (error) {
        res.status(400).json({ erro: 'Email já cadastrado' });
    }
});

app.put('/api/admin/membros/:id', autenticarAdmin, async (req, res) => {
    const { nome, email, data_nascimento, telefone, funcao, ativo } = req.body;
    
    try {
        await db.run(
            "UPDATE membros SET nome = ?, email = ?, data_nascimento = ?, telefone = ?, funcao = ?, ativo = ? WHERE id = ?",
            [nome, email, data_nascimento, telefone, funcao, ativo, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

app.delete('/api/admin/membros/:id', autenticarAdmin, async (req, res) => {
    try {
        await db.run("DELETE FROM membros WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// CRUD Escalas (admin)
app.get('/api/admin/escalas', autenticarAdmin, async (req, res) => {
    const { mes, ano } = req.query;
    let query = `
        SELECT e.*, 
               m1.nome as membro1_nome,
               m2.nome as membro2_nome
        FROM escalas e
        LEFT JOIN membros m1 ON e.membro1_id = m1.id
        LEFT JOIN membros m2 ON e.membro2_id = m2.id
    `;
    let params = [];
    
    if (mes && ano) {
        query += " WHERE strftime('%m', e.data) = ? AND strftime('%Y', e.data) = ?";
        params = [mes.padStart(2, '0'), ano];
    }
    
    query += " ORDER BY e.data DESC";
    
    try {
        const escalas = await db.query(query, params);
        res.json(escalas);
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.post('/api/admin/escalas', autenticarAdmin, async (req, res) => {
    const { data, horario, funcao, membro1_id, membro2_id, observacoes } = req.body;
    
    try {
        const result = await db.run(
            "INSERT INTO escalas (data, horario, funcao, membro1_id, membro2_id, observacoes) VALUES (?, ?, ?, ?, ?, ?)",
            [data, horario, funcao, membro1_id, membro2_id || null, observacoes]
        );
        res.json({ id: result.id, success: true });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

app.put('/api/admin/escalas/:id', autenticarAdmin, async (req, res) => {
    const { data, horario, funcao, membro1_id, membro2_id, observacoes } = req.body;
    
    try {
        await db.run(
            "UPDATE escalas SET data = ?, horario = ?, funcao = ?, membro1_id = ?, membro2_id = ?, observacoes = ? WHERE id = ?",
            [data, horario, funcao, membro1_id, membro2_id || null, observacoes, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

app.delete('/api/admin/escalas/:id', autenticarAdmin, async (req, res) => {
    try {
        await db.run("DELETE FROM escalas WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// CRUD Avisos (admin)
app.get('/api/admin/avisos', autenticarAdmin, async (req, res) => {
    try {
        const avisos = await db.query(`
            SELECT * FROM avisos 
            ORDER BY 
                CASE importancia 
                    WHEN 'alta' THEN 1 
                    WHEN 'media' THEN 2 
                    WHEN 'baixa' THEN 3 
                END, 
                data DESC
        `);
        res.json(avisos);
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.post('/api/admin/avisos', autenticarAdmin, async (req, res) => {
    const { titulo, mensagem, importancia, autor } = req.body;
    const data = new Date().toISOString().split('T')[0];
    
    try {
        const result = await db.run(
            "INSERT INTO avisos (titulo, mensagem, importancia, data, autor) VALUES (?, ?, ?, ?, ?)",
            [titulo, mensagem, importancia, data, autor]
        );
        res.json({ id: result.id, success: true });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

app.put('/api/admin/avisos/:id', autenticarAdmin, async (req, res) => {
    const { titulo, mensagem, importancia } = req.body;
    
    try {
        await db.run(
            "UPDATE avisos SET titulo = ?, mensagem = ?, importancia = ? WHERE id = ?",
            [titulo, mensagem, importancia, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

app.delete('/api/admin/avisos/:id', autenticarAdmin, async (req, res) => {
    try {
        await db.run("DELETE FROM avisos WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// CRUD Eventos (admin)
app.get('/api/admin/eventos', autenticarAdmin, async (req, res) => {
    try {
        const eventos = await db.query("SELECT * FROM eventos ORDER BY data, horario");
        res.json(eventos);
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.post('/api/admin/eventos', autenticarAdmin, async (req, res) => {
    const { titulo, data, horario, descricao, local } = req.body;
    
    try {
        const result = await db.run(
            "INSERT INTO eventos (titulo, data, horario, descricao, local) VALUES (?, ?, ?, ?, ?)",
            [titulo, data, horario, descricao, local]
        );
        res.json({ id: result.id, success: true });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

app.put('/api/admin/eventos/:id', autenticarAdmin, async (req, res) => {
    const { titulo, data, horario, descricao, local } = req.body;
    
    try {
        await db.run(
            "UPDATE eventos SET titulo = ?, data = ?, horario = ?, descricao = ?, local = ? WHERE id = ?",
            [titulo, data, horario, descricao, local, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

app.delete('/api/admin/eventos/:id', autenticarAdmin, async (req, res) => {
    try {
        await db.run("DELETE FROM eventos WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// Configurações (admin)
app.get('/api/admin/configuracoes', autenticarAdmin, async (req, res) => {
    try {
        const configs = await db.query("SELECT * FROM configuracoes");
        const config = {};
        configs.forEach(row => config[row.chave] = row.valor);
        res.json(config);
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.post('/api/admin/configuracoes', autenticarAdmin, async (req, res) => {
    const { proximoCulto } = req.body;
    
    try {
        await db.run(
            "INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)",
            ['proximo_culto', proximoCulto]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// ========== ROTAS DE REDIRECIONAMENTO ==========

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>CEA Betel - Sistema Unificado</title>
            <style>
                body {
                    font-family: 'Segoe UI', sans-serif;
                    background: linear-gradient(135deg, #003b7d 0%, #0066b3 100%);
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    margin: 0;
                    padding: 20px;
                }
                .container {
                    max-width: 800px;
                    text-align: center;
                    color: white;
                }
                h1 {
                    font-size: 48px;
                    margin-bottom: 10px;
                }
                .subtitle {
                    font-size: 18px;
                    opacity: 0.9;
                    margin-bottom: 40px;
                }
                .cards {
                    display: flex;
                    gap: 30px;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                .card {
                    background: white;
                    border-radius: 20px;
                    padding: 40px;
                    width: 300px;
                    cursor: pointer;
                    transition: transform 0.3s, box-shadow 0.3s;
                    color: #003b7d;
                }
                .card:hover {
                    transform: translateY(-10px);
                    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                }
                .icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                }
                .card h2 {
                    margin-bottom: 15px;
                }
                .card p {
                    color: #666;
                    margin-bottom: 20px;
                }
                .btn {
                    display: inline-block;
                    padding: 10px 30px;
                    background: linear-gradient(135deg, #003b7d 0%, #0066b3 100%);
                    color: white;
                    text-decoration: none;
                    border-radius: 25px;
                    font-weight: 600;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🌟 CEA Betel</h1>
                <div class="subtitle">Sistema Unificado - Comunidade Evangélica Ágape</div>
                
                <div class="cards">
                    <div class="card" onclick="window.location.href='/app-membro'">
                        <div class="icon">📱</div>
                        <h2>App dos Membros</h2>
                        <p>Acesse sua escala, avisos, aniversariantes e eventos da igreja</p>
                        <span class="btn">Entrar como Membro</span>
                    </div>
                    
                    <div class="card" onclick="window.location.href='/admin'">
                        <div class="icon">🔧</div>
                        <h2>Painel Administrativo</h2>
                        <p>Gerencie membros, escalas, avisos e eventos da igreja</p>
                        <span class="btn">Entrar como Admin</span>
                    </div>
                </div>
                
                <div style="margin-top: 40px; opacity: 0.7;">
                    <p>Escolha uma das opções acima para acessar o sistema</p>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('🌟 CEA BETEL - SISTEMA UNIFICADO');
    console.log('='.repeat(50));
    console.log(`📱 App Membros: http://localhost:${PORT}/app-membro`);
    console.log(`🔧 Painel Admin: http://localhost:${PORT}/admin`);
    console.log(`🏠 Página Inicial: http://localhost:${PORT}`);
    console.log('='.repeat(50));
    console.log('👤 Admin: admin / admin123');
    console.log('👤 Membros: joao@email.com / 123456');
    console.log('='.repeat(50) + '\n');
});