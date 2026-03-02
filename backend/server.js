// ============================================
// SERVER PRINCIPAL - CEA BETEL BERTIOGA
// ============================================

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import db from './database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cea-betel-secret-key-2025';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== CONFIGURAÇÃO DE ARQUIVOS ESTÁTICOS ==========
// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, '../public')));

// Rota específica para o app dos membros
app.use('/app-membro', express.static(path.join(__dirname, '../public/app-membro')));

// Rota específica para o admin
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

// Rota principal - redireciona para app-membro
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/app-membro/index.html'));
});

// Rota para o app-membro
app.get('/app-membro', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/app-membro/index.html'));
});

// Rota para o admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// ========== ROTAS PÚBLICAS (APP MEMBROS) ==========

// Login do membro
app.post('/api/membros/login', async (req, res) => {
    const { email, senha } = req.body;
    
    try {
        const membro = await db.get(
            "SELECT * FROM membros WHERE email = $1 AND ativo = true",
            [email]
        );
        
        if (!membro) {
            return res.status(401).json({ erro: 'E-mail não encontrado' });
        }
        
        const senhaValida = bcrypt.compareSync(senha, membro.senha);
        if (!senhaValida) {
            return res.status(401).json({ erro: 'Senha incorreta' });
        }
        
        // Registrar log
        await db.run(
            "INSERT INTO logs (usuario, acao) VALUES ($1, $2)",
            [membro.nome, 'Login no app']
        );
        
        res.json({
            id: membro.id,
            nome: membro.nome,
            email: membro.email,
            funcao: membro.funcao,
            data_nascimento: membro.data_nascimento,
            permissoes: membro.permissoes
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// Home do membro
app.get('/api/membros/home/:membroId', async (req, res) => {
    const { membroId } = req.params;
    
    try {
        const [culto, avisos, escalaHoje] = await Promise.all([
            db.get("SELECT valor FROM configuracoes WHERE chave = $1", ['proximo_culto']),
            db.query("SELECT * FROM avisos WHERE importancia = 'alta' ORDER BY data DESC LIMIT 3"),
            db.get(
                "SELECT * FROM escalas WHERE data = CURRENT_DATE AND (membro1_id = $1 OR membro2_id = $1)",
                [membroId]
            )
        ]);
        
        res.json({
            proximoCulto: culto?.valor || 'Domingo, 19:00',
            estaEscalado: !!escalaHoje,
            avisosImportantes: avisos || []
        });
    } catch (error) {
        console.error('Erro na home:', error);
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
            WHERE (e.membro1_id = $1 OR e.membro2_id = $1) AND e.data >= CURRENT_DATE
            ORDER BY e.data
        `, [membroId]);
        
        res.json(escalas);
    } catch (error) {
        console.error('Erro nas escalas:', error);
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
        console.error('Erro nos avisos:', error);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// Aniversariantes do mês
app.get('/api/membros/aniversariantes', async (req, res) => {
    const mesAtual = new Date().getMonth() + 1;
    
    try {
        const aniversariantes = await db.query(`
            SELECT id, nome, data_nascimento 
            FROM membros 
            WHERE EXTRACT(MONTH FROM data_nascimento) = $1
            ORDER BY EXTRACT(DAY FROM data_nascimento)
        `, [mesAtual]);
        
        res.json(aniversariantes);
    } catch (error) {
        console.error('Erro nos aniversariantes:', error);
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
            WHERE EXTRACT(MONTH FROM data) = $1 AND EXTRACT(YEAR FROM data) = $2
            ORDER BY data, horario
        `, [mesAtual, anoAtual]);
        
        res.json(eventos);
    } catch (error) {
        console.error('Erro nos eventos:', error);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// ========== ROTAS ADMIN ==========

// Login admin
app.post('/api/admin/login', async (req, res) => {
    const { usuario, senha } = req.body;
    
    try {
        const admin = await db.get(
            "SELECT * FROM admin WHERE usuario = $1",
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
            "UPDATE admin SET ultimo_acesso = CURRENT_TIMESTAMP WHERE id = $1",
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
        console.error('Erro no login admin:', error);
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
        const [membros, escalas, avisos, eventos, financeiro] = await Promise.all([
            db.get("SELECT COUNT(*) as total FROM membros"),
            db.get("SELECT COUNT(*) as total FROM escalas WHERE data >= CURRENT_DATE"),
            db.get("SELECT COUNT(*) as total FROM avisos WHERE importancia = 'alta'"),
            db.get("SELECT COUNT(*) as total FROM eventos WHERE data >= CURRENT_DATE"),
            db.get("SELECT COALESCE(SUM(valor), 0) as total FROM financeiro WHERE EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE)")
        ]);
        
        res.json({
            membros: parseInt(membros?.total) || 0,
            escalas: parseInt(escalas?.total) || 0,
            avisos: parseInt(avisos?.total) || 0,
            eventos: parseInt(eventos?.total) || 0,
            financeiro: parseFloat(financeiro?.total) || 0
        });
    } catch (error) {
        console.error('Erro no dashboard:', error);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// CRUD Membros
app.get('/api/admin/membros', autenticarAdmin, async (req, res) => {
    try {
        const membros = await db.query("SELECT * FROM membros ORDER BY nome");
        res.json(membros);
    } catch (error) {
        console.error('Erro ao listar membros:', error);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.post('/api/admin/membros', autenticarAdmin, async (req, res) => {
    const { nome, email, senha, data_nascimento, telefone, funcao } = req.body;
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(senha || '123456', salt);
    
    try {
        const result = await db.run(
            "INSERT INTO membros (nome, email, senha, data_nascimento, telefone, funcao) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            [nome, email, hash, data_nascimento, telefone, funcao]
        );
        
        await db.run(
            "INSERT INTO logs (usuario, acao, dados) VALUES ($1, $2, $3)",
            [req.admin.usuario, 'criou_membro', `Membro ${nome} criado`]
        );
        
        res.json({ id: result.id, success: true });
    } catch (error) {
        console.error('Erro ao criar membro:', error);
        res.status(400).json({ erro: 'Email já cadastrado' });
    }
});

app.put('/api/admin/membros/:id', autenticarAdmin, async (req, res) => {
    const { nome, email, data_nascimento, telefone, funcao, ativo } = req.body;
    
    try {
        await db.run(
            "UPDATE membros SET nome = $1, email = $2, data_nascimento = $3, telefone = $4, funcao = $5, ativo = $6 WHERE id = $7",
            [nome, email, data_nascimento, telefone, funcao, ativo, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao atualizar membro:', error);
        res.status(400).json({ erro: error.message });
    }
});

app.delete('/api/admin/membros/:id', autenticarAdmin, async (req, res) => {
    try {
        await db.run("DELETE FROM membros WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao excluir membro:', error);
        res.status(400).json({ erro: error.message });
    }
});

// CRUD Escalas
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
        query += " WHERE EXTRACT(MONTH FROM e.data) = $1 AND EXTRACT(YEAR FROM e.data) = $2";
        params = [mes, ano];
    }
    
    query += " ORDER BY e.data DESC";
    
    try {
        const escalas = await db.query(query, params);
        res.json(escalas);
    } catch (error) {
        console.error('Erro ao listar escalas:', error);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.post('/api/admin/escalas', autenticarAdmin, async (req, res) => {
    const { data, horario, funcao, membro1_id, membro2_id, observacoes } = req.body;
    
    try {
        const result = await db.run(
            "INSERT INTO escalas (data, horario, funcao, membro1_id, membro2_id, observacoes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            [data, horario, funcao, membro1_id, membro2_id || null, observacoes]
        );
        res.json({ id: result.id, success: true });
    } catch (error) {
        console.error('Erro ao criar escala:', error);
        res.status(400).json({ erro: error.message });
    }
});

app.put('/api/admin/escalas/:id', autenticarAdmin, async (req, res) => {
    const { data, horario, funcao, membro1_id, membro2_id, observacoes } = req.body;
    
    try {
        await db.run(
            "UPDATE escalas SET data = $1, horario = $2, funcao = $3, membro1_id = $4, membro2_id = $5, observacoes = $6 WHERE id = $7",
            [data, horario, funcao, membro1_id, membro2_id || null, observacoes, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao atualizar escala:', error);
        res.status(400).json({ erro: error.message });
    }
});

app.delete('/api/admin/escalas/:id', autenticarAdmin, async (req, res) => {
    try {
        await db.run("DELETE FROM escalas WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao excluir escala:', error);
        res.status(400).json({ erro: error.message });
    }
});

// CRUD Avisos
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
        console.error('Erro ao listar avisos:', error);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.post('/api/admin/avisos', autenticarAdmin, async (req, res) => {
    const { titulo, mensagem, importancia, autor } = req.body;
    
    try {
        const result = await db.run(
            "INSERT INTO avisos (titulo, mensagem, importancia, data, autor) VALUES ($1, $2, $3, CURRENT_DATE, $4) RETURNING id",
            [titulo, mensagem, importancia, autor]
        );
        res.json({ id: result.id, success: true });
    } catch (error) {
        console.error('Erro ao criar aviso:', error);
        res.status(400).json({ erro: error.message });
    }
});

app.delete('/api/admin/avisos/:id', autenticarAdmin, async (req, res) => {
    try {
        await db.run("DELETE FROM avisos WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao excluir aviso:', error);
        res.status(400).json({ erro: error.message });
    }
});

// CRUD Eventos
app.get('/api/admin/eventos', autenticarAdmin, async (req, res) => {
    try {
        const eventos = await db.query("SELECT * FROM eventos ORDER BY data, horario");
        res.json(eventos);
    } catch (error) {
        console.error('Erro ao listar eventos:', error);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.post('/api/admin/eventos', autenticarAdmin, async (req, res) => {
    const { titulo, data, horario, descricao, local } = req.body;
    
    try {
        const result = await db.run(
            "INSERT INTO eventos (titulo, data, horario, descricao, local) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            [titulo, data, horario, descricao, local]
        );
        res.json({ id: result.id, success: true });
    } catch (error) {
        console.error('Erro ao criar evento:', error);
        res.status(400).json({ erro: error.message });
    }
});

app.delete('/api/admin/eventos/:id', autenticarAdmin, async (req, res) => {
    try {
        await db.run("DELETE FROM eventos WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao excluir evento:', error);
        res.status(400).json({ erro: error.message });
    }
});

// CRUD Financeiro
app.get('/api/admin/financeiro', autenticarAdmin, async (req, res) => {
    const { mes, ano } = req.query;
    
    try {
        const registros = await db.query(`
            SELECT f.*, m.nome as membro_nome 
            FROM financeiro f
            LEFT JOIN membros m ON f.membro_id = m.id
            WHERE EXTRACT(MONTH FROM f.data) = $1 AND EXTRACT(YEAR FROM f.data) = $2
            ORDER BY f.data DESC
        `, [mes, ano]);
        
        const totais = await db.get(`
            SELECT 
                COALESCE(SUM(CASE WHEN tipo = 'dizimo' THEN valor ELSE 0 END), 0) as total_dizimos,
                COALESCE(SUM(CASE WHEN tipo = 'oferta' THEN valor ELSE 0 END), 0) as total_ofertas,
                COALESCE(SUM(CASE WHEN tipo = 'outros' THEN valor ELSE 0 END), 0) as total_outros,
                COALESCE(SUM(valor), 0) as total_geral
            FROM financeiro
            WHERE EXTRACT(MONTH FROM data) = $1 AND EXTRACT(YEAR FROM data) = $2
        `, [mes, ano]);
        
        res.json({
            registros,
            totais
        });
    } catch (error) {
        console.error('Erro no financeiro:', error);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.post('/api/admin/financeiro', autenticarAdmin, async (req, res) => {
    const { tipo, membro_id, valor, data, descricao } = req.body;
    
    try {
        const result = await db.run(
            "INSERT INTO financeiro (tipo, membro_id, valor, data, descricao) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            [tipo, membro_id || null, valor, data, descricao]
        );
        res.json({ id: result.id, success: true });
    } catch (error) {
        console.error('Erro ao criar registro financeiro:', error);
        res.status(400).json({ erro: error.message });
    }
});

app.delete('/api/admin/financeiro/:id', autenticarAdmin, async (req, res) => {
    try {
        await db.run("DELETE FROM financeiro WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao excluir registro financeiro:', error);
        res.status(400).json({ erro: error.message });
    }
});

// Configurações
app.get('/api/admin/configuracoes', autenticarAdmin, async (req, res) => {
    try {
        const configs = await db.query("SELECT * FROM configuracoes");
        const config = {};
        configs.forEach(row => config[row.chave] = row.valor);
        res.json(config);
    } catch (error) {
        console.error('Erro ao buscar configurações:', error);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.post('/api/admin/configuracoes', autenticarAdmin, async (req, res) => {
    const { chave, valor } = req.body;
    
    try {
        await db.run(
            "INSERT INTO configuracoes (chave, valor) VALUES ($1, $2) ON CONFLICT (chave) DO UPDATE SET valor = $2",
            [chave, valor]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao salvar configuração:', error);
        res.status(400).json({ erro: error.message });
    }
});

// Alterar senha do admin
app.post('/api/admin/alterar-senha', autenticarAdmin, async (req, res) => {
    const { senhaAtual, novaSenha } = req.body;
    
    try {
        const admin = await db.get("SELECT * FROM admin WHERE id = $1", [req.admin.id]);
        
        const senhaValida = bcrypt.compareSync(senhaAtual, admin.senha);
        if (!senhaValida) {
            return res.status(401).json({ erro: 'Senha atual incorreta' });
        }
        
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(novaSenha, salt);
        
        await db.run("UPDATE admin SET senha = $1 WHERE id = $2", [hash, req.admin.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({ erro: 'Erro ao alterar senha' });
    }
});

// Logs
app.get('/api/admin/logs', autenticarAdmin, async (req, res) => {
    try {
        const logs = await db.query("SELECT * FROM logs ORDER BY data DESC, hora DESC LIMIT 100");
        res.json(logs);
    } catch (error) {
        console.error('Erro ao buscar logs:', error);
        res.status(500).json({ erro: 'Erro ao buscar logs' });
    }
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(50));
    console.log('⛪ CEA BETEL BERTIOGA - RENDER');
    console.log('='.repeat(50));
    console.log(`📱 App Membros: http://localhost:${PORT}/app-membro`);
    console.log(`🔧 Painel Admin: http://localhost:${PORT}/admin`);
    console.log('='.repeat(50));
    console.log('👤 Admin: admin / admin123');
    console.log('👤 Membros: joao@email.com / 123456');
    console.log('💾 Banco: PostgreSQL (Neon)');
    console.log('='.repeat(50) + '\n');
});