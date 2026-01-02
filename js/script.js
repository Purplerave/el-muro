/**
 * EL MURO V32.0 - MASTER FUSION
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
    } catch(e) {}
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
    if (!u || !u.id || u.id.indexOf('-') === -1) {
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
        if (res.data) {
            app.state.jokes = res.data;
            syncWall();
            updateStats();
            checkDailyAIJoke();
        }
    } catch (e) { console.error(e); }
}

async function checkDailyAIJoke() {
    var aiID = '00000000-0000-0000-0000-000000000000';
    var jokes = app.state.jokes || [];
    var lastAI = jokes.filter(function(j) { return j.authorid === aiID; })[0];
    if (!lastAI || (Date.now() - new Date(lastAI.ts).getTime() >= 21600000)) {
        try {
            var resFact = await client.from('joke_factory').select('*').eq('used', false).limit(1);
            if (resFact.data && resFact.data.length > 0) {
                var candidate = resFact.data[0];
                var resInsert = await client.from('jokes').insert([{ 
                    text: candidate.text, author: "Bot IA", authorid: aiID, 
                    color: candidate.color || "#fff9c4", avatar: candidate.avatar || "bot1"
                }]);
                if (!resInsert.error) {
                    await client.from('joke_factory').update({ used: true }).eq('id', candidate.id);
                    initGlobalSync();
                }
            }
        } catch(e) {}
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
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#aaa;"><h2>VACÍO</h2></div>';
    } else {
        for(var i=0; i<list.length; i++) {
            container.appendChild(createCard(list[i]));
        }
    }
}

function createCard(joke) {
    var el = document.createElement('article');
    el.className = 'post-it';
    el.id = 'joke-' + joke.id;
    el.style.setProperty('--bg-c', joke.color || '#fff9c4');
    var authorImg = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (joke.avatar || 'bot1');
    var isVoted = app.user.voted.indexOf(joke.id) !== -1;
    var vClass = isVoted ? 'voted' : '';

    el.innerHTML = '<div class="post-body">' + sanitize(joke.text) + '</div>' +
        '<div class="post-footer">' +
            '<div class="author-info"><img src="' + authorImg + '"> ' + sanitize(joke.author) + '</div>' +
            '<div class="actions">' +
                '<button class="act-btn btn-share" data-id="' + joke.id + '">📸</button>' +
                '<button class="act-btn btn-vote ' + vClass + '" data-id="' + joke.id + '" data-type="best">🤣 ' + (joke.votes_best||0) + '</button>' +
                '<button class="act-btn btn-vote ' + vClass + '" data-id="' + joke.id + '" data-type="bad">🍅 ' + (joke.votes_bad||0) + '</button>' +
            '</div>' +
        '</div>';
    return el;
}

window.shareAsImage = function(id) {
    var card = document.getElementById('joke-' + id);
    if (!card || typeof html2canvas === 'undefined') return showToast("Cargando...", "error");
    showToast("Generando...");
    html2canvas(card, { useCORS: true, allowTaint: true, scale: 2, backgroundColor: "#ffffff" }).then(function(canvas) {
        var link = document.createElement('a');
        link.download = 'chiste.png';
        link.href = canvas.toDataURL("image/png");
        link.click();
        showToast("¡Imagen lista!");
    });
};

window.vote = async function(id, type) {
    if (app.user.voted.indexOf(id) !== -1) return showToast('Ya votaste', 'error');
    playSound(type === 'best' ? 'laugh' : 'splat');
    try {
        var field = (type === 'best' ? 'votes_best' : 'votes_bad');
        var res = await client.rpc('increment_vote', { joke_id: id, field_name: field, visitor_id: app.user.id, device_fp: app.user.id });
        if (!res.error) { 
            app.user.voted.push(id);
            localStorage.setItem('elMuro_v6_usr', JSON.stringify(app.user)); 
            initGlobalSync();
        }
    } catch(e) {}
};

async function postJoke() {
    var input = document.getElementById('secret-input');
    var txt = input ? input.value.trim() : "";
    var aliasInput = document.getElementById('user-alias');
    var alias = aliasInput ? aliasInput.value.trim() : "";

    // VALIDACIÓN ESTRICTA DE ALIAS
    if (alias.length < 2) return showToast('¡Pon tu ALIAS para publicar!', 'error');
    if (txt.length < 3) return showToast('Chiste muy corto', 'error');
    
    var check = await client.rpc('check_joke_originality', { new_content: txt });
    if (check.data === false) return showToast('Repetido', 'error');

    var dot = document.querySelector('.dot.active');
    var col = dot ? dot.getAttribute('data-color') : '#fff9c4';
    
    client.from('jokes').insert([{ text: txt, author: alias, authorid: app.user.id, color: col, avatar: app.user.avatar || 'bot1' }]).then(function(res) {
        if (!res.error) { input.value = ''; playSound('post'); showToast('¡Pegado!'); initGlobalSync(); }
    });
}

function updateStats() {
    var list = app.state.jokes || [];
    var best = list.slice().sort(function(a,b){ return (b.votes_best||0)-(a.votes_best||0); }).slice(0, 5);
    var hl = document.getElementById('humorists-list');
    if (hl) hl.innerHTML = best.map(function(j) { return '<li><span>' + sanitize(j.author) + '</span> <span style="color:#ff9500;margin-left:auto;">🤣 ' + (j.votes_best||0) + '</span></li>'; }).join('');
    var worst = list.filter(function(j){ return (j.votes_bad||0)>(j.votes_best||0); }).sort(function(a,b){ return (b.votes_bad||0)-(a.votes_bad||0); }).slice(0, 3);
    var pl = document.getElementById('purgatory-list');
    if (pl) pl.innerHTML = worst.map(function(j) { return '<li><span>' + sanitize(j.author) + '</span> <span style="color:#ff1744;margin-left:auto;">🍅 ' + (j.votes_bad||0) + '</span></li>'; }).join('') || '<li>Limpio</li>';
    var now = new Date();
    var daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
    var ps = document.getElementById('purgatory-status');
    if (ps) ps.innerHTML = '<p style="color:#888;">Faltan ' + daysLeft + ' días.</p>';
}

window.onload = function() {
    app.user = loadUser();
    initSounds();
    document.getElementById('my-avatar-img').src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (app.user.avatar || 'bot1');
    if(app.user.alias) document.getElementById('user-alias').value = app.user.alias;

    document.getElementById('mural').onclick = function(e) {
        var btn = e.target.closest('.act-btn');
        if (!btn) return;
        var id = btn.getAttribute('data-id');
        if (btn.classList.contains('btn-share')) window.shareAsImage(id);
        if (btn.classList.contains('btn-vote')) window.vote(id, btn.getAttribute('data-type'));
    };

    document.getElementById('post-btn').onclick = postJoke;
    document.getElementById('search-input').oninput = function(e) { app.state.filterTerm = e.target.value; syncWall(); };
    document.getElementById('mute-btn').onclick = function() { app.isMuted = !app.isMuted; this.innerText = app.isMuted ? '🔇' : '🔊'; };
    
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
            if (this.classList.contains('btn-trigger-dash')) document.getElementById('dashboard').setAttribute('aria-hidden', 'false');
        };
    }

    document.getElementById('close-dash-btn').onclick = function() { document.getElementById('dashboard').setAttribute('aria-hidden', 'true'); };

    initGlobalSync();
};