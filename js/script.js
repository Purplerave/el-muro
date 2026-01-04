/**
 * EL MURO V37.6 - FINAL STABILITY
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

function sanitize(s) { 
    if(!s) return "";
    var d = document.createElement('div'); 
    d.textContent = s.substring(0, 300); 
    return d.innerHTML; 
}

async function initGlobalSync() {
    try {
        var { data, error } = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(100);
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
    
    // FORZAR EL COLOR USANDO LA VARIABLE CSS
    if (joke.color === 'special-ai') el.classList.add('special-ai');
    else if (joke.color === 'special-vip') el.classList.add('special-vip');
    else el.style.setProperty('--bg-c', joke.color || '#fff9c4');

    el.innerHTML = '<div class="post-body">' + sanitize(joke.text) + '</div>' +
        '<div class="post-footer">' +
            '<div>👤 ' + sanitize(joke.author) + '</div>' +
            '<div class="actions">' +
                '<button class="act-btn" onclick="vote(\"' + joke.id + '\", \'best\")">🤣 ' + (joke.votes_best||0) + '</button>' + 
                '<button class="act-btn" onclick="vote(\"' + joke.id + '\", \'bad\")">🍅 ' + (joke.votes_bad||0) + '</button>' + 
            '</div>' + 
        '</div>';
    return el;
}

window.vote = async function(id, type) {
    if (app.user.voted.indexOf(id) !== -1) return alert('Ya votaste este chiste');
    var field = (type === 'best' ? 'votes_best' : 'votes_bad');
    var { error } = await client.rpc('increment_vote', { joke_id: id, field_name: field });
    if (!error) { app.user.voted.push(id); localStorage.setItem('elMuro_v6_usr', JSON.stringify(app.user)); initGlobalSync(); }
};

async function postJoke() {
    var txt = document.getElementById('secret-input').value.trim();
    var alias = document.getElementById('user-alias').value.trim();
    if (!alias) return alert('Pon un ALIAS');
    if (txt.length < 3) return alert('Chiste muy corto');
    
    var dot = document.querySelector('.dot.active');
    var col = dot ? dot.getAttribute('data-color') : '#fff9c4';
    
    // Inserción básica
    var { error } = await client.from('jokes').insert([{ 
        text: txt, author: alias, authorid: app.user.id, color: col, ts: new Date().toISOString()
    }]);
    
    if (!error) { 
        document.getElementById('secret-input').value = ''; 
        initGlobalSync(); 
    } else { 
        alert("Error al publicar: " + error.message); 
    } 
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
