/**
 * EL MURO V9.0 - SURGICAL DOM & ROBUST SECURITY
 * Gemini & Grok Optimized | High Performance | Edge Function Ready
 */

const SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';

const CONFIG = {
    USER_KEY: 'elMuro_v6_usr',
    STORAGE_KEY: 'elMuro_v6_db',
    CACHE_TIME_KEY: 'elMuro_v6_ts',
    AI_NAME: '00000000-0000-0000-0000-000000000000',
    PURGE_THRESHOLD: 5
};

const { createClient } = supabase;
const client = createClient(SUPABASE_URL, SUPABASE_KEY);

class App {
    constructor() {
        this.state = { jokes: [], sort: 'new' };
        this.user = this.loadUser();
        this.isAdmin = false;
        this.adminClicks = 0;
        this.isMuted = false;
        this.dom = {}; 
        this.nodes = new Map(); // Caché de nodos DOM para actualizaciones quirúrgicas
        
        this.cacheDOM();
        this.initEvents();
        this.loadLocalJokes();
        this.initGlobalSync(); 
        this.updateAvatarUI();
        this.checkPurgeTimer();
    loadUser() {
        let u;
        try { u = JSON.parse(localStorage.getItem(CONFIG.USER_KEY)); } catch(e) { u = null; }
        
        const genUUID = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

        if (!u || !u.id || u.id.startsWith('usr-')) {
            u = { id: genUUID(), voted: [], owned: [], alias: '', hasSaved: false };
            localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(u)); 
        }
        return u;
    }

