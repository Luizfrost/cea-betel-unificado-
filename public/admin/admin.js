// ============================================
// CEA BETEL - PAINEL ADMINISTRATIVO
// ============================================

const Admin = {
    token: localStorage.getItem('adminToken'),
    admin: JSON.parse(localStorage.getItem('admin') || 'null'),
    telaAtual: 'dashboard',
    dados: {
        membros: [],
        escalas: [],
        avisos: [],
        eventos: [],
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
                    <h1>🔧 CEA Betel</h1>
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
                        <h2>🔧 CEA Betel</h2>
                        <p>Painel Administrativo</p>
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
        
        // Atualizar active do menu
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
            case 'configuracoes': return this.renderizarConfiguracoes();
            default: return '';
        }
    },

    renderizarDashboard() {
        const dash = this.dados.dashboard || { membros: 0, escalas: 0, avisos: 0, eventos: 0 };
        
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
            
            <div style="margin-top: 30px;">
                <h3 style="color: #003b7d; margin-bottom: 20px;">Acesso Rápido</h3>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                    <button class="btn-novo" onclick="Admin.mudarTela('membros')">
                        <i class="fas fa-users"></i> Gerenciar Membros
                    </button>
                    <button class="btn-novo" onclick="Admin.mudarTela('escalas')">
                        <i class="fas fa-calendar-alt"></i> Gerenciar Escalas
                    </button>
                    <button class="btn-novo" onclick="Admin.mudarTela('avisos')">
                        <i class="fas fa-bullhorn"></i> Gerenciar Avisos
                    </button>
                    <button class="btn-novo" onclick="Admin.mudarTela('eventos')">
                        <i class="fas fa-calendar-check"></i> Gerenciar Eventos
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

    renderizarConfiguracoes() {
        return `
            <div class="content-header">
                <h1>Configurações</h1>
            </div>
            
            <div class="table-container">
                <h3 style="margin-bottom: 20px;">Próximo Culto</h3>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="proximoCulto" value="${this.dados.config.proximoCulto || 'Domingo, 19:00'}" class="filtro-input" style="flex: 1;">
                    <button class="btn-novo" onclick="Admin.salvarConfiguracoes()">
                        <i class="fas fa-save"></i> Salvar
                    </button>
                </div>
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

    async salvarConfiguracoes() {
        const proximoCulto = document.getElementById('proximoCulto').value;
        
        try {
            const response = await fetch('/api/admin/configuracoes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ proximoCulto })
            });
            
            if (response.ok) {
                alert('Configurações salvas!');
                await this.carregarConfiguracoes();
            }
        } catch (error) {
            alert('Erro ao salvar');
        }
    },

    mostrarMensagem(tipo, texto) {
        alert(texto);
    }
};

// Inicializar
Admin.init();
window.Admin = Admin;