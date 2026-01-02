/**
 * EL MURO V19.0 - COMPATIBILIDAD TOTAL (BRAVE READY)
 */

var SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';

var CONFIG = {
    USER_KEY: 'elMuro_v6_usr',
    STORAGE_KEY: 'elMuro_v6_db',
    AI_NAME: '00000000-0000-0000-0000-000000000000',
    COOLDOWN_MS: 20000
};

var client;
try {
    client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch(e) {
    console.error("Error al iniciar Supabase. Posible bloqueo de Brave.");
}

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
    isMuted: false,
    sounds: {
        post: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
        laugh: new Audio('https://assets.mixkit.co/active_storage/sfx/2802/2802-preview.mp3'),
        splat: new Audio('https://assets.mixkit.co/active_storage/sfx/2747/2747-preview.mp3'),
        click: new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3')
    }
};

function playSfx(name) {
    if (app.isMuted) return;
    try {
        var s = app.sounds[name];
        if (s) { s.currentTime = 0; s.play().catch(function() {}); }
    } catch(e) {}
}

function loadUser() {
    var u;
    try { 
        u = JSON.parse(localStorage.getItem(CONFIG.USER_KEY)); 
    } catch(e) { u = null; }
    
    if (!u || !u.id) {
        u = { id: 'usr_' + Math.random().toString(36).substr(2, 9), voted: [], owned: [], alias: '' };
        try {
            localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(u));
        } catch(e) {}
    }
    return u;
}

async function initGlobalSync() {
    if (!client) return;
    try {
        var res = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(200);
        if (res.data) {
            app.state.jokes = res.data;
            freezeOrder();
            syncWall();
        }
    } catch (e) { console.error("Sync Error:", e); }
}

function freezeOrder() {
    var list = app.state.jokes.slice();
    if (app.state.sort === 'best') {
        app.displayOrder = list.sort(function(a,b) { return (b.votes_best || 0) - (a.votes_best || 0); });
    } else if (app.state.sort === 'controversial') {
        app.displayOrder = list.filter(function(j) {
            return (j.votes_bad || 0) > (j.votes_best || 0);
        }).sort(function(a,b) { return (b.votes_bad - b.votes_best) - (a.votes_bad - a.votes_best); }).slice(0, 5);
    } else {
        app.displayOrder = list.sort(function(a,b) { return new Date(b.ts) - new Date(a.ts); });
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
    
    var isVoted = (app.user.voted || []).indexOf(joke.id) !== -1;
    var vClass = isVoted ? 'voted' : '';
    var authorImg = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (joke.authorid || joke.author);

    el.innerHTML = '<div class="post-body">' + sanitize(joke.text) + '</div>' +
        '<div class="post-footer">' +
            '<div class="author-info">' +
                '<img src="' + authorImg + '" style="width:24px;height:24px;border-radius:50%;">' +
                '<span>' + sanitize(joke.author) + '</span>' +
            '</div>' +
            '<div class="actions">' +
                '<button class="act-btn vote-btn ' + vClass + '" data-id="' + joke.id + '" data-type="best">🤣 <span>' + (joke.votes_best || 0) + '</span></button>' +
                '<button class="act-btn vote-btn ' + vClass + '" data-id="' + joke.id + '" data-type="bad">🍅 <span>' + (joke.votes_bad || 0) + '</span></button>' +
            '</div>' +
        '</div>';
    return el;
}

async function vote(id, type) {
    if (!client) return showToast('Error conexión');
    if (app.user.voted.indexOf(id) !== -1) return showToast('Ya has votado');
    playSfx(type === 'best' ? 'laugh' : 'splat');

    try {
        var field = (type === 'best' ? 'votes_best' : 'votes_bad');
        var res = await client.rpc('increment_vote', { 
            joke_id: id, 
            field_name: field,
            visitor_id: app.user.id,
            device_fp: app.user.id // Usamos ID de usuario en lugar de huella para Brave
        });
        if (!res.error) { 
            app.user.voted.push(id);
            localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(app.user)); 
            initGlobalSync();
        }
    } catch(e) {}
}

