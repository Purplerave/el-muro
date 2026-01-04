/**
 * EL MURO V38.4 - FULL FEATURES RESTORED
 */

var SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';
var client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

var app = {
    state: { jokes: [], sort: 'new' },
    user: null
};

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
        if (data) { 
            app.state.jokes = data; 
            syncWall(); 
            updateDashboard();
        }
    } catch (e) { console.error(e); }
}

function syncWall() {
    var container = document.getElementById('mural');
    if(!container) return;
    container.innerHTML = '';
    
    var list = app.state.jokes.slice();
    if (app.state.sort === 'best') {
        list.sort((a,b) => (b.votes_best||0) - (a.votes_best||0));
    } else if (app.state.sort === 'controversial') {
        list = list.filter(j => (j.votes_bad||0) > (j.votes_best||0));
        list.sort((a,b) => (b.votes_bad||0) - (a.votes_bad||0));
    }

    list.forEach(j => container.appendChild(createCard(j)));
}

function createCard(joke) {
    var el = document.createElement('article');
    el.className = 'post-it';
    el.id = 'joke-' + joke.id;
    el.style.setProperty('--bg-c', joke.color || '#fff9c4');
    
    var votes = (joke.votes_best || 0);
    var bads = (joke.votes_bad || 0);

    el.innerHTML = '<div class="post-body">' + sanitize(joke.text) + '</div>' +
        '<div class="post-footer">' + 
            '<div>👤 ' + sanitize(joke.author) + '</div>' + 
            '<div class="actions">' + 
                '<button class="act-btn" onclick="shareAsImage("'+joke.id+'")">📸</button>' + 
                '<button class="act-btn" onclick="vote("'+joke.id+'", "best")">🤣 ' + votes + '</button>' + 
                '<button class="act-btn" onclick="vote("'+joke.id+'", "bad")">🍅 ' + bads + '</button>' + 
            '</div>' + 
        '</div>';
    return el;
}

window.shareAsImage = function(id) {
    var card = document.getElementById('joke-' + id);
    if (!card) return;
    html2canvas(card, { scale: 2 }).then(canvas => {
        var link = document.createElement('a');
        link.download = 'chiste-muro.png';
        link.href = canvas.toDataURL();
        link.click();
    });
};

window.vote = async function(id, type) {
    var card = document.getElementById('joke-' + id);
    if (!card) return;

    // Animación instantánea
    if (type === 'bad') {
        card.classList.add('shake');
        createSplat(card);
        setTimeout(() => card.classList.remove('shake'), 400);
    } else {
        createConfetti(card);
    }

    // Lógica de servidor
    var field = (type === 'best' ? 'votes_best' : 'votes_bad');
    console.log("Enviando voto:", { id, field, user: app.user.id });

    var { error } = await client.rpc('increment_vote', { 
        joke_id: String(id), 
        field_name: field, 
        visitor_id: app.user.id 
    });

    if (error) {
        console.error("Error servidor:", error);
        if (error.message.includes('VOTO_DUPLICADO')) {
            showToast("¡YA HAS JUZGADO ESTE CHISTE!", "error");
        } else {
            alert("ERROR CRÍTICO: " + error.message + "\n\nCopia este error y dímelo.");
        }
    } else {
        app.user.voted.push(id); 
        localStorage.setItem('elMuro_v6_usr', JSON.stringify(app.user));
        // Actualizamos el número visualmente solo si el servidor dice OK
        initGlobalSync(); 
    }
};

function createSplat(card) {
    var splat = document.createElement('div');
    splat.className = 'tomato-splat';
    splat.style.left = (Math.random() * 60 + 20) + '%';
    splat.style.top = (Math.random() * 60 + 20) + '%';
    card.appendChild(splat);
    setTimeout(() => splat.remove(), 500);
}

function createConfetti(card) {
    for (var i = 0; i < 15; i++) {
        var c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = '50%';
        c.style.top = '50%';
        c.style.setProperty('--x', (Math.random() * 300 - 150) + 'px');
        c.style.setProperty('--y', (Math.random() * -300 - 50) + 'px');
        c.style.backgroundColor = ['#81c784', '#ffeb3b', '#2196f3'][Math.floor(Math.random()*3)];
        card.appendChild(c);
        (function(el){ setTimeout(() => el.remove(), 1000); })(c);
    }
}

function updateDashboard() {
    var list = app.state.jokes || [];
    var worst = list.filter(j => (j.votes_bad||0) > (j.votes_best||0))
                    .sort((a,b) => (b.votes_bad||0) - (a.votes_bad||0))
                    .slice(0, 3);
    
    var pl = document.getElementById('purgatory-list');
    if (pl) {
        pl.innerHTML = worst.map(j => `
            <div class="purgatory-item">
                <strong>${sanitize(j.author)}</strong>
                ${sanitize(j.text).substring(0,60)}...
                <br><span>🍅 ${j.votes_bad}</span>
            </div>
        `).join('') || '<p style="font-weight:900; color:#666;">TRANQUILIDAD...<br>No hay nadie en la purga.</p>';
    }
}

async function postJoke() {
    var input = document.getElementById('secret-input');
    var alias = document.getElementById('user-alias').value.trim();
    if (!alias) return alert("Pon un Alias");
    if (input.value.length < 3) return;
    var dot = document.querySelector('.dot.active');
    var col = dot ? dot.getAttribute('data-color') : '#fff9c4';
    await client.from('jokes').insert([{ text: input.value, author: alias, authorid: app.user.id, color: col, ts: new Date().toISOString() }]);
    input.value = ''; initGlobalSync();
}

window.onload = function() {
    app.user = loadUser();
    document.getElementById('my-avatar-img').src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (app.user.avatar || 'bot1');
    if(app.user.alias) document.getElementById('user-alias').value = app.user.alias;
    
    document.getElementById('post-btn').onclick = postJoke;
    
    document.getElementById('avatar-btn').onclick = function() {
        var s = document.getElementById('avatar-selector');
        s.style.display = (s.style.display === 'grid' ? 'none' : 'grid');
    };

    document.querySelectorAll('.av-opt').forEach(opt => {
        opt.onclick = function() {
            app.user.avatar = this.dataset.seed;
            document.getElementById('my-avatar-img').src = this.src;
            localStorage.setItem('elMuro_v6_usr', JSON.stringify(app.user));
            document.getElementById('avatar-selector').style.display = 'none';
        }
    });

    document.getElementById('color-dots').onclick = function(e) {
        var d = e.target.closest('.dot');
        if(d) {
            document.querySelectorAll('.dot').forEach(el => el.classList.remove('active'));
            d.classList.add('active');
        }
    };

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            app.state.sort = this.dataset.sort;
            if (this.dataset.sort === 'controversial') {
                document.getElementById('dashboard').setAttribute('aria-hidden', 'false');
            } else {
                syncWall();
            }
        }
    });

    document.getElementById('close-dash-btn').onclick = function() {
        document.getElementById('dashboard').setAttribute('aria-hidden', 'true');
    };

    initGlobalSync();
};
