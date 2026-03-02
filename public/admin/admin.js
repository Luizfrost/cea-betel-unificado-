// ============================================
// CEA BETEL BERTIOGA - PAINEL ADMINISTRATIVO
// ============================================

const Admin = {
    token: localStorage.getItem('adminToken'),
    admin: JSON.parse(localStorage.getItem('admin') || 'null'),
    telaAtual: 'dashboard',
    dados: {
        dashboard: {},
        membros: [],
        escalas: [],
        avisos: [],
        eventos: [],
        financeiro: [],
        totaisFinanceiro: {},
        config: {}
    },
    itemEditando: null,
    filtros: {
        mes: new Date().getMonth() + 1,
        ano: new Date().getFullYear()
    },

    init() {
        if (this.token && this.admin) {
            this.carregarDados();
        } else {
            this.renderizarLogin();
        }
    },

    renderizarLogin() {
        document.getElementById('app').innerHTML = `
            <div class="login-container">
                <div class="login-card">
                    <h1>⛪ CEA Betel Bertioga</h1>
                    <div class="subtitle">Painel Administrativo</div>
                    
                    <div class="input-group">
                        <label><i class="fas fa-user"></i> Usuário</label>
                        <input type="text" id="usuario" placeholder="admin" value="admin">
                    </div>
                    
                    <div class="input-group">
                        <label><i class="fas fa-lock"></i> Senha</label>
                        <input type="password" id="senha" placeholder="••••••" value="admin123">
                    </div>
                    
                    <button class="login-btn" onclick="Admin.login()">
                        <i class="fas fa-sign-in-alt"></i> Entrar
                    </button>
                    
                    <div class="mensagem" id="mensagem"></div>
                </div>
            </div>
        `;
    },

    async login() {
        const usuario = document.getElementById('usuario').value;
        const senha = document.getElementById('senha').value;
        const btnLogin = document.querySelector('.login-btn');
        
        btnLogin.disabled = true;
        btnLogin.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
        
        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario, senha })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.token = data.token;
                this.admin = data.admin;
                localStorage.setItem('adminToken', data.token);
                localStorage.setItem('admin', JSON.stringify(data.admin));
                this.carregarDados();
            } else {
                this.mostrarMensagem('erro', data.erro || 'Erro no login');
                btnLogin.disabled = false;
                btnLogin.innerHTML = 'Entrar';
            }
        } catch (error) {
            this.mostrarMensagem('erro', 'Erro ao conectar');
            btnLogin.disabled = false;
            btnLogin.innerHTML = 'Entrar';
        }
    },

    logout() {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('admin');
        this.token = null;
        this.admin = null;
        this.renderizarLogin();
    },

    async carregarDados() {
        this.renderizarLoading();
        
        try {
            await Promise.all([
                this.carregarDashboard(),
                this.carregarMembros(),
                this.carregarEscalas(),
                this.carregarAvisos(),
                this.carregarEventos(),
                this.carregarFinanceiro(),
                this.carregarConfiguracoes()
            ]);
            
            this.renderizarInterface();
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    },

    async carregarDashboard() {
        const response = await fetch('/api/admin/dashboard', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        this.dados.dashboard = await response.json();
    },

    async carregarMembros() {
        const response = await fetch('/api/admin/membros', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        this.dados.membros = await response.json();
    },

    async carregarEscalas() {
        const response = await fetch(`/api/admin/escalas?mes=${this.filtros.mes}&ano=${this.filtros.ano}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        this.dados.escalas = await response.json();
    },

    async carregarAvisos() {
        const response = await fetch('/api/admin/avisos', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        this.dados.avisos = await response.json();
    },

    async carregarEventos() {
        const response = await fetch('/api/admin/eventos', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        this.dados.eventos = await response.json();
    },

    async carregarFinanceiro() {
        const response = await fetch(`/api/admin/financeiro?mes=${this.filtros.mes}&ano=${this.filtros.ano}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        const data = await response.json();
        this.dados.financeiro = data.registros || [];
        this.dados.totaisFinanceiro = data.totais || {};
    },

    async carregarConfiguracoes() {
        const response = await fetch('/api/admin/configuracoes', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        this.dados.config = await response.json();
    },

    renderizarLoading() {
        document.getElementById('app').innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Carregando painel...</p>
            </div>
        `;
    },

    renderizarInterface() {
        document.getElementById('app').innerHTML = `
            <div class="painel-container">
                <div class="sidebar">
                    <div class="sidebar-header">
                        <h2>⛪ CEA Betel</h2>
                        <p>Bertioga</p>
                    </div>
                    
                    <div class="sidebar-menu">
                        <div class="menu-item ${this.telaAtual === 'dashboard' ? 'active' : ''}" onclick="Admin.mudarTela('dashboard')">
                            <i class="fas fa-home"></i> Dashboard
                        </div>
                        <div class="menu-item ${this.telaAtual === 'membros' ? 'active' : ''}" onclick="Admin.mudarTela('membros')">
                            <i class="fas fa-users"></i> Membros
                        </div>
                        <div class="menu-item ${this.telaAtual === 'escalas' ? 'active' : ''}" onclick="Admin.mudarTela('escalas')">
                            <i class="fas fa-calendar-alt"></i> Escalas
                        </div>
                        <div class="menu-item ${this.telaAtual === 'avisos' ? 'active' : ''}" onclick="Admin.mudarTela('avisos')">
                            <i class="fas fa-bullhorn"></i> Avisos
                        </div>
                        <div class="menu-item ${this.telaAtual === 'eventos' ? 'active' : ''}" onclick="Admin.mudarTela('eventos')">
                            <i class="fas fa-calendar-check"></i> Eventos
                        </div>
                        <div class="menu-item ${this.telaAtual === 'financeiro' ? 'active' : ''}" onclick="Admin.mudarTela('financeiro')">
                            <i class="fas fa-coins"></i> Financeiro
                        </div>
                        <div class="menu-item ${this.telaAtual === 'configuracoes' ? 'active' : ''}" onclick="Admin.mudarTela('configuracoes')">
                            <i class="fas fa-cog"></i> Configurações
                        </div>
                    </div>
                    
                    <div class="sidebar-footer">
                        <div class="user-info">
                            <div class="user-avatar">A</div>
                            <div class="user-details">
                                <div class="user-name">${this.admin.nome}</div>
                                <div class="user-role">Administrador</div>
                            </div>
                        </div>
                        <button class="logout-btn" onclick="Admin.logout()">
                            <i class="fas fa-sign-out-alt"></i> Sair
                        </button>
                    </div>
                </div>
                
                <div class="main-content" id="mainContent">
                    ${this.renderizarTelaAtual()}
                </div>
            </div>
            
            <div class="modal" id="modal">
                <div class="modal-content" id="modalContent"></div>
            </div>
        `;
    },

    mudarTela(tela) {
        this.telaAtual = tela;
        document.getElementById('mainContent').innerHTML = this.renderizarTelaAtual();
        
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        event.currentTarget.classList.add('active');
    },

    renderizarTelaAtual() {
        switch(this.telaAtual) {
            case 'dashboard': return this.renderizarDashboard();
            case 'membros': return this.renderizarMembros();
            case 'escalas': return this.renderizarEscalas();
            case 'avisos': return this.renderizarAvisos();
            case 'eventos': return this.renderizarEventos();
            case 'financeiro': return this.renderizarFinanceiro();
            case 'configuracoes': return this.renderizarConfiguracoes();
            default: return '';
        }
    },

    renderizarDashboard() {
        const dash = this.dados.dashboard || { membros: 0, escalas: 0, avisos: 0, eventos: 0, financeiro: 0 };
        
        return `
            <div class="content-header">
                <h1>Dashboard</h1>
            </div>
            
            <div class="cards-grid">
                <div class="card">
                    <div class="card-icon"><i class="fas fa-users"></i></div>
                    <div class="card-info">
                        <h3>Membros</h3>
                        <div class="card-number">${dash.membros}</div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-icon"><i class="fas fa-calendar-alt"></i></div>
                    <div class="card-info">
                        <h3>Escalas Futuras</h3>
                        <div class="card-number">${dash.escalas}</div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-icon"><i class="fas fa-bullhorn"></i></div>
                    <div class="card-info">
                        <h3>Avisos Importantes</h3>
                        <div class="card-number">${dash.avisos}</div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-icon"><i class="fas fa-calendar-check"></i></div>
                    <div class="card-info">
                        <h3>Eventos</h3>
                        <div class="card-number">${dash.eventos}</div>
                    </div>
                </div>
            </div>

            <div class="cards-grid" style="margin-top: 20px;">
                <div class="card">
                    <div class="card-icon"><i class="fas fa-coins"></i></div>
                    <div class="card-info">
                        <h3>Financeiro do Mês</h3>
                        <div class="card-number">R$ ${(dash.financeiro || 0).toFixed(2)}</div>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 30px;">
                <h3 style="color: #003b7d; margin-bottom: 20px;">Acesso Rápido</h3>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                    <button class="btn-novo" onclick="Admin.mudarTela('membros')">
                        <i class="fas fa-users"></i> Membros
                    </button>
                    <button class="btn-novo" onclick="Admin.mudarTela('escalas')">
                        <i class="fas fa-calendar-alt"></i> Escalas
                    </button>
                    <button class="btn-novo" onclick="Admin.mudarTela('avisos')">
                        <i class="fas fa-bullhorn"></i> Avisos
                    </button>
                    <button class="btn-novo" onclick="Admin.mudarTela('eventos')">
                        <i class="fas fa-calendar-check"></i> Eventos
                    </button>
                    <button class="btn-novo" onclick="Admin.mudarTela('financeiro')">
                        <i class="fas fa-coins"></i> Financeiro
                    </button>
                    <button class="btn-novo" onclick="Admin.verLogs()">
                        <i class="fas fa-history"></i> Logs
                    </button>
                </div>
            </div>
        `;
    },

    renderizarMembros() {
        return `
            <div class="content-header">
                <h1>Membros</h1>
                <button class="btn-novo" onclick="Admin.abrirModal('membro')">
                    <i class="fas fa-plus"></i> Novo Membro
                </button>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Email</th>
                            <th>Telefone</th>
                            <th>Função</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.dados.membros.map(m => `
                            <tr>
                                <td>${m.nome}</td>
                                <td>${m.email}</td>
                                <td>${m.telefone || '-'}</td>
                                <td>${m.funcao || '-'}</td>
                                <td class="${m.ativo ? 'status-ativo' : 'status-inativo'}">
                                    ${m.ativo ? 'Ativo' : 'Inativo'}
                                </td>
                                <td>
                                    <button class="btn-acao btn-editar" onclick="Admin.abrirModal('membro', ${JSON.stringify(m).replace(/"/g, '&quot;')})">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn-acao btn-editar" onclick="Admin.editarPermissoes(${m.id})">
                                        <i class="fas fa-lock"></i>
                                    </button>
                                    <button class="btn-acao btn-excluir" onclick="Admin.excluirItem('membros', ${m.id})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderizarEscalas() {
        return `
            <div class="content-header">
                <h1>Escalas</h1>
                <div style="display: flex; gap: 10px;">
                    <select id="mesFiltro" onchange="Admin.filtrarEscalas()" class="filtro-select">
                        <option value="1">Janeiro</option>
                        <option value="2">Fevereiro</option>
                        <option value="3">Março</option>
                        <option value="4">Abril</option>
                        <option value="5">Maio</option>
                        <option value="6">Junho</option>
                        <option value="7">Julho</option>
                        <option value="8">Agosto</option>
                        <option value="9">Setembro</option>
                        <option value="10">Outubro</option>
                        <option value="11">Novembro</option>
                        <option value="12">Dezembro</option>
                    </select>
                    <input type="number" id="anoFiltro" value="${this.filtros.ano}" class="filtro-input" style="width: 100px;">
                    <button class="btn-novo" onclick="Admin.abrirModal('escala')">
                        <i class="fas fa-plus"></i> Nova Escala
                    </button>
                </div>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Horário</th>
                            <th>Função</th>
                            <th>Responsável 1</th>
                            <th>Responsável 2</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.dados.escalas.map(e => `
                            <tr>
                                <td>${new Date(e.data).toLocaleDateString('pt-BR')}</td>
                                <td>${e.horario}</td>
                                <td>${e.funcao}</td>
                                <td>${e.membro1_nome || '-'}</td>
                                <td>${e.membro2_nome || '-'}</td>
                                <td>
                                    <button class="btn-acao btn-editar" onclick="Admin.abrirModal('escala', ${JSON.stringify(e).replace(/"/g, '&quot;')})">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn-acao btn-excluir" onclick="Admin.excluirItem('escalas', ${e.id})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderizarAvisos() {
        return `
            <div class="content-header">
                <h1>Avisos</h1>
                <button class="btn-novo" onclick="Admin.abrirModal('aviso')">
                    <i class="fas fa-plus"></i> Novo Aviso
                </button>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Título</th>
                            <th>Importância</th>
                            <th>Autor</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.dados.avisos.map(a => `
                            <tr>
                                <td>${new Date(a.data).toLocaleDateString('pt-BR')}</td>
                                <td>${a.titulo}</td>
                                <td>
                                    <span style="
                                        padding: 3px 8px;
                                        border-radius: 12px;
                                        font-size: 11px;
                                        font-weight: 600;
                                        background: ${a.importancia === 'alta' ? '#dc3545' : a.importancia === 'media' ? '#ffc107' : '#28a745'};
                                        color: white;
                                    ">${a.importancia.toUpperCase()}</span>
                                </td>
                                <td>${a.autor || '-'}</td>
                                <td>
                                    <button class="btn-acao btn-editar" onclick="Admin.abrirModal('aviso', ${JSON.stringify(a).replace(/"/g, '&quot;')})">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn-acao btn-excluir" onclick="Admin.excluirItem('avisos', ${a.id})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderizarEventos() {
        return `
            <div class="content-header">
                <h1>Eventos</h1>
                <button class="btn-novo" onclick="Admin.abrirModal('evento')">
                    <i class="fas fa-plus"></i> Novo Evento
                </button>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Horário</th>
                            <th>Título</th>
                            <th>Local</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.dados.eventos.map(e => `
                            <tr>
                                <td>${new Date(e.data).toLocaleDateString('pt-BR')}</td>
                                <td>${e.horario}</td>
                                <td>${e.titulo}</td>
                                <td>${e.local || '-'}</td>
                                <td>
                                    <button class="btn-acao btn-editar" onclick="Admin.abrirModal('evento', ${JSON.stringify(e).replace(/"/g, '&quot;')})">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn-acao btn-excluir" onclick="Admin.excluirItem('eventos', ${e.id})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderizarFinanceiro() {
        const totais = this.dados.totaisFinanceiro || {};
        
        return `
            <div class="content-header">
                <h1>Financeiro</h1>
                <div style="display: flex; gap: 10px;">
                    <select id="mesFiltroFinanceiro" onchange="Admin.filtrarFinanceiro()" class="filtro-select">
                        <option value="1">Janeiro</option>
                        <option value="2">Fevereiro</option>
                        <option value="3">Março</option>
                        <option value="4">Abril</option>
                        <option value="5">Maio</option>
                        <option value="6">Junho</option>
                        <option value="7">Julho</option>
                        <option value="8">Agosto</option>
                        <option value="9">Setembro</option>
                        <option value="10">Outubro</option>
                        <option value="11">Novembro</option>
                        <option value="12">Dezembro</option>
                    </select>
                    <input type="number" id="anoFiltroFinanceiro" value="${this.filtros.ano}" class="filtro-input" style="width: 100px;">
                    <button class="btn-novo" onclick="Admin.abrirModal('financeiro')">
                        <i class="fas fa-plus"></i> Novo Registro
                    </button>
                </div>
            </div>

            <div class="resumo-financeiro">
                <div class="card-resumo">
                    <h4>💰 Dízimos</h4>
                    <div class="valor">R$ ${(totais.total_dizimos || 0).toFixed(2)}</div>
                </div>
                <div class="card-resumo">
                    <h4>🎁 Ofertas</h4>
                    <div class="valor">R$ ${(totais.total_ofertas || 0).toFixed(2)}</div>
                </div>
                <div class="card-resumo">
                    <h4>📦 Outros</h4>
                    <div class="valor">R$ ${(totais.total_outros || 0).toFixed(2)}</div>
                </div>
                <div class="card-resumo">
                    <h4>📊 Total</h4>
                    <div class="valor">R$ ${(totais.total_geral || 0).toFixed(2)}</div>
                </div>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Tipo</th>
                            <th>Membro</th>
                            <th>Valor</th>
                            <th>Descrição</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.dados.financeiro.map(f => `
                            <tr>
                                <td>${new Date(f.data).toLocaleDateString('pt-BR')}</td>
                                <td>${f.tipo === 'dizimo' ? '💵 Dízimo' : f.tipo === 'oferta' ? '🎁 Oferta' : '📦 Outros'}</td>
                                <td>${f.membro_nome || '-'}</td>
                                <td><strong>R$ ${(f.valor || 0).toFixed(2)}</strong></td>
                                <td>${f.descricao || '-'}</td>
                                <td>
                                    <button class="btn-acao btn-excluir" onclick="Admin.excluirItem('financeiro', ${f.id})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderizarConfiguracoes() {
        return `
            <div class="content-header">
                <h1>Configurações</h1>
            </div>
            
            <div class="cards-grid">
                <div class="card" onclick="Admin.abrirModalConfig('senha')">
                    <div class="card-icon"><i class="fas fa-lock"></i></div>
                    <div class="card-info">
                        <h3>Alterar Senha</h3>
                        <p>Mude sua senha de acesso</p>
                    </div>
                </div>
                
                <div class="card" onclick="Admin.abrirModalConfig('pix')">
                    <div class="card-icon"><i class="fas fa-qrcode"></i></div>
                    <div class="card-info">
                        <h3>Configurar PIX</h3>
                        <p>Chave PIX da igreja</p>
                    </div>
                </div>
                
                <div class="card" onclick="Admin.abrirModalConfig('email')">
                    <div class="card-icon"><i class="fas fa-envelope"></i></div>
                    <div class="card-info">
                        <h3>Configurar Email</h3>
                        <p>Para recuperação de senha</p>
                    </div>
                </div>
                
                <div class="card" onclick="Admin.configurarWebPush()">
                    <div class="card-icon"><i class="fas fa-bell"></i></div>
                    <div class="card-info">
                        <h3>Notificações Push</h3>
                        <p>Configurar alertas</p>
                    </div>
                </div>
                
                <div class="card" onclick="Admin.verLogs()">
                    <div class="card-icon"><i class="fas fa-history"></i></div>
                    <div class="card-info">
                        <h3>Logs do Sistema</h3>
                        <p>Histórico de ações</p>
                    </div>
                </div>
            </div>

            <div class="table-container">
                <h3 style="margin-bottom: 20px;">Gerenciar Permissões dos Membros</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Email</th>
                            <th>Escalas</th>
                            <th>Avisos</th>
                            <th>Eventos</th>
                            <th>Aniversariantes</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.dados.membros.map(m => {
                            const permissoes = m.permissoes ? JSON.parse(m.permissoes) : { verEscalas: true, verAvisos: true, verEventos: true, verAniversariantes: true };
                            return `
                            <tr>
                                <td>${m.nome}</td>
                                <td>${m.email}</td>
                                <td><input type="checkbox" ${permissoes.verEscalas ? 'checked' : ''} disabled></td>
                                <td><input type="checkbox" ${permissoes.verAvisos ? 'checked' : ''} disabled></td>
                                <td><input type="checkbox" ${permissoes.verEventos ? 'checked' : ''} disabled></td>
                                <td><input type="checkbox" ${permissoes.verAniversariantes ? 'checked' : ''} disabled></td>
                                <td>
                                    <button class="btn-acao btn-editar" onclick="Admin.editarPermissoes(${m.id})">
                                        <i class="fas fa-edit"></i> Editar
                                    </button>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    abrirModal(tipo, item = null) {
        this.itemEditando = item;
        const modal = document.getElementById('modal');
        const modalContent = document.getElementById('modalContent');
        
        let titulo = '';
        let campos = '';
        
        switch(tipo) {
            case 'membro':
                titulo = item ? 'Editar Membro' : 'Novo Membro';
                campos = `
                    <input type="text" id="nome" placeholder="Nome completo" value="${item?.nome || ''}" required>
                    <input type="email" id="email" placeholder="Email" value="${item?.email || ''}" required>
                    ${!item ? '<input type="text" id="senha" placeholder="Senha (padrão: 123456)" value="123456">' : ''}
                    <input type="date" id="data_nascimento" value="${item?.data_nascimento || ''}">
                    <input type="text" id="telefone" placeholder="Telefone" value="${item?.telefone || ''}">
                    <input type="text" id="funcao" placeholder="Função" value="${item?.funcao || ''}">
                    ${item ? `
                        <select id="ativo">
                            <option value="1" ${item.ativo ? 'selected' : ''}>Ativo</option>
                            <option value="0" ${!item.ativo ? 'selected' : ''}>Inativo</option>
                        </select>
                    ` : ''}
                `;
                break;
                
            case 'escala':
                titulo = item ? 'Editar Escala' : 'Nova Escala';
                const membros = this.dados.membros.filter(m => m.ativo).map(m => 
                    `<option value="${m.id}">${m.nome}</option>`
                ).join('');
                
                campos = `
                    <input type="date" id="data" value="${item?.data || ''}" required>
                    <input type="time" id="horario" value="${item?.horario || ''}" required>
                    <select id="funcao" required>
                        <option value="">Selecione a função</option>
                        <option value="Abertura" ${item?.funcao === 'Abertura' ? 'selected' : ''}>Abertura</option>
                        <option value="Dízimo" ${item?.funcao === 'Dízimo' ? 'selected' : ''}>Dízimo</option>
                        <option value="Palavra" ${item?.funcao === 'Palavra' ? 'selected' : ''}>Palavra</option>
                        <option value="Recepção" ${item?.funcao === 'Recepção' ? 'selected' : ''}>Recepção</option>
                    </select>
                    <select id="membro1_id">
                        <option value="">Selecione o 1º responsável</option>
                        ${membros}
                    </select>
                    <select id="membro2_id">
                        <option value="">Selecione o 2º responsável (opcional)</option>
                        ${membros}
                    </select>
                    <textarea id="observacoes" placeholder="Observações">${item?.observacoes || ''}</textarea>
                `;
                break;
                
            case 'aviso':
                titulo = item ? 'Editar Aviso' : 'Novo Aviso';
                campos = `
                    <input type="text" id="titulo" placeholder="Título" value="${item?.titulo || ''}" required>
                    <textarea id="mensagem" placeholder="Mensagem" required>${item?.mensagem || ''}</textarea>
                    <select id="importancia" required>
                        <option value="alta" ${item?.importancia === 'alta' ? 'selected' : ''}>Alta Importância</option>
                        <option value="media" ${item?.importancia === 'media' ? 'selected' : ''}>Média Importância</option>
                        <option value="baixa" ${item?.importancia === 'baixa' ? 'selected' : ''}>Baixa Importância</option>
                    </select>
                    <input type="text" id="autor" placeholder="Autor" value="${item?.autor || this.admin.nome}" required>
                `;
                break;
                
            case 'evento':
                titulo = item ? 'Editar Evento' : 'Novo Evento';
                campos = `
                    <input type="text" id="titulo" placeholder="Título" value="${item?.titulo || ''}" required>
                    <input type="date" id="data" value="${item?.data || ''}" required>
                    <input type="time" id="horario" value="${item?.horario || ''}" required>
                    <input type="text" id="local" placeholder="Local" value="${item?.local || ''}">
                    <textarea id="descricao" placeholder="Descrição">${item?.descricao || ''}</textarea>
                `;
                break;
                
            case 'financeiro':
                titulo = item ? 'Editar Registro' : 'Novo Registro Financeiro';
                const membrosFinanceiro = this.dados.membros.filter(m => m.ativo).map(m => 
                    `<option value="${m.id}">${m.nome}</option>`
                ).join('');
                
                campos = `
                    <select id="tipo" required>
                        <option value="">Selecione o tipo</option>
                        <option value="dizimo">💵 Dízimo</option>
                        <option value="oferta">🎁 Oferta</option>
                        <option value="outros">📦 Outros</option>
                    </select>
                    <select id="membro_id">
                        <option value="">Selecione o membro (opcional)</option>
                        ${membrosFinanceiro}
                    </select>
                    <input type="number" id="valor" step="0.01" placeholder="Valor (R$)" value="${item?.valor || ''}" required>
                    <input type="date" id="data" value="${item?.data || new Date().toISOString().split('T')[0]}" required>
                    <input type="text" id="descricao" placeholder="Descrição" value="${item?.descricao || ''}">
                `;
                break;
        }
        
        modalContent.innerHTML = `
            <h2>${titulo}</h2>
            <form id="modalForm" onsubmit="Admin.salvarItem('${tipo}', event)">
                ${campos}
                <div class="modal-buttons">
                    <button type="submit" class="btn-save">Salvar</button>
                    <button type="button" class="btn-cancel" onclick="Admin.fecharModal()">Cancelar</button>
                </div>
            </form>
        `;
        
        if (tipo === 'escala' && item) {
            setTimeout(() => {
                document.getElementById('membro1_id').value = item.membro1_id || '';
                document.getElementById('membro2_id').value = item.membro2_id || '';
            }, 100);
        }
        
        modal.classList.add('active');
    },

    fecharModal() {
        document.getElementById('modal').classList.remove('active');
        this.itemEditando = null;
    },

    async salvarItem(tipo, event) {
        event.preventDefault();
        
        const form = document.getElementById('modalForm');
        const dados = {};
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            dados[input.id] = input.value;
        });
        
        try {
            let url = `/api/admin/${tipo}s`;
            let method = 'POST';
            
            if (this.itemEditando) {
                url += `/${this.itemEditando.id}`;
                method = 'PUT';
            }
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(dados)
            });
            
            if (response.ok) {
                this.fecharModal();
                await this.carregarDados();
                alert('Item salvo com sucesso!');
            } else {
                const erro = await response.json();
                alert(erro.erro || 'Erro ao salvar');
            }
        } catch (error) {
            alert('Erro ao salvar');
        }
    },

    async excluirItem(endpoint, id) {
        if (!confirm('Tem certeza que deseja excluir?')) return;
        
        try {
            const response = await fetch(`/api/admin/${endpoint}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                await this.carregarDados();
                alert('Item excluído!');
            } else {
                alert('Erro ao excluir');
            }
        } catch (error) {
            alert('Erro ao excluir');
        }
    },

    filtrarEscalas() {
        this.filtros.mes = document.getElementById('mesFiltro').value;
        this.filtros.ano = document.getElementById('anoFiltro').value;
        this.carregarEscalas().then(() => {
            this.renderizarInterface();
        });
    },

    filtrarFinanceiro() {
        this.filtros.mes = document.getElementById('mesFiltroFinanceiro').value;
        this.filtros.ano = document.getElementById('anoFiltroFinanceiro').value;
        this.carregarFinanceiro().then(() => {
            this.renderizarInterface();
        });
    },

    abrirModalConfig(tipo) {
        const modal = document.getElementById('modal');
        const modalContent = document.getElementById('modalContent');
        
        if (tipo === 'senha') {
            modalContent.innerHTML = `
                <h2>Alterar Senha do Admin</h2>
                <form id="modalForm" onsubmit="Admin.alterarSenha(event)">
                    <input type="password" id="senhaAtual" placeholder="Senha atual" required>
                    <input type="password" id="novaSenha" placeholder="Nova senha" required>
                    <input type="password" id="confirmarSenha" placeholder="Confirmar nova senha" required>
                    <div class="modal-buttons">
                        <button type="submit" class="btn-save">Alterar Senha</button>
                        <button type="button" class="btn-cancel" onclick="Admin.fecharModal()">Cancelar</button>
                    </div>
                </form>
            `;
        } else if (tipo === 'pix') {
            modalContent.innerHTML = `
                <h2>Configurar PIX da Igreja</h2>
                <form id="modalForm" onsubmit="Admin.salvarPix(event)">
                    <input type="text" id="pix" placeholder="Chave PIX" value="${this.dados.config.pix || ''}" required>
                    <p style="color: #666; font-size: 12px; margin-top: -10px;">Ex: CNPJ, CPF, email ou telefone</p>
                    <div class="modal-buttons">
                        <button type="submit" class="btn-save">Salvar PIX</button>
                        <button type="button" class="btn-cancel" onclick="Admin.fecharModal()">Cancelar</button>
                    </div>
                </form>
            `;
        } else if (tipo === 'email') {
            modalContent.innerHTML = `
                <h2>Configurar Email</h2>
                <p style="margin-bottom: 20px;">Configure o email para recuperação de senha (use Gmail)</p>
                <form id="modalForm" onsubmit="Admin.configurarEmail(event)">
                    <input type="email" id="email_user" placeholder="Email" value="${this.dados.config.email_user || ''}" required>
                    <input type="password" id="email_pass" placeholder="Senha do email" value="${this.dados.config.email_pass || ''}" required>
                    <input type="text" id="email_smtp" placeholder="SMTP (ex: smtp.gmail.com)" value="${this.dados.config.email_smtp || 'smtp.gmail.com'}">
                    <input type="text" id="email_port" placeholder="Porta (ex: 587)" value="${this.dados.config.email_port || '587'}">
                    <div class="modal-buttons">
                        <button type="submit" class="btn-save">Salvar Configurações</button>
                        <button type="button" class="btn-cancel" onclick="Admin.fecharModal()">Cancelar</button>
                    </div>
                </form>
            `;
        }
        
        modal.classList.add('active');
    },

    async alterarSenha(event) {
        event.preventDefault();
        
        const senhaAtual = document.getElementById('senhaAtual').value;
        const novaSenha = document.getElementById('novaSenha').value;
        const confirmarSenha = document.getElementById('confirmarSenha').value;
        
        if (novaSenha !== confirmarSenha) {
            alert('As senhas não coincidem!');
            return;
        }
        
        try {
            const response = await fetch('/api/admin/alterar-senha', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ senhaAtual, novaSenha })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert(data.mensagem || 'Senha alterada com sucesso!');
                this.fecharModal();
            } else {
                alert(data.erro || 'Erro ao alterar senha');
            }
        } catch (error) {
            alert('Erro ao conectar');
        }
    },

    async salvarPix(event) {
        event.preventDefault();
        
        const pix = document.getElementById('pix').value;
        
        try {
            const response = await fetch('/api/admin/pix', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ pix })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert(data.mensagem || 'PIX salvo com sucesso!');
                this.fecharModal();
                await this.carregarConfiguracoes();
            } else {
                alert(data.erro || 'Erro ao salvar PIX');
            }
        } catch (error) {
            alert('Erro ao conectar');
        }
    },

    async configurarEmail(event) {
        event.preventDefault();
        
        const config = {
            email_user: document.getElementById('email_user').value,
            email_pass: document.getElementById('email_pass').value,
            email_smtp: document.getElementById('email_smtp').value,
            email_port: document.getElementById('email_port').value
        };
        
        try {
            const response = await fetch('/api/admin/configurar-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(config)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert(data.mensagem || 'Email configurado com sucesso!');
                this.fecharModal();
            } else {
                alert(data.erro || 'Erro ao configurar email');
            }
        } catch (error) {
            alert('Erro ao conectar');
        }
    },

    async configurarWebPush() {
        try {
            const response = await fetch('/api/admin/vapid-keys', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            const keys = await response.json();
            
            const modal = document.getElementById('modal');
            const modalContent = document.getElementById('modalContent');
            
            modalContent.innerHTML = `
                <h2>Notificações Push</h2>
                <p style="margin-bottom: 20px;">Configure as chaves VAPID para notificações push.</p>
                
                <div class="config-email">
                    <h4>Chave Pública</h4>
                    <div class="vapid-keys">${keys.publicKey}</div>
                    
                    <h4 style="margin-top: 20px;">Chave Privada (guarde com segurança!)</h4>
                    <div class="vapid-keys">${keys.privateKey}</div>
                </div>
                
                <p style="color: #666; font-size: 13px; margin-top: 10px;">
                    ⚠️ As chaves já foram geradas automaticamente. O sistema já está pronto para enviar notificações.
                </p>
                
                <div class="modal-buttons">
                    <button type="button" class="btn-cancel" onclick="Admin.fecharModal()">Fechar</button>
                </div>
            `;
            
            modal.classList.add('active');
        } catch (error) {
            alert('Erro ao configurar push');
        }
    },

    async editarPermissoes(membroId) {
        try {
            const response = await fetch(`/api/admin/membros/${membroId}/permissoes`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            const membro = await response.json();
            
            const modal = document.getElementById('modal');
            const modalContent = document.getElementById('modalContent');
            
            modalContent.innerHTML = `
                <h2>Permissões de ${membro.nome}</h2>
                <form id="modalForm" onsubmit="Admin.salvarPermissoes(${membroId}, event)">
                    <label style="display: block; margin-bottom: 15px;">
                        <input type="checkbox" id="verEscalas" ${membro.permissoes.verEscalas ? 'checked' : ''}>
                        <span style="margin-left: 10px;">Pode ver Escalas</span>
                    </label>
                    <label style="display: block; margin-bottom: 15px;">
                        <input type="checkbox" id="verAvisos" ${membro.permissoes.verAvisos ? 'checked' : ''}>
                        <span style="margin-left: 10px;">Pode ver Avisos</span>
                    </label>
                    <label style="display: block; margin-bottom: 15px;">
                        <input type="checkbox" id="verEventos" ${membro.permissoes.verEventos ? 'checked' : ''}>
                        <span style="margin-left: 10px;">Pode ver Eventos</span>
                    </label>
                    <label style="display: block; margin-bottom: 15px;">
                        <input type="checkbox" id="verAniversariantes" ${membro.permissoes.verAniversariantes ? 'checked' : ''}>
                        <span style="margin-left: 10px;">Pode ver Aniversariantes</span>
                    </label>
                    <div class="modal-buttons">
                        <button type="submit" class="btn-save">Salvar Permissões</button>
                        <button type="button" class="btn-cancel" onclick="Admin.fecharModal()">Cancelar</button>
                    </div>
                </form>
            `;
            
            modal.classList.add('active');
        } catch (error) {
            alert('Erro ao carregar permissões');
        }
    },

    async salvarPermissoes(membroId, event) {
        event.preventDefault();
        
        const permissoes = {
            verEscalas: document.getElementById('verEscalas').checked,
            verAvisos: document.getElementById('verAvisos').checked,
            verEventos: document.getElementById('verEventos').checked,
            verAniversariantes: document.getElementById('verAniversariantes').checked
        };
        
        try {
            const response = await fetch(`/api/admin/membros/${membroId}/permissoes`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ permissoes })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert(data.mensagem || 'Permissões atualizadas!');
                this.fecharModal();
                await this.carregarDados();
            } else {
                alert(data.erro || 'Erro ao salvar');
            }
        } catch (error) {
            alert('Erro ao conectar');
        }
    },

    async verLogs() {
        try {
            const response = await fetch('/api/admin/logs', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            const logs = await response.json();
            
            const modal = document.getElementById('modal');
            const modalContent = document.getElementById('modalContent');
            
            modalContent.innerHTML = `
                <h2>Logs do Sistema</h2>
                <div style="max-height: 400px; overflow-y: auto;">
                    <table style="width: 100%;">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Hora</th>
                                <th>Usuário</th>
                                <th>Ação</th>
                                <th>Detalhes</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${logs.map(log => `
                                <tr>
                                    <td>${log.data}</td>
                                    <td>${log.hora}</td>
                                    <td>${log.usuario}</td>
                                    <td>${log.acao}</td>
                                    <td>${log.dados || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="modal-buttons">
                    <button type="button" class="btn-cancel" onclick="Admin.fecharModal()">Fechar</button>
                </div>
            `;
            
            modal.classList.add('active');
        } catch (error) {
            alert('Erro ao carregar logs');
        }
    },

    mostrarMensagem(tipo, texto) {
        alert(texto);
    }
};

// Inicializar
Admin.init();
window.Admin = Admin;