    saveUser() { localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(this.user)); }

    loadLocalJokes() {
        try {
            const lastSync = localStorage.getItem(CONFIG.CACHE_TIME_KEY);
            const now = Date.now();
            
            // Si el caché tiene más de 24h, lo ignoramos para forzar descarga fresca
            if (lastSync && (now - lastSync > 86400000)) return;

            const local = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY));
            if (local && Array.isArray(local)) {
                this.state.jokes = local;
                this.syncWall();
            }
        } catch(e) {}
    }

    async initGlobalSync() {
        try {
            const { data, error } = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(200);
            if (!error && data) {
                this.state.jokes = data;
                this.syncWall();
                this.checkDailyAIJoke();
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.state.jokes));
                localStorage.setItem(CONFIG.CACHE_TIME_KEY, Date.now().toString());
            }
        } catch (e) { console.error(e); }

        client.channel('public:jokes').on('postgres_changes', { event: '*', schema: 'public', table: 'jokes' }, (payload) => {
            this.handleRealtime(payload);
        }).subscribe();
    }

    handleRealtime(payload) {
        if (payload.eventType === 'UPDATE') {
            const idx = this.state.jokes.findIndex(j => j.id === payload.new.id);
            if (idx !== -1) {
                this.state.jokes[idx] = payload.new;
                this.updateCardContent(payload.new);
                this.updateStats();
            }
        } else if (payload.eventType === 'DELETE') {
            this.state.jokes = this.state.jokes.filter(j => j.id !== payload.old.id);
            const el = this.nodes.get(payload.old.id);
            if (el) { el.remove(); this.nodes.delete(payload.old.id); }
            this.updateStats();
        } else if (payload.eventType === 'INSERT') {
            this.refreshData(); // Para inserts re-sincronizamos todo por seguridad de orden
        }
    }

    cacheDOM() {
        this.dom = {
            mural: document.getElementById('mural'),
            input: document.getElementById('secret-input'),
            alias: document.getElementById('user-alias'),
            filters: document.querySelectorAll('.filter-btn'),
            avatarImg: document.getElementById('my-avatar-img'),
            purgList: document.getElementById('purgatory-list'),
            humorList: document.getElementById('humorists-list'),
            title: document.getElementById('title-sign'),
            muteBtn: document.getElementById('mute-btn'),
            dashToggle: document.getElementById('mobile-dash-toggle'),
            dashboard: document.getElementById('dashboard'),
            postBtn: document.getElementById('post-btn')
        };
        if(this.user.alias) this.dom.alias.value = this.user.alias;
    }

    initEvents() {
        this.dom.postBtn.onclick = () => this.post();
        this.dom.filters.forEach(btn => {
            btn.onclick = () => {
                this.dom.filters.forEach(f => f.classList.remove('active'));
                btn.classList.add('active');
                this.state.sort = btn.dataset.sort;
                this.syncWall(true); // Re-render completo solo al cambiar filtro
            };
        });
        if(this.dom.title) this.dom.title.onclick = () => this.tryAdminAccess();
        if(this.dom.muteBtn) this.dom.muteBtn.onclick = () => this.toggleMute();
        if(this.dom.dashToggle) {
            this.dom.dashToggle.onclick = () => {
                const isHidden = this.dom.dashboard.getAttribute('aria-hidden') === 'true';
                this.dom.dashboard.setAttribute('aria-hidden', !isHidden);
                this.dom.dashToggle.innerText = isHidden ? "❌" : "🏆";
            };
        }
    }

    syncWall(fullRedraw = false) {
        const sorted = this.getSortedJokes();
        const container = this.dom.mural;
        if(!container) return;

        if (fullRedraw) {
            container.innerHTML = '';
            this.nodes.clear();
        }

        // Manejo de Estados de Purga
        if (this.state.sort === 'controversial') {
            this.renderPurgeHeader(container);
        }

        if (sorted.length === 0) {
            container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#aaa;"><h2 style="font-family:'Bangers'; font-size:3rem; color:var(--accent);">VACÍO...</h2></div>`;
            return;
        }

        // Actualización QUIRÚRGICA: Solo tocamos lo necesario
        const currentIds = new Set(sorted.map(j => j.id));
        
        // 1. Eliminar nodos que ya no deberían estar
        this.nodes.forEach((node, id) => {
            if (!currentIds.has(id)) { node.remove(); this.nodes.delete(id); }
        });

        // 2. Insertar o actualizar
        sorted.forEach((joke, index) => {
            let el = this.nodes.get(joke.id);
            if (!el) {
                el = this.createCard(joke);
                this.nodes.set(joke.id, el);
                container.insertBefore(el, container.children[index] || null);
            } else {
                this.updateCardContent(joke);
                // Si el orden ha cambiado, mover el nodo
                if (container.children[index] !== el) {
                    container.insertBefore(el, container.children[index] || null);
                }
            }
        });

        this.updateStats();
    }

    renderPurgeHeader(container) {
        const active = this.isPurgeActive();
        const days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
        const info = document.createElement('div');
        info.className = "danger-zone";
        info.style.cssText = "grid-column:1/-1; background:#1a1a1a; border:2px dashed #ff1744; padding:20px; text-align:center; margin-bottom:20px;";
        info.innerHTML = `<h2 style="font-family:'Bangers'; color:#ff1744; font-size:2rem;">💀 MODO PURGA</h2><p style="color:#aaa;">${active ? "¡VOTA PARA SALVAR A UNO!" : "Días para el juicio: "+days}</p>`;
        container.prepend(info);
    }

    createCard(joke) {
        const el = document.createElement('article');
        el.className = 'post-it';
        el.id = `joke-${joke.id}`;
        this.updateCardContent(joke, el);
        return el;
    }

    updateCardContent(joke, el = null) {
        const card = el || this.nodes.get(joke.id);
        if (!card) return;

        card.style.setProperty('--bg-c', joke.color || '#FFEB3B');
        card.style.setProperty('--rot', `${joke.rot || 0}deg`);
        const isVoted = this.user.voted.includes(joke.id);
        const purgeMode = this.state.sort === 'controversial' && this.isPurgeActive();
        
        card.innerHTML = `
            <div class="post-body">${this.sanitize(joke.text)}</div>
            <div class="post-footer">
                <div class="author-info"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${joke.authorid || joke.author}">${this.sanitize(joke.author)}</div>
                <div class="actions">
                    ${this.isAdmin ? `<button class="act-btn" onclick="app.deleteJoke('${joke.id}')" style="background:#ff1744; color:#fff;">🗑️</button>` : ''}
                    ${purgeMode ? `<button class="act-btn ${this.user.hasSaved?'voted':''}" onclick="app.vote('${joke.id}', 'save')">💖 SALVAR</button>` : 
                    `<button class="act-btn ${isVoted?'voted':''}" onclick="app.vote('${joke.id}', 'best')">🤣 <span>${joke.votes_best || 0}</span></button>
                     <button class="act-btn ${isVoted?'voted':''}" onclick="app.vote('${joke.id}', 'bad')">🍅 <span>${joke.votes_bad || 0}</span></button>`}
                    <button class="act-btn" onclick="app.share('${joke.id}')">↗️</button>
                </div>
            </div>`;
    }

    async post() {
        const text = this.dom.input.value.trim();
        const alias = this.dom.alias.value.trim();
        
        if (!alias || !text) return this.toast("⚠️ Escribe algo...");
        
        this.setLoading(true);
        try {
            const joke = { 
                text, 
                author: alias, 
                authorid: this.user.id, 
                color: document.querySelector('.dot.active').dataset.color, 
                rot: parseFloat((Math.random()*4-2).toFixed(1)), 
                votes_best: 0, 
                votes_bad: 0 
            };
            const { data, error } = await client.from('jokes').insert([joke]).select();
            
            if (error) {
                if (error.code === '23505') return this.toast("🚫 Ese chiste ya existe.");
                throw error;
            }
            
            this.dom.input.value = ''; 
            this.user.alias = alias;
            this.saveUser();
            this.refreshData();
            this.toast("¡Pegado! 🌍");
        } catch(e) { 
            console.error("Post Error Details:", e.message || e, e.details || "", e.hint || "");
            this.toast(`🔴 Error: ${e.message || "Revisa la conexión"}`); 
        }
        this.setLoading(false);
    }

    setLoading(loading) {
        this.dom.postBtn.disabled = loading;
        this.dom.postBtn.innerHTML = loading ? `<span class="spinner"></span>...` : "PEGAR";
    }

    async generateGroqJoke() {
        try {
            const memory = this.state.jokes.slice(0, 10).map(j => j.text).join(' | ');
            const { data, error } = await client.functions.invoke('generate-joke', { body: { memory } });
            if (error) throw error;
            return data.joke;
        } catch (e) { return null; }
    }

    // --- MÉTODOS DE APOYO (SIN CAMBIOS) ---
    loadUser() {
        let u;
        try { u = JSON.parse(localStorage.getItem(CONFIG.USER_KEY)); } catch(e) { u = null; }
        if (!u || !u.id) u = { id: 'usr-'+Math.random().toString(36).substr(2,9), voted: [], owned: [], alias: '', hasSaved: false };
        return u;
    }
    isPurgeActive() {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        return (lastDay - now.getDate()) <= 3;
    }
    getSortedJokes() {
        let list = [...this.state.jokes];
        if (this.state.sort === 'best') return list.sort((a,b) => (b.votes_best || 0) - (a.votes_best || 0));
        if (this.state.sort === 'controversial') return list.filter(j => (j.votes_bad || 0) > 0).sort((a,b) => (b.votes_bad || 0) - (a.votes_bad || 0)).slice(0, 3);
        return list.sort((a,b) => new Date(b.ts) - new Date(a.ts));
    }
    async vote(id, type) {
        const joke = this.state.jokes.find(j => j.id === id);
        if(!joke) return;
        if (this.user.owned.includes(id)) return this.toast("⛔ No puedes votarte a ti mismo.");
        if (type === 'save') {
            if (this.user.hasSaved) return this.toast("⚠️ Ya has usado tu salvación.");
            type = 'best'; this.user.hasSaved = true;
        } else {
            if (this.user.voted.includes(id)) return this.toast("⚠️ Ya has votado");
            this.user.voted.push(id);
        }
        const field = type === 'best' ? 'votes_best' : 'votes_bad';
        await client.from('jokes').update({ [field]: (joke[field] || 0) + 1 }).eq('id', id);
        this.saveUser();
    }
    updateStats() {
        const worst = this.state.jokes.filter(j => (j.votes_bad || 0) > 0).sort((a,b) => b.votes_bad - a.votes_bad).slice(0, 3);
        if (this.dom.purgList) this.dom.purgList.innerHTML = worst.length ? worst.map(j => `<li><span>${j.author}</span> <span>🍅 ${j.votes_bad}</span></li>`).join('') : '<li>Vacío...</li>';
        const best = this.state.jokes.filter(j => (j.votes_best || 0) > 0).sort((a,b) => b.votes_best - a.votes_best).slice(0, 5);
        if (this.dom.humorList) this.dom.humorList.innerHTML = best.map(j => `<li><span>${j.author}</span> <span>🤣 ${j.votes_best}</span></li>`).join('');
    }
    async refreshData() {
        const { data } = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(200);
        if (data) { this.state.jokes = data; this.syncWall(); }
    }
    tryAdminAccess() {
        if (++this.adminClicks >= 5) {
            if (prompt("Contraseña Admin:") === "admin123") { this.isAdmin = true; this.syncWall(true); this.toast("⚠️ MODO ADMIN"); }
            this.adminClicks = 0;
        }
    }
    async deleteJoke(id) { if (confirm("¿Borrar?")) await client.from('jokes').delete().eq('id', id); }
    async share(id) {
        const joke = this.state.jokes.find(j => j.id === id);
        if(!joke) return;
        const shareText = `"${joke.text}" - Chiste de ${joke.author} en EL MURO 🧱`;
        if (navigator.share) await navigator.share({ title: 'EL MURO', text: shareText, url: window.location.href });
        else window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
    }
    async checkDailyAIJoke() {
        const lastAI = this.state.jokes.filter(j => j.authorid === CONFIG.AI_NAME).sort((a,b) => new Date(b.ts) - new Date(a.ts))[0];
        if (!lastAI || (Date.now() - new Date(lastAI.ts).getTime() >= 21600000)) {
            const text = await this.generateGroqJoke();
            if (text) {
                const names = ["Alex", "Leo", "Sofi", "Marc", "Eva", "Bruno", "Iris", "Luca"];
                await client.from('jokes').insert([{ text, author: names[Math.floor(Math.random()*names.length)], authorid: CONFIG.AI_NAME, color: "#FFEB3B", rot: 1, votes_best: 0, votes_bad: 0 }]);
                this.refreshData();
            }
        }
    }
    updateAvatarUI() { if(this.dom.avatarImg) this.dom.avatarImg.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${this.user.id}`; }
    checkPurgeTimer() {
        const el = document.getElementById('purgatory-status');
        if(el) {
            const days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
            el.innerHTML = days <= 3 ? "🔴 PURGA ACTIVA" : `FIN DEL MES: ${days} DÍAS`;
        }
    }
    toggleMute() { this.isMuted = !this.isMuted; this.dom.muteBtn.innerText = this.isMuted ? "🔇" : "🔊"; this.toast(this.isMuted ? "Audio OFF" : "Audio ON"); }
    toast(msg) {
        const t = document.createElement('div'); t.className = 'toast show'; t.innerText = msg;
        document.getElementById('toast-container').appendChild(t);
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2000);
    }
    sanitize(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

window.app = new App();