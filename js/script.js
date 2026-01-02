/**
 * EL MURO V16.7 - REPARACIÓN FINAL DE EVENTOS
 */

var SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
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
        closeDash: document.getElementById('close-dash-btn'),
        error: document.getElementById('error-display'),
        purgStatus: document.getElementById('purgatory-status'),
        avatarImg: document.getElementById('my-avatar-img')
    };
}

async function initGlobalSync() {
    console.log("Syncing...");
    try {
        var res = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(200);
        if (res.data) {
            app.state.jokes = res.data;
            freezeOrder();
            syncWall();
        }
    } catch (e) { console.error("Sync Error:", e); }

    client.channel('public:jokes').on('postgres_changes', { event: '*', schema: 'public', table: 'jokes' }, function(payload) {
        if (payload.eventType === 'INSERT') {
            showToast('¡Nuevo chiste!');
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
    var container = document.getElementById('mural');
    if(!container) return;
    container.innerHTML = '';
    
    if (app.displayOrder.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:50px; color:#aaa; grid-column:1/-1;"><h2>MURO VACÍO</h2></div>';
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
    el.style.setProperty('--bg-c', joke.color || '#fff9c4');
    
    var isVoted = app.user.voted.indexOf(joke.id) !== -1;
    var vClass = isVoted ? 'voted' : '';
    var authorImg = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (joke.authorid || joke.author);

    el.innerHTML = '<div class="post-body">' + sanitize(joke.text) + '</div>' +
        '<div class="post-footer">' +
            '<div class="author-info">' +
                '<img src="' + authorImg + '">' +
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
    var mural = document.getElementById('mural');
    if(mural) {
        mural.addEventListener('click', function(e) {
            var btn = e.target.closest('.act-btn');
            if (!btn) return;
            var id = btn.dataset.id;
            if (btn.classList.contains('vote-btn')) vote(id, btn.dataset.type);
        });
    }
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
        }
    } catch(e) {}
}

async function postJoke() {
    var lastPostTime = localStorage.getItem('last_post_time') || 0;
    if (Date.now() - lastPostTime < CONFIG.COOLDOWN_MS) return showToast('Espera 30s');

    var textInput = document.getElementById('secret-input');
    var aliasInput = document.getElementById('user-alias');
    var text = textInput ? textInput.value.trim() : "";
    var alias = aliasInput ? aliasInput.value.trim() : "Anónimo";

    if (text.length < 3) return showToast('Escribe algo...');
    
    var btn = document.getElementById('post-btn');
    if(btn) btn.disabled = true;

    try {
        var dot = document.querySelector('.dot.active');
        var color = dot ? dot.dataset.color : '#fff9c4';
        var res = await client.from('jokes').insert([{ text: text, author: alias, authorid: app.user.id, color: color, votes_best: 0, votes_bad: 0 }]).select();
        
        if (!res.error) { 
            playSfx('post');
            if(textInput) textInput.value = ''; 
            localStorage.setItem('last_post_time', Date.now());
            showToast('¡Pegado!'); 
        }
    } catch(e) { showToast('Error red'); }
    if(btn) btn.disabled = false;
}

function showToast(m) {
    var t = document.createElement('div'); t.className = 'toast show'; t.innerText = m;
    var c = document.getElementById('toast-container');
    if(c) { c.appendChild(t); setTimeout(function() { if(t.parentNode) t.remove(); }, 2500); }
}

function sanitize(s) { 
    if(!s) return "";
    return s.replace(/[<>"']/g, '').substring(0, 300); 
}

window.onload = function() {
    console.log("V16.7 ACTIVE");
    app.user = loadUser();
    cacheDOM();
    initDelegation();
    
    // Asignación DIRECTA de eventos para evitar fallos de caché
    var postBtn = document.getElementById('post-btn');
    if(postBtn) postBtn.onclick = postJoke;

    var dots = document.querySelectorAll('.dot');
    for (var i=0; i<dots.length; i++) {
        dots[i].onclick = function(e) {
            var allDots = document.querySelectorAll('.dot');
            for (var j=0; j<allDots.length; j++) allDots[j].classList.remove('active');
            this.classList.add('active');
        };
    }

    // Buscador
    var sInput = document.getElementById('search-input');
    if(sInput) {
        var debouncedSearch = debounce(function(val) {
            var t = val.toLowerCase();
            var cards = document.querySelectorAll('.post-it');
            for (var k=0; i<cards.length; k++) {
                var content = cards[k].querySelector('.post-body').textContent.toLowerCase();
                cards[k].style.display = content.indexOf(t) !== -1 ? 'block' : 'none';
            }
        }, 300);
        sInput.oninput = function(e) { debouncedSearch(e.target.value); };
    }

    // Dash
    var dToggle = document.getElementById('mobile-dash-toggle');
    if(dToggle) dToggle.onclick = function() {
        var dash = document.getElementById('dashboard');
        var isH = dash.getAttribute('aria-hidden') === 'true';
        dash.setAttribute('aria-hidden', !isH);
        this.innerText = isH ? '✕' : '🏆';
    };

    if(app.dom.avatarImg) {
        setTimeout(function() {
            app.dom.avatarImg.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + app.user.id;
        }, 100);
    }

    initGlobalSync();
};

function updateStats() {
    var worst = app.state.jokes.filter(function(j) { return (j.votes_bad || 0) > (j.votes_best || 0); }).slice(0, 3);
    var pList = document.getElementById('purgatory-list');
    if (pList) pList.innerHTML = worst.map(function(j) { return '<li><span>' + sanitize(j.author) + '</span> <span style="color:#ff1744">🍅 ' + j.votes_bad + '</span></li>'; }).join('') || '<li>Libre</li>';
}
