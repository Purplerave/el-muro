/**
 * EL MURO V37.4 - INDESTRUCTIBLE VERSION
 */

var SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';
var client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

var app = { state: { jokes: [] }, user: null };

function genUUID() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { var r = Math.random() * 16 | 0, v = (c == 'x' ? r : (r & 0x3 | 0x8)); return v.toString(16); }); }

function loadUser() {
    var u;
    try { u = JSON.parse(localStorage.getItem('elMuro_v6_usr')); } catch(e) { u = null; }
    if (!u || !u.id) {
        u = { id: genUUID(), voted: [], alias: '', avatar: 'bot1' };
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
    d.textContent = Array.from(s).slice(0, 300).join(''); 
    return d.innerHTML; 
}

async function initGlobalSync() {
    try {
        // Intentamos cargar por created_at o ts (doble compatibilidad)
        var res = await client.from('jokes').select('*').order('id', { ascending: false }).limit(100);
        if (res.data) { app.state.jokes = res.data; syncWall(); }
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
    
    // EL VERDE TIENE QUE VERSE: Aplicamos color de fondo directo
    var color = joke.color || '#fff9c4';
    el.style.backgroundColor = color;
    el.style.setProperty('--bg-c', color); 

    if (color === 'special-ai') el.classList.add('special-ai');
    if (color === 'special-vip') el.classList.add('special-vip');

    el.innerHTML = '<div class="post-body">' + sanitize(joke.text) + '</div>' +
        '<div class="post-footer">' +
            '<div class="author-info">👤 ' + sanitize(joke.author) + '</div>' +
            '<div class="actions">' +
                '<button class="act-btn" onclick="vote("'+joke.id+'", "best")">🤣 ' + (joke.votes_best||0) + '</button>' +
                '<button class="act-btn" onclick="vote("'+joke.id+'", "bad")">🍅 ' + (joke.votes_bad||0) + '</button>' +
            '</div>' +
        '</div>';
    return el;
}

window.vote = async function(id, type) {
    if (app.user.voted.indexOf(id) !== -1) return showToast('Ya votaste', 'error');
    var field = (type === 'best' ? 'votes_best' : 'votes_bad');
    var { error } = await client.rpc('increment_vote', { joke_id: id, field_name: field });
    if (!error) { app.user.voted.push(id); localStorage.setItem('elMuro_v6_usr', JSON.stringify(app.user)); initGlobalSync(); }
};

async function postJoke() {
    var txt = document.getElementById('secret-input').value.trim();
    var alias = document.getElementById('user-alias').value.trim();
    if (alias.length < 2) return alert('¡Escribe tu ALIAS primero!');
    if (txt.length < 3) return alert('¡Chiste muy corto!');
    
    var dot = document.querySelector('.dot.active');
    var col = dot ? dot.getAttribute('data-color') : '#fff9c4';
    
    console.log("Intentando publicar:", { txt, alias, col });

    var { data, error } = await client.from('jokes').insert([{ 
        text: txt, author: alias, authorid: app.user.id, color: col, avatar: 'bot1' 
    }]);
    
    if (!error) { 
        document.getElementById('secret-input').value = ''; 
        alert('¡Publicado con éxito!'); 
        initGlobalSync(); 
    } else { 
        console.error(error);
        alert("Error Supabase: " + error.message); 
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
