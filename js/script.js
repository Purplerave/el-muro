/**
 * EL MURO V40.0 - STABLE RELEASE
 */

var SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';
var client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

var app = { state: { jokes: [], sort: 'new' }, user: null };

function loadUser() {
    var u;
    try { u = JSON.parse(localStorage.getItem('elMuro_v6_usr')); } catch(e) { u = null; }
    if (!u || !u.id) {
        var newId = (typeof crypto.randomUUID === 'function') 
            ? crypto.randomUUID() 
            : Math.random().toString(36).substring(2) + Date.now().toString(36);
        u = { id: newId, voted: [], alias: '', avatar: 'bot1' };
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
    } catch (e) { console.error("Sync Error:", e); }
}

function syncWall() {
    var container = document.getElementById('mural');
    if(!container) return;
    container.innerHTML = '';
    
    var list = app.state.jokes.slice();
    if (app.state.sort === 'best') {
        list.sort((a,b) => (b.votes_best||0) - (a.votes_best||0));
    } else {
        list.sort((a,b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    }

    list.forEach(function(j) { container.appendChild(createCard(j)); });
}

function createCard(j) {
    var el = document.createElement('article');
    el.className = 'post-it';
    el.id = 'joke-' + j.id;
    el.style.setProperty('--bg-c', j.color || '#fff9c4');

    var isLong = (j.text || "").length > 100;
    var isPopular = (j.votes_best || 0) > 10;
    var isAI = (j.authorid === '00000000-0000-0000-0000-000000000000');
    
    if (isAI) el.classList.add('special-ai');
    if ((isLong || isPopular) && !isAI) el.classList.add('wide');

    var rot = (Math.random() * 4 - 2).toFixed(1);
    el.style.transform = `rotate(${rot}deg)`;

    el.innerHTML = `<div class="post-body">${sanitize(j.text)}</div>
        <div class="post-footer">
            <div style="font-family: var(--font-mono); font-size: 0.75rem;">👤 ${sanitize(j.author)}</div>
            <div class="actions">
                <button class="act-btn" onclick="shareJoke('${j.id}')">📸</button>
                <button class="act-btn" onclick="vote('${j.id}', 'best')">🤣 <span class="num-box">${j.votes_best||0}</span></button>
                <button class="act-btn" onclick="vote('${j.id}', 'bad')">🍅 <span class="num-box">${j.votes_bad||0}</span></button>
            </div>
        </div>`;
    return el;
}

window.shareJoke = function(id) {
    var card = document.getElementById('joke-' + id);
    if (!card) return;
    
    var btn = card.querySelector('button[onclick*="share"]');
    var originalText = btn.innerHTML;
    btn.innerHTML = '⏳';

    html2canvas(card, { scale: 2, backgroundColor: null, useCORS: true }).then(canvas => {
        canvas.toBlob(async blob => {
            if (!blob) return;
            var file = new File([blob], "chiste_muro.png", { type: "image/png" });
            
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'El Muro de los Chistes Malos',
                        text: '¡Mira este chiste en El Muro!'
                    });
                    btn.innerHTML = '✅';
                } catch (e) { btn.innerHTML = originalText; }
            } else {
                try {
                    const item = new ClipboardItem({ "image/png": blob });
                    await navigator.clipboard.write([item]);
                    alert("¡Imagen copiada al portapapeles!");
                    btn.innerHTML = '📋';
                } catch (e) {
                    var link = document.createElement('a');
                    link.download = 'chiste_muro.png';
                    link.href = canvas.toDataURL();
                    link.click();
                    btn.innerHTML = '⬇️';
                }
            }
            setTimeout(() => btn.innerHTML = originalText, 2000);
        });
    });
};

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
    var card = document.getElementById('joke-' + id);
    if (!card) return;

    if (type === 'bad') {
        card.classList.add('shake');
        createSplat(card);
        setTimeout(() => card.classList.remove('shake'), 400);
    } else {
        createConfetti(card);
    }

    try {
        var field = (type === 'best' || type === 'save') ? 'votes_best' : 'votes_bad';
        var { error } = await client.rpc('increment_vote', {
            p_joke_id: String(id),
            p_field_name: field,
            p_voter_id: String(app.user.id)
        });

        if (error) {
            if (error.message.includes("VOTO_DUPLICADO")) alert("¡YA HAS VOTADO!");
            else console.error("Error DB:", error.message);
        } else {
            var span = card.querySelector(`button[onclick*="'${type}'"] .num-box`);
            if (span) span.innerText = (parseInt(span.innerText) || 0) + 1;
            
            var localJoke = app.state.jokes.find(j => String(j.id) === String(id));
            if (localJoke) localJoke[field] = (localJoke[field] || 0) + 1;
        }
    } catch (err) { console.error("Fatal Error:", err); }
};

