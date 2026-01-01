/**
 * EL MURO V12.3 - FROZEN ORDER (CEO APPROVED)
 * Smart Sorting | Static Layout | Manual Refresh
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
    displayOrder: [], // Aquí guardamos el orden congelado
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
            
            // Purga automática día 1
            if (new Date().getDate() === 1) executePurge();

            // CONGELAR ORDEN INICIAL
            freezeOrder();
            syncWall();
            checkDailyAIJoke();
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
        }
    } catch (e) {}

    // ESCUCHA REALTIME (Solo actualiza números, no mueve tarjetas)
    client.channel('public:jokes').on('postgres_changes', { event: '*', schema: 'public', table: 'jokes' }, (payload) => {
        handleRealtime(payload);
    }).subscribe();
}

function freezeOrder() {
    // Calculamos el orden basado en el filtro actual y lo guardamos
    const list = [...app.state.jokes];
    let sorted;

    if (app.state.sort === 'best') {
        sorted = list.sort((a,b) => {
            if ((b.votes_best || 0) !== (a.votes_best || 0)) return (b.votes_best || 0) - (a.votes_best || 0);
            return (a.votes_bad || 0) - (b.votes_bad || 0); // Empate: menos tomates arriba
        });
    } else if (app.state.sort === 'controversial') {
        sorted = list.filter(j => (j.votes_bad || 0) > (j.votes_best || 0))
                     .sort((a,b) => {
                         const diffA = (a.votes_bad || 0) - (a.votes_best || 0);
                         const diffB = (b.votes_bad || 0) - (b.votes_best || 0);
                         return diffB - diffA; // Más "negatividad" arriba
                     }).slice(0, 3);
    } else {
        sorted = list.sort((a,b) => new Date(b.ts) - new Date(a.ts));
    }
    
    app.displayOrder = sorted;
}

function handleRealtime(payload) {
    if (payload.eventType === 'UPDATE') {
        // Actualizar datos en el estado maestro
        const idx = app.state.jokes.findIndex(j => j.id === payload.new.id);
        if (idx !== -1) app.state.jokes[idx] = payload.new;

        // Actualizar visualmente la tarjeta SIN MOVERLA
        const card = document.getElementById(`joke-${payload.new.id}`);
        if (card) {
            const spans = card.querySelectorAll('.actions span');
            if(spans[0]) spans[0].innerText = payload.new.votes_best || 0;
            if(spans[1]) spans[1].innerText = payload.new.votes_bad || 0;
        }
        updateStats();
    } else if (payload.eventType === 'INSERT') {
        showToast("✨ Alguien ha pegado un chiste nuevo. Refresca para verlo.");
    } else if (payload.eventType === 'DELETE') {
        const card = document.getElementById(`joke-${payload.old.id}`);
        if (card) card.style.opacity = '0.3'; // Visualmente eliminado hasta refresco
    }
}

async function executePurge() {
    const targets = app.state.jokes
        .filter(j => (j.votes_bad || 0) > (j.votes_best || 0))
        .sort((a,b) => (b.votes_bad - b.votes_best) - (a.votes_bad - a.votes_best))
        .slice(0, 3);
    for (let joke of targets) await client.from('jokes').delete().eq('id', joke.id);
}

function syncWall() {
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

    if (app.displayOrder.length === 0) {
        container.innerHTML += '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#aaa;"><h2 style="font-family:Bangers; font-size:3rem; color:var(--accent);">VACÍO...</h2></div>';
    } else {
        app.displayOrder.forEach(j => container.appendChild(createCard(j)));
    }
    updateStats();
}

function createCard(joke) {
    const el = document.createElement('article');
    el.className = 'post-it';
    el.id = `joke-${joke.id}`;
    el.style.setProperty('--bg-c', joke.color || '#FFEB3B');
    el.style.setProperty('--rot', (joke.rot || 0) + 'deg');
    const isVoted = app.user.voted.includes(joke.id);
    const purgeActive = isPurgeActive();
    const isCondemned = (joke.votes_bad || 0) > (joke.votes_best || 0);
    
    let actionsHTML = '';
    if (app.state.sort === 'controversial' && purgeActive && isCondemned) {
        actionsHTML = `<button class="act-btn ${app.user.hasSaved?'voted':''}" onclick="vote('${joke.id}', 'save')" style="background:var(--accent); color:#000;">💖 SALVAR</button>`;
    } else {
        actionsHTML = `<button class="act-btn ${isVoted?'voted':''}" onclick="vote('${joke.id}', 'best')">😂 <span>${joke.votes_best || 0}</span></button>
                       <button class="act-btn ${isVoted?'voted':''}" onclick="vote('${joke.id}', 'bad')">🍅 <span>${joke.votes_bad || 0}</span></button>`;
    }

    el.innerHTML = `<div class="post-body">${sanitize(joke.text)}</div>
        <div class="post-footer">
            <div class="author-info"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${joke.authorid || joke.author}">${sanitize(joke.author)}</div>
            <div class="actions">
                ${app.isAdmin ? `<button class="act-btn" onclick="deleteJoke('${joke.id}')" style="background:#ff1744; color:#fff;">🗑️</button>` : ''}
                ${actionsHTML}
                <button class="act-btn" onclick="shareJoke('${joke.id}')">↗️</button>
            </div>
        </div>`;
    return el;
}

async function vote(id, type) {
    if (type === 'save') {
        if (app.user.hasSaved) return showToast("⚠️ Ya has usado tu salvación.");
        type = 'best'; app.user.hasSaved = true;
    } else {
        if (app.user.voted.includes(id)) return showToast("⚠️ Ya has votado");
        if (app.user.owned.includes(id)) return showToast("⛔ No puedes votarte a ti mismo.");
    }

    const joke = app.state.jokes.find(j => j.id === id);
    if(!joke) return;

    try {
        const field = type === 'best' ? 'votes_best' : 'votes_bad';
        const { error } = await client.from('jokes').update({ [field]: (joke[field] || 0) + 1 }).eq('id', id);
        if (error) throw error;
        
        if (type !== 'best' || !app.user.hasSaved) app.user.voted.push(id);
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(app.user));
        
        // ACTUALIZACIÓN LOCAL INMEDIATA DE LA TARJETA (SIN MOVERLA)
        const card = document.getElementById(`joke-${id}`);
        if (card) {
            const span = card.querySelector(type === 'best' ? '.actions span:first-of-type' : '.actions span:nth-of-type(2)');
            if (span) span.innerText = (joke[field] || 0) + 1;
            card.querySelectorAll('.act-btn').forEach(b => b.classList.add('voted'));
        }
        showToast("¡Voto registrado!");
    } catch(e) { showToast("🔴 Fallo al votar"); }
}

function updateStats() {
    const worst = app.state.jokes.filter(j => (j.votes_bad || 0) > (j.votes_best || 0)).sort((a,b) => (b.votes_bad - b.votes_best) - (a.votes_bad - a.votes_best)).slice(0, 3);
    if (app.dom.purgList) app.dom.purgList.innerHTML = worst.length ? worst.map(j => `<li><span>${j.author}</span> <span style="color:#ff1744">🍅 ${j.votes_bad}</span></li>`).join('') : '<li>Libre</li>';
    const best = app.state.jokes.filter(j => (j.votes_best || 0) > 0).sort((a,b) => b.votes_best - a.votes_best).slice(0, 5);
    if (app.dom.humorList) app.dom.humorList.innerHTML = best.map(j => `<li><span>${j.author}</span> <span>🤣 ${j.votes_best}</span></li>`).join('');
}

function isPurgeActive() {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return (lastDay - now.getDate()) <= 3;
}

async function postJoke() {
    const text = app.dom.input.value.trim();
    const alias = app.dom.alias.value.trim();
    if (!alias || !text) return showToast("⚠️ Completa todo");
    app.dom.postBtn.disabled = true;
    try {
        const joke = { text, author: alias, authorid: app.user.id, color: document.querySelector('.dot.active').dataset.color, rot: parseFloat((Math.random()*4-2).toFixed(1)), votes_best: 0, votes_bad: 0 };
        const { data, error } = await client.from('jokes').insert([joke]).select();
        if (error) throw error;
        app.dom.input.value = ''; app.user.alias = alias; app.user.owned.push(data[0].id);
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(app.user));
        showToast("¡Pegado! Refresca para ver el orden.");
        // Añadimos al inicio de la lista visual por cortesía
        app.dom.mural.prepend(createCard(data[0]));
    } catch(e) { showToast("🔴 Error al publicar"); }
    app.dom.postBtn.disabled = false;
}

function deleteJoke(id) { if (confirm("Borrar?")) client.from('jokes').delete().eq('id', id).then(() => { const c = document.getElementById(`joke-${id}`); if(c) c.remove(); }); }
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

async function checkDailyAIJoke() {
    const lastAI = app.state.jokes.filter(j => j.authorid === CONFIG.AI_NAME).sort((a,b) => new Date(b.ts) - new Date(a.ts))[0];
    if (!lastAI || (Date.now() - new Date(lastAI.ts).getTime() >= 21600000)) {
        try {
            const memory = app.state.jokes.slice(0, 10).map(j => j.text).join(' | ');
            const { data } = await client.functions.invoke('generate-joke', { body: { memory } });
            if (data && data.joke) await client.from('jokes').insert([{ text: data.joke, author: "Bot", authorid: CONFIG.AI_NAME, color: "#FFEB3B", rot: 1, votes_best: 0, votes_bad: 0 }]);
        } catch(e) {}
    }
}

window.onload = function() {
    app.user = loadUser();
    cacheDOM();
    app.dom.postBtn.onclick = postJoke;
    app.dom.filters.forEach(btn => {
        btn.onclick = () => {
            app.dom.filters.forEach(f => f.classList.remove('active'));
            btn.classList.add('active');
            app.state.sort = btn.dataset.sort;
            freezeOrder(); // Solo aquí recalculamos el orden
            syncWall();
        };
    });
    app.dom.dots.forEach(d => { d.onclick = () => { app.dom.dots.forEach(x => x.classList.remove('active')); d.classList.add('active'); }; });
    app.dom.title.onclick = () => { if (++app.adminClicks >= 5) { if (prompt("Admin:") === "admin123") { app.isAdmin = true; syncWall(); showToast("⚠️ ADMIN"); } app.adminClicks = 0; } };
    app.dom.dashToggle.onclick = () => { const isHidden = app.dom.dashboard.getAttribute('aria-hidden') === 'true'; app.dom.dashboard.setAttribute('aria-hidden', !isHidden); app.dom.dashToggle.innerText = isHidden ? "X" : "🏆"; };
    if(app.dom.avatarImg) app.dom.avatarImg.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + app.user.id;
    initGlobalSync();
};