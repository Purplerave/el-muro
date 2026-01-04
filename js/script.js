/**
 * EL MURO V36.0 - BRAVE & GROQ STABLE
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
    var d = document.createElement('div'); 
    // Usamos Array.from para no romper emojis (pares sustitutos)
    var clean = Array.from(s).slice(0, 300).join('');
    d.textContent = clean; 
    return d.innerHTML; 
}

var isGeneratingAI = false; // Bloqueo para evitar múltiples peticiones
async function initGlobalSync() {
    console.log("-> Sincronizando con el Muro...");
    try {
        var res = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(200);
        if (res.data) {
            app.state.jokes = res.data;
            syncWall();
            updateStats();
            checkDailyAIJoke();
        }
    } catch (e) { console.error("Error de sincronización:", e); }
}

async function checkDailyAIJoke() {
    if (isGeneratingAI) return;
    var aiID = '00000000-0000-0000-0000-000000000000';
    var jokes = app.state.jokes || [];
    var lastAI = jokes.filter(function(j) { return j.authorid === aiID; })[0];
    
    // Si hace más de 6h que no publica la IA
    if (!lastAI || (Date.now() - new Date(lastAI.ts).getTime() >= 21600000)) {
        isGeneratingAI = true; 
        console.log("-> Solicitando nuevo chiste a la Nube (Edge Function)...");
        try {
            var memory = jokes.slice(0, 5).map(function(j) { return j.text; }).join(" | ");
            
            // Llamamos a la función. Ella insertará el chiste si todo va bien.
            var res = await client.functions.invoke('generate-joke', { 
                body: { memory: memory } 
            });
            
            if (res.data && res.data.success) {
                console.log("IA ha publicado un nuevo chiste.");
                initGlobalSync(); // Refrescamos para verlo
            }
            isGeneratingAI = false; 
        } catch(e) { 
            isGeneratingAI = false; 
            console.warn("Error invocando IA:", e); 
        }
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
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#aaa;"><h2>EL MURO ESTÁ LIMPIO</h2></div>';
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
    
    // Manejo de colores especiales (AI / VIP)
    if (joke.color === 'special-ai' || joke.color === 'special-vip') {
        el.style.setProperty('--bg-c', 'transparent'); 
    } else {
        el.style.setProperty('--bg-c', joke.color || '#fff9c4');
        el.style.backgroundColor = 'var(--bg-c)';
    }
    
    // --- GAMIFICACIÓN VISUAL (RANGOS DINÁMICOS) ---
    var votes = (joke.votes_best || 0);
    var bads = (joke.votes_bad || 0);
    
    if (votes >= 15) el.classList.add('rank-gold');
    else if (votes >= 7) el.classList.add('rank-neon');
    else if (bads > votes && bads >= 3) el.classList.add('rank-purge');
    // ----------------------------------------------

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
    if (!card) return;
    showToast("Capturando chiste...");
    html2canvas(card, { useCORS: true, allowTaint: true, scale: 2, backgroundColor: "#ffffff" }).then(function(canvas) {
        var link = document.createElement('a');
        link.download = 'chiste-el-muro.png';
        link.href = canvas.toDataURL("image/png");
        link.click();
        showToast("¡Imagen descargada!");
    });
};

window.vote = async function(id, type) {
    if (type !== 'save' && app.user.voted.indexOf(id) !== -1) return showToast('Ya has votado este chiste', 'error');
    
    // --- EFECTO PARTÍCULAS (BURST) ---
    createBurst(id, type === 'best' ? '🤣' : (type === 'save' ? '🛡️' : '🍅'));

    var field = 'votes_best';
    if (type === 'bad') field = 'votes_bad';
    if (type === 'save') field = 'votes_save';

    playSound(type === 'best' ? 'laugh' : (type === 'save' ? 'post' : 'splat'));

    try {
        var res = await client.rpc('increment_vote', { joke_id: id, field_name: field, visitor_id: app.user.id, device_fp: app.user.id });
        if (!res.error) { 
            if (type !== 'save') {
                app.user.voted.push(id);
                localStorage.setItem('elMuro_v6_usr', JSON.stringify(app.user)); 
            } else {
                showToast("🛡️ ¡Indulto registrado!");
            }
            initGlobalSync();
        }
    } catch(e) {}
};

function createBurst(id, emoji) {
    var card = document.getElementById('joke-' + id);
    if (!card) return;
    for (var i = 0; i < 6; i++) {
        var el = document.createElement('div');
        el.className = 'burst';
        el.innerText = emoji;
        el.style.left = '50%';
        el.style.top = '50%';
        el.style.setProperty('--x', (Math.random() * 200 - 100) + 'px');
        el.style.setProperty('--y', (Math.random() * -200 - 50) + 'px');
        card.appendChild(el);
        (function(c){ setTimeout(function(){ if(c) c.remove(); }, 800); })(el);
    }
}

async function postJoke() {
    var input = document.getElementById('secret-input');
    var txt = input ? input.value.trim() : "";
    var aliasInput = document.getElementById('user-alias');
    var alias = aliasInput ? aliasInput.value.trim() : "";

    if (alias.length < 2) return showToast('¡Pon tu ALIAS para publicar!', 'error');
    if (txt.length < 3) return showToast('Chiste muy corto', 'error');
    
    // --- RATE LIMITING (Anti-Spam) ---
    var lastPost = localStorage.getItem('last_post_time');
    var now = Date.now();
    if (lastPost && (now - lastPost < 60000)) { // 60 segundos de espera
        var wait = Math.ceil((60000 - (now - lastPost)) / 1000);
        return showToast('⏳ Espera ' + wait + 's para publicar otro.', 'error');
    }

    var btn = document.getElementById('post-btn');
    btn.disabled = true;

    try {
        var check = await client.rpc('check_joke_originality', { new_content: txt });
        if (check.data === false) {
            btn.disabled = false;
            return showToast('Ese ya está en el muro...', 'error');
        }

        var dot = document.querySelector('.dot.active');
        var col = dot ? dot.getAttribute('data-color') : '#fff9c4';
        
        var res = await client.from('jokes').insert([{ 
            text: txt, author: alias, authorid: app.user.id, color: col, avatar: app.user.avatar || 'bot1' 
        }]);
        
        if (!res.error) { 
            input.value = ''; 
            localStorage.setItem('last_post_time', Date.now()); // Guardamos timestamp
            playSound('post'); 
            showToast('¡Pegado!'); 
            app.user.alias = alias;
            localStorage.setItem('elMuro_v6_usr', JSON.stringify(app.user));
            initGlobalSync(); 
        }
    } catch(e) { showToast("Error de red", 'error'); }
    btn.disabled = false;
}

function updateStats() {
    var list = app.state.jokes || [];
    var best = list.slice().sort(function(a,b){ return (b.votes_best||0)-(a.votes_best||0); }).slice(0, 5);
    var hl = document.getElementById('humorists-list');
    if (hl) hl.innerHTML = best.map(function(j) { return '<li><span>' + sanitize(j.author) + '</span> <span style="color:#ff9500;margin-left:auto;">🤣 ' + (j.votes_best||0) + '</span></li>'; }).join('');
    var worst = list.filter(function(j){ return (j.votes_bad||0)>(j.votes_best||0); }).sort(function(a,b){ return (b.votes_bad||0)-(a.votes_bad||0); }).slice(0, 3);
    
    // Lógica de Fechas para la Purga
    var now = new Date();
    var lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); // Último día del mes (28, 30, 31)
    var purgeStartDay = lastDay - 2; // Empieza 3 días antes (ej: 29, 30, 31)
    var currentDay = now.getDate();
    var isPurgeActive = currentDay >= purgeStartDay;
    
    var statusDiv = document.getElementById('purgatory-status');
    if (statusDiv) {
        if (isPurgeActive) {
            // Calcular horas restantes
            var nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            var hoursLeft = Math.floor((nextMonth - now) / (1000 * 60 * 60));
            statusDiv.innerHTML = '<div style="background:#ff1744; color:#fff; padding:8px; border-radius:5px; text-align:center; margin-bottom:10px; font-weight:bold; font-size:0.9rem; animation:pulse 1.5s infinite;">🚨 PURGA ACTIVA: Quedan ' + hoursLeft + 'h</div>';
        } else {
            var daysLeft = purgeStartDay - currentDay;
            statusDiv.innerHTML = '<div style="background:#333; color:#fff; padding:8px; border-radius:5px; text-align:center; margin-bottom:10px; font-size:0.9rem;">⏳ Faltan ' + daysLeft + ' días para la Purga</div>';
        }
    }

    var pl = document.getElementById('purgatory-list');
    if (pl) {
        pl.innerHTML = worst.map(function(j) { 
            // El botón de indulto solo aparece si la purga está activa
            var saveBtn = isPurgeActive 
                ? '<button class="act-btn btn-vote" data-id="' + j.id + '" data-type="save" style="font-size:0.7rem; padding:2px 6px; background:#e3f2fd; border-color:#2196f3; color:#0d47a1;">🛡️ ' + (j.votes_save||0) + '</button>' 
                : '<span style="font-size:0.7rem; color:#aaa;" title="Indulto disponible a fin de mes">🔒 ' + (j.votes_save||0) + '</span>';

            return '<li>' +
                '<div style="flex:1;">' +
                    '<span>' + sanitize(j.author) + '</span>' +
                    '<div style="font-size:0.75rem; color:#666; margin-top:2px;">' + sanitize(j.text).substring(0, 40) + '...</div>' +
                '</div>' +
                '<div style="display:flex; flex-direction:column; align-items:end; gap:5px;">' +
                    '<span style="color:#ff1744;">🍅 ' + (j.votes_bad||0) + '</span>' +
                    saveBtn +
                '</div>' +
            '</li>'; 
        }).join('') || '<li style="color:#aaa; font-weight:normal;">No hay candidatos a la purga... por ahora.</li>';
    }
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
            var allD = document.querySelectorAll('.dot');
            for (var k=0; k<allD.length; k++) allD[k].classList.remove('active');
            this.classList.add('active');
        };
    }

    var filters = document.querySelectorAll('.filter-btn');
    for (var f=0; f<filters.length; f++) {
        filters[f].onclick = function() {
            var allF = document.querySelectorAll('.filter-btn');
            for (var x=0; x<allF.length; x++) allF[x].classList.remove('active');
            this.classList.add('active');
            app.state.sort = this.dataset.sort;
            syncWall();
            if (this.classList.contains('btn-trigger-dash')) document.getElementById('dashboard').setAttribute('aria-hidden', 'false');
        };
    }

    document.getElementById('close-dash-btn').onclick = function() { document.getElementById('dashboard').setAttribute('aria-hidden', 'true'); };

    initGlobalSync();
};