/* =====================================================================
   mock-supabase.js — Simulador de Supabase para probar dentro de
   Claude Design (o sin conexión).
   ---------------------------------------------------------------------
   Intercepta window.fetch: cuando una petición va al host de Supabase,
   la responde localmente emulando PostgREST (GET/POST/PATCH/DELETE,
   filtros ?col=eq.val, order, limit). El resto de peticiones pasan
   intactas al fetch real.

   Los datos viven en localStorage (clave lab_mock_db) para que persistan
   entre recargas mientras pruebas.

   ACTIVACIÓN AUTOMÁTICA:
   - En GitHub Pages (*.github.io)  → mock APAGADO  → usa Supabase real.
   - En cualquier otro host (Claude Design, localhost, file://)
                                    → mock ENCENDIDO → simulación local.
   Forzar manualmente:
     localStorage.setItem('lab_force_mock','1')  → siempre simular
     localStorage.setItem('lab_force_mock','0')  → siempre real
   ===================================================================== */
(function () {
  const SUPABASE_HOST = 'hslqnrnolsjdtmrmsyzf.supabase.co';
  const DB_KEY = 'lab_mock_db';

  // ---- decidir si el mock se activa ----
  function decideMock() {
    let forced = null;
    try { forced = localStorage.getItem('lab_force_mock'); } catch (e) {}
    if (forced === '1') return true;
    if (forced === '0') return false;
    // por defecto: real sólo en github.io, simulado en todo lo demás
    return !/\.github\.io$/i.test(location.hostname);
  }
  if (!decideMock()) {
    console.info('[mock-supabase] desactivado — usando Supabase real');
    return;
  }
  console.info('[mock-supabase] ACTIVO — simulando Supabase localmente');

  // ---- datos semilla (sólo la primera vez) ----
  const SEED = {
    componentes: [
      {id:'d01',codigoInterno:'00001',contenedor:'G1',cajon:1,posicion:1,tipo:'Resistencia',codigoFabricante:'RC0402FR-0710KL',valor:'',descripcion:'Resistencia 10kΩ SMD 0402 1%',cantidad:500,espacioOcupado:'Medio',notas:'1/16W, ±1%'},
      {id:'d02',codigoInterno:'00002',contenedor:'G1',cajon:1,posicion:2,tipo:'Resistencia',codigoFabricante:'RC0402FR-074K7L',valor:'',descripcion:'Resistencia 4.7kΩ SMD 0402 1%',cantidad:300,espacioOcupado:'Bajo',notas:''},
      {id:'d03',codigoInterno:'00003',contenedor:'G1',cajon:2,posicion:1,tipo:'Resistencia',codigoFabricante:'RC0402FR-071KL',valor:'',descripcion:'Resistencia 1kΩ SMD 0402 1%',cantidad:400,espacioOcupado:'Medio',notas:''},
      {id:'d05',codigoInterno:'00005',contenedor:'G1',cajon:5,posicion:1,tipo:'Capacitor',codigoFabricante:'GRM155R61A104KA01D',valor:'',descripcion:'Capacitor cerámico 100nF 10V 0402',cantidad:200,espacioOcupado:'Bajo',notas:'MLCC ±10%'},
      {id:'d07',codigoInterno:'00007',contenedor:'G1',cajon:6,posicion:1,tipo:'Capacitor',codigoFabricante:'GRM188R61E226ME15D',valor:'',descripcion:'Capacitor cerámico 22µF 25V 0603',cantidad:80,espacioOcupado:'Bajo',notas:''},
      {id:'d08',codigoInterno:'00008',contenedor:'G1',cajon:10,posicion:1,tipo:'IC',codigoFabricante:'BQ25155YFPR',valor:'',descripcion:'Cargador Li-Ion 500mA I2C',cantidad:20,espacioOcupado:'Bajo',notas:'DSBGA-9'},
      {id:'d10',codigoInterno:'00010',contenedor:'G1',cajon:12,posicion:1,tipo:'IC',codigoFabricante:'STM32F103C8T6',valor:'',descripcion:'Microcontrolador ARM Cortex-M3 72MHz',cantidad:8,espacioOcupado:'Bajo',notas:'LQFP-48'},
      {id:'d11',codigoInterno:'00011',contenedor:'G1',cajon:15,posicion:1,tipo:'Sensor',codigoFabricante:'BME280',valor:'',descripcion:'Sensor temperatura, humedad y presión',cantidad:10,espacioOcupado:'Bajo',notas:'I2C/SPI'},
      {id:'d13',codigoInterno:'00013',contenedor:'G1',cajon:20,posicion:1,tipo:'Transistor',codigoFabricante:'IRLZ44N',valor:'',descripcion:'MOSFET N-Ch 55V 47A TO-220',cantidad:12,espacioOcupado:'Bajo',notas:''},
      {id:'d14',codigoInterno:'00014',contenedor:'G1',cajon:25,posicion:1,tipo:'Regulador',codigoFabricante:'AMS1117-3.3',valor:'',descripcion:'Regulador LDO 3.3V 1A SOT-223',cantidad:30,espacioOcupado:'Bajo',notas:''},
      {id:'d15',codigoInterno:'00015',contenedor:'G1',cajon:30,posicion:1,tipo:'Diodo',codigoFabricante:'1N4148W',valor:'',descripcion:'Diodo señal rápida 100V 150mA',cantidad:100,espacioOcupado:'Bajo',notas:'SOD-123'},
      {id:'d16',codigoInterno:'00016',contenedor:'G1',cajon:35,posicion:1,tipo:'LED',codigoFabricante:'LTST-C191KFKT',valor:'',descripcion:'LED rojo 0402 620nm',cantidad:200,espacioOcupado:'Bajo',notas:'Vf=2.0V'},
      {id:'d17',codigoInterno:'30001',contenedor:'C1',cajon:1,posicion:1,tipo:'IC',codigoFabricante:'74HC00N',valor:'',descripcion:'Compuerta NAND cuádruple DIP-14',cantidad:25,espacioOcupado:'Medio',notas:'Through-hole'},
      {id:'d19',codigoInterno:'30003',contenedor:'C1',cajon:3,posicion:1,tipo:'Transistor',codigoFabricante:'2N3904',valor:'',descripcion:'NPN BJT 40V 200mA TO-92',cantidad:50,espacioOcupado:'Medio',notas:'Through-hole'},
      {id:'d21',codigoInterno:'30005',contenedor:'C1',cajon:5,posicion:1,tipo:'IC',codigoFabricante:'NE555P',valor:'',descripcion:'Temporizador 555 DIP-8',cantidad:15,espacioOcupado:'Bajo',notas:'Through-hole'},
      {id:'d23',codigoInterno:'40001',contenedor:'C2',cajon:1,posicion:1,tipo:'IC',codigoFabricante:'74LS138N',valor:'',descripcion:'Decodificador 3-a-8 DIP-16',cantidad:8,espacioOcupado:'Bajo',notas:'Through-hole'},
      {id:'d25',codigoInterno:'40003',contenedor:'C2',cajon:3,posicion:1,tipo:'Transistor',codigoFabricante:'2N2222A',valor:'',descripcion:'NPN BJT 40V 600mA TO-18',cantidad:30,espacioOcupado:'Medio',notas:'Through-hole'}
    ],
    usuarios: [],
    transacciones: [],
    changelog: []
  };

  function loadDB() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    const db = JSON.parse(JSON.stringify(SEED));
    saveDB(db);
    return db;
  }
  function saveDB(db) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) {}
  }

  // próximo id autoincremental para tablas con id numérico
  function nextId(rows) {
    let mx = 0;
    rows.forEach(r => { const n = parseInt(r.id); if (!isNaN(n) && n > mx) mx = n; });
    return mx + 1;
  }

  // construye una respuesta fetch falsa
  function reply(data, status = 200) {
    const body = JSON.stringify(data);
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
      text: async () => body,
      headers: { get: () => 'application/json' }
    });
  }

  // parsea /rest/v1/<tabla>?<query>
  function parse(url) {
    const u = new URL(url);
    const m = u.pathname.match(/\/rest\/v1\/([^/?]+)/);
    const table = m ? m[1] : null;
    const filters = [];
    let order = null, limit = null;
    u.searchParams.forEach((val, key) => {
      if (key === 'select') return;
      if (key === 'order') { order = val; return; }
      if (key === 'limit') { limit = parseInt(val); return; }
      // formato PostgREST: col=eq.value
      const mm = val.match(/^eq\.(.*)$/);
      if (mm) filters.push({ col: key, val: decodeURIComponent(mm[1]) });
    });
    return { table, filters, order, limit };
  }

  function applyFilters(rows, filters) {
    return rows.filter(r => filters.every(f => String(r[f.col]) === String(f.val)));
  }

  const realFetch = window.fetch.bind(window);

  window.fetch = function (input, opts = {}) {
    const url = typeof input === 'string' ? input : (input && input.url);
    if (!url || url.indexOf(SUPABASE_HOST) === -1) {
      return realFetch(input, opts);
    }

    const method = (opts.method || 'GET').toUpperCase();
    const { table, filters, order, limit } = parse(url);
    const db = loadDB();
    if (!table || !db[table]) db[table] = db[table] || [];
    let rows = db[table];

    try {
      // -------- GET --------
      if (method === 'GET') {
        let out = applyFilters(rows, filters);
        if (order) {
          const [col, dir] = order.split('.');
          out = out.slice().sort((a, b) => {
            const cmp = String(a[col] ?? '').localeCompare(String(b[col] ?? ''));
            return dir === 'desc' ? -cmp : cmp;
          });
        }
        if (limit) out = out.slice(0, limit);
        return reply(out);
      }

      // -------- POST (insert) --------
      if (method === 'POST') {
        let body = {};
        try { body = JSON.parse(opts.body || '{}'); } catch (e) {}
        const incoming = Array.isArray(body) ? body : [body];
        const inserted = incoming.map(row => {
          const r = { ...row };
          if (r.id === undefined || r.id === null || r.id === '') r.id = nextId(rows);
          rows.push(r);
          return r;
        });
        saveDB(db);
        return reply(inserted, 201);
      }

      // -------- PATCH (update) --------
      if (method === 'PATCH') {
        let patch = {};
        try { patch = JSON.parse(opts.body || '{}'); } catch (e) {}
        const updated = [];
        rows.forEach((r, i) => {
          if (filters.every(f => String(r[f.col]) === String(f.val))) {
            rows[i] = { ...r, ...patch };
            updated.push(rows[i]);
          }
        });
        saveDB(db);
        return reply(updated);
      }

      // -------- DELETE --------
      if (method === 'DELETE') {
        db[table] = rows.filter(r => !filters.every(f => String(r[f.col]) === String(f.val)));
        saveDB(db);
        return reply([], 200);
      }
    } catch (e) {
      console.error('[mock-supabase] error:', e);
      return reply({ error: String(e) }, 500);
    }

    return reply([], 200);
  };

  // utilidad para resetear la simulación desde la consola
  window.resetMockDB = function () {
    try { localStorage.removeItem(DB_KEY); } catch (e) {}
    console.info('[mock-supabase] base reiniciada — recarga la página');
  };
})();
