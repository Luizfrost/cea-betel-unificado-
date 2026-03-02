// ============================================
// CEA BETEL BERTIOGA - APP DOS MEMBROS
// ============================================

const AppMembro = {
    membro: null,
    telaAtual: 'home',
    dados: {
        home: null,
        escalas: [],
        avisos: [],
        aniversariantes: [],
        eventos: []
    },

    init() {
        this.verificarLogin();
    },

    verificarLogin() {
        const membroSalvo = localStorage.getItem('membro');
        if (membroSalvo) {
            this.membro = JSON.parse(membroSalvo);
            this.carregarDados();
        } else {
            this.renderizarLogin();
        }
    },

    async login(email, senha) {
        try {
            const response = await fetch('/api/membros/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senha })
            });

            const data = await response.json();

            if (response.ok) {
                this.membro = data;
                localStorage.setItem('membro', JSON.stringify(data));
                this.mostrarMensagem('sucesso', 'Login realizado!');
                setTimeout(() => this.carregarDados(), 1000);
            } else {
                this.mostrarMensagem('erro', data.erro || 'Erro no login');
            }
        } catch (error) {
            this.mostrarMensagem('erro', 'Erro ao conectar');
        }
    },

    logout() {
        localStorage.removeItem('membro');
        this.membro = null;
        this.renderizarLogin();
    },

    async carregarDados() {
        this.renderizarLoading();
        
        try {
            await Promise.all([
                this.carregarHome(),
                this.carregarEscalas(),
                this.carregarAvisos(),
                this.carregarAniversariantes(),
                this.carregarEventos()
            ]);
            
            this.renderizarInterface();
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    },

    async carregarHome() {
        const response = await fetch(`/api/membros/home/${this.membro.id}`);
        this.dados.home = await response.json();
    },

    async carregarEscalas() {
        const response = await fetch(`/api/membros/escalas/${this.membro.id}`);
        this.dados.escalas = await response.json();
    },

    async carregarAvisos() {
        const response = await fetch('/api/membros/avisos');
        this.dados.avisos = await response.json();
    },

    async carregarAniversariantes() {
        const response = await fetch('/api/membros/aniversariantes');
        this.dados.aniversariantes = await response.json();
    },

    async carregarEventos() {
        const response = await fetch('/api/membros/eventos');
        this.dados.eventos = await response.json();
    },

    renderizarLogin() {
        document.getElementById('app').innerHTML = `
            <div class="login-container">
                <div class="login-card">
                    <h2>⛪ CEA Betel Bertioga</h2>
                    <div class="subtitle">Comunidade Evangélica Ágape</div>
                    
                    <div class="input-group">
                        <label>E-mail</label>
                        <input type="email" id="email" placeholder="seu@email.com" value="joao@email.com">
                    </div>
                    
                    <div class="input-group">
                        <label>Senha</label>
                        <input type="password" id="senha" placeholder="••••••" value="123456">
                    </div>
                    
                    <button class="login-btn" onclick="AppMembro.login(
                        document.getElementById('email').value,
                        document.getElementById('senha').value
                    )">Entrar</button>
                    
                    <div class="mensagem" id="mensagem"></div>
                </div>
            </div>
        `;
    },

    renderizarLoading() {
        document.getElementById('app').innerHTML = `
            <div style="min-height: 600px; display: flex; align-items: center; justify-content: center;">
                <div class="loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Carregando...</p>
                </div>
            </div>
        `;
    },

    renderizarInterface() {
        document.getElementById('app').innerHTML = `
            <div class="app-header">
                <h1>⛪ CEA Betel Bertioga</h1>
                <div class="user-greeting">Olá, ${this.membro.nome.split(' ')[0]}!</div>
            </div>

            <div class="app-content" id="content">
                ${this.renderizarTelaAtual()}
            </div>

            <div class="bottom-nav">
                <div class="nav-item ${this.telaAtual === 'home' ? 'active' : ''}" onclick="AppMembro.mudarTela('home')">
                    <i class="fas fa-home"></i>
                    <span>Início</span>
                </div>
                <div class="nav-item ${this.telaAtual === 'escala' ? 'active' : ''}" onclick="AppMembro.mudarTela('escala')">
                    <i class="fas fa-calendar-alt"></i>
                    <span>Escala</span>
                </div>
                <div class="nav-item ${this.telaAtual === 'avisos' ? 'active' : ''}" onclick="AppMembro.mudarTela('avisos')">
                    <i class="fas fa-bullhorn"></i>
                    <span>Avisos</span>
                </div>
                <div class="nav-item ${this.telaAtual === 'aniversariantes' ? 'active' : ''}" onclick="AppMembro.mudarTela('aniversariantes')">
                    <i class="fas fa-birthday-cake"></i>
                    <span>Anivers.</span>
                </div>
                <div class="nav-item ${this.telaAtual === 'eventos' ? 'active' : ''}" onclick="AppMembro.mudarTela('eventos')">
                    <i class="fas fa-calendar-check"></i>
                    <span>Agenda</span>
                </div>
            </div>
        `;
    },

    mudarTela(tela) {
        this.telaAtual = tela;
        document.getElementById('content').innerHTML = this.renderizarTelaAtual();
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        event.currentTarget.classList.add('active');
    },

    renderizarTelaAtual() {
        switch(this.telaAtual) {
            case 'home': return this.renderizarHome();
            case 'escala': return this.renderizarEscala();
            case 'avisos': return this.renderizarAvisos();
            case 'aniversariantes': return this.renderizarAniversariantes();
            case 'eventos': return this.renderizarEventos();
            default: return '';
        }
    },

    renderizarHome() {
        const home = this.dados.home || {};
        
        return `
            <div class="card">
                <h3>📅 Próximo Culto</h3>
                <div class="culto-info">
                    <span class="culto-dia">Domingo</span>
                    <span class="culto-horario">${home.proximoCulto || '19:00'}</span>
                </div>
                
                <div class="escala-status">
                    <i class="fas ${home.estaEscalado ? 'fa-check-circle status-sim' : 'fa-times-circle status-nao'}" style="font-size: 24px;"></i>
                    <div>
                        <strong>Você está escalado?</strong><br>
                        <span class="${home.estaEscalado ? 'status-sim' : 'status-nao'}">
                            ${home.estaEscalado ? 'SIM! 🎉' : 'Não'}
                        </span>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3>🔔 Avisos Importantes</h3>
                ${home.avisosImportantes?.map(aviso => `
                    <div class="aviso-item">
                        <strong>${aviso.titulo}</strong>
                        <p>${aviso.mensagem}</p>
                    </div>
                `).join('') || '<p>Nenhum aviso</p>'}
            </div>

            <button class="login-btn" onclick="AppMembro.logout()" style="background: #6c757d;">Sair</button>
        `;
    },

    renderizarEscala() {
        if (!this.dados.escalas.length) {
            return '<div class="empty-state"><i class="fas fa-calendar-times"></i><p>Sem escalas</p></div>';
        }

        return this.dados.escalas.map(escala => `
            <div class="escala-card">
                <div class="escala-data">${new Date(escala.data).toLocaleDateString('pt-BR')}</div>
                <div class="escala-detalhes">
                    <span><i class="fas fa-clock"></i> ${escala.horario}</span>
                    <span class="escala-funcao">${escala.funcao}</span>
                </div>
            </div>
        `).join('');
    },

    renderizarAvisos() {
        return this.dados.avisos.map(aviso => `
            <div class="card">
                <h3>${aviso.titulo}</h3>
                <p>${aviso.mensagem}</p>
                <small>${new Date(aviso.data).toLocaleDateString('pt-BR')}</small>
            </div>
        `).join('');
    },

    renderizarAniversariantes() {
        return `
            <div class="card">
                <h3>🎂 Aniversariantes</h3>
                ${this.dados.aniversariantes.map(ani => `
                    <div style="padding: 10px 0; border-bottom: 1px solid #eee;">
                        <strong>${ani.nome}</strong><br>
                        <small>${new Date(ani.data_nascimento).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</small>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderizarEventos() {
        return this.dados.eventos.map(evento => `
            <div class="card">
                <h3>${evento.titulo}</h3>
                <p><i class="fas fa-calendar"></i> ${new Date(evento.data).toLocaleDateString('pt-BR')} às ${evento.horario}</p>
                <p>${evento.descricao}</p>
            </div>
        `).join('');
    },

    mostrarMensagem(tipo, texto) {
        const msg = document.getElementById('mensagem');
        if (!msg) return;
        msg.className = `mensagem ${tipo}`;
        msg.textContent = texto;
        setTimeout(() => msg.className = 'mensagem', 3000);
    }
};

window.AppMembro = AppMembro;
AppMembro.init();