/**
 * EL MURO V25.0 - G-STANDARD STABLE
 * Fusión de robustez Gemini + Seguridad Ejecutor
 */

var SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';
var client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

var app = {
    state: { jokes: [], sort: 'new', filterTerm: '' },
    user: null,
    isMuted: false,
    sounds: {}
};

function initSounds() {
    try {
        app.sounds = {
            post: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
            laugh: new Audio('https://assets.mixkit.co/active_storage/sfx/2802/2802-preview.mp3'),
            splat: new Audio('https://assets.mixkit.co/active_storage/sfx/2747/2747-preview.mp3')
        };
    } catch(e) { console.warn("Sounds blocked"); }
}

function playSound(name) {
    if (app.isMuted || !app.sounds[name]) return;
    try { app.sounds[name].currentTime = 0; app.sounds[name].play().catch(function(){}); } catch(e) {}
}

function genUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = (c == 'x' ? r : (r & 0x3 | 0x8));
        return v.toString(16);
    });
}

function loadUser() {
    var u;
    try { u = JSON.parse(localStorage.getItem('elMuro_v6_usr')); } catch(e) { u = null; }
    if (!u || !u.id) {
        u = { id: genUUID(), voted: [], owned: [], alias: '', avatar: 'bot1' };
        localStorage.setItem('elMuro_v6_usr', JSON.stringify(u));
    }
    return u;
}

function showToast(msg, type) {
    var container = document.getElementById('toast-container');
    if(!container) return;
    var el = document.createElement('div');
    el.className = 'toast';
    if(type === 'error') el.style.backgroundColor = '#ff1744';
    el.innerText = msg;
    container.appendChild(el);
    setTimeout(function() { el.classList.add('show'); }, 10);
    setTimeout(function() {
        el.classList.remove('show');
        setTimeout(function() { el.remove(); }, 300);
    }, 3000);
}

function sanitize(s) { 
    if(!s) return "";
    var d = document.createElement('div'); d.textContent = s;
    return d.innerHTML.substring(0, 300); 
}

async function initGlobalSync() {
    try {
        var res = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(200);
        if (res.error) throw res.error;
        if (res.data) {
            app.state.jokes = res.data;
            syncWall();
            updateStats();
        }
    } catch (e) { 
        console.error(e); 
        var errDisp = document.getElementById('error-display');
        if(errDisp) errDisp.style.display = 'block';
    }
}

function syncWall() {
    var container = document.getElementById('mural');
    if(!container) return;
    container.innerHTML = '';
    
    var list = app.state.jokes.slice();
    
    if (app.state.filterTerm) {
        var term = app.state.filterTerm.toLowerCase();
        list = list.filter(function(j) {
            return (j.text && j.text.toLowerCase().indexOf(term) !== -1) || 
                   (j.author && j.author.toLowerCase().indexOf(term) !== -1);
        });
    }

    if (app.state.sort === 'best') {
        list.sort(function(a,b){ return (b.votes_best||0)-(a.votes_best||0); });
    } else if (app.state.sort === 'controversial') {
        list = list.filter(function(j){ return (j.votes_bad||0) > (j.votes_best||0); });
        list.sort(function(a,b){ return (b.votes_bad||0)-(a.votes_bad||0); });
    }

    if (list.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#aaa;"><h2>' + (app.state.filterTerm ? 'NO HAY RESULTADOS' : 'EL MURO ESTÁ VACÍO') + '</h2></div>';
    } else {
        for(var i=0; i<list.length; i++) {
            container.appendChild(createCard(list[i]));
        }
    }
}

function createCard(joke) {
    var el = document.createElement('article');
    el.className = 'post-it';
    el.style.setProperty('--bg-c', joke.color || '#fff9c4');
    
    var authorImg = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (joke.avatar || 'bot1');
    var isVoted = app.user.voted.indexOf(joke.id) !== -1;
    var vClass = isVoted ? 'voted' : '';

    el.innerHTML = '<div class="post-body">' + sanitize(joke.text) + '</div>' +
        '<div class="post-footer">' +
            '<div class="author-info">' +
                '<img src="' + authorImg + '" style="width:24px;height:24px;border-radius:50%;background:#fff;border:1px solid #eee;margin-right:5px;"> ' + 
                sanitize(joke.author) +
            '</div>' +
            '<div class="actions">' +
                '<button class="act-btn btn-vote ' + vClass + '" data-id="' + joke.id + '" data-type="best">🤣 ' + (joke.votes_best||0) + '</button>' +
                '<button class="act-btn btn-vote ' + vClass + '" data-id="' + joke.id + '" data-type="bad">🍅 ' + (joke.votes_bad||0) + '</button>' +
            '</div>' +
        '</div>';
    return el;
}

