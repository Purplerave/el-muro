/**
 * EL MURO V10.5 - ESTRUCTURA BLINDADA
 */

var SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';

var CONFIG = {
    USER_KEY: 'elMuro_v6_usr',
    STORAGE_KEY: 'elMuro_v6_db',
    AI_NAME: '00000000-0000-0000-0000-000000000000'
};

var client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function App() {
    this.state = { jokes: [], sort: 'new' };
    this.isAdmin = false;
    this.adminClicks = 0;
    this.isMuted = false;
    this.dom = {}; 
    
    this.init();
}

App.prototype.init = function() {
    this.user = this.loadUser();
    this.cacheDOM();
    this.initEvents();
    this.loadLocalJokes();
    this.initGlobalSync(); 
    this.updateAvatarUI();
    this.checkPurgeTimer();
};

App.prototype.loadUser = function() {
    var u = null;
    try { 
        var data = localStorage.getItem(CONFIG.USER_KEY);
        if (data) u = JSON.parse(data);
    } catch(e) {}

    if (!u || !u.id) {
        u = { 
            id: 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now(), 
            voted: [], owned: [], alias: '', hasSaved: false 
        };
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(u));
    }
    return u;
};

App.prototype.saveUser = function() { 
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(this.user)); 
};

App.prototype.loadLocalJokes = function() {
    try {
        var local = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY));
        if (local && Array.isArray(local)) {
            this.state.jokes = local;
            this.syncWall();
        }
    } catch(e) {}
};

App.prototype.initGlobalSync = async function() {
    var self = this;
    try {
        const res = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(200);
        if (res.data) {
            self.state.jokes = res.data;
            self.syncWall();
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(res.data));
        }
    } catch (e) {}

    client.channel('public:jokes').on('postgres_changes', { event: '*', schema: 'public', table: 'jokes' }, function() {
        self.refreshData();
    }).subscribe();
};

App.prototype.refreshData = async function() {
    var self = this;
    const res = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(200);
    if (res.data) {
        self.state.jokes = res.data;
        self.syncWall();
    }
};

App.prototype.cacheDOM = function() {
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
};

App.prototype.initEvents = function() {
    var self = this;
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
            var isHidden = self.dom.dashboard.getAttribute('aria-hidden') === 'true';
            self.dom.dashboard.setAttribute('aria-hidden', !isHidden);
            self.dom.dashToggle.innerText = isHidden ? "X" : "RANK";
        };
    }
};

App.prototype.getSortedJokes = function() {
    var list = this.state.jokes.slice();
    if (this.state.sort === 'best') {
        return list.sort(function(a,b) { return (b.votes_best || 0) - (a.votes_best || 0); });
    }
    if (this.state.sort === 'controversial') {
        return list.filter(function(j) { return (j.votes_bad || 0) > 0; }).sort(function(a,b) { return (b.votes_bad || 0) - (a.votes_bad || 0); }).slice(0, 3);
    }
    return list.sort(function(a,b) { return new Date(b.ts) - new Date(a.ts); });
};

App.prototype.syncWall = function() {
    var sorted = this.getSortedJokes();
    var container = this.dom.mural;
    if(!container) return;

    container.innerHTML = '';
    
    if (this.state.sort === 'controversial') {
        var days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
        var info = document.createElement('div');
        info.style.cssText = "grid-column:1/-1; background:#1a1a1a; border:2px dashed #ff1744; padding:20px; text-align:center; margin-bottom:20px;";
        info.innerHTML = '<h2 style="font-family:Bangers; color:#ff1744; font-size:2rem;">PURGA</h2><p style="color:#aaa;">Dias: '+days+'</p>';
        container.appendChild(info);
    }

    if (sorted.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#aaa;"><h2 style="font-family:Bangers; font-size:3rem;">VACIO</h2></div>';
    } else {
        var self = this;
        sorted.forEach(function(j) { container.appendChild(self.createCard(j)); });
    }
    this.updateStats();
};

App.prototype.createCard = function(joke) {
    var el = document.createElement('article');
    el.className = 'post-it';
    el.style.setProperty('--bg-c', joke.color || '#FFEB3B');
    el.style.setProperty('--rot', (joke.rot || 0) + 'deg');
    var isVoted = this.user.voted.indexOf(joke.id) !== -1;
    
    var votedClass = isVoted ? 'voted' : '';
    var authorImg = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (joke.authorid || joke.author);
    
    var html = '';
    html += '<div class="post-body">' + this.sanitize(joke.text) + '</div>';
    html += '<div class="post-footer">';
    html += '<div class="author-info"><img src="' + authorImg + '">' + this.sanitize(joke.author) + '</div>';
    html += '<div class="actions">';
    if(this.isAdmin) html += '<button class="act-btn" onclick="app.deleteJoke(\' '+joke.id+'\')" style="background:#ff1744; color:#fff;">DEL</button>';
    html += '<button class="act-btn '+votedClass+'" onclick="app.vote(\' '+joke.id+'\', \'best\')">😂 <span>'+(joke.votes_best || 0)+'</span></button>';
    html += '<button class="act-btn '+votedClass+'" onclick="app.vote(\' '+joke.id+'\', \'bad\')">🍅 <span>'+(joke.votes_bad || 0)+'</span></button>';
    html += '<button class="act-btn" onclick="app.share(\' '+joke.id+'\')">SH</button>';
    html += '</div></div>';
    
    el.innerHTML = html;
    return el;
};

