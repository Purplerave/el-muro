/**
 * EL MURO V12.0 - FINAL PRODUCTION VERSION
 */

const SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';

const CONFIG = {
    USER_KEY: 'elMuro_v6_usr',
    STORAGE_KEY: 'elMuro_v6_db',
    AI_NAME: '00000000-0000-0000-0000-000000000000'
};

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.app = {
    state: { jokes: [], sort: 'new' },
    user: null,
    isAdmin: false,
    adminClicks: 0,
    dom: {}
};

function genUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = (c == 'x' ? r : (r & 0x3 | 0x8));
        return v.toString(16);
    });
}

function loadUser() {
    let u;
    try { u = JSON.parse(localStorage.getItem(CONFIG.USER_KEY)); } catch(e) { u = null; }
    if (!u || !u.id || u.id.length < 30) {
        u = { id: genUUID(), voted: [], owned: [], alias: '', hasSaved: false };
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(u));
    }
    return u;
}

function cacheDOM() {
    app.dom = {
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
    if(app.user.alias) app.dom.alias.value = app.user.alias;
}

async function initGlobalSync() {
    try {
        const { data, error } = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(200);
        if (data) {
            app.state.jokes = data;
            syncWall();
            checkDailyAIJoke(); // Ciclo automático activo
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
        }
    } catch (e) {}

    client.channel('public:jokes').on('postgres_changes', { event: '*', schema: 'public', table: 'jokes' }, () => {
        refreshData();
    }).subscribe();
}

async function refreshData() {
    const { data } = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(200);
    if (data) {
        app.state.jokes = data;
        syncWall();
    }
}

function syncWall() {
    const sorted = getSortedJokes();
    const container = app.dom.mural;
    if(!container) return;
    container.innerHTML = '';
    
    if (app.state.sort === 'controversial') {
        const days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
        const info = document.createElement('div');
        info.style.cssText = "grid-column:1/-1; background:#1a1a1a; border:2px dashed #ff1744; padding:20px; text-align:center; margin-bottom:20px;";
        info.innerHTML = `<h2 style="font-family:Bangers; color:#ff1744; font-size:2rem;">💀 MODO PURGA</h2><p style="color:#aaa;">Días para el juicio: ${days}</p>`;
        container.appendChild(info);
    }

    if (sorted.length === 0) {
        container.innerHTML += '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#aaa;"><h2 style="font-family:Bangers; font-size:3rem; color:var(--accent);">VACÍO...</h2></div>';
    } else {
        sorted.forEach(j => container.appendChild(createCard(j)));
    }
    updateStats();
}

function createCard(joke) {
    const el = document.createElement('article');
    el.className = 'post-it';
    el.style.setProperty('--bg-c', joke.color || '#FFEB3B');
    el.style.setProperty('--rot', (joke.rot || 0) + 'deg');
    const isVoted = app.user.voted.includes(joke.id);
    
    el.innerHTML = `<div class="post-body">${sanitize(joke.text)}</div>
        <div class="post-footer">
            <div class="author-info"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${joke.authorid || joke.author}">${sanitize(joke.author)}</div>
            <div class="actions">
                ${app.isAdmin ? `<button class="act-btn" onclick="deleteJoke('${joke.id}')" style="background:#ff1744; color:#fff;">🗑️</button>` : ''}
                <button class="act-btn ${isVoted?'voted':''}" onclick="vote('${joke.id}', 'best')">🤣 <span>${joke.votes_best || 0}</span></button>
                <button class="act-btn ${isVoted?'voted':''}" onclick="vote('${joke.id}', 'bad')">🍅 <span>${joke.votes_bad || 0}</span></button>
                <button class="act-btn" onclick="shareJoke('${joke.id}')">↗️</button>
            </div>
        </div>`;
    return el;
}

async function postJoke() {
    const text = app.dom.input.value.trim();
    const alias = app.dom.alias.value.trim();
    if (!alias || !text) return showToast("⚠️ Completa todo");
    
    app.dom.postBtn.disabled = true;
    try {
        const activeDot = document.querySelector('.dot.active');
        const color = activeDot ? activeDot.dataset.color : '#FFEB3B';
        const joke = { 
            text: text, author: alias, authorid: app.user.id, 
            color: color, rot: parseFloat((Math.random()*4-2).toFixed(1)), 
            votes_best: 0, votes_bad: 0 
        };
        const { error } = await client.from('jokes').insert([joke]);
        if (error) throw error;
        app.dom.input.value = ''; 
        app.user.alias = alias;
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(app.user));
        refreshData();
        showToast("¡Pegado! 🌍");
    } catch(e) { showToast("🔴 Error al publicar"); }
    app.dom.postBtn.disabled = false;
}

