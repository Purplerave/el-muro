/**
 * EL MURO V10.1 - COMPATIBILITY & FIX
 */

const SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';

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
        try { 
            u = JSON.parse(localStorage.getItem(CONFIG.USER_KEY)); 
        } catch(e) { 
            u = null; 
        }
        
        function genUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }

        if (!u || !u.id || u.id.length < 20) {
            u = { id: genUUID(), voted: [], owned: [], alias: '', hasSaved: false };
            localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(u));
        }
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

        client.channel('public:jokes').on('postgres_changes', { event: '*', schema: 'public', table: 'jokes' }, () => {
            this.refreshData();
        }).subscribe();
    }

    async refreshData() {
        const { data } = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(200);
        if (data) {
            this.state.jokes = data;
            this.syncWall();
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
            postBtn: document.getElementById('post-btn'),
            dots: document.querySelectorAll('.dot')
        };
        if(this.user.alias) this.dom.alias.value = this.user.alias;
    }

    initEvents() {
        const self = this;
        this.dom.postBtn.onclick = function() { self.post(); };
        this.dom.filters.forEach(function(btn) {
            btn.onclick = function() {
                self.dom.filters.forEach(function(f) { f.classList.remove('active'); });
                btn.classList.add('active');
                self.state.sort = btn.dataset.sort;
                self.syncWall(); 
            };
        });
        this.dom.dots.forEach(function(d) {
            d.onclick = function() {
                self.dom.dots.forEach(function(x) { x.classList.remove('active'); });
                d.classList.add('active');
            };
        });
        if(this.dom.title) this.dom.title.onclick = function() { self.tryAdminAccess(); };
        if(this.dom.muteBtn) this.dom.muteBtn.onclick = function() { self.toggleMute(); };
        if(this.dom.dashToggle) {
            this.dom.dashToggle.onclick = function() {
                const isHidden = self.dom.dashboard.getAttribute('aria-hidden') === 'true';
                self.dom.dashboard.setAttribute('aria-hidden', !isHidden);
                self.dom.dashToggle.innerText = isHidden ? "❌" : "🏆";
            };
        }
    }

    getSortedJokes() {
        let list = [...this.state.jokes];
        if (this.state.sort === 'best') return list.sort((a,b) => (b.votes_best || 0) - (a.votes_best || 0));
        if (this.state.sort === 'controversial') return list.filter(j => (j.votes_bad || 0) > 0).sort((a,b) => (b.votes_bad || 0) - (a.votes_bad || 0)).slice(0, 3);
        return list.sort((a,b) => new Date(b.ts) - new Date(a.ts));
    }

    syncWall() {
        const sorted = this.getSortedJokes();
        const container = this.dom.mural;
        if(!container) return;

        container.innerHTML = '';
        
        if (this.state.sort === 'controversial') {
            const days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
            const info = document.createElement('div');
            info.style.cssText = "grid-column:1/-1; background:#1a1a1a; border:2px dashed #ff1744; padding:20px; text-align:center; margin-bottom:20px;";
            info.innerHTML = '<h2 style="font-family:\'Bangers\'; color:#ff1744; font-size:2rem;">💀 MODO PURGA</h2><p style="color:#aaa;">Días para el juicio: '+days+'</p>';
            container.appendChild(info);
        }

        if (sorted.length === 0) {
            container.innerHTML += '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#aaa;"><h2 style="font-family:\'Bangers\'; font-size:3rem; color:var(--accent);">VACÍO...</h2></div>';
        } else {
            const self = this;
            sorted.forEach(function(j) { container.appendChild(self.createCard(j)); });
        }
        this.updateStats();
    }

    createCard(joke) {
        const el = document.createElement('article');
        el.className = 'post-it';
        el.style.setProperty('--bg-c', joke.color || '#FFEB3B');
        el.style.setProperty('--rot', (joke.rot || 0) + 'deg');
        const isVoted = this.user.voted.includes(joke.id);
        
        el.innerHTML = "` +
            `<div class="post-body">${this.sanitize(joke.text)}</div>` +
            `<div class="post-footer">
                <div class="author-info"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${joke.authorid || joke.author}">${this.sanitize(joke.author)}</div>
                <div class="actions">
                    ${this.isAdmin ? `<button class="act-btn" onclick="app.deleteJoke('${joke.id}')" style="background:#ff1744; color:#fff;">🗑️</button>` : ''}
                    <button class="act-btn ${isVoted?'voted':''}" onclick="app.vote('${joke.id}', 'best')">🤣 <span>${joke.votes_best || 0}</span></button>
                    <button class="act-btn ${isVoted?'voted':''}" onclick="app.vote('${joke.id}', 'bad')">🍅 <span>${joke.votes_bad || 0}</span></button>
                    <button class="act-btn" onclick="app.share('${joke.id}')">↗️</button>
                </div>
            </div>`;
        return el;
    }

    async post() {
        const text = this.dom.input.value.trim();
        const alias = this.dom.alias.value.trim();
        if (!alias || !text) return this.toast("⚠️ Completa todo");
        
        this.setLoading(true);
        try {
            const joke = { 
                text: text, author: alias, authorid: this.user.id, 
                color: document.querySelector('.dot.active').dataset.color, 
                rot: parseFloat((Math.random()*4-2).toFixed(1)), 
                votes_best: 0, votes_bad: 0 
            };
            const { data, error } = await client.from('jokes').insert([joke]).select();
            if (error) throw error;
            this.dom.input.value = ''; 
            this.user.alias = alias;
            this.saveUser();
            this.refreshData();
            this.toast("¡Pegado! 🌍");
        } catch(e) { 
            console.error("Error Post:", e);
            this.toast("🔴 Error al publicar"); 
        }
        this.setLoading(false);
    }

    setLoading(loading) {
        this.dom.postBtn.disabled = loading;
        this.dom.postBtn.innerHTML = loading ? "..." : "PEGAR";
    }

    async vote(id, type) {
        if (this.user.voted.includes(id)) return this.toast("⚠️ Ya has votado");
        if (this.user.owned.includes(id)) return this.toast("⛔ No puedes votarte a ti mismo.");
        
        const joke = this.state.jokes.find(j => j.id === id);
        if(!joke) return;

        const field = type === 'best' ? 'votes_best' : 'votes_bad';
        const { error } = await client.from('jokes').update({ [field]: (joke[field] || 0) + 1 }).eq('id', id);
        if (!error) {
            this.user.voted.push(id);
            this.saveUser();
            this.refreshData();
        }
    }

    updateStats() {
        const worst = this.state.jokes.filter(j => (j.votes_bad || 0) > 0).sort((a,b) => b.votes_bad - a.votes_bad).slice(0, 3);
        if (this.dom.purgList) this.dom.purgList.innerHTML = worst.length ? worst.map(j => `<li><span>${j.author}</span> <span>🍅 ${j.votes_bad}</span></li>`).join('') : '<li>Vacío...</li>';
        const best = this.state.jokes.filter(j => (j.votes_best || 0) > 0).sort((a,b) => b.votes_best - a.votes_best).slice(0, 5);
        if (this.dom.humorList) this.dom.humorList.innerHTML = best.map(j => `<li><span>${j.author}</span> <span>🤣 ${j.votes_best}</span></li>`).join('');
    }

    tryAdminAccess() {
        if (++this.adminClicks >= 5) {
            const p = prompt("Admin:");
            if (p === "admin123") { this.isAdmin = true; this.syncWall(); this.toast("⚠️ ADMIN"); }
            this.adminClicks = 0;
        }
    }

    async deleteJoke(id) { if (confirm("¿Borrar?")) await client.from('jokes').delete().eq('id', id); }
    
    async share(id) {
        const joke = this.state.jokes.find(j => j.id === id);
        if(!joke) return;
        const txt = '"' + joke.text + '" - ' + joke.author + ' en EL MURO';
        if (navigator.share) await navigator.share({ title: 'EL MURO', text: txt, url: window.location.href });
        else window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(txt), '_blank');
    }

    async checkDailyAIJoke() {
        const lastAI = this.state.jokes.filter(j => j.authorid === CONFIG.AI_NAME).sort((a,b) => new Date(b.ts) - new Date(a.ts))[0];
        if (!lastAI || (Date.now() - new Date(lastAI.ts).getTime() >= 21600000)) {
            try {
                const memory = this.state.jokes.slice(0, 10).map(j => j.text).join(' | ');
                const { data } = await client.functions.invoke('generate-joke', { body: { memory } });
                if (data && data.joke) {
                    await client.from('jokes').insert([{ text: data.joke, author: "IA", authorid: CONFIG.AI_NAME, color: "#FFEB3B", rot: 1, votes_best: 0, votes_bad: 0 }]);
                    this.refreshData();
                }
            } catch(e) {}
        }
    }

    updateAvatarUI() { if(this.dom.avatarImg) this.dom.avatarImg.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + this.user.id; }
    
    checkPurgeTimer() {
        const el = document.getElementById('purgatory-status');
        if(el) {
            const days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
            el.innerHTML = days <= 3 ? "🔴 PURGA ACTIVA" : 'FIN DEL MES: ' + days + ' DÍAS';
        }
    }

    toggleMute() { this.isMuted = !this.isMuted; this.dom.muteBtn.innerText = this.isMuted ? "🔇" : "🔊"; }
    
    toast(msg) {
        const t = document.createElement('div'); t.className = 'toast show'; t.innerText = msg;
        const container = document.getElementById('toast-container');
        if(container) {
            container.appendChild(t);
            setTimeout(function() { t.classList.remove('show'); setTimeout(function() { t.remove(); }, 300); }, 2000);
        }
    }

    sanitize(str) { 
        const d = document.createElement('div'); 
        d.textContent = str; 
        return d.innerHTML; 
    }
}

window.app = new App();