App.prototype.post = async function() {
    var text = this.dom.input.value.trim();
    var alias = this.dom.alias.value.trim();
    if (!alias || !text) return this.toast("Error: Vacio");
    
    this.setLoading(true);
    try {
        var activeDot = document.querySelector('.dot.active');
        var color = activeDot ? activeDot.dataset.color : '#FFEB3B';
        var joke = { 
            text: text, author: alias, authorid: this.user.id, 
            color: color, 
            rot: parseFloat((Math.random()*4-2).toFixed(1)), 
            votes_best: 0, votes_bad: 0 
        };
        const res = await client.from('jokes').insert([joke]).select();
        if (res.error) throw res.error;
        this.dom.input.value = ''; 
        this.user.alias = alias;
        this.saveUser();
        this.refreshData();
        this.toast("Pegado!");
    } catch(e) { 
        this.toast("Error al publicar"); 
    }
    this.setLoading(false);
};

App.prototype.setLoading = function(l) {
    this.dom.postBtn.disabled = l;
    this.dom.postBtn.innerHTML = l ? "..." : "PEGAR";
};

App.prototype.vote = async function(id, type) {
    if (this.user.voted.indexOf(id) !== -1) return this.toast("Ya has votado");
    var joke = this.state.jokes.find(function(j) { return j.id === id; });
    if(!joke) return;

    var field = type === 'best' ? 'votes_best' : 'votes_bad';
    const res = await client.from('jokes').update({ [field]: (joke[field] || 0) + 1 }).eq('id', id);
    if (!res.error) {
        this.user.voted.push(id);
        this.saveUser();
        this.refreshData();
    }
};

App.prototype.updateStats = function() {
    var jokes = this.state.jokes;
    var worst = jokes.filter(function(j) { return (j.votes_bad || 0) > 0; }).sort(function(a,b) { return b.votes_bad - a.votes_bad; }).slice(0, 3);
    if (this.dom.purgList) {
        this.dom.purgList.innerHTML = worst.length ? worst.map(function(j) { return '<li><span>' + j.author + '</span> <span>' + j.votes_bad + '</span></li>'; }).join('') : '<li>Vacio</li>';
    }
    var best = jokes.filter(function(j) { return (j.votes_best || 0) > 0; }).sort(function(a,b) { return b.votes_best - a.votes_best; }).slice(0, 5);
    if (this.dom.humorList) {
        this.dom.humorList.innerHTML = best.map(function(j) { return '<li><span>' + j.author + '</span> <span>' + j.votes_best + '</span></li>'; }).join('');
    }
};

App.prototype.tryAdminAccess = function() {
    if (++this.adminClicks >= 5) {
        var p = prompt("Pw:");
        if (p === "admin123") { this.isAdmin = true; this.syncWall(); this.toast("ADMIN"); }
        this.adminClicks = 0;
    }
};

App.prototype.deleteJoke = async function(id) { 
    if (confirm("Borrar?")) await client.from('jokes').delete().eq('id', id); 
};

App.prototype.share = function(id) {
    var joke = this.state.jokes.find(function(j) { return j.id === id; });
    if(!joke) return;
    var txt = joke.text + " - " + joke.author;
    if (navigator.share) navigator.share({ title: 'EL MURO', text: txt, url: window.location.href });
    else window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(txt), '_blank');
};

App.prototype.updateAvatarUI = function() { 
    if(this.dom.avatarImg) this.dom.avatarImg.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + this.user.id; 
};

App.prototype.checkPurgeTimer = function() {
    var el = document.getElementById('purgatory-status');
    if(el) {
        var days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
        el.innerHTML = days <= 3 ? "PURGA" : 'FIN: ' + days + ' DIAS';
    }
};

App.prototype.toggleMute = function() { 
    this.isMuted = !this.isMuted; 
    this.dom.muteBtn.innerText = this.isMuted ? "MUTE" : "VOL"; 
};

App.prototype.toast = function(m) {
    var t = document.createElement('div'); 
    t.className = 'toast show'; 
    t.innerText = m;
    var c = document.getElementById('toast-container');
    if(c) {
        c.appendChild(t);
        setTimeout(function() { t.classList.remove('show'); setTimeout(function() { if(t.parentNode) t.remove(); }, 300); }, 2000);
    }
};

App.prototype.sanitize = function(s) { 
    var d = document.createElement('div'); 
    d.textContent = s;
    return d.innerHTML; 
};

window.app = new App();
