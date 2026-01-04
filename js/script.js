/**
 * EL MURO V39.6 - EMERGENCY REPAIR
 */

var SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';
var client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

var app = { state: { jokes: [] }, user: null };

function loadUser() {
    var u;
    try { u = JSON.parse(localStorage.getItem('elMuro_v6_usr')); } catch(e) { u = null; }
    if (!u || !u.id) {
        u = { id: crypto.randomUUID(), voted: [], alias: '', avatar: 'bot1' };
        localStorage.setItem('elMuro_v6_usr', JSON.stringify(u));
    }
    return u;
}

function sanitize(s) { 
    if(!s) return "";
    var d = document.createElement('div'); d.textContent = s.substring(0, 300); return d.innerHTML; 
}

async function initGlobalSync() {
    try {
        var { data } = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(100);
        if (data) { app.state.jokes = data; syncWall(); }
    } catch (e) { console.error("Sync Error:", e); }
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
    el.style.setProperty('--bg-c', joke.color || '#fff9c4');
    
    var v_best = joke.votes_best || 0;
    var v_bad = joke.votes_bad || 0;

    el.innerHTML = '<div class="post-body">' + sanitize(joke.text) + '</div>' +
        '<div class="post-footer">' +
            '<div>👤 ' + sanitize(joke.author) + '</div>' +
            '<div class="actions">' +
                '<button class="act-btn" onclick="vote(\'"+joke.id+"\', \'best\')">🤣 <span>' + v_best + '</span></button>' +
                '<button class="act-btn" onclick="vote(\'"+joke.id+"\', \'bad\')">🍅 <span>' + v_bad + '</span></button>' +
            '</div>' +
        '</div>';
    return el;
}

// FUNCIONES DE ANIMACIÓN (Fuera para asegurar carga)
function createSplat(card) {
    var s = document.createElement('div');
    s.className = 'tomato-splat';
    s.style.left = '50%'; s.style.top = '50%';
    card.appendChild(s);
    setTimeout(() => s.remove(), 500);
}

function createConfetti(card) {
    for (var i = 0; i < 10; i++) {
        var c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = '50%'; c.style.top = '50%';
        c.style.setProperty('--x', (Math.random() * 200 - 100) + 'px');
        c.style.setProperty('--y', (Math.random() * -200 - 50) + 'px');
        card.appendChild(c);
        (function(el){ setTimeout(() => el.remove(), 800); })(c);
    }
}

window.vote = async function(id, type) {
    console.log("Votando:", id, type);
    var card = document.getElementById('joke-' + id);
    if (!card) return;

    // 1. ANIMACIÓN PRIMERO (Siempre sale)
    if (type === 'bad') {
        card.classList.add('shake');
        createSplat(card);
        setTimeout(() => card.classList.remove('shake'), 400);
    } else {
        createConfetti(card);
    }

    // 2. CONEXIÓN CON DB
    try {
        var field = (type === 'best' ? 'votes_best' : 'votes_bad');
        var { error } = await client.rpc('increment_vote', { 
            joke_id: String(id), 
            field_name: field, 
            visitor_id: app.user.id 
        });

        if (error) {
            console.error("Error DB:", error.message);
            if (error.message.includes("VOTO_DUPLICADO")) {
                alert("¡YA HAS VOTADO ESTO!");
            }
        } else {
            // Actualizar número visualmente
            initGlobalSync();
        }
    } catch (err) {
        console.error("Fatal Error:", err);
    }
};

async function postJoke() {
    var input = document.getElementById('secret-input');
    var alias = document.getElementById('user-alias').value.trim();
    if (!alias) return alert("Pon un Alias");
    if (input.value.length < 3) return;
    
    var dot = document.querySelector('.dot.active');
    var col = dot ? dot.getAttribute('data-color') : '#fff9c4';
    
    await client.from('jokes').insert([{ 
        text: input.value, author: alias, authorid: app.user.id, color: col, ts: new Date().toISOString() 
    }]);
    
    input.value = '';
    initGlobalSync();
}

window.onload = function() {
    app.user = loadUser();
    document.getElementById('my-avatar-img').src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (app.user.avatar || 'bot1');
    if(app.user.alias) document.getElementById('user-alias').value = app.user.alias;
    document.getElementById('post-btn').onclick = postJoke;
    document.getElementById('color-dots').onclick = function(e) {
        var d = e.target.closest('.dot');
        if(d) {
            document.querySelectorAll('.dot').forEach(el => el.classList.remove('active'));
            d.classList.add('active');
        }
    };
    initGlobalSync();
};