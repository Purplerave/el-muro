/**
 * EL MURO V13.7 - ANTI-CRASH VERSION
 */

var SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';

var CONFIG = {
    USER_KEY: 'elMuro_v6_usr',
    STORAGE_KEY: 'elMuro_v6_db',
    AI_NAME: '00000000-0000-0000-0000-000000000000'
};

var client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
    var u;
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
        const res = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(200);
        if (res.data) {
            app.state.jokes = res.data;
            if (new Date().getDate() === 1) executePurge();
            freezeOrder();
            syncWall();
            checkDailyAIJoke();
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(res.data));
        }
    } catch (e) {}

    client.channel('public:jokes').on('postgres_changes', { event: '*', schema: 'public', table: 'jokes' }, function(payload) {
        handleRealtime(payload);
    }).subscribe();
}

function freezeOrder() {
    var list = app.state.jokes.slice();
    if (app.state.sort === 'best') {
        app.displayOrder = list.sort(function(a,b) { return (b.votes_best || 0) - (a.votes_best || 0); });
    } else if (app.state.sort === 'controversial') {
        app.displayOrder = list.filter(function(j) {
            return (j.votes_bad || 0) > (j.votes_best || 0);
        }).sort(function(a,b) { return (b.votes_bad - b.votes_best) - (a.votes_bad - a.votes_best); }).slice(0, 3);
    } else {
        app.displayOrder = list.sort(function(a,b) { return new Date(b.ts) - new Date(a.ts); });
    }
}

function handleRealtime(payload) {
    if (payload.eventType === 'UPDATE') {
        var idx = app.state.jokes.findIndex(function(j) { return j.id === payload.new.id; });
        if (idx !== -1) app.state.jokes[idx] = payload.new;
        updateCardUI(payload.new);
        updateStats();
    } else if (payload.eventType === 'INSERT') {
        showToast('Nuevos chistes! Refresca.');
    }
}

function updateCardUI(joke) {
    var card = document.getElementById('joke-' + joke.id);
    if (card) {
        var spans = card.querySelectorAll('.actions span');
        if(spans[0]) spans[0].innerText = joke.votes_best || 0;
        if(spans[1]) spans[1].innerText = joke.votes_bad || 0;
    }
}

function syncWall() {
    var container = app.dom.mural;
    if(!container) return;
    var fragment = document.createDocumentFragment();
    container.innerHTML = '';
    
    app.displayOrder.forEach(function(j) { fragment.appendChild(createCard(j)); });
    container.appendChild(fragment);
    container.parentElement.scrollTop = 0;
    updateStats();
}

function createCard(joke) {
    var el = document.createElement('article');
    el.className = 'post-it';
    el.id = 'joke-' + joke.id;
    el.style.setProperty('--bg-c', joke.color || '#FFEB3B');
    el.style.setProperty('--rot', (joke.rot || 0) + 'deg');
    
    var isVoted = app.user.voted.indexOf(joke.id) !== -1;
    var purgeActive = isPurgeActive();
    var isCondemned = (joke.votes_bad || 0) > (joke.votes_best || 0);
    
    var actionsHTML = '';
    if (app.state.sort === 'controversial' && purgeActive && isCondemned) {
        var savedClass = app.user.hasSaved ? 'voted' : '';
        actionsHTML = '<button class="act-btn vote-btn ' + savedClass + '" data-id="' + joke.id + '" data-type="save" style="background:var(--accent); color:#000;">SALVAR</button>';
    } else {
        var vClass = isVoted ? 'voted' : '';
        actionsHTML = '<button class="act-btn vote-btn ' + vClass + '" data-id="' + joke.id + '" data-type="best">\u{1F923} <span>' + (joke.votes_best || 0) + '</span></button>' +
                       '<button class="act-btn vote-btn ' + vClass + '" data-id="' + joke.id + '" data-type="bad">\u{1F345} <span>' + (joke.votes_bad || 0) + '</span></button>';
    }

    var adminBtn = app.isAdmin ? '<button class="act-btn del-btn" data-id="' + joke.id + '" style="background:#ff1744; color:#fff;">DEL</button>' : '';
    var authorImg = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (joke.authorid || joke.author);

    el.innerHTML = '<div class="post-body">' + sanitize(joke.text) + '</div>' +
        '<div class="post-footer">' +
            '<div class="author-info">' +
                '<img src="' + authorImg + '" width="24" height="24" style="width:24px!important;height:24px!important;border-radius:50%;border:1px solid #000;background:#fff;flex-shrink:0;">' +
                sanitize(joke.author) +
            '</div>' +
            '<div class="actions">' +
                adminBtn +
                actionsHTML +
                '<button class="act-btn share-btn" data-id="' + joke.id + '">\u{2197}</button>' +
            '</div>' +
        '</div>';
    return el;
}

