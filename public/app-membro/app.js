// ============================================
// CEA BETEL - APP DOS MEMBROS
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
        const btnLogin = document.querySelector('.login-btn');
        
        try {
            btnLogin.disabled = true;
            btnLogin.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';

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
                    <h2>🌟 CEA Betel</h2>
                    <div class="subtitle">Comunidade Evangélica Apostólica</div>
                    
                    <div class="input-group">
                        <label><i class="fas fa-envelope"></i> E-mail</label>
                        <input type="email" id="email" placeholder="seu@email.com" value="joao@email.com">
                    </div>
                    
                    <div class="input-group">
                        <label><i class="fas fa-lock"></i> Senha</label>
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
                <h1>
                    🌟 CEA Betel
                    <span>${this.membro.nome.split(' ')[0]}</span>
                </h1>
                <div class="user-greeting">
                    <i class="fas fa-map-marker-alt"></i> Comunidade Evangélica Ágape
                </div>
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
        
        // Atualizar active do menu
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
            <div class="card welcome-card">
                <div class="card-header">
                    <h3><i class="fas fa-hand-peace"></i> Olá, ${this.membro.nome.split(' ')[0]}!</h3>
                </div>
                <p>Seja bem-vindo(a) à nossa comunidade. 🙏</p>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-church"></i> Próximo Culto</h3>
                </div>
                <div class="culto-info">
                    <span class="culto-dia">Domingo</span>
                    <span class="culto-horario">${home.proximoCulto || '19:00'}</span>
                </div>
                
                <div class="escala-status">
                    <i class="fas ${home.estaEscalado ? 'fa-check-circle status-sim' : 'fa-times-circle status-nao'}" style="font-size: 30px;"></i>
                    <div>
                        <div style="font-weight: 600; margin-bottom: 3px;">
                            Você está escalado neste culto?
                        </div>
                        <div class="${home.estaEscalado ? 'status-sim' : 'status-nao'}" style="font-weight: 600;">
                            ${home.estaEscalado ? 'SIM! 🎉' : 'Não 😊'}
                        </div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-exclamation-triangle" style="color: #dc3545;"></i> Avisos Importantes</h3>
                </div>
                ${home.avisosImportantes?.length > 0 ? home.avisosImportantes.map(aviso => `
                    <div class="aviso-item">
                        <div class="aviso-titulo">${aviso.titulo}</div>
                        <div class="aviso-mensagem">${aviso.mensagem}</div>
                    </div>
                `).join('') : `
                    <div class="empty-state">
                        <i class="fas fa-check-circle"></i>
                        <p>Nenhum aviso importante</p>
                    </div>
                `}
            </div>

            <div style="margin: 20px 0; display: flex; gap: 10px;">
                <button class="login-btn" onclick="AppMembro.mudarTela('escala')" style="padding: 10px;">
                    <i class="fas fa-calendar-alt"></i> Minha Escala
                </button>
                <button class="login-btn" onclick="AppMembro.logout()" style="background: #6c757d; padding: 10px;">
                    <i class="fas fa-sign-out-alt"></i> Sair
                </button>
            </div>
        `;
    },

    renderizarEscala() {
        if (this.dados.escalas.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <p>Você não está escalado em nenhum culto ainda.</p>
                </div>
            `;
        }

        return this.dados.escalas.map(escala => `
            <div class="escala-card">
                <div class="escala-data">
                    <i class="fas fa-calendar-day"></i> ${new Date(escala.data).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <div class="escala-detalhes">
                    <span><i class="fas fa-clock"></i> ${escala.horario}</span>
                    <span class="escala-funcao">${escala.funcao}</span>
                </div>
                ${escala.membro2_nome ? `
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e6edf5; color: #666; font-size: 13px;">
                        <i class="fas fa-users"></i> Recepção: ${escala.membro1_nome} e ${escala.membro2_nome}
                    </div>
                ` : ''}
            </div>
        `).join('');
    },

    renderizarAvisos() {
        if (this.dados.avisos.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-bullhorn"></i>
                    <p>Nenhum aviso no momento.</p>
                </div>
            `;
        }

        return this.dados.avisos.map(aviso => `
            <div class="card aviso-${aviso.importancia}">
                <span class="importancia-badge badge-${aviso.importancia}">
                    ${aviso.importancia === 'alta' ? '🔴 IMPORTANTE' : 
                      aviso.importancia === 'media' ? '🟡 AVISO' : '🟢 INFORMATIVO'}
                </span>
                <h3 style="color: #003b7d; margin-bottom: 10px;">${aviso.titulo}</h3>
                <p style="color: #666; line-height: 1.6;">${aviso.mensagem}</p>
                <div style="margin-top: 15px; color: #999; font-size: 12px;">
                    <i class="fas fa-calendar-alt"></i> ${new Date(aviso.data).toLocaleDateString('pt-BR')}
                </div>
            </div>
        `).join('');
    },

    renderizarAniversariantes() {
        if (this.dados.aniversariantes.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-birthday-cake"></i>
                    <p>Nenhum aniversariante este mês.</p>
                </div>
            `;
        }

        return `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-birthday-cake"></i> Aniversariantes de ${new Date().toLocaleDateString('pt-BR', { month: 'long' })}</h3>
                </div>
                ${this.dados.aniversariantes.map(ani => {
                    const dia = new Date(ani.data_nascimento).getDate();
                    return `
                        <div class="aniversariante-item">
                            <div class="aniversariante-avatar">${ani.nome.charAt(0)}</div>
                            <div class="aniversariante-info">
                                <div class="aniversariante-nome">${ani.nome}</div>
                                <div class="aniversariante-dia">
                                    <i class="fas fa-calendar-day"></i> Dia ${dia}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    renderizarEventos() {
        if (this.dados.eventos.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <p>Nenhum evento este mês.</p>
                </div>
            `;
        }

        return this.dados.eventos.map(evento => {
            const data = new Date(evento.data);
            return `
                <div class="evento-card">
                    <div class="evento-data">
                        <div class="evento-dia">${data.getDate()}</div>
                        <div class="evento-mes">${data.toLocaleDateString('pt-BR', { month: 'short' })}</div>
                    </div>
                    <div class="evento-info">
                        <div class="evento-titulo">${evento.titulo}</div>
                        <div class="evento-horario">
                            <i class="fas fa-clock"></i> ${evento.horario}
                        </div>
                        <div class="evento-descricao">${evento.descricao}</div>
                    </div>
                </div>
            `;
        }).join('');
    },

    mostrarMensagem(tipo, texto) {
        const mensagem = document.getElementById('mensagem');
        if (!mensagem) return;
        
        mensagem.className = `mensagem ${tipo}`;
        mensagem.textContent = texto;
        
        setTimeout(() => {
            mensagem.className = 'mensagem';
        }, 3000);
    }
};

// Inicializar
AppMembro.init();
window.AppMembro = AppMembro;