/**
 * EL MURO V20.3 - DEBUG MODE & POSITION FIX
 */

var SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';

var client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.app = {
    state: { jokes: [], sort: 'new' },
    user: null,
    isMuted: false,
    sounds: {
        post: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
        laugh: new Audio('https://assets.mixkit.co/active_storage/sfx/2802/2802-preview.mp3'),
        splat: new Audio('https://assets.mixkit.co/active_storage/sfx/2747/2747-preview.mp3')
    }
};

function loadUser() {
    var u;
    try { u = JSON.parse(localStorage.getItem('elMuro_v6_usr')); } catch(e) { u = null; }
    if (!u || !u.id) {
        u = { id: 'usr_' + Math.random().toString(36).substr(2, 9), voted: [], owned: [], alias: '', avatar: 'bot1' };
        localStorage.setItem('elMuro_v6_usr', JSON.stringify(u));
    }
    return u;
}

async function initGlobalSync() {
    try {
        var res = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(200);
        if (res.data) {
            app.state.jokes = res.data;
            syncWall();
        }
    } catch (e) { console.error("Sync error:", e); }
}

function syncWall() {
    var c = document.getElementById('mural');
    if(!c) return;
    c.innerHTML = '';
    var list = app.state.jokes;
    if (app.state.sort === 'best') {
        list = list.slice().sort(function(a,b){ return (b.votes_best||0)-(a.votes_best||0); });
    }
    for (var i=0; i<list.length; i++) {
        c.appendChild(createCard(list[i]));
    }
}

function createCard(joke) {
    var el = document.createElement('article');
    el.className = 'post-it';
    el.style.setProperty('--bg-c', joke.color || '#fff9c4');
    var authorImg = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (joke.authorid || joke.author);
    el.innerHTML = '<div class="post-body">' + sanitize(joke.text) + '</div>' +
        '<div class="post-footer">' +
            '<div class="author-info"><img src="' + authorImg + '" style="width:24px;border-radius:50%;"> ' + sanitize(joke.author) + '</div>' +
            '<div class="actions">' +
                '<button class="act-btn" onclick="vote(\"' + joke.id + '\",\'best\")">🤣 '+(joke.votes_best||0)+'</button>' +
                '<button class="act-btn" onclick="vote(\"' + joke.id + '\",\'bad\")">🍅 '+(joke.votes_bad||0)+'</button>' +
            '</div>' +
        '</div>';
    return el;
}

async function vote(id, type) {
    if ((app.user.voted || []).indexOf(id) !== -1) return alert('Ya has votado');
    try {
        var field = (type === 'best' ? 'votes_best' : 'votes_bad');
        var res = await client.rpc('increment_vote', { joke_id: id, field_name: field, visitor_id: app.user.id, device_fp: app.user.id });
        if (!res.error) { 
            app.user.voted.push(id);
            localStorage.setItem('elMuro_v6_usr', JSON.stringify(app.user)); 
            initGlobalSync();
        }
    } catch(e) {}
}

async function postJoke() {
    var txt = document.getElementById('secret-input').value.trim();
    var alias = document.getElementById('user-alias').value.trim() || "Anónimo";

    if (txt.length < 3) return alert('Escribe algo más...');

    try {
        var dot = document.querySelector('.dot.active');
        var col = dot ? dot.getAttribute('data-color') : '#fff9c4';
        
        var payload = { text: txt, author: alias, authorid: app.user.id, color: col, votes_best: 0, votes_bad: 0 };
        
        console.log("Enviando:", payload);
        var res = await client.from('jokes').insert([payload]).select();
        
        if (res.error) {
            console.error("DETALLE ERROR SUPABASE:", res.error);
            alert("Error de la Base de Datos: " + res.error.message);
        } else {
            document.getElementById('secret-input').value = '';
            alert("¡Chiste Pegado!");
            initGlobalSync();
        }
    } catch(e) { 
        alert("Error de red o ejecución: " + e.message); 
    }
}

function sanitize(s) { 
    if(!s) return "";
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML.substring(0, 300); 
}

window.onload = function() {
    app.user = loadUser();
    
    // Configurar Avatar
    var img = document.getElementById('my-avatar-img');
    if(img) img.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (app.user.avatar || 'bot1');

    // Eventos de botones principales
    document.getElementById('post-btn').onclick = postJoke;
    
    document.getElementById('avatar-btn').onclick = function() {
        var s = document.getElementById('avatar-selector');
        s.style.display = (s.style.display === 'block' ? 'none' : 'block');
    };

    var opts = document.querySelectorAll('.av-opt');
    for (var i=0; i<opts.length; i++) {
        opts[i].onclick = function() {
            var seed = this.getAttribute('data-seed');
            app.user.avatar = seed;
            localStorage.setItem('elMuro_v6_usr', JSON.stringify(app.user));
            document.getElementById('my-avatar-img').src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + seed;
            document.getElementById('avatar-selector').style.display = 'none';
        };
    }

    var dots = document.querySelectorAll('.dot');
    for (var j=0; j<dots.length; j++) {
        dots[j].onclick = function() {
            for (var k=0; k<dots.length; k++) dots[k].classList.remove('active');
            this.classList.add('active');
        };
    }

    initGlobalSync();
};