function initDelegation() {
    app.dom.mural.addEventListener('click', function(e) {
        var btn = e.target.closest('.act-btn');
        if (!btn) return;
        var id = btn.dataset.id;
        if (btn.classList.contains('vote-btn')) vote(id, btn.dataset.type);
        if (btn.classList.contains('share-btn')) shareJoke(id);
        if (btn.classList.contains('del-btn')) deleteJoke(id);
    });
}

async function vote(id, type) {
    if (type === 'save') {
        if (app.user.hasSaved) return showToast('Ya has usado tu salvacion.');
        type = 'best'; app.user.hasSaved = true;
    } else {
        if (app.user.voted.indexOf(id) !== -1) return showToast('Ya has votado');
        if (app.user.owned.indexOf(id) !== -1) return showToast('Es tu chiste');
    }
    var joke = app.state.jokes.find(function(j) { return j.id === id; });
    var field = type === 'best' ? 'votes_best' : 'votes_bad';
    try {
        const res = await client.from('jokes').update({ [field]: (joke[field] || 0) + 1 }).eq('id', id);
        if (!res.error) { 
            if (type !== 'best' || !app.user.hasSaved) app.user.voted.push(id);
            localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(app.user)); 
            refreshData(); 
        }
    } catch(e) {}
}

async function postJoke() {
    var text = app.dom.input.value.trim();
    var alias = app.dom.alias.value.trim();
    if (!alias || text.length < 3) return showToast('Escribe algo...');
    app.dom.postBtn.disabled = true;
    try {
        var dot = document.querySelector('.dot.active');
        var color = dot ? dot.dataset.color : '#FFEB3B';
        const res = await client.from('jokes').insert([{ text: text, author: alias, authorid: app.user.id, color: color, rot: 1, votes_best: 0, votes_bad: 0 }]).select();
        if (!res.error) { 
            app.dom.input.value = ''; 
            app.user.owned.push(res.data[0].id); 
            localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(app.user)); 
            refreshData(); 
            showToast('Pegado!'); 
        }
    } catch(e) {}
    app.dom.postBtn.disabled = false;
}

function searchJokes(term) {
    var t = term.toLowerCase();
    document.querySelectorAll('.post-it').forEach(function(card) {
        var content = card.querySelector('.post-body').textContent.toLowerCase();
        card.style.display = content.indexOf(t) !== -1 ? 'block' : 'none';
    });
}

function showToast(m) {
    var t = document.createElement('div'); t.className = 'toast show'; t.innerText = m;
    var c = document.getElementById('toast-container');
    if(c) { c.appendChild(t); setTimeout(function() { if(t.parentNode) t.remove(); }, 2500); }
}

