// CONFIGURACIÓN SUPABASE (Mismas claves que en script.js)
var SUPABASE_URL = 'https://vqdzidtiyqsuxnlaztmf.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZHppZHRpeXFzdXhubGF6dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyODIxNTIsImV4cCI6MjA4Mjg1ODE1Mn0.ZmDwXQ_5Rg6mTBM8JS4eDYQoBvH9ceQmHL-ELKqdWVA';
var client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Elementos DOM
var loginContainer = document.getElementById('login-container');
var dashboard = document.getElementById('admin-dashboard');
var loginBtn = document.getElementById('login-btn');
var logoutBtn = document.getElementById('logout-btn');
var emailInput = document.getElementById('email');
var passInput = document.getElementById('password');
var errorMsg = document.getElementById('login-error');
var jokesList = document.getElementById('jokes-list');
var statusMsg = document.getElementById('status-msg');

// --- AUTH LOGIC ---

async function checkSession() {
    var { data } = await client.auth.getSession();
    if (data.session) {
        showDashboard();
    } else {
        showLogin();
    }
}

async function login() {
    var email = emailInput.value;
    var password = passInput.value;
    
    loginBtn.disabled = true;
    errorMsg.style.display = 'none';

    var { data, error } = await client.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        console.error("Login error:", error);
        errorMsg.style.display = 'block';
        loginBtn.disabled = false;
    } else {
        showDashboard();
    }
}

async function logout() {
    await client.auth.signOut();
    showLogin();
}

function showLogin() {
    loginContainer.style.display = 'block';
    dashboard.style.display = 'none';
    loginBtn.disabled = false;
    emailInput.value = '';
    passInput.value = '';
}

function showDashboard() {
    loginContainer.style.display = 'none';
    dashboard.style.display = 'block';
    loadJokes();
}

// --- DATA LOGIC ---

async function loadJokes() {
    statusMsg.innerText = "Cargando...";
    jokesList.innerHTML = '';

    var { data, error } = await client
        .from('jokes')
        .select('*')
        .order('ts', { ascending: false })
        .limit(100);

    if (error) {
        statusMsg.innerText = "Error cargando datos.";
        return;
    }

    statusMsg.innerText = "Mostrando últimos 100 chistes.";
    
    data.forEach(joke => {
        var row = document.createElement('tr');
        
        var idCell = `<td>${joke.id}</td>`;
        var textCell = `<td>${sanitize(joke.text).substring(0, 100)}...</td>`;
        var authorCell = `<td>${sanitize(joke.author)} <br> <small style='color:#666'>${joke.authorid}</small></td>`;
        var votesCell = `<td>🤣 ${joke.votes_best || 0} / 🍅 ${joke.votes_bad || 0}</td>`;
        
        var actionsCell = `
            <td>
                <button class="btn-delete" onclick="deleteJoke(${joke.id})">BORRAR</button>
            </td>
        `;

        row.innerHTML = idCell + textCell + authorCell + votesCell + actionsCell;
        jokesList.appendChild(row);
    });
}

window.deleteJoke = async function(id) {
    if(!confirm("¿Seguro que quieres borrar este chiste? Esta acción es irreversible.")) return;

    var { error } = await client.from('jokes').delete().eq('id', id);
    
    if (error) {
        alert("Error al borrar: " + error.message);
    } else {
        loadJokes(); // Recargar lista
    }
};

function sanitize(s) { 
    if(!s) return "";
    var d = document.createElement('div'); 
    d.textContent = s; 
    return d.innerHTML; 
}

// --- EVENT LISTENERS ---

loginBtn.addEventListener('click', login);
logoutBtn.addEventListener('click', logout);
document.getElementById('refresh-btn').addEventListener('click', loadJokes);

// Init
checkSession();
