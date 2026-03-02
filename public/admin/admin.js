// ============================================
// CEA BETEL - PAINEL ADMIN
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
        financeiro: [],
        totaisFinanceiro: {}
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
                    <h1>⛪ CEA Betel</h1>
                    <div class="input-group">
                        <input type="text" id="usuario" placeholder="Usuário" value="admin">
                    </div>
                    <div class="input-group">
                        <input type="password" id="senha" placeholder="Senha" value="admin123">
                    </div>
                    <button class="login-btn" onclick="Admin.login()">Entrar</button>
                </div>
            </div>
        `;
    },

    async login() {
        const usuario = document.getElementById('usuario').value;
        const senha = document.getElementById('senha').value;
        
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
                alert(data.erro || 'Erro no login');
            }
        } catch (error) {
            alert('Erro ao conectar');
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
        try {
            await Promise.all([
                this.carregarMembros(),
                this.carregarEscalas(),
                this.carregarAvisos(),
                this.carregarEventos(),
                this.carregarFinanceiro()
            ]);
            this.renderizarInterface();
        } catch (error) {
            console.error('Erro:', error);
        }
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

    renderizarInterface() {
        document.getElementById('app').innerHTML = `
            <div class="painel-container">
                <div class="sidebar">
                    <div class="sidebar-header">
                        <h2>⛪ CEA Betel</h2>
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
                    </div>
                    <div class="sidebar-footer">
                        <button class="logout-btn" onclick="Admin.logout()">Sair</button>
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
    },

    renderizarTelaAtual() {
        switch(this.telaAtual) {
            case 'dashboard': return this.renderizarDashboard();
            case 'membros': return this.renderizarMembros();
            case 'escalas': return this.renderizarEscalas();
            case 'avisos': return this.renderizarAvisos();
            case 'eventos': return this.renderizarEventos();
            case 'financeiro': return this.renderizarFinanceiro();
            default: return '';
        }
    },

    renderizarDashboard() {
        return `
            <div class="content-header">
                <h1>Dashboard</h1>
            </div>
            <div class="cards-grid">
                <div class="card">
                    <div class="card-icon"><i class="fas fa-users"></i></div>
                    <div class="card-number">${this.dados.membros.length}</div>
                </div>
                <div class="card">
                    <div class="card-icon"><i class="fas fa-calendar-alt"></i></div>
                    <div class="card-number">${this.dados.escalas.length}</div>
                </div>
            </div>
        `;
    },

    renderizarMembros() {
        return `
            <div class="content-header">
                <h1>Membros</h1>
                <button class="btn-novo" onclick="Admin.abrirModal('membro')">+ Novo</button>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Nome</th><th>Email</th><th>Função</th><th>Ações</th></tr>
                    </thead>
                    <tbody>
                        ${this.dados.membros.map(m => `
                            <tr>
                                <td>${m.nome}</td>
                                <td>${m.email}</td>
                                <td>${m.funcao || '-'}</td>
                                <td>
                                    <button class="btn-acao btn-editar" onclick="Admin.abrirModal('membro', ${JSON.stringify(m)})">Editar</button>
                                    <button class="btn-acao btn-excluir" onclick="Admin.excluirItem('membros', ${m.id})">Excluir</button>
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
                <button class="btn-novo" onclick="Admin.abrirModal('escala')">+ Nova</button>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Data</th><th>Horário</th><th>Função</th><th>Responsáveis</th><th>Ações</th></tr>
                    </thead>
                    <tbody>
                        ${this.dados.escalas.map(e => `
                            <tr>
                                <td>${e.data}</td>
                                <td>${e.horario}</td>
                                <td>${e.funcao}</td>
                                <td>${e.membro1_nome || ''} ${e.membro2_nome ? 'e ' + e.membro2_nome : ''}</td>
                                <td>
                                    <button class="btn-acao btn-editar" onclick="Admin.abrirModal('escala', ${JSON.stringify(e)})">Editar</button>
                                    <button class="btn-acao btn-excluir" onclick="Admin.excluirItem('escalas', ${e.id})">Excluir</button>
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
                <button class="btn-novo" onclick="Admin.abrirModal('aviso')">+ Novo</button>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Data</th><th>Título</th><th>Importância</th><th>Ações</th></tr>
                    </thead>
                    <tbody>
                        ${this.dados.avisos.map(a => `
                            <tr>
                                <td>${a.data}</td>
                                <td>${a.titulo}</td>
                                <td>${a.importancia}</td>
                                <td>
                                    <button class="btn-acao btn-excluir" onclick="Admin.excluirItem('avisos', ${a.id})">Excluir</button>
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
                <button class="btn-novo" onclick="Admin.abrirModal('evento')">+ Novo</button>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Data</th><th>Título</th><th>Local</th><th>Ações</th></tr>
                    </thead>
                    <tbody>
                        ${this.dados.eventos.map(e => `
                            <tr>
                                <td>${e.data}</td>
                                <td>${e.titulo}</td>
                                <td>${e.local || '-'}</td>
                                <td>
                                    <button class="btn-acao btn-excluir" onclick="Admin.excluirItem('eventos', ${e.id})">Excluir</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderizarFinanceiro() {
        const t = this.dados.totaisFinanceiro || {};
        return `
            <div class="content-header">
                <h1>Financeiro</h1>
                <button class="btn-novo" onclick="Admin.abrirModal('financeiro')">+ Novo</button>
            </div>
            <div class="cards-grid">
                <div class="card"><h3>Dízimos</h3><div class="card-number">R$ ${(t.total_dizimos || 0).toFixed(2)}</div></div>
                <div class="card"><h3>Ofertas</h3><div class="card-number">R$ ${(t.total_ofertas || 0).toFixed(2)}</div></div>
                <div class="card"><h3>Total</h3><div class="card-number">R$ ${(t.total_geral || 0).toFixed(2)}</div></div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Data</th><th>Tipo</th><th>Valor</th><th>Descrição</th><th>Ações</th></tr>
                    </thead>
                    <tbody>
                        ${this.dados.financeiro.map(f => `
                            <tr>
                                <td>${f.data}</td>
                                <td>${f.tipo}</td>
                                <td>R$ ${f.valor}</td>
                                <td>${f.descricao || '-'}</td>
                                <td>
                                    <button class="btn-acao btn-excluir" onclick="Admin.excluirItem('financeiro', ${f.id})">Excluir</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    abrirModal(tipo, item = null) {
        this.itemEditando = item;
        const modal = document.getElementById('modal');
        const modalContent = document.getElementById('modalContent');
        
        let titulo = '', campos = '';
        
        switch(tipo) {
            case 'membro':
                titulo = item ? 'Editar Membro' : 'Novo Membro';
                campos = `
                    <input type="text" id="nome" placeholder="Nome" value="${item?.nome || ''}" required>
                    <input type="email" id="email" placeholder="Email" value="${item?.email || ''}" required>
                    <input type="text" id="funcao" placeholder="Função" value="${item?.funcao || ''}">
                `;
                break;
            case 'escala':
                titulo = item ? 'Editar Escala' : 'Nova Escala';
                const membros = this.dados.membros.map(m => `<option value="${m.id}">${m.nome}</option>`).join('');
                campos = `
                    <input type="date" id="data" value="${item?.data || ''}" required>
                    <input type="time" id="horario" value="${item?.horario || ''}" required>
                    <select id="funcao" required>
                        <option value="Abertura">Abertura</option>
                        <option value="Dízimo">Dízimo</option>
                        <option value="Palavra">Palavra</option>
                        <option value="Recepção">Recepção</option>
                    </select>
                    <select id="membro1_id"><option value="">Responsável 1</option>${membros}</select>
                    <select id="membro2_id"><option value="">Responsável 2</option>${membros}</select>
                `;
                break;
            case 'financeiro':
                titulo = 'Novo Registro Financeiro';
                campos = `
                    <select id="tipo" required>
                        <option value="dizimo">Dízimo</option>
                        <option value="oferta">Oferta</option>
                        <option value="outros">Outros</option>
                    </select>
                    <input type="number" id="valor" step="0.01" placeholder="Valor" required>
                    <input type="date" id="data" required>
                    <input type="text" id="descricao" placeholder="Descrição">
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
        form.querySelectorAll('input, select').forEach(i => dados[i.id] = i.value);
        
        try {
            const url = `/api/admin/${tipo}s${this.itemEditando ? '/' + this.itemEditando.id : ''}`;
            const method = this.itemEditando ? 'PUT' : 'POST';
            
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
            } else {
                const err = await response.json();
                alert(err.erro || 'Erro ao salvar');
            }
        } catch (error) {
            alert('Erro ao salvar');
        }
    },

    async excluirItem(endpoint, id) {
        if (!confirm('Excluir?')) return;
        await fetch(`/api/admin/${endpoint}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        await this.carregarDados();
    }
};

window.Admin = Admin;
Admin.init();