window.vote = async function(id, type) {
    if (app.user.voted.indexOf(id) !== -1) return showToast('Ya has votado', 'error');
    
    playSound(type === 'best' ? 'laugh' : 'splat');

    try {
        var field = (type === 'best' ? 'votes_best' : 'votes_bad');
        var res = await client.rpc('increment_vote', { 
            joke_id: id, field_name: field, visitor_id: app.user.id, device_fp: app.user.id 
        });

        if (!res.error) { 
            app.user.voted.push(id);
            localStorage.setItem('elMuro_v6_usr', JSON.stringify(app.user)); 
            initGlobalSync();
            showToast(type === 'best' ? '¡Jaja!' : '¡Tomatazo!');
        }
    } catch(e) { console.error(e); }
};

async function postJoke() {
    var input = document.getElementById('secret-input');
    var txt = input ? input.value.trim() : "";
    var alias = document.getElementById('user-alias').value.trim() || "Anónimo";

    if (txt.length < 3) return showToast('Escribe algo más...', 'error');

    var btn = document.getElementById('post-btn');
    btn.disabled = true;

    try {
        var dot = document.querySelector('.dot.active');
        var col = dot ? dot.getAttribute('data-color') : '#fff9c4';
        
        var payload = { text: txt, author: alias, authorid: app.user.id, color: col, avatar: app.user.avatar || 'bot1' };
        var res = await client.from('jokes').insert([payload]);
        
        if (res.error) throw res.error;

        input.value = '';
        playSound('post');
        showToast('¡Chiste pegado!');
        initGlobalSync();
    } catch(e) { showToast("Error al publicar", 'error'); }
    btn.disabled = false;
}

function updateStats() {
    var list = app.state.jokes || [];
    
    // Hall of Fame
    var best = list.slice().sort(function(a,b){ return (b.votes_best||0)-(a.votes_best||0); }).slice(0, 5);
    var hl = document.getElementById('humorists-list');
    if (hl) hl.innerHTML = best.map(function(j) {
        return '<li><span>' + sanitize(j.author) + '</span> <span style="color:#ff9500;margin-left:auto;">🤣 ' + (j.votes_best||0) + '</span></li>';
    }).join('');

    // Purga
    var worst = list.filter(function(j){ return (j.votes_bad||0)>(j.votes_best||0); }).sort(function(a,b){ return (b.votes_bad||0)-(a.votes_bad||0); }).slice(0, 3);
    var pl = document.getElementById('purgatory-list');
    if (pl) pl.innerHTML = worst.map(function(j) {
        return '<li><span>' + sanitize(j.author) + '</span> <span style="color:#ff1744;margin-left:auto;">🍅 ' + (j.votes_bad||0) + '</span></li>';
    }).join('') || '<li>Todo limpio</li>';

    // Status
    var now = new Date();
    var lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    var daysLeft = lastDay - now.getDate();
    var ps = document.getElementById('purgatory-status');
    if (ps) ps.innerHTML = '<p style="color:#888;">Faltan ' + daysLeft + ' días para la purga.</p>';
}

window.onload = function() {
    app.user = loadUser();
    initSounds();

    document.getElementById('my-avatar-img').src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (app.user.avatar || 'bot1');
    if(app.user.alias) document.getElementById('user-alias').value = app.user.alias;

    // EVENTOS
    document.getElementById('post-btn').onclick = postJoke;
    
    document.getElementById('search-input').oninput = function(e) {
        app.state.filterTerm = e.target.value;
        syncWall();
    };

    document.getElementById('mute-btn').onclick = function() {
        app.isMuted = !app.isMuted;
        this.innerText = app.isMuted ? '🔇' : '🔊';
        showToast(app.isMuted ? 'Sonido desactivado' : 'Sonido activado');
    };

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
            document.getElementById('my-avatar-img').src = this.src;
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

    var filters = document.querySelectorAll('.filter-btn');
    for (var f=0; f<filters.length; f++) {
        filters[f].onclick = function() {
            for (var x=0; x<filters.length; x++) filters[x].classList.remove('active');
            this.classList.add('active');
            app.state.sort = this.dataset.sort;
            syncWall();
        };
    }

    // Delegación de votos para evitar problemas de comillas
    document.getElementById('mural').onclick = function(e) {
        var btn = e.target.closest('.btn-vote');
        if (btn) window.vote(btn.dataset.id, btn.dataset.type);
    };

    initGlobalSync();
};
