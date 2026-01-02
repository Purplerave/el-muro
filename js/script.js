/**
 * EL MURO V15.0 - BLINDAJE TOTAL Y LIMPIEZA DE CUALQUIER ERROR
 */

var SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
// Usamos la nueva clave publishable para máxima compatibilidad con RLS
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';

var CONFIG = {
    USER_KEY: 'elMuro_v6_usr',
    STORAGE_KEY: 'elMuro_v6_db',
    AI_NAME: '00000000-0000-0000-0000-000000000000',
    COOLDOWN_MS: 30000
};

var client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function debounce(func, wait) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function() {
            func.apply(context, args);
        }, wait);
    };
}

window.app = {
    state: { jokes: [], sort: 'new' },
    displayOrder: [],
    user: null,
    fingerprint: null,
    isMuted: false,
    sounds: {
        post: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
        laugh: new Audio('https://assets.mixkit.co/active_storage/sfx/2802/2802-preview.mp3'),
        splat: new Audio('https://assets.mixkit.co/active_storage/sfx/2747/2747-preview.mp3'),
        click: new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3')
    },
    dom: {}
};

function playSfx(name) {
    if (app.isMuted) return;
    var s = app.sounds[name];
    if (s) {
        s.currentTime = 0;
        s.play().catch(function(e) {});
    }
}

function loadUser() {
    var u;
    try { u = JSON.parse(localStorage.getItem(CONFIG.USER_KEY)); } catch(e) { u = null; }
    if (!u || !u.id) {
        u = { id: 'usr_' + Math.random().toString(36).substr(2, 9), voted: [], owned: [], alias: '' };
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
        purgList: document.getElementById('purgatory-list'),
        humorList: document.getElementById('humorists-list'),
        muteBtn: document.getElementById('mute-btn'),
        dashToggle: document.getElementById('mobile-dash-toggle'),
        dashboard: document.getElementById('dashboard'),
        postBtn: document.getElementById('post-btn'),
        searchInput: document.getElementById('search-input'),
        charCounter: document.getElementById('char-counter'),
        closeDash: document.getElementById('close-dash-btn'),
        error: document.getElementById('error-display'),
        purgStatus: document.getElementById('purgatory-status')
    };
}

async function initGlobalSync() {
    console.log("Iniciando Sincronización...");
    
    // Fail-safe: Si en 8 segundos no hay datos, limpiamos esqueletos
    var timeout = setTimeout(function() {
        if (app.state.jokes.length === 0) {
            console.warn("Timeout de carga alcanzado");
            syncWall(); 
            if(app.dom.error) app.dom.error.style.display = 'block';
        }
    }, 8000);

    try {
        var res = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(200);
        clearTimeout(timeout);
        
        if (res.data) {
            app.state.jokes = res.data;
            if(app.dom.error) app.dom.error.style.display = 'none';
        } else {
            console.error("Error Supabase:", res.error);
            if(app.dom.error) app.dom.error.style.display = 'block';
        }
    } catch (e) { 
        console.error("Error Catastrófico:", e);
        if(app.dom.error) app.dom.error.style.display = 'block';
    }

    freezeOrder();
    syncWall();
    
    // Realtime suscripción
    client.channel('public:jokes').on('postgres_changes', { event: '*', schema: 'public', table: 'jokes' }, function(payload) {
        if (payload.eventType === 'INSERT') {
            showToast('¡Nuevo chiste en el muro!');
        } else if (payload.eventType === 'UPDATE') {
            var idx = app.state.jokes.findIndex(function(j) { return j.id === payload.new.id; });
            if (idx !== -1) {
                app.state.jokes[idx] = payload.new;
                updateCardUI(payload.new);
            }
        }
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
    
    // LIMPIEZA CRÍTICA: Esto quita los Skeletons
    container.innerHTML = '';
    
    if (app.displayOrder.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#aaa;"><h2 style="font-family:Bangers; font-size:3rem; color:var(--accent);">EL MURO ESTÁ VACÍO</h2><p>Sé el primero en pegar algo...</p></div>';
    } else {
        for (var i=0; i<app.displayOrder.length; i++) {
            container.appendChild(createCard(app.displayOrder[i]));
        }
    }
    updateStats();
}

function createCard(joke) {
    var el = document.createElement('article');
    el.className = 'post-it';
    el.id = 'joke-' + joke.id;
    el.style.setProperty('--bg-c', joke.color || '#FFEB3B');
    
    var isVoted = app.user.voted.indexOf(joke.id) !== -1;
    var vClass = isVoted ? 'voted' : '';
    var authorImg = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (joke.authorid || joke.author);

    el.innerHTML = '<div class="post-body">' + sanitize(joke.text) + '</div>' +
        '<div class="post-footer">' +
            '<div class="author-info">' +
                '<img src="' + authorImg + '" width="24" height="24" style="border-radius:50%; background:#fff;">' +
                '<span>' + sanitize(joke.author) + '</span>' +
            '</div>' +
            '<div class="actions">' +
                '<button class="act-btn vote-btn ' + vClass + '" data-id="' + joke.id + '" data-type="best">🤣 <span>' + (joke.votes_best || 0) + '</span></button>' +
                '<button class="act-btn vote-btn ' + vClass + '" data-id="' + joke.id + '" data-type="bad">🍅 <span>' + (joke.votes_bad || 0) + '</span></button>' +
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
    });
}

