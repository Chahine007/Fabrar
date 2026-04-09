const render = async () => `
  <div class="min-h-screen flex items-center justify-center bg-gray-50 fixed inset-0 z-50">
    <div class="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100 relative overflow-hidden">
      <!-- Decorative background -->
      <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
      
      <div class="text-center mb-10">
        <h1 class="text-3xl font-black text-gray-900 tracking-tight flex justify-center items-center gap-2 mb-2">
          <span class="text-blue-600">❖</span> ERP Core
        </h1>
        <p class="text-gray-500 font-medium">Accedi al pannello di controllo</p>
      </div>

      <form id="login-form" class="space-y-6">
        <div id="login-error" class="hidden bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold text-center border border-red-100 flex items-center justify-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <span>Credenziali Errate</span>
        </div>

        <div>
          <label for="username" class="block text-sm font-bold text-gray-700 mb-2">Nome Utente o Email</label>
          <input type="text" id="username" placeholder="Inserisci username" class="w-full p-3.5 border border-gray-300 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all font-medium text-gray-900" required>
        </div>

        <div>
          <label for="password" class="block text-sm font-bold text-gray-700 mb-2">Password</label>
          <input type="password" id="password" placeholder="••••••••" class="w-full p-3.5 border border-gray-300 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all font-medium text-gray-900" required>
        </div>

        <button type="submit" id="login-btn" class="w-full bg-slate-900 hover:bg-black text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 outline-none focus:ring-4 focus:ring-slate-200">
          Entra nel Gestionale
        </button>
      </form>

      <div class="mt-8 text-center text-xs text-gray-400 font-medium uppercase tracking-wider">
        Accesso Riservato al Personale Autorizzato
      </div>
    </div>
  </div>
`;

const mount = async () => {
    const form = document.getElementById('login-form');
    const errBox = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        
        btn.disabled = true;
        btn.innerHTML = '<span class="animate-pulse">Autenticazione in corso...</span>';
        errBox.classList.add('hidden');

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Login non valido');

            // Successo: Salviamo e Redirigiamo
            localStorage.setItem('jwt_token', data.token);
            window.location.hash = '#/dashboard';
            
        } catch (err) {
            btn.disabled = false;
            btn.innerText = 'Entra nel Gestionale';
            errBox.querySelector('span').innerText = err.message;
            errBox.classList.remove('hidden');
        }
    });
};

export default { render, mount };