function sanitize(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function isPurgeActive() {
    var now = new Date();
    var lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return (lastDay - now.getDate()) <= 3;
}

window.onload = function() {
    app.user = loadUser();
    cacheDOM();
    initDelegation();
    app.dom.postBtn.onclick = postJoke;
    app.dom.input.oninput = function(e) { app.dom.charCounter.innerText = e.target.value.length + '/300'; };
    app.dom.searchInput.oninput = function(e) { searchJokes(e.target.value); };
    app.dom.filters.forEach(function(btn) {
        btn.onclick = function() {
            app.dom.filters.forEach(function(f) { f.classList.remove('active'); });
            btn.classList.add('active');
            app.state.sort = btn.dataset.sort;
            freezeOrder();
            syncWall();
        };
    });
    app.dom.muteBtn.onclick = function() { app.isMuted = !app.isMuted; app.dom.muteBtn.innerText = app.isMuted ? 'MUTE' : 'VOL'; };
    app.dom.dashToggle.onclick = function() {
        var isH = app.dom.dashboard.getAttribute('aria-hidden') === 'true';
        app.dom.dashboard.setAttribute('aria-hidden', !isH);
        app.dom.dashToggle.innerText = isH ? 'X' : 'RANK';
    };
    var closeBtn = document.getElementById('close-dash-btn');
    if(closeBtn) closeBtn.onclick = function() { app.dom.dashboard.setAttribute('aria-hidden', 'true'); app.dom.dashToggle.innerText = 'RANK'; };
    if(app.dom.avatarImg) app.dom.avatarImg.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + app.user.id;
    initGlobalSync();
};

async function executePurge() {
    var targets = app.state.jokes.filter(function(j) { return (j.votes_bad || 0) > (j.votes_best || 0); }).slice(0, 3);
    for (var i=0; i<targets.length; i++) await client.from('jokes').delete().eq('id', targets[i].id);
}

async function checkDailyAIJoke() {
    var lastAI = app.state.jokes.filter(function(j) { return j.authorid === CONFIG.AI_NAME; })[0];
    if (!lastAI || (Date.now() - new Date(lastAI.ts).getTime() >= 21600000)) {
        try {
            const res = await client.functions.invoke('generate-joke', { body: { memory: "" } });
            if (res.data && res.data.joke) await client.from('jokes').insert([{ text: res.data.joke, author: "Bot", authorid: CONFIG.AI_NAME, color: "#FFEB3B", rot: 1, votes_best: 0, votes_bad: 0 }]);
        } catch(e) {}
    }
}

function updateStats() {
    var worst = app.state.jokes.filter(function(j) { return (j.votes_bad || 0) > (j.votes_best || 0); }).slice(0, 3);
    if (app.dom.purgList) app.dom.purgList.innerHTML = worst.map(function(j) { return '<li><img src="https://api.dicebear.com/7.x/bottts/svg?seed=' + (j.authorid || j.author) + '" style="width:20px;height:20px;border-radius:50%;margin-right:10px;"> <span>' + j.author + '</span> <span style="color:#ff1744">' + j.votes_bad + '</span></li>'; }).join('') || '<li>Libre</li>';
    var best = app.state.jokes.slice().sort(function(a,b) { return (b.votes_best || 0) - (a.votes_best || 0); }).slice(0, 5);
    if (app.dom.humorList) app.dom.humorList.innerHTML = best.map(function(j) { return '<li><img src="https://api.dicebear.com/7.x/bottts/svg?seed=' + (j.authorid || j.author) + '" style="width:20px;height:20px;border-radius:50%;margin-right:10px;"> <span>' + j.author + '</span> <span style="color:var(--accent)">' + (j.votes_best || 0) + '</span></li>'; }).join('');
}

async function deleteJoke(id) { if (confirm('Borrar?')) { await client.from('jokes').delete().eq('id', id); refreshData(); } }
async function shareJoke(id) {
    var joke = app.state.jokes.find(function(j) { return j.id === id; });
    var txt = '"' + joke.text + '" - en EL MURO';
    if (navigator.share) await navigator.share({ title: 'EL MURO', text: txt, url: window.location.href });
    else window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(txt));
}