async function checkDailyAIJoke() {
    const lastAI = app.state.jokes.filter(j => j.authorid === CONFIG.AI_NAME).sort((a,b) => new Date(b.ts) - new Date(a.ts))[0];
    const now = Date.now();
    const sixHours = 6 * 60 * 60 * 1000;

    if (!lastAI || (now - new Date(lastAI.ts).getTime() >= sixHours)) {
        const jokeText = await generateGroqJoke();
        if (jokeText) {
            const names = ["Alex", "Leo", "Sofi", "Marc", "Eva", "Bruno", "Iris", "Luca"];
            const joke = {
                text: jokeText, author: names[Math.floor(Math.random()*names.length)], authorid: CONFIG.AI_NAME,
                color: "#FFEB3B", rot: 1, votes_best: 0, votes_bad: 0
            };
            await client.from('jokes').insert([joke]);
            refreshData();
        }
    }
}

async function generateGroqJoke() {
    try {
        const memory = app.state.jokes.slice(0, 10).map(j => j.text).join(' | ');
        const { data, error } = await client.functions.invoke('generate-joke', { body: { memory: memory } });
        if (error) throw error;
        return data.joke;
    } catch (e) { return null; }
}

function getSortedJokes() {
    let list = [...app.state.jokes];
    if (app.state.sort === 'best') return list.sort((a,b) => (b.votes_best || 0) - (a.votes_best || 0));
    if (app.state.sort === 'controversial') return list.filter(j => (j.votes_bad || 0) > 0).sort((a,b) => (b.votes_bad || 0) - (a.votes_bad || 0)).slice(0, 3);
    return list.sort((a,b) => new Date(b.ts) - new Date(a.ts));
}

async function vote(id, type) {
    if (app.user.voted.includes(id)) return showToast("⚠️ Ya has votado");
    const joke = app.state.jokes.find(j => j.id === id);
    if(!joke) return;
    const field = type === 'best' ? 'votes_best' : 'votes_bad';
    const { error } = await client.from('jokes').update({ [field]: (joke[field] || 0) + 1 }).eq('id', id);
    if (!error) { app.user.voted.push(id); localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(app.user)); refreshData(); }
}

function updateStats() {
    const worst = app.state.jokes.filter(j => (j.votes_bad || 0) > 0).sort((a,b) => b.votes_bad - a.votes_bad).slice(0, 3);
    if (app.dom.purgList) app.dom.purgList.innerHTML = worst.length ? worst.map(j => `<li><span>${j.author}</span> <span>🍅 ${j.votes_bad}</span></li>`).join('') : '<li>Vacío</li>';
    const best = app.state.jokes.filter(j => (j.votes_best || 0) > 0).sort((a,b) => b.votes_best - a.votes_best).slice(0, 5);
    if (app.dom.humorList) app.dom.humorList.innerHTML = best.map(j => `<li><span>${j.author}</span> <span>🤣 ${j.votes_best}</span></li>`).join('');
}

function deleteJoke(id) { if (confirm("Borrar?")) client.from('jokes').delete().eq('id', id).then(() => refreshData()); }

function shareJoke(id) {
    const joke = app.state.jokes.find(j => j.id === id);
    if(!joke) return;
    const txt = `"${joke.text}" - ${joke.author} en EL MURO`;
    if (navigator.share) navigator.share({ title: 'EL MURO', text: txt, url: window.location.href });
    else window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(txt)}`, '_blank');
}

function showToast(msg) {
    const t = document.createElement('div'); t.className = 'toast show'; t.innerText = msg;
    const c = document.getElementById('toast-container');
    if(c) { c.appendChild(t); setTimeout(() => { t.classList.remove('show'); setTimeout(() => { if(t.parentNode) t.remove(); }, 300); }, 2500); }
}

function sanitize(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

window.onload = function() {
    app.user = loadUser();
    cacheDOM();
    app.dom.postBtn.onclick = postJoke;
    app.dom.filters.forEach(btn => {
        btn.onclick = () => {
            app.dom.filters.forEach(f => f.classList.remove('active'));
            btn.classList.add('active');
            app.state.sort = btn.dataset.sort;
            syncWall();
        };
    });
    app.dom.dots.forEach(d => {
        d.onclick = () => { app.dom.dots.forEach(x => x.classList.remove('active')); d.classList.add('active'); };
    });
    app.dom.title.onclick = () => {
        if (++app.adminClicks >= 5) {
            if (prompt("Admin:") === "admin123") { app.isAdmin = true; syncWall(); showToast("⚠️ ADMIN"); }
            app.adminClicks = 0;
        }
    };
    app.dom.dashToggle.onclick = () => {
        const isHidden = app.dom.dashboard.getAttribute('aria-hidden') === 'true';
        app.dom.dashboard.setAttribute('aria-hidden', !isHidden);
        app.dom.dashToggle.innerText = isHidden ? "X" : "🏆";
    };
    if(app.dom.avatarImg) app.dom.avatarImg.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + app.user.id;
    initGlobalSync();
};