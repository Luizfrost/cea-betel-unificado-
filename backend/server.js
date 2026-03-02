import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import webPush from 'web-push';
import db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'cea-betel-bertioga-secret-2025';
const BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://cea-betel-app.onrender.com' 
    : 'http://localhost:3000';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Configuração de email
let transporter = null;

async function configurarEmail() {
    const emailHost = await db.get("SELECT valor FROM configuracoes WHERE chave = 'email_smtp'");
    const emailPort = await db.get("SELECT valor FROM configuracoes WHERE chave = 'email_port'");
    const emailUser = await db.get("SELECT valor FROM configuracoes WHERE chave = 'email_user'");
    const emailPass = await db.get("SELECT valor FROM configuracoes WHERE chave = 'email_pass'");
    
    if (emailUser?.valor && emailPass?.valor) {
        transporter = nodemailer.createTransport({
            host: emailHost?.valor || 'smtp.gmail.com',
            port: emailPort?.valor || 587,
            secure: false,
            auth: {
                user: emailUser.valor,
                pass: emailPass.valor
            }
        });
        console.log('✅ Email configurado');
    } else {
        console.log('⚠️ Email não configurado');
    }
}

configurarEmail();

// Configuração Web Push
async function configurarWebPush() {
    const publicKey = await db.get("SELECT valor FROM configuracoes WHERE chave = 'vapid_public_key'");
    const privateKey = await db.get("SELECT valor FROM configuracoes WHERE chave = 'vapid_private_key'");
    
    if (publicKey?.valor && privateKey?.valor) {
        webPush.setVapidDetails(
            'mailto:admin@ceabetel.com.br',
            publicKey.valor,
            privateKey.valor
        );
        console.log('✅ Web Push configurado');
    } else {
        console.log('⚠️ Web Push não configurado');
    }
}

configurarWebPush();

// ========== MIDDLEWARE DE AUTENTICAÇÃO ==========
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

// ========== ROTAS DE RECUPERAÇÃO DE SENHA ==========

