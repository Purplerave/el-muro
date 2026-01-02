/**
 * EL MURO V20.0 - BRAVE COMPATIBLE & AVATAR PICKER
 */

var SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';

var CONFIG = {
    USER_KEY: 'elMuro_v6_usr',
    STORAGE_KEY: 'elMuro_v6_db',
    AI_NAME: '00000000-0000-0000-0000-000000000000',
    COOLDOWN_MS: 15000
};

var client = null;
try {
    client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase cargado con éxito");
} catch(e) { console.error("Error Supabase:", e); }

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
        if (s) { s.currentTime = 0; s.play().catch(function(){}); }
    } catch(e) {}
}

function loadUser() {
    var u;
    try { u = JSON.parse(localStorage.getItem(CONFIG.USER_KEY)); } catch(e) { u = null; }
    if (!u || !u.id) {
        u = { id: 'usr_' + Math.random().toString(36).substr(2, 9), voted: [], owned: [], alias: '', avatar: 'bot1' };
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(u));
    }
    if (!u.avatar) u.avatar = 'bot1';
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
    } catch (e) { console.error("Sync error:", e); }
}

function freezeOrder() {
    var list = app.state.jokes.slice();
    if (app.state.sort === 'best') {
        app.displayOrder = list.sort(function(a,b) { return (b.votes_best || 0) - (a.votes_best || 0); });
    } else {
        app.displayOrder = list.sort(function(a,b) { return new Date(b.ts) - new Date(a.ts); });
    }
}

function syncWall() {
    var c = document.getElementById('mural');
    if(!c) return;
    c.innerHTML = '';
    if (app.displayOrder.length === 0) {
        c.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;"><h2>EL MURO ESTÁ ESPERANDO...</h2></div>';
    } else {
        for (var i=0; i<app.displayOrder.length; i++) {
            c.appendChild(createCard(app.displayOrder[i]));
        }
    }
    updateStats();
}

function createCard(joke) {
    var el = document.createElement('article');
    el.className = 'post-it';
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
    if (!client) return;
    if (app.user.voted.indexOf(id) !== -1) return showToast('Ya has votado');
    playSfx(type === 'best' ? 'laugh' : 'splat');
    try {
        var field = (type === 'best' ? 'votes_best' : 'votes_bad');
        var res = await client.rpc('increment_vote', { 
            joke_id: id, 
            field_name: field,
            visitor_id: app.user.id,
            device_fp: app.user.id 
        });
        if (!res.error) { 
            app.user.voted.push(id);
            localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(app.user)); 
            initGlobalSync();
        }
    } catch(e) {}
}

async function postJoke() {
    console.log("Post Clicked");
    if (!client) return showToast("Brave bloquea la conexión");
    
    var last = localStorage.getItem('last_post_time') || 0;
    if (Date.now() - last < CONFIG.COOLDOWN_MS) return showToast('Espera un poco');

    var ti = document.getElementById('secret-input');
    var ai = document.getElementById('user-alias');
    var txt = ti ? ti.value.trim() : "";
    var alias = ai ? ai.value.trim() : "Anónimo";

    if (txt.length < 3) return showToast('Escribe algo...');

    var btn = document.getElementById('post-btn');
    if(btn) btn.disabled = true;

    try {
        var dot = document.querySelector('.dot.active');
        var col = dot ? dot.getAttribute('data-color') : '#fff9c4';
        
        var res = await client.from('jokes').insert([{ 
            text: txt, 
            author: alias, 
            authorid: app.user.id, 
            color: col, 
            votes_best: 0, 
            votes_bad: 0 
        }]).select();
        
        if (!res.error) { 
            playSfx('post');
            if(ti) ti.value = ''; 
            localStorage.setItem('last_post_time', Date.now());
            showToast('¡Pegado!'); 
            initGlobalSync(); 
        } else {
            console.error("Error insert:", res.error);
            showToast("Error al pegar");
        }
    } catch(e) { showToast('Error conexión'); }
    if(btn) btn.disabled = false;
}

function showToast(m) {
    var t = document.createElement('div'); t.className = 'toast show'; t.innerText = m;
    var c = document.getElementById('toast-container');
    if(c) { c.appendChild(t); setTimeout(function(){ if(t.parentNode) t.remove(); }, 2500); }
}

function sanitize(s) { 
    if(!s) return "";
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML.substring(0, 300); 
}

window.onload = function() {
    console.log("V20.0 START");
    app.user = loadUser();
    
    // 1. Selector de Avatares
    var ab = document.getElementById('avatar-btn');
    if(ab) ab.onclick = function() {
        var s = document.getElementById('avatar-selector');
        s.style.display = (s.style.display === 'none' ? 'block' : 'none');
    };

    var opts = document.querySelectorAll('.av-opt');
    for (var i=0; i<opts.length; i++) {
        opts[i].onclick = function() {
            var seed = this.getAttribute('data-seed');
            app.user.id = seed + '_' + Math.random().toString(36).substr(2, 5); // Cambiamos ID para cambiar cara
            app.user.avatar = seed;
            localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(app.user));
            var img = document.getElementById('my-avatar-img');
            if(img) img.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + seed;
            document.getElementById('avatar-selector').style.display = 'none';
            showToast("¡Nueva cara elegida!");
        };
    }

    // 2. Otros eventos
    var pb = document.getElementById('post-btn');
    if(pb) pb.onclick = postJoke;

    var dots = document.querySelectorAll('.dot');
    for (var j=0; j<dots.length; j++) {
        dots[j].onclick = function() {
            var all = document.querySelectorAll('.dot');
            for (var k=0; k<all.length; k++) all[k].classList.remove('active');
            this.classList.add('active');
        };
    }

    var av = document.getElementById('my-avatar-img');
    if(av) av.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (app.user.avatar || 'bot1');

    initGlobalSync();
    
    var m = document.getElementById('mural');
    if(m) m.onclick = function(e) {
        var b = e.target.closest('.vote-btn');
        if (b) vote(b.dataset.id, b.dataset.type);
    };
};

function updateStats() {
    var worst = app.state.jokes.filter(function(j) { return (j.votes_bad || 0) > (j.votes_best || 0); }).slice(0, 3);
    var pl = document.getElementById('purgatory-list');
    if (pl) pl.innerHTML = worst.map(function(j) { return '<li><span>' + sanitize(j.author) + '</span> <span style="color:#ff1744">🍅 ' + j.votes_bad + '</span></li>'; }).join('') || '<li>Todo limpio...</li>';
}