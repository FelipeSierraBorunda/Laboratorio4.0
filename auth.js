/* =====================================================================
   auth.js — Cuentas, sesión y registro de actividad para LabInventory
   ---------------------------------------------------------------------
   Ahora respaldado por Supabase (tablas: usuarios, transacciones,
   changelog) en lugar de localStorage.

   PATRÓN DE CACHÉ:
   La app lee getUsage() / getChangelog() / allUsage() / getSession()
   de forma SÍNCRONA durante el render. Por eso mantenemos una caché en
   memoria que:
     1. Se llena desde Supabase en init() (al arrancar la app).
     2. Se actualiza de inmediato (optimista) en cada escritura, mientras
        en segundo plano se envía el INSERT a Supabase.

   La sesión activa (qué usuario inició sesión) se guarda localmente:
   es un puntero efímero, no un dato de negocio.
   ===================================================================== */
(function () {
  const SESSION_KEY = 'li_session';

  // ---- caché en memoria ----
  let _accounts = {};     // email -> { id, email, nombre, pass, creado }
  let _usage = [];         // transacciones (todos los usuarios), más reciente primero
  let _changelog = [];     // registro global, más reciente primero
  let _session = null;     // { email, nombre }
  let _ready = false;

  // Hash consistente — simple pero determinista
  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h = h & h; // Convert to 32bit integer
    }
    return String(Math.abs(h));
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
  function sb() { return window.SupabaseClient; }

  const LabAuth = {
    // Carga inicial desde Supabase. Llamar (y await) una vez al arrancar.
    async init() {
      const c = sb();
      if (!c) { _ready = true; return; }
      try {
        const [users, tx, ch] = await Promise.all([
          c.select('usuarios'),
          c.select('transacciones', { order: 'ts.desc', limit: 500 }),
          c.select('changelog', { order: 'ts.desc', limit: 500 })
        ]);
        _accounts = {};
        (users || []).forEach(u => { _accounts[u.email] = u; });
        _usage = tx || [];
        _changelog = ch || [];
      } catch (e) {
        console.error('[auth] init:', e);
      }
      // restaurar sesión local
      let email = null;
      try { email = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) {}
      if (email && _accounts[email]) _session = { email, nombre: _accounts[email].nombre };
      _ready = true;
    },

    isReady() { return _ready; },

    getSession() { return _session ? { email: _session.email, nombre: _session.nombre } : null; },

    async register({ nombre, email, password }) {
      nombre = (nombre || '').trim();
      email = (email || '').trim().toLowerCase();
      if (!nombre || !email || !password) return { ok: false, error: 'Completa nombre, correo y contraseña' };
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'El correo no es válido' };
      if (password.length < 4) return { ok: false, error: 'La contraseña debe tener al menos 4 caracteres' };
      if (_accounts[email]) return { ok: false, error: 'Ya existe una cuenta con ese correo' };

      const acc = { id: uid(), email, nombre, pass: hash(password), creado: new Date().toISOString() };
      try {
        if (sb()) await sb().insert('usuarios', acc);
      } catch (e) {
        console.error('[auth] register:', e);
        return { ok: false, error: 'No se pudo crear la cuenta (error de conexión)' };
      }
      _accounts[email] = acc;
      _session = { email, nombre };
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(email)); } catch (e) {}
      return { ok: true, user: { nombre, email } };
    },

    async login({ email, password }) {
      email = (email || '').trim().toLowerCase();
      let acc = _accounts[email];
      
      // Si no está en caché, cargar desde Supabase
      if (!acc && sb()) {
        try {
          const users = await sb().select('usuarios', { filter: `email=eq.${email}` });
          if (users && users.length > 0) {
            acc = users[0];
            _accounts[email] = acc; // guardar en caché
          }
        } catch (e) {
          console.error('[auth] login - error cargando usuario:', e);
        }
      }
      
      if (!acc || acc.pass !== hash(password || '')) return { ok: false, error: 'Correo o contraseña incorrectos' };
      _session = { email: acc.email, nombre: acc.nombre };
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(acc.email)); } catch (e) {}
      return { ok: true, user: { nombre: acc.nombre, email: acc.email } };
    },

    logout() {
      _session = null;
      try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    },

    // Registra una acción de la cuenta activa. Actualiza la caché de
    // inmediato y empuja el INSERT a Supabase en segundo plano.
    logUsage(entry) {
      if (!_session) return;
      const row = Object.assign({ email: _session.email, usuario: _session.nombre, ts: new Date().toISOString() }, entry);
      _usage.unshift(row);
      if (_usage.length > 500) _usage.length = 500;
      if (sb()) sb().insert('transacciones', row).catch(e => console.error('[auth] logUsage:', e));
    },

    // Historial de la cuenta activa.
    getUsage() {
      if (!_session) return [];
      return _usage.filter(u => u.email === _session.email);
    },

    // Historial de TODAS las cuentas (para "quién consumió qué").
    allUsage() {
      return _usage.slice().sort((x, y) => String(y.ts).localeCompare(String(x.ts)));
    },

    // Registro GLOBAL de cambios al inventario (panel admin).
    logChange(entry) {
      const usuario = _session ? _session.nombre : 'Sistema';
      const row = Object.assign({ usuario, ts: new Date().toISOString() }, entry);
      _changelog.unshift(row);
      if (_changelog.length > 500) _changelog.length = 500;
      if (sb()) sb().insert('changelog', row).catch(e => console.error('[auth] logChange:', e));
    },
    getChangelog() { return _changelog.slice(); }
  };

  window.LabAuth = LabAuth;
})();
