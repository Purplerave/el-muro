/**
 * EL MURO V37.1 - COLOR & STABILITY FIX
 */

var SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';
var client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

var app = {
    state: { jokes: [], sort: 'new', filterTerm: '' },
    user: null,
    isMuted: false
};

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
        var res = await client.from('jokes').select('*').order('ts', { ascending: false }).limit(200);
        if (res.data) { app.state.jokes = res.data; syncWall(); }
    } catch (e) { console.error(e); }
}

function syncWall() {
    var container = document.getElementById('mural');
    if(!container) return;
    container.innerHTML = '';
    var list = app.state.jokes.slice();
    for(var i=0; i<list.length; i++) { container.appendChild(createCard(list[i])); }
}

function createCard(joke) {
    var el = document.createElement('article');
    el.className = 'post-it';
    el.id = 'joke-' + joke.id;
    
    // CORRECCIÓN COLOR: Usamos variable CSS para que el verde se vea
    if (joke.color === 'special-ai') el.classList.add('special-ai');
    else if (joke.color === 'special-vip') el.classList.add('special-vip');
    else el.style.setProperty('--bg-c', joke.color || '#fff9c4');
    
    var votes = (joke.votes_best || 0);
    var bads = (joke.votes_bad || 0);
    if (votes >= 15) el.classList.add('rank-gold');
    else if (votes >= 7) el.classList.add('rank-neon');
    else if (bads > votes && bads >= 3) el.classList.add('rank-purge');

    var authorImg = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (joke.avatar || 'bot1');
    var isVoted = app.user.voted.indexOf(joke.id) !== -1;
    var vClass = isVoted ? 'voted' : '';

    el.innerHTML = '<div class="post-body">' + sanitize(joke.text) + '</div>' +
        '<div class="post-footer">' +
            '<div class="author-info"><img src="' + authorImg + '"> ' + sanitize(joke.author) + '</div>' +
            '<div class="actions">' +
                '<button class="act-btn btn-vote ' + vClass + '" data-id="' + joke.id + '" data-type="best">🤣 ' + votes + '</button>' +
                '<button class="act-btn btn-vote ' + vClass + '" data-id="' + joke.id + '" data-type="bad">🍅 ' + bads + '</button>' +
            '</div>' +
        '</div>';
    return el;
}

window.vote = async function(id, type) {
    if (app.user.voted.indexOf(id) !== -1) return showToast('Ya votaste', 'error');
    var field = (type === 'best' ? 'votes_best' : 'votes_bad');
    try {
        var res = await client.rpc('increment_vote', { joke_id: id, field_name: field, visitor_id: app.user.id, device_fp: app.user.id });
        if (!res.error) { app.user.voted.push(id); localStorage.setItem('elMuro_v6_usr', JSON.stringify(app.user)); initGlobalSync(); }
    } catch(e) {}
};

async function postJoke() {
    var txt = document.getElementById('secret-input').value.trim();
    var alias = document.getElementById('user-alias').value.trim();
    if (alias.length < 2) return showToast('¡Pon tu ALIAS!', 'error');
    if (txt.length < 3) return showToast('Muy corto', 'error');
    
    var dot = document.querySelector('.dot.active');
    var col = dot ? dot.getAttribute('data-color') : '#fff9c4';
    
    var { error } = await client.from('jokes').insert([{ 
        text: txt, author: alias, authorid: app.user.id, color: col, avatar: app.user.avatar || 'bot1' 
    }]);
    
    if (!error) { 
        document.getElementById('secret-input').value = ''; 
        showToast('¡Pegado!', 'success'); 
        initGlobalSync(); 
    } else { showToast(error.message, 'error'); }
}

window.onload = function() {
    app.user = loadUser();
    document.getElementById('my-avatar-img').src = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (app.user.avatar || 'bot1');
    if(app.user.alias) document.getElementById('user-alias').value = app.user.alias;
    
    document.getElementById('post-btn').onclick = postJoke;
    
    var dots = document.querySelectorAll('.dot');
    for (var j=0; j<dots.length; j++) {
        dots[j].onclick = function() {
            var allD = document.querySelectorAll('.dot');
            for (var k=0; k<allD.length; k++) allD[k].classList.remove('active');
            this.classList.add('active');
        };
    }
    initGlobalSync();
};