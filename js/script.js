/**
 * EL MURO V13.6 - AVATAR FIX BLINDADO
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
    displayOrder: [],
    user: null,
    isAdmin: false,
    adminClicks: 0,
    isMuted: false,
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
    if (!u || !u.id) {
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
        searchInput: document.getElementById('search-input'),
        charCounter: document.getElementById('char-counter')
    };
    if(app.user.alias) app.dom.alias.value = app.user.alias;
}

async function initGlobalSync() {
    try {
        const { data, error } = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(200);
        if (data) {
            app.state.jokes = data;
            if (new Date().getDate() === 1) executePurge();
            freezeOrder();
            syncWall();
            checkDailyAIJoke();
        }
    } catch (e) {}

    client.channel('public:jokes').on('postgres_changes', { event: '*', schema: 'public', table: 'jokes' }, (payload) => {
        handleRealtime(payload);
    }).subscribe();
}

function freezeOrder() {
    const list = [...app.state.jokes];
    if (app.state.sort === 'best') {
        app.displayOrder = list.sort((a,b) => (b.votes_best || 0) - (a.votes_best || 0));
    } else if (app.state.sort === 'controversial') {
        app.displayOrder = list.filter(j => {
            return (j.votes_bad || 0) > (j.votes_best || 0);
        }).sort((a,b) => (b.votes_bad - b.votes_best) - (a.votes_bad - a.votes_best)).slice(0, 3);
    } else {
        app.displayOrder = list.sort((a,b) => new Date(b.ts) - new Date(a.ts));
    }
}

function handleRealtime(payload) {
    if (payload.eventType === 'UPDATE') {
        const idx = app.state.jokes.findIndex(j => j.id === payload.new.id);
        if (idx !== -1) app.state.jokes[idx] = payload.new;
        updateCardUI(payload.new);
        updateStats();
    } else if (payload.eventType === 'INSERT') {
        showToast("✨ Hay chistes nuevos. Refresca para verlos.");
    }
}

function updateCardUI(joke) {
    const card = document.getElementById(`joke-${joke.id}`);
    if (card) {
        const spans = card.querySelectorAll('.actions span');
        if(spans[0]) spans[0].innerText = joke.votes_best || 0;
        if(spans[1]) spans[1].innerText = joke.votes_bad || 0;
    }
}

function syncWall() {
    const container = app.dom.mural;
    if(!container) return;
    const fragment = document.createDocumentFragment();
    container.innerHTML = '';
    
    app.displayOrder.forEach(j => fragment.appendChild(createCard(j)));
    container.appendChild(fragment);
    container.parentElement.scrollTop = 0;
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
        actionsHTML = `<button class="act-btn vote-btn ${app.user.hasSaved?'voted':''}" data-id="${joke.id}" data-type="save" style="background:var(--accent); color:#000;">💖 SALVAR</button>`;
    } else {
        actionsHTML = `<button class="act-btn vote-btn ${isVoted?'voted':''}" data-id="${joke.id}" data-type="best">🤣 <span>${joke.votes_best || 0}</span></button>
                       <button class="act-btn vote-btn ${isVoted?'voted':''}" data-id="${joke.id}" data-type="bad">🍅 <span>${joke.votes_bad || 0}</span></button>`;
    }

    el.innerHTML = `<div class="post-body">${sanitize(joke.text)}</div>
        <div class="post-footer">
            <div class="author-info">
                <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${joke.authorid || joke.author}" width="24" height="24" style="width:24px!important;height:24px!important;border-radius:50%;border:1px solid #000;background:#fff;flex-shrink:0;">
                ${sanitize(joke.author)}
            </div>
            <div class="actions">
                ${app.isAdmin ? `<button class="act-btn del-btn" data-id="${joke.id}" style="background:#ff1744; color:#fff;">🗑️</button>` : ''}
                ${actionsHTML}
                <button class="act-btn share-btn" data-id="${joke.id}">↗️</button>
            </div>
        </div>`;
    return el;
}

function initDelegation() {
    app.dom.mural.addEventListener('click', (e) => {
        const btn = e.target.closest('.act-btn');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.classList.contains('vote-btn')) vote(id, btn.dataset.type);
        if (btn.classList.contains('share-btn')) shareJoke(id);
        if (btn.classList.contains('del-btn')) deleteJoke(id);
    });
}

async function vote(id, type) {
    if (type === 'save') {
        if (app.user.hasSaved) return showToast("⚠️ Ya has usado tu salvación.");
        type = 'best'; app.user.hasSaved = true;
    } else {
        if (app.user.voted.includes(id)) return showToast("⚠️ Ya has votado");
        if (app.user.owned.includes(id)) return showToast("⛔ Es tu chiste");
    }
    const joke = app.state.jokes.find(j => j.id === id);
    const field = type === 'best' ? 'votes_best' : 'votes_bad';
    try {
        const { error } = await client.from('jokes').update({ [field]: (joke[field] || 0) + 1 }).eq('id', id);
        if (!error) { 
            if (type !== 'best' || !app.user.hasSaved) app.user.voted.push(id);
            localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(app.user)); 
            refreshData(); 
        }
    } catch(e) {}
}

async function postJoke() {
    const text = app.dom.input.value.trim();
    const alias = app.dom.alias.value.trim();
    if (!alias || text.length < 3) return showToast("⚠️ Escribe algo...");
    app.dom.postBtn.disabled = true;
    try {
        const { data, error } = await client.from('jokes').insert([{ text, author: alias, authorid: app.user.id, color: document.querySelector('.dot.active').dataset.color, rot: 1, votes_best: 0, votes_bad: 0 }]).select();
        if (!error) { app.dom.input.value = ''; app.user.owned.push(data[0].id); localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(app.user)); refreshData(); showToast("¡Pegado! 🌍"); }
    } catch(e) {}
    app.dom.postBtn.disabled = false;
}

function searchJokes(term) {
    const t = term.toLowerCase();
    document.querySelectorAll('.post-it').forEach(card => {
        const content = card.querySelector('.post-body').textContent.toLowerCase();
        card.style.display = content.includes(t) ? 'block' : 'none';
    });
}

function showToast(m) {
    const t = document.createElement('div'); t.className = 'toast'; t.innerText = m;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

function sanitize(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

window.onload = function() {
    app.user = loadUser();
    cacheDOM();
    initDelegation();
    app.dom.postBtn.onclick = postJoke;
    app.dom.input.oninput = (e) => app.dom.charCounter.innerText = `${e.target.value.length}/300`;
    app.dom.searchInput.oninput = (e) => searchJokes(e.target.value);
    app.dom.filters.forEach(btn => {
        btn.onclick = () => {
            app.dom.filters.forEach(f => f.classList.remove('active'));
            btn.classList.add('active');
            app.state.sort = btn.dataset.sort;
            freezeOrder();
            syncWall();
        };
    });
    app.dom.muteBtn.onclick = () => { app.isMuted = !app.isMuted; app.dom.muteBtn.innerText = app.isMuted ? "🔇" : "🔊"; };
    app.dom.dashToggle.onclick = () => {
        const isHidden = app.dom.dashboard.getAttribute('aria-hidden') === 'true';
        app.dom.dashboard.setAttribute('aria-hidden', !isHidden);
        app.dom.dashToggle.innerText = isHidden ? "X" : "🏆";
    };
    const closeBtn = document.getElementById('close-dash-btn');
    if(closeBtn) closeBtn.onclick = () => { app.dom.dashboard.setAttribute('aria-hidden', 'true'); app.dom.dashToggle.innerText = "🏆"; };
    app.dom.mural.onclick = () => { if (app.dom.dashboard.getAttribute('aria-hidden') === 'false') { app.dom.dashboard.setAttribute('aria-hidden', 'true'); app.dom.dashToggle.innerText = "🏆"; } };
    if(app.dom.avatarImg) app.dom.avatarImg.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + app.user.id;
    initGlobalSync();
};

async function executePurge() {
    const targets = app.state.jokes.filter(j => (j.votes_bad || 0) > (j.votes_best || 0)).slice(0, 3);
    for (let j of targets) await client.from('jokes').delete().eq('id', j.id);
}

async function checkDailyAIJoke() {
    const lastAI = app.state.jokes.filter(j => j.authorid === CONFIG.AI_NAME)[0];
    if (!lastAI || (Date.now() - new Date(lastAI.ts).getTime() >= 21600000)) {
        try {
            const { data } = await client.functions.invoke('generate-joke', { body: { memory: "" } });
            if (data && data.joke) await client.from('jokes').insert([{ text: data.joke, author: "IA", authorid: CONFIG.AI_NAME, color: "#FFEB3B", rot: 1, votes_best: 0, votes_bad: 0 }]);
        } catch(e) {}
    }
}

function updateStats() {
    const worst = app.state.jokes.filter(j => (j.votes_bad || 0) > (j.votes_best || 0)).slice(0, 3);
    if (app.dom.purgList) app.dom.purgList.innerHTML = worst.map(j => `<li><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${j.authorid || j.author}" style="width:20px;height:20px;border-radius:50%;margin-right:10px;"> <span>${j.author}</span> <span style="color:#ff1744">🍅 ${j.votes_bad}</span></li>`).join('') || '<li>Libre</li>';
    const best = [...app.state.jokes].sort((a,b) => (b.votes_best || 0) - (a.votes_best || 0)).slice(0, 5);
    if (app.dom.humorList) app.dom.humorList.innerHTML = best.map(j => `<li><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${j.authorid || j.author}" style="width:20px;height:20px;border-radius:50%;margin-right:10px;"> <span>${j.author}</span> <span style="color:var(--accent)">🤣 ${j.votes_best || 0}</span></li>`).join('');
}

async function deleteJoke(id) { if (confirm("¿Borrar?")) { await client.from('jokes').delete().eq('id', id); refreshData(); } }
async function shareJoke(id) {
    const joke = app.state.jokes.find(j => j.id === id);
    const txt = `"${joke.text}" - en EL MURO`;
    if (navigator.share) await navigator.share({ title: 'EL MURO', text: txt, url: window.location.href });
    else window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(txt));
}