async function vote(id, type) {
    if (app.user.voted.indexOf(id) !== -1) return showToast('Ya has votado');
    playSfx(type === 'best' ? 'laugh' : 'splat');

    try {
        var field = (type === 'best' ? 'votes_best' : 'votes_bad');
        var res = await client.rpc('increment_vote', { 
            joke_id: id, 
            field_name: field,
            visitor_id: app.user.id,
            device_fp: app.fingerprint || app.user.id 
        });
        
        if (!res.error) { 
            app.user.voted.push(id);
            localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(app.user)); 
        } else if (res.error.message && res.error.message.indexOf('VOTO_DUPLICADO') !== -1) {
            showToast('Ya has votado');
            app.user.voted.push(id);
            localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(app.user)); 
        }
    } catch(e) {}
}

async function postJoke() {
    var lastPostTime = localStorage.getItem('last_post_time') || 0;
    if (Date.now() - lastPostTime < CONFIG.COOLDOWN_MS) return showToast('Espera 30s');

    var text = app.dom.input.value.trim();
    var alias = app.dom.alias.value.trim();
    if (!alias || text.length < 3) return showToast('Escribe algo...');
    
    app.dom.postBtn.disabled = true;
    try {
        var dot = document.querySelector('.dot.active');
        var color = dot ? dot.dataset.color : '#FFEB3B';
        var res = await client.from('jokes').insert([{ text: text, author: alias, authorid: app.user.id, color: color, votes_best: 0, votes_bad: 0 }]).select();
        
        if (!res.error) { 
            playSfx('post');
            app.dom.input.value = ''; 
            localStorage.setItem('last_post_time', Date.now());
            showToast('¡Pegado!'); 
        }
    } catch(e) { showToast('Error red'); }
    app.dom.postBtn.disabled = false;
}

function searchJokes(term) {
    var t = term.toLowerCase();
    var cards = document.querySelectorAll('.post-it');
    for (var i=0; i<cards.length; i++) {
        var content = cards[i].querySelector('.post-body').textContent.toLowerCase();
        cards[i].style.display = content.indexOf(t) !== -1 ? 'block' : 'none';
    }
}

function showToast(m) {
    var t = document.createElement('div'); t.className = 'toast show'; t.innerText = m;
    var c = document.getElementById('toast-container');
    if(c) { c.appendChild(t); setTimeout(function() { if(t.parentNode) t.remove(); }, 2500); }
}

function sanitize(s) { 
    if(!s) return "";
    return s.replace(/[<>\"']/g, '').substring(0, 300); 
}

window.onload = function() {
    console.log("V15.0 RUNNING");
    app.user = loadUser();
    cacheDOM();
    initDelegation();
    
    // Huella digital en segundo plano
    setTimeout(function() {
        try {
            FingerprintJS.load().then(function(fp) { return fp.get(); }).then(function(result) {
                app.fingerprint = result.visitorId;
            });
        } catch(e) {}
    }, 500);

    app.dom.postBtn.onclick = postJoke;
    app.dom.input.oninput = function(e) { app.dom.charCounter.innerText = e.target.value.length + '/300'; };
    
    var debouncedSearch = debounce(function(val) { searchJokes(val); }, 300);
    app.dom.searchInput.oninput = function(e) { debouncedSearch(e.target.value); };

    app.dom.filters.forEach(function(btn) {
        btn.onclick = function() {
            playSfx('click');
            app.dom.filters.forEach(function(f) { f.classList.remove('active'); });
            btn.classList.add('active');
            app.state.sort = btn.dataset.sort;
            freezeOrder();
            syncWall();
        };
    });
    
    app.dom.muteBtn.onclick = function() { app.isMuted = !app.isMuted; app.dom.muteBtn.innerText = app.isMuted ? '🔇' : '🔊'; };
    
    app.dom.dashToggle.onclick = function() {
        playSfx('click');
        var isH = app.dom.dashboard.getAttribute('aria-hidden') === 'true';
        app.dom.dashboard.setAttribute('aria-hidden', !isH);
        app.dom.dashToggle.innerText = isH ? '✕' : '🏆';
    };
    
    if(app.dom.closeDash) {
        app.dom.closeDash.onclick = function() {
            app.dom.dashboard.setAttribute('aria-hidden', 'true');
            app.dom.dashToggle.innerText = '🏆';
        };
    }

    initGlobalSync();
};

function updateStats() {
    var worst = app.state.jokes.filter(function(j) { return (j.votes_bad || 0) > (j.votes_best || 0); }).slice(0, 3);
    
    var now = new Date();
    var lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    var daysLeft = lastDay - now.getDate();
    var statusMsg = "";

    if (daysLeft <= 3) {
        statusMsg = "<b style='color:#ff1744'>⚠️ EL JUICIO HA COMENZADO.</b> Los 3 de abajo están en peligro. ¡Vota 🤣 para intentar salvarlos!";
    } else {
        statusMsg = "La Purga comienza en " + (daysLeft - 3) + " días. Los peores caerán.";
    }

    if (app.dom.purgStatus) app.dom.purgStatus.innerHTML = "<p style='font-size:0.8rem; margin:10px 0;'>" + statusMsg + "</p>";

    if (app.dom.purgList) app.dom.purgList.innerHTML = worst.map(function(j) { return '<li><img src="https://api.dicebear.com/7.x/bottts/svg?seed=' + (j.authorid || j.author) + '" style="width:20px;height:20px;border-radius:50%;margin-right:10px;"> <span>' + sanitize(j.author) + '</span> <span style="color:#ff1744">🍅 ' + j.votes_bad + '</span></li>'; }).join('') || '<li>Libre por ahora...</li>';
    var best = app.state.jokes.slice().sort(function(a,b) { return (b.votes_best || 0) - (a.votes_best || 0); }).slice(0, 5);
    if (app.dom.humorList) app.dom.humorList.innerHTML = best.map(function(j) { return '<li><span>' + sanitize(j.author) + '</span> <span style="color:var(--accent)">🤣 ' + (j.votes_best || 0) + '</span></li>'; }).join('');
}