async function postJoke() {
    if (!client) return showToast('Desactiva los escudos de Brave');
    
    var lastPostTime = localStorage.getItem('last_post_time') || 0;
    if (Date.now() - lastPostTime < CONFIG.COOLDOWN_MS) return showToast('Espera un poco...');

    var textInput = document.getElementById('secret-input');
    var aliasInput = document.getElementById('user-alias');
    var text = textInput ? textInput.value.trim() : "";
    var alias = aliasInput ? aliasInput.value.trim() : "Anónimo";

    if (text.length < 3) return showToast('Escribe algo más...');
    
    var btn = document.getElementById('post-btn');
    if(btn) btn.disabled = true;

    try {
        var activeDot = document.querySelector('.dot.active');
        var color = activeDot ? activeDot.getAttribute('data-color') : '#fff9c4';
        
        var res = await client.from('jokes').insert([{ 
            text: text, 
            author: alias, 
            authorid: app.user.id, 
            color: color, 
            votes_best: 0, 
            votes_bad: 0 
        }]).select();
        
        if (!res.error) { 
            playSfx('post');
            if(textInput) textInput.value = ''; 
            localStorage.setItem('last_post_time', Date.now());
            showToast('¡Pegado!'); 
            initGlobalSync(); 
        }
    } catch(e) { showToast('Error de conexión'); }
    if(btn) btn.disabled = false;
}

function showToast(m) {
    var t = document.createElement('div'); t.className = 'toast show'; t.innerText = m;
    var c = document.getElementById('toast-container');
    if(c) { c.appendChild(t); setTimeout(function() { if(t.parentNode) t.remove(); }, 2500); }
}

function sanitize(s) { 
    if(!s) return "";
    var temp = document.createElement('div');
    temp.textContent = s;
    return temp.innerHTML.substring(0, 300);
}

window.onload = function() {
    app.user = loadUser();
    
    // 1. Vincular botón pegar
    var pb = document.getElementById('post-btn');
    if(pb) pb.onclick = function() { postJoke(); };

    // 2. Colores
    var d = document.querySelectorAll('.dot');
    for (var i=0; i<d.length; i++) {
        d[i].onclick = function() {
            var all = document.querySelectorAll('.dot');
            for (var j=0; j<all.length; j++) all[j].classList.remove('active');
            this.classList.add('active');
        };
    }

    // 3. Filtros
    var f = document.querySelectorAll('.filter-btn');
    for (var k=0; k<f.length; k++) {
        f[k].onclick = function() {
            var allF = document.querySelectorAll('.filter-btn');
            for (var m=0; m<allF.length; m++) allF[m].classList.remove('active');
            this.classList.add('active');
            app.state.sort = this.dataset.sort;
            freezeOrder();
            syncWall();
        };
    }

    // 4. Otros
    var dt = document.getElementById('mobile-dash-toggle');
    if(dt) dt.onclick = function() {
        var dash = document.getElementById('dashboard');
        var isH = dash.getAttribute('aria-hidden') === 'true';
        dash.setAttribute('aria-hidden', !isH);
        this.innerText = isH ? '✕' : '🏆';
    };

    var av = document.getElementById('my-avatar-img');
    if(av) av.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + app.user.id;

    initGlobalSync();
    
    var mural = document.getElementById('mural');
    if(mural) {
        mural.addEventListener('click', function(e) {
            var btn = e.target.closest('.vote-btn');
            if (btn) vote(btn.dataset.id, btn.dataset.type);
        });
    }
};

function updateStats() {
    var worst = app.state.jokes.filter(function(j) { return (j.votes_bad || 0) > (j.votes_best || 0); }).slice(0, 3);
    var pList = document.getElementById('purgatory-list');
    if (pList) pList.innerHTML = worst.map(function(j) { return '<li><span>' + sanitize(j.author) + '</span> <span style="color:#ff1744">🍅 ' + j.votes_bad + '</span></li>'; }).join('') || '<li>Libre</li>';
}
