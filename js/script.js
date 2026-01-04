/**
 * EL MURO V38.0 - PROFESSIONAL BACKEND & OPTIMISTIC UI
 */

var SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';
var client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

var app = { state: { jokes: [] }, user: null };

function loadUser() {
    var u;
    try { u = JSON.parse(localStorage.getItem('elMuro_v6_usr')); } catch(e) { u = null; }
    if (!u || !u.id) {
        u = { id: crypto.randomUUID(), voted: [], alias: '' };
        localStorage.setItem('elMuro_v6_usr', JSON.stringify(u));
    }
    return u;
}

function showToast(msg, type) {
    var container = document.getElementById('toast-container');
    if(!container) return;
    var el = document.createElement('div');
    el.className = 'toast show';
    el.style.backgroundColor = (type === 'error' ? '#ff1744' : '#4caf50');
    el.innerText = msg;
    container.appendChild(el);
    setTimeout(function() { el.remove(); }, 3000);
}

function sanitize(s) { 
    if(!s) return "";
    var d = document.createElement('div'); 
    d.textContent = s.substring(0, 300).trim(); 
    return d.innerHTML; 
}

async function initGlobalSync() {
    try {
        var { data } = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(50);
        if (data) { app.state.jokes = data; syncWall(); }
    } catch (e) { console.error(e); }
}

function syncWall() {
    var container = document.getElementById('mural');
    if(!container) return;
    container.innerHTML = '';
    app.state.jokes.forEach(function(j) { container.appendChild(createCard(j)); });
}

function createCard(joke) {
    var el = document.createElement('article');
    el.className = 'post-it';
    el.id = 'joke-' + joke.id;
    
    var color = joke.color || '#fff9c4';
    el.style.setProperty('--bg-c', color);

    if (color === 'special-ai') el.classList.add('special-ai');
    if (color === 'special-vip') el.classList.add('special-vip');

    el.innerHTML = '<div class="post-body">' + sanitize(joke.text) + '</div>' +
        '<div class="post-footer">' +
            '<div>👤 ' + sanitize(joke.author) + '</div>' +
            '<div class="actions">' +
                '<button class="act-btn" id="btn-best-'+joke.id+'" onclick="vote(\"' + joke.id + '\", \'best\'")">🤣 <span>' + (joke.votes_best||0) + '</span></button>' + 
                '<button class="act-btn" id="btn-bad-'+joke.id+'" onclick="vote(\"' + joke.id + '\", \'bad\'")">🍅 <span>' + (joke.votes_bad||0) + '</span></button>' + 
            '</div>' + 
        '</div>';
    return el;
}

window.vote = async function(id, type) {
    // 1. Feedback inmediato (Optimistic UI)
    var btn = document.getElementById('btn-' + (type === 'best' ? 'best-' : 'bad-') + id);
    if (!btn) return;
    var span = btn.querySelector('span');
    span.innerText = parseInt(span.innerText) + 1;
    btn.disabled = true;

    // 2. Llamada al servidor
    var field = (type === 'best' ? 'votes_best' : 'votes_bad');
    var { error } = await client.rpc('increment_vote', { joke_id: id, field_name: field, visitor_id: app.user.id });
    
    if (error) {
        // Revertimos si falla (ej: ya votó)
        span.innerText = parseInt(span.innerText) - 1;
        showToast("Ya has votado este chiste", "error");
    } else {
        app.user.voted.push(id);
        localStorage.setItem('elMuro_v6_usr', JSON.stringify(app.user));
    }
};

async function postJoke() {
    var input = document.getElementById('secret-input');
    var txt = input.value.trim();
    var alias = document.getElementById('user-alias').value.trim();
    
    if (!alias) return showToast('Pon un ALIAS', 'error');
    if (txt.length < 3) return showToast('Muy corto', 'error');
    
    // Cooldown local
    var last = localStorage.getItem('last_p');
    if (last && (Date.now() - last < 30000)) return showToast('Espera 30s', 'error');

    var { error } = await client.from('jokes').insert([{ 
        text: txt, author: alias, authorid: app.user.id, color: document.querySelector('.dot.active').getAttribute('data-color'), ts: new Date().toISOString()
    }]);
    
    if (!error) { 
        input.value = ''; 
        localStorage.setItem('last_p', Date.now());
        showToast('¡Publicado!', 'success');
        initGlobalSync(); 
    } else { showToast(error.message, 'error'); } 
}

window.onload = function() {
    app.user = loadUser();
    if(app.user.alias) document.getElementById('user-alias').value = app.user.alias;
    document.getElementById('post-btn').onclick = postJoke;
    document.getElementById('color-dots').onclick = function(e) {
        var d = e.target.closest('.dot');
        if(d) {
            document.querySelectorAll('.dot').forEach(function(el){ el.classList.remove('active'); });
            d.classList.add('active');
        }
    };
    initGlobalSync();
};