function updateDashboard() {
    var worst = app.state.jokes.filter(j => (j.votes_bad||0) > (j.votes_best||0)).sort((a,b) => (b.votes_bad||0)-(a.votes_bad||0)).slice(0,3);
    var container = document.getElementById('purgatory-list');
    if(!container) return;

    var today = new Date();
    var lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    var daysLeft = lastDay.getDate() - today.getDate();
    var isPurgeTime = (daysLeft <= 3);

    var headerHTML = `<div style="padding:15px; background:#222; margin-bottom:20px; border:2px solid #ff1744;">
        <p style="color:#fff; font-size:0.9rem; margin:0 0 10px 0;">
            🚫 <strong>PROTOCOLO DE ELIMINACIÓN</strong><br>
            Los 3 chistes con peor reputación serán eliminados a fin de mes.
        </p>
        ${isPurgeTime 
            ? `<div style="color:#00ff00; font-weight:bold; animation: blink 1s infinite;">🚨 LA PURGA ESTÁ ACTIVA.<br>Tienes 1 voto de indulto.</div>` 
            : `<div style="color:#ff9500; font-weight:bold;">⏳ Faltan ${daysLeft} días para el juicio final.</div>`}
    </div>`;

    var listHTML = worst.map(j => `
        <div class="purgatory-item">
            <div class="threat-level">⚠️ AMENAZA: CRÍTICA</div>
            <div style="font-family:var(--font-mono); font-size:0.85rem; margin-bottom:15px; line-height:1.4; color:#eee;">
                <strong>${sanitize(j.author)}</strong>: <br>"${sanitize(j.text)}"
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #444; padding-top:10px;">
                <span style="color:#ff1744; font-weight:900;">🍅 ${j.votes_bad} Votos</span>
                ${isPurgeTime 
                    ? `<button class="act-btn" onclick="vote('${j.id}', 'save')" style="font-size:0.7rem; background:#00ff00; color:#000; border-color:#000;">🛡️ SALVAR</button>` 
                    : `<span style="font-size:0.7rem; color:#666;">🔒 ESPERA...</span>`}
            </div>
        </div>`).join('');

    container.innerHTML = headerHTML + (listHTML || '<p style="font-family:var(--font-mono); color:#00ff00;">>>> SISTEMA LIMPIO.</p>');
}

async function postJoke() {
    var input = document.getElementById('secret-input');
    var alias = document.getElementById('user-alias').value.trim();
    if (alias.length < 2) return alert("Pon un Alias (mín. 2 letras)");
    if (input.value.length < 3) return alert("El chiste es muy corto");

    var dot = document.querySelector('.dot.active');
    var col = dot ? dot.getAttribute('data-color') : '#fff9c4';

    app.user.alias = alias;
    localStorage.setItem('elMuro_v6_usr', JSON.stringify(app.user));

    var { error } = await client.from('jokes').insert([{
        text: input.value, author: alias, authorid: app.user.id, color: col, ts: new Date().toISOString() 
    }]);

    if(error) alert("Error: " + error.message);
    else {
        input.value = '';
        initGlobalSync();
    }
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
    initGlobalSync();
};