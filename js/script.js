/**
 * EL MURO V23.0 - ESTABILIDAD ABSOLUTA
 */

var SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';

var client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.app = {
    state: { jokes: [], sort: 'new' },
    user: null,
    isMuted: false
};

function genUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = (c == 'x' ? r : (r & 0x3 | 0x8));
        return v.toString(16);
    });
}

function loadUser() {
    var u;
    try { u = JSON.parse(localStorage.getItem('elMuro_v6_usr')); } catch(e) { u = null; }
    if (!u || !u.id || u.id.indexOf('-') === -1) {
        u = { id: genUUID(), voted: [], owned: [], alias: '', avatar: 'bot1' };
        localStorage.setItem('elMuro_v6_usr', JSON.stringify(u));
    }
    return u;
}

async function initGlobalSync() {
    console.log("-> Descargando datos de Supabase...");
    try {
        var res = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(200);
        if (res.data) {
            console.log("-> Datos recibidos: " + res.data.length);
            app.state.jokes = res.data;
            syncWall();
            updateStats(); // ¡CRÍTICO: Rellenar Dashboard!
        } else {
            console.error("-> Error Supabase:", res.error);
        }
    } catch (e) { console.error("-> Error de red:", e); }
}

function syncWall() {
    var c = document.getElementById('mural');
    if(!c) return;
    c.innerHTML = '';
    
    var list = app.state.jokes || [];
    
    // Ordenar según filtro
    if (app.state.sort === 'best') {
        list = list.slice().sort(function(a,b){ return (b.votes_best||0)-(a.votes_best||0); });
    } else if (app.state.sort === 'controversial') {
        list = list.filter(function(j){ return (j.votes_bad||0) > (j.votes_best||0); });
    }

    if (list.length === 0) {
        c.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px;"><h2>EL MURO ESTÁ VACÍO</h2></div>';
    } else {
        for (var i=0; i<list.length; i++) {
            c.appendChild(createCard(list[i]));
        }
    }
}

function createCard(joke) {
    var el = document.createElement('article');
    el.className = 'post-it';
    el.style.setProperty('--bg-c', joke.color || '#fff9c4');
    var authorImg = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (joke.avatar || 'bot1');
    
    el.innerHTML = '<div class="post-body">' + sanitize(joke.text) + '</div>' +
        '<div class="post-footer">' + 
            '<div class="author-info"><img src="' + authorImg + '" style="width:24px;border-radius:50%;background:#fff;border:1px solid #eee;margin-right:5px;"> ' + sanitize(joke.author) + '</div>' + 
            '<div class="actions">' + 
                '<button class="act-btn" onclick="vote(\"' + joke.id + '\",\'best\'")">🤣 '+(joke.votes_best||0)+'</button>' + 
                '<button class="act-btn" onclick="vote(\"' + joke.id + '\",\'bad\'")">🍅 '+(joke.votes_bad||0)+'</button>' + 
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
        var payload = { text: txt, author: alias, authorid: app.user.id, color: col, avatar: app.user.avatar || 'bot1' };
        
        var res = await client.from('jokes').insert([payload]);
        if (res.error) {
            alert("Error: " + res.error.message);
        } else {
            document.getElementById('secret-input').value = '';
            alert("¡Chiste Pegado!");
            initGlobalSync();
        }
    } catch(e) { alert("Error de red"); }
}

function updateStats() {
    console.log("-> Actualizando Dashboard...");
    var list = app.state.jokes || [];
    
    // HALL OF FAME
    var best = list.slice().sort(function(a,b){ return (b.votes_best||0)-(a.votes_best||0); }).slice(0, 5);
    var hl = document.getElementById('humorists-list');
    if (hl) {
        hl.innerHTML = best.map(function(j) {
            return '<li><span>' + sanitize(j.author) + '</span> <span style="color:#ff9500;margin-left:auto;">🤣 ' + (j.votes_best||0) + '</span></li>';
        }).join('');
    }

    // LA PURGA
    var worst = list.filter(function(j){ return (j.votes_bad||0)>(j.votes_best||0); }).slice(0, 3);
    var pl = document.getElementById('purgatory-list');
    if (pl) {
        pl.innerHTML = worst.map(function(j) {
            return '<li><span>' + sanitize(j.author) + '</span> <span style="color:#ff1744;margin-left:auto;">🍅 ' + (j.votes_bad||0) + '</span></li>';
        }).join('') || '<li>Todo limpio</li>';
    }
}

function sanitize(s) { 
    if(!s) return "";
    var d = document.createElement('div'); d.textContent = s;
    return d.innerHTML.substring(0, 300); 
}

window.onload = function() {
    console.log("-> V23.0 Cargada");
    app.user = loadUser();
    
    // Inicializar UI
    document.getElementById('my-avatar-img').src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (app.user.avatar || 'bot1');
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

    // Filtros
    var filters = document.querySelectorAll('.filter-btn');
    for (var f=0; f<filters.length; f++) {
        filters[f].onclick = function() {
            for (var x=0; x<filters.length; x++) filters[x].classList.remove('active');
            this.classList.add('active');
            app.state.sort = this.dataset.sort;
            syncWall();
        };
    }

    // Dashboard Toggle
    document.getElementById('mobile-dash-toggle').onclick = function() {
        var d = document.getElementById('dashboard');
        var isH = d.getAttribute('aria-hidden') === 'true';
        d.setAttribute('aria-hidden', isH ? 'false' : 'true');
        this.innerText = isH ? '✕' : '🏆';
    };

    document.getElementById('close-dash-btn').onclick = function() {
        document.getElementById('dashboard').setAttribute('aria-hidden', 'true');
        document.getElementById('mobile-dash-toggle').innerText = '🏆';
    };

    initGlobalSync();
};