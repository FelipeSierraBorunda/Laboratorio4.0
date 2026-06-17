/* =====================================================================
   supabase-client.js — Cliente REST genérico para Supabase (PostgREST)
   ---------------------------------------------------------------------
   Usa fetch directo (sin librerías). Soporta cualquier tabla mediante
   select / insert / patch / del, además de los atajos para la tabla
   "componentes" que ya usaba la app (getAll / create / update / delete).

   Si mock-supabase.js está cargado e intercepta fetch, este mismo
   código corre contra la simulación local sin cambiar nada.
   ===================================================================== */

if (!window.SupabaseClient) {
  const SUPABASE_URL = 'https://hslqnrnolsjdtmrmsyzf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_g_4ezPhhWpr5xoQZu6WjdQ_dKwyGpp6';

  const baseHeaders = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  };

  const rest = (path) => `${SUPABASE_URL}/rest/v1/${path}`;

  const SupabaseClient = {
    // ---------- primitivas genéricas ----------

    // SELECT * FROM <table> [ORDER BY ...] [LIMIT ...]
    async select(table, { order, limit } = {}) {
      try {
        let url = rest(`${table}?select=*`);
        if (order) url += `&order=${order}`;
        if (limit) url += `&limit=${limit}`;
        const res = await fetch(url, { method: 'GET', headers: baseHeaders });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        console.error(`[Supabase] select ${table}:`, e);
        return [];
      }
    },

    // INSERT INTO <table> (...) VALUES (...) RETURNING *
    async insert(table, row) {
      const res = await fetch(rest(table), {
        method: 'POST',
        headers: { ...baseHeaders, Prefer: 'return=representation' },
        body: JSON.stringify(row)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    },

    // UPDATE <table> SET ... WHERE <col> = <val> RETURNING *
    async patch(table, col, val, patch) {
      const res = await fetch(rest(`${table}?${col}=eq.${encodeURIComponent(val)}`), {
        method: 'PATCH',
        headers: { ...baseHeaders, Prefer: 'return=representation' },
        body: JSON.stringify(patch)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    },

    // DELETE FROM <table> WHERE <col> = <val>
    async del(table, col, val) {
      const res = await fetch(rest(`${table}?${col}=eq.${encodeURIComponent(val)}`), {
        method: 'DELETE',
        headers: baseHeaders
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    },

    // ---------- atajos para "componentes" (API que ya usa la app) ----------
    getAll() { return this.select('componentes'); },
    create(c) { return this.insert('componentes', c); },
    update(id, c) { return this.patch('componentes', 'id', id, c); },
    delete(id) { return this.del('componentes', 'id', id); }
  };

  window.SupabaseClient = SupabaseClient;
}