// Solicitar recuperação de senha
app.post('/api/recuperar-senha', async (req, res) => {
    const { email } = req.body;
    
    try {
        const membro = await db.get("SELECT * FROM membros WHERE email = ?", [email]);
        
        if (!membro) {
            return res.status(404).json({ erro: 'Email não encontrado' });
        }
        
        // Gerar token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 3600000).toISOString(); // 1 hora
        
        await db.run(
            "UPDATE membros SET reset_token = ?, reset_expires = ? WHERE id = ?",
            [resetToken, resetExpires, membro.id]
        );
        
        // Enviar email
        if (transporter) {
            const resetLink = `${BASE_URL}/resetar-senha?token=${resetToken}`;
            
            await transporter.sendMail({
                from: '"CEA Betel Bertioga" <ceabetel@gmail.com>',
                to: email,
                subject: 'Recuperação de Senha - CEA Betel Bertioga',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #003b7d;">Recuperação de Senha</h2>
                        <p>Olá ${membro.nome},</p>
                        <p>Recebemos uma solicitação para redefinir sua senha.</p>
                        <p>Clique no link abaixo para criar uma nova senha:</p>
                        <p>
                            <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background: #0066b3; color: white; text-decoration: none; border-radius: 5px;">
                                Redefinir Senha
                            </a>
                        </p>
                        <p>Se você não solicitou esta recuperação, ignore este email.</p>
                        <p>Este link expira em 1 hora.</p>
                        <hr>
                        <p style="color: #666;">CEA Betel Bertioga - Comunidade Evangélica Ágape</p>
                    </div>
                `
            });
        }
        
        await db.run(
            "INSERT INTO logs (usuario, acao, data, hora) VALUES (?, ?, ?, ?)",
            [membro.nome, 'Solicitou recuperação de senha', new Date().toISOString().split('T')[0], new Date().toTimeString().split(' ')[0]]
        );
        
        res.json({ success: true, mensagem: 'Email de recuperação enviado!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao processar recuperação' });
    }
});

// Validar token de recuperação
app.get('/api/validar-token/:token', async (req, res) => {
    const { token } = req.params;
    
    try {
        const membro = await db.get(
            "SELECT * FROM membros WHERE reset_token = ? AND reset_expires > ?",
            [token, new Date().toISOString()]
        );
        
        if (!membro) {
            return res.status(400).json({ erro: 'Token inválido ou expirado' });
        }
        
        res.json({ success: true, email: membro.email });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao validar token' });
    }
});

// Redefinir senha
app.post('/api/redefinir-senha', async (req, res) => {
    const { token, novaSenha } = req.body;
    
    try {
        const membro = await db.get(
            "SELECT * FROM membros WHERE reset_token = ? AND reset_expires > ?",
            [token, new Date().toISOString()]
        );
        
        if (!membro) {
            return res.status(400).json({ erro: 'Token inválido ou expirado' });
        }
        
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(novaSenha, salt);
        
        await db.run(
            "UPDATE membros SET senha = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?",
            [hash, membro.id]
        );
        
        await db.run(
            "INSERT INTO logs (usuario, acao, data, hora) VALUES (?, ?, ?, ?)",
            [membro.nome, 'Redefiniu a senha', new Date().toISOString().split('T')[0], new Date().toTimeString().split(' ')[0]]
        );
        
        res.json({ success: true, mensagem: 'Senha redefinida com sucesso!' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao redefinir senha' });
    }
});

// ========== ROTAS DE NOTIFICAÇÕES PUSH ==========

// Inscrever para notificações
app.post('/api/push/subscribe', async (req, res) => {
    const { subscription, membroId } = req.body;
    
    try {
        await db.run(
            "INSERT INTO push_subscriptions (membro_id, subscription, data) VALUES (?, ?, ?)",
            [membroId, JSON.stringify(subscription), new Date().toISOString()]
        );
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao inscrever' });
    }
});

// Cancelar inscrição
app.post('/api/push/unsubscribe', async (req, res) => {
    const { membroId } = req.body;
    
    try {
        await db.run("DELETE FROM push_subscriptions WHERE membro_id = ?", [membroId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao cancelar inscrição' });
    }
});

// Enviar notificação para todos os membros
async function enviarNotificacao(titulo, mensagem, url) {
    try {
        const subscriptions = await db.query("SELECT * FROM push_subscriptions");
        
        const payload = JSON.stringify({
            title: titulo,
            body: mensagem,
            icon: '/assets/icon-192.png',
            badge: '/assets/icon-192.png',
            url: url
        });
        
        subscriptions.forEach(sub => {
            try {
                webPush.sendNotification(JSON.parse(sub.subscription), payload)
                    .catch(err => console.log('Erro ao enviar push:', err));
            } catch (e) {
                console.log('Erro na subscription:', e);
            }
        });
    } catch (error) {
        console.error('Erro ao enviar notificações:', error);
    }
}

// ========== ROTAS ADMIN - LOGIN ==========
app.post('/api/admin/login', async (req, res) => {
    const { usuario, senha } = req.body;
    
    try {
        const admin = await db.get("SELECT * FROM admin WHERE usuario = ?", [usuario]);
        
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
        
        await db.run("UPDATE admin SET ultimo_acesso = datetime('now') WHERE id = ?", [admin.id]);
        
        res.json({
            token,
            admin: {
                id: admin.id,
                usuario: admin.usuario,
                nome: admin.nome,
                email: admin.email
            }
        });
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// ========== ROTAS ADMIN - DASHBOARD ==========
app.get('/api/admin/dashboard', autenticarAdmin, async (req, res) => {
    try {
        const [membros, escalas, avisos, eventos, financeiro] = await Promise.all([
            db.get("SELECT COUNT(*) as total FROM membros"),
            db.get("SELECT COUNT(*) as total FROM escalas WHERE data >= date('now')"),
            db.get("SELECT COUNT(*) as total FROM avisos WHERE importancia = 'alta'"),
            db.get("SELECT COUNT(*) as total FROM eventos WHERE data >= date('now')"),
            db.get("SELECT SUM(valor) as total FROM financeiro WHERE data >= date('now', 'start of month')")
        ]);
        
        res.json({
            membros: membros?.total || 0,
            escalas: escalas?.total || 0,
            avisos: avisos?.total || 0,
            eventos: eventos?.total || 0,
            financeiro: financeiro?.total || 0
        });
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// ========== ROTAS ADMIN - MEMBROS ==========
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
    const permissoes = JSON.stringify({
        verEscalas: true,
        verAvisos: true,
        verEventos: true,
        verAniversariantes: true
    });
    
    try {
        const result = await db.run(
            "INSERT INTO membros (nome, email, senha, data_nascimento, telefone, funcao, permissoes, data_cadastro) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [nome, email, hash, data_nascimento, telefone, funcao, permissoes, data_cadastro]
        );
        
        await db.run(
            "INSERT INTO logs (usuario, acao, dados, data, hora) VALUES (?, ?, ?, ?, ?)",
            [req.admin.usuario, 'criou_membro', `Membro ${nome} criado`, new Date().toISOString().split('T')[0], new Date().toTimeString().split(' ')[0]]
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

// ========== ROTAS ADMIN - PERMISSÕES ==========
app.get('/api/admin/membros/:id/permissoes', autenticarAdmin, async (req, res) => {
    try {
        const membro = await db.get("SELECT id, nome, email, permissoes FROM membros WHERE id = ?", [req.params.id]);
        res.json({
            id: membro.id,
            nome: membro.nome,
            email: membro.email,
            permissoes: JSON.parse(membro.permissoes)
        });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar permissões' });
    }
});

app.put('/api/admin/membros/:id/permissoes', autenticarAdmin, async (req, res) => {
    const { permissoes } = req.body;
    
    try {
        await db.run(
            "UPDATE membros SET permissoes = ? WHERE id = ?",
            [JSON.stringify(permissoes), req.params.id]
        );
        
        res.json({ success: true, mensagem: 'Permissões atualizadas!' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao atualizar permissões' });
    }
});

// ========== ROTAS ADMIN - ESCALAS ==========
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
        
        // Buscar nomes para log
        const membro1 = membro1_id ? await db.get("SELECT nome FROM membros WHERE id = ?", [membro1_id]) : null;
        const membro2 = membro2_id ? await db.get("SELECT nome FROM membros WHERE id = ?", [membro2_id]) : null;
        
        await db.run(
            "INSERT INTO logs (usuario, acao, dados, data, hora) VALUES (?, ?, ?, ?, ?)",
            [req.admin.usuario, 'criou_escala', `Escala ${data} - ${funcao}: ${membro1?.nome || ''} ${membro2?.nome || ''}`, new Date().toISOString().split('T')[0], new Date().toTimeString().split(' ')[0]]
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

// ========== ROTAS ADMIN - AVISOS ==========
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
        
        await db.run(
            "INSERT INTO logs (usuario, acao, dados, data, hora) VALUES (?, ?, ?, ?, ?)",
            [req.admin.usuario, 'criou_aviso', `Aviso: ${titulo}`, new Date().toISOString().split('T')[0], new Date().toTimeString().split(' ')[0]]
        );
        
        // Enviar notificações push
        await enviarNotificacao(
            '📢 Novo Aviso - CEA Betel',
            importancia === 'alta' ? `🔴 ${titulo}` : titulo,
            '/app-membro'
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

// ========== ROTAS ADMIN - FINANCEIRO ==========
app.get('/api/admin/financeiro', autenticarAdmin, async (req, res) => {
    const { mes, ano } = req.query;
    let query = `
        SELECT f.*, m.nome as membro_nome 
        FROM financeiro f
        LEFT JOIN membros m ON f.membro_id = m.id
    `;
    let params = [];
    
    if (mes && ano) {
        query += " WHERE strftime('%m', f.data) = ? AND strftime('%Y', f.data) = ?";
        params = [mes.padStart(2, '0'), ano];
    }
    
    query += " ORDER BY f.data DESC";
    
    try {
        const registros = await db.query(query, params);
        
        // Totais
        const totais = await db.get(`
            SELECT 
                SUM(CASE WHEN tipo = 'dizimo' THEN valor ELSE 0 END) as total_dizimos,
                SUM(CASE WHEN tipo = 'oferta' THEN valor ELSE 0 END) as total_ofertas,
                SUM(CASE WHEN tipo = 'outros' THEN valor ELSE 0 END) as total_outros,
                SUM(valor) as total_geral
            FROM financeiro
            WHERE strftime('%m', data) = ? AND strftime('%Y', data) = ?
        `, [mes?.padStart(2, '0') || new Date().getMonth() + 1, ano || new Date().getFullYear()]);
        
        res.json({
            registros,
            totais: totais || { total_dizimos: 0, total_ofertas: 0, total_outros: 0, total_geral: 0 }
        });
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

app.post('/api/admin/financeiro', autenticarAdmin, async (req, res) => {
    const { tipo, membro_id, valor, data, descricao, comprovante } = req.body;
    
    try {
        const result = await db.run(
            "INSERT INTO financeiro (tipo, membro_id, valor, data, descricao, comprovante) VALUES (?, ?, ?, ?, ?, ?)",
            [tipo, membro_id || null, valor, data, descricao, comprovante || null]
        );
        
        const membro = membro_id ? await db.get("SELECT nome FROM membros WHERE id = ?", [membro_id]) : null;
        
        await db.run(
            "INSERT INTO logs (usuario, acao, dados, data, hora) VALUES (?, ?, ?, ?, ?)",
            [req.admin.usuario, 'criou_financeiro', `${tipo} de R$ ${valor} - ${membro?.nome || 'Anônimo'}`, new Date().toISOString().split('T')[0], new Date().toTimeString().split(' ')[0]]
        );
        
        res.json({ id: result.id, success: true });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

app.delete('/api/admin/financeiro/:id', autenticarAdmin, async (req, res) => {
    try {
        await db.run("DELETE FROM financeiro WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

app.get('/api/admin/financeiro/relatorio', autenticarAdmin, async (req, res) => {
    const { ano } = req.query;
    
    try {
        const relatorio = await db.query(`
            SELECT 
                strftime('%m', data) as mes,
                SUM(CASE WHEN tipo = 'dizimo' THEN valor ELSE 0 END) as dizimos,
                SUM(CASE WHEN tipo = 'oferta' THEN valor ELSE 0 END) as ofertas,
                SUM(CASE WHEN tipo = 'outros' THEN valor ELSE 0 END) as outros,
                SUM(valor) as total
            FROM financeiro
            WHERE strftime('%Y', data) = ?
            GROUP BY strftime('%m', data)
            ORDER BY mes
        `, [ano || new Date().getFullYear()]);
        
        res.json(relatorio);
    } catch (error) {
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// ========== ROTAS ADMIN - EVENTOS ==========
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
        
        await db.run(
            "INSERT INTO logs (usuario, acao, dados, data, hora) VALUES (?, ?, ?, ?, ?)",
            [req.admin.usuario, 'criou_evento', `Evento: ${titulo}`, new Date().toISOString().split('T')[0], new Date().toTimeString().split(' ')[0]]
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

// ========== ROTAS ADMIN - CONFIGURAÇÕES ==========
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
    const { chave, valor } = req.body;
    
    try {
        await db.run(
            "INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)",
            [chave, valor]
        );
        
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// ========== ROTAS ADMIN - ALTERAR SENHA ==========
app.post('/api/admin/alterar-senha', autenticarAdmin, async (req, res) => {
    const { senhaAtual, novaSenha } = req.body;
    
    try {
        const admin = await db.get("SELECT * FROM admin WHERE id = ?", [req.admin.id]);
        
        const senhaValida = bcrypt.compareSync(senhaAtual, admin.senha);
        if (!senhaValida) {
            return res.status(401).json({ erro: 'Senha atual incorreta' });
        }
        
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(novaSenha, salt);
        
        await db.run("UPDATE admin SET senha = ? WHERE id = ?", [hash, req.admin.id]);
        
        await db.run(
            "INSERT INTO logs (usuario, acao, data, hora) VALUES (?, ?, ?, ?)",
            [req.admin.usuario, 'Alterou a própria senha', new Date().toISOString().split('T')[0], new Date().toTimeString().split(' ')[0]]
        );
        
        res.json({ success: true, mensagem: 'Senha alterada com sucesso!' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao alterar senha' });
    }
});

// ========== ROTAS ADMIN - PIX ==========
app.get('/api/admin/pix', autenticarAdmin, async (req, res) => {
    try {
        const pix = await db.get("SELECT valor FROM configuracoes WHERE chave = 'pix'");
        res.json({ pix: pix?.valor || '' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar PIX' });
    }
});

app.post('/api/admin/pix', autenticarAdmin, async (req, res) => {
    const { pix } = req.body;
    
    try {
        await db.run(
            "INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)",
            ['pix', pix]
        );
        
        res.json({ success: true, mensagem: 'PIX atualizado com sucesso!' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao salvar PIX' });
    }
});

// ========== ROTAS ADMIN - LOGS ==========
app.get('/api/admin/logs', autenticarAdmin, async (req, res) => {
    try {
        const logs = await db.query("SELECT * FROM logs ORDER BY data DESC, hora DESC LIMIT 100");
        res.json(logs);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar logs' });
    }
});

// ========== ROTAS ADMIN - CONFIGURAR EMAIL ==========
app.post('/api/admin/configurar-email', autenticarAdmin, async (req, res) => {
    const { email_user, email_pass, email_smtp, email_port } = req.body;
    
    try {
        await db.run("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)", ['email_user', email_user]);
        await db.run("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)", ['email_pass', email_pass]);
        await db.run("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)", ['email_smtp', email_smtp || 'smtp.gmail.com']);
        await db.run("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)", ['email_port', email_port || '587']);
        
        // Reconfigurar transporter
        await configurarEmail();
        
        res.json({ success: true, mensagem: 'Email configurado com sucesso!' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao configurar email' });
    }
});

// ========== ROTAS ADMIN - CONFIGURAR WEB PUSH ==========
app.get('/api/admin/vapid-keys', autenticarAdmin, async (req, res) => {
    try {
        const publicKey = await db.get("SELECT valor FROM configuracoes WHERE chave = 'vapid_public_key'");
        const privateKey = await db.get("SELECT valor FROM configuracoes WHERE chave = 'vapid_private_key'");
        
        if (!publicKey?.valor || !privateKey?.valor) {
            // Gerar novas chaves
            const vapidKeys = webPush.generateVAPIDKeys();
            
            await db.run("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)", ['vapid_public_key', vapidKeys.publicKey]);
            await db.run("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)", ['vapid_private_key', vapidKeys.privateKey]);
            
            res.json({ publicKey: vapidKeys.publicKey, privateKey: vapidKeys.privateKey });
        } else {
            res.json({ publicKey: publicKey.valor, privateKey: privateKey.valor });
        }
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao gerar chaves VAPID' });
    }
});

// ========== ROTAS DOS MEMBROS ==========

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
        
        await db.run(
            "INSERT INTO logs (usuario, acao, data, hora) VALUES (?, ?, ?, ?)",
            [membro.nome, 'Login no app', new Date().toISOString().split('T')[0], new Date().toTimeString().split(' ')[0]]
        );
        
        res.json({
            id: membro.id,
            nome: membro.nome,
            email: membro.email,
            funcao: membro.funcao,
            data_nascimento: membro.data_nascimento,
            permissoes: JSON.parse(membro.permissoes)
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
            WHERE (e.membro1_id = ? OR e.membro2_id = ?) AND e.data >= date('now')
            ORDER BY e.data
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
            SELECT id, nome, data_nascimento 
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

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('⛪ CEA BETEL BERTIOGA - SISTEMA UNIFICADO');
    console.log('='.repeat(50));
    console.log(`📱 App Membros: http://localhost:${PORT}/app-membro`);
    console.log(`🔧 Painel Admin: http://localhost:${PORT}/admin`);
    console.log(`🏠 Página Inicial: http://localhost:${PORT}`);
    console.log('='.repeat(50));
    console.log('👤 Admin: admin / admin123');
    console.log('👤 Membros: joao@email.com / 123456');
    console.log('='.repeat(50));
    console.log('📧 Recuperação de senha por email');
    console.log('💰 Relatórios financeiros');
    console.log('🔔 Notificações push');
    console.log('='.repeat(50) + '\n');
});