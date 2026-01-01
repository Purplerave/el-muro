/**
 * EL MURO V8.0 - PRODUCTION READY (CEO & GROK APPROVED)
 * Mobile Fixed | Persistence | Viral Sharing | Robust UI
 */

const SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';
const GROQ_KEY = ''; // ELIMINADO POR SEGURIDAD (Secret Scanning)

const CONFIG = {
    USER_KEY: 'elMuro_v6_usr',
    STORAGE_KEY: 'elMuro_v6_db',
    AI_NAME: '00000000-0000-0000-0000-000000000000'
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
        
        this.cacheDOM();
        this.initEvents();
        this.loadLocalJokes();
        this.initGlobalSync(); 
        this.updateAvatarUI();
        this.checkPurgeTimer();
    }

    loadUser() {
        let u;
        try { u = JSON.parse(localStorage.getItem(CONFIG.USER_KEY)); } catch(e) { u = null; }
        if (!u || !u.id) u = { id: 'usr-'+Math.random().toString(36).substr(2,9), voted: [], owned: [], alias: '', hasSaved: false };
        if (u.hasSaved === undefined) u.hasSaved = false;
        return u;
    }

    saveUser() {
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(this.user));
    }

    loadLocalJokes() {
        try {
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
            }
        } catch (e) { console.error(e); }

        client.channel('public:jokes').on('postgres_changes', { event: '*', schema: 'public', table: 'jokes' }, (payload) => {
            if (payload.eventType === 'UPDATE') {
                const idx = this.state.jokes.findIndex(j => j.id === payload.new.id);
                if (idx !== -1) {
                    this.state.jokes[idx] = payload.new;
                    const card = document.getElementById(`joke-${payload.new.id}`);
                    if (card) {
                        const spans = card.querySelectorAll('.actions span');
                        if(spans[0]) spans[0].innerText = payload.new.votes_best || 0;
                        if(spans[1]) spans[1].innerText = payload.new.votes_bad || 0;
                    }
                    this.updateStats();
                }
            } else if (payload.eventType === 'DELETE') {
                this.state.jokes = this.state.jokes.filter(j => j.id !== payload.old.id);
                this.syncWall();
            } else if (payload.eventType === 'INSERT') {
                this.refreshData();
            }
        }).subscribe();
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
            dashboard: document.getElementById('dashboard')
        };
        // Cargar alias persistente
        if(this.user.alias) this.dom.alias.value = this.user.alias;
    }

    initEvents() {
        document.getElementById('post-btn').onclick = () => this.post();
        this.dom.filters.forEach(btn => {
            btn.onclick = () => {
                this.dom.filters.forEach(f => f.classList.remove('active'));
                btn.classList.add('active');
                this.state.sort = btn.dataset.sort;
                this.syncWall(); 
            };
        });

        if(this.dom.title) this.dom.title.onclick = () => this.tryAdminAccess();
        if(this.dom.muteBtn) this.dom.muteBtn.onclick = () => this.toggleMute();
        
        // MOBILE DASHBOARD TOGGLE
        if(this.dom.dashToggle) {
            this.dom.dashToggle.onclick = () => {
                const isHidden = this.dom.dashboard.getAttribute('aria-hidden') === 'true';
                this.dom.dashboard.setAttribute('aria-hidden', !isHidden);
                this.dom.dashToggle.innerText = isHidden ? "❌" : "🏆";
            };
        }
    }

    async share(id) {
        const joke = this.state.jokes.find(j => j.id === id);
        if(!joke) return;
        
        const shareText = `"${joke.text}" - Chiste de ${joke.author} en EL MURO 🧱`;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'EL MURO DE LOS CHISTES MALOS',
                    text: shareText,
                    url: window.location.href
                });
            } catch (err) { console.log("Share cancelled"); }
        } else {
            // Fallback a Twitter
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
        }
    }

    tryAdminAccess() {
        if (++this.adminClicks >= 5) {
            if (prompt("Contraseña Admin:") === "admin123") {
                this.isAdmin = true;
                this.syncWall();
                this.toast("⚠️ MODO ADMIN ACTIVADO");
            }
            this.adminClicks = 0;
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.dom.muteBtn.innerText = this.isMuted ? "🔇" : "🔊";
        this.toast(this.isMuted ? "Audio OFF" : "Audio ON");
    }

    isPurgeActive() {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        return (lastDay - now.getDate()) <= 3;
    }

    getSortedJokes() {
        let list = [...this.state.jokes];
        if (this.state.sort === 'new') return list.sort((a,b) => new Date(b.ts) - new Date(a.ts));
        if (this.state.sort === 'best') return list.sort((a,b) => (b.votes_best || 0) - (a.votes_best || 0));
        if (this.state.sort === 'controversial') return list.filter(j => (j.votes_bad || 0) > 0).sort((a,b) => (b.votes_bad || 0) - (a.votes_bad || 0)).slice(0, 3);
        return list;
    }

    syncWall() {
        const sorted = this.getSortedJokes();
        const container = this.dom.mural;
        if(!container) return;
        container.innerHTML = '';
        
        if (this.state.sort === 'controversial') {
            const active = this.isPurgeActive();
            const days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
            const infoDiv = document.createElement('div');
            infoDiv.className = "danger-zone";
            infoDiv.style.cssText = "grid-column:1/-1; background:#1a1a1a; border:2px dashed #ff1744; padding:20px; text-align:center; margin-bottom:20px;";
            infoDiv.innerHTML = `<h2 style="font-family:'Bangers'; color:#ff1744; font-size:2rem;">💀 MODO PURGA</h2><p style="color:#aaa; max-width:600px; margin:10px auto;">${active ? "¡LA PURGA HA EMPEZADO! Salva a uno. El resto será borrado." : "Aquí aparecerán los 3 peores. Quedan "+days+" días para el juicio."}</p>`;
            container.appendChild(infoDiv);
        }

        if (sorted.length === 0) {
            container.innerHTML += `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#aaa;"><h2 style="font-family:'Bangers'; font-size:3rem; color:var(--accent);">VACÍO...</h2></div>`;
        } else {
            sorted.forEach(j => container.appendChild(this.createCard(j)));
        }
        this.updateStats();
    }

    createCard(joke) {
        const el = document.createElement('article');
        el.className = 'post-it';
        el.id = `joke-${joke.id}`;
        el.style.setProperty('--bg-c', joke.color || '#FFEB3B');
        el.style.setProperty('--rot', `${joke.rot || 0}deg`);
        const isVoted = this.user.voted.includes(joke.id);
        const purgeMode = this.state.sort === 'controversial' && this.isPurgeActive();
        
        el.innerHTML = `
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
        return el;
    }

    async deleteJoke(id) {
        if (confirm("¿Borrar este chiste?")) {
            await client.from('jokes').delete().eq('id', id);
        }
    }

    async vote(id, type) {
        if (type === 'save') {
            if (this.user.hasSaved) return this.toast("⚠️ Ya has votado.");
            type = 'best'; this.user.hasSaved = true;
        } else {
            if (this.user.voted.includes(id)) return this.toast("⚠️ Ya has votado");
            this.user.voted.push(id);
        }
        const joke = this.state.jokes.find(j => j.id === id);
        if(!joke) return;
        const field = type === 'best' ? 'votes_best' : 'votes_bad';
        await client.from('jokes').update({ [field]: (joke[field] || 0) + 1 }).eq('id', id);
        this.saveUser();
    }

    async refreshData() {
        const { data } = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(200);
        if (data) { this.state.jokes = data; this.syncWall(); }
    }

    updateStats() {
        const worst = this.state.jokes.filter(j => (j.votes_bad || 0) > 0).sort((a,b) => b.votes_bad - a.votes_bad).slice(0, 3);
        if (this.dom.purgList) this.dom.purgList.innerHTML = worst.length ? worst.map(j => `<li><span>${j.author}</span> <span>🍅 ${j.votes_bad}</span></li>`).join('') : '<li>Vacío...</li>';
        const best = this.state.jokes.filter(j => (j.votes_best || 0) > 0).sort((a,b) => b.votes_best - a.votes_best).slice(0, 5);
        if (this.dom.humorList) this.dom.humorList.innerHTML = best.map(j => `<li><span>${j.author}</span> <span>🤣 ${j.votes_best}</span></li>`).join('');
    }

    checkPurgeTimer() {
        const el = document.getElementById('purgatory-status');
        if(!el) return;
        const days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
        el.innerHTML = days <= 3 ? "🔴 PURGA ACTIVA" : `FIN DEL MES: ${days} DÍAS`;
    }

    async post() {
        const text = this.dom.input.value.trim();
        const alias = this.dom.alias.value.trim();
        if (!alias || text.length < 3) return this.toast("⚠️ Revisa el nombre y el texto");
        if (this.state.jokes.some(j => j.text.toLowerCase() === text.toLowerCase())) return this.toast("🚫 Ya existe.");
        
        const joke = { text, author: alias, authorid: this.user.id, color: document.querySelector('.dot.active').dataset.color, rot: parseFloat((Math.random()*4-2).toFixed(1)), votes_best: 0, votes_bad: 0 };
        const { data, error } = await client.from('jokes').insert([joke]).select();
        if (!error && data) { 
            this.dom.input.value = ''; 
            this.user.alias = alias; // Guardar alias para la próxima
            this.saveUser();
            this.refreshData();
            this.toast("¡Pegado! 🌍"); 
        }
    }

    async checkDailyAIJoke() {
        const today = new Date().toLocaleDateString('en-CA'); 
        const hasDaily = this.state.jokes.some(j => j.authorid === CONFIG.AI_NAME && new Date(j.ts).toLocaleDateString('en-CA') === today);
        if (!hasDaily) {
            const jokeText = await this.generateGroqJoke();
            if (jokeText) {
                const names = ["Alex", "Leo", "Sofi", "Marc", "Eva", "Bruno", "Iris", "Luca"];
                const joke = { text: jokeText, author: names[Math.floor(Math.random()*names.length)], authorid: CONFIG.AI_NAME, color: ["#FFEB3B", "#FF4081", "#00E676", "#2979FF"][Math.floor(Math.random()*4)], rot: parseFloat((Math.random()*4-2).toFixed(1)), votes_best: 0, votes_bad: 0 };
                await client.from('jokes').insert([joke]);
                this.refreshData();
            }
        }
    }

    async generateGroqJoke() {
        try {
            const memory = this.state.jokes.slice(0, 10).map(j => j.text).join(' | ');
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [{ role: "system", content: `Genera un chiste corto y malo en español. Solo el texto. No repitas: ${memory}` }]
                })
            });
            const data = await response.json();
            return data.choices[0].message.content.trim().replace(/^"|"$/g, '');
        } catch (e) { return null; }
    }

    updateAvatarUI() { if(this.dom.avatarImg) this.dom.avatarImg.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${this.user.id}`; }
    toast(msg) {
        const t = document.createElement('div'); t.className = 'toast show'; t.innerText = msg;
        document.getElementById('toast-container').appendChild(t);
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2000);
    }
    sanitize(str) { const d = document.createElement('div'); d.innerText = str; return d.innerHTML; }
}

window.app = new App();