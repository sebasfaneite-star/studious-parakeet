/* UCKER Sales HQ — on-device data layer.
   Gives the app the same small database API it used inside Claude (collections, documents,
   live snapshots), but stores everything on this phone. The starting data (leads and the
   goals/settings) comes from the files in /data; anything the rep adds or changes is saved
   in this browser's storage on top of it. */
(function () {
  'use strict';
  const KEY = 'ucker-hq-local-v1';
  const NAME_KEY = 'ucker-hq-rep-name';
  const ME = 'me';

  let local = {};
  try { local = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { local = {}; }
  const base = {};
  const listeners = new Set();
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

  const ready = (async () => {
    const load = async (url) => { try { const r = await fetch(url, { cache: 'no-cache' }); if (r.ok) return await r.json(); } catch (e) {} return null; };
    const [leads, settings] = await Promise.all([load('data/leads.json'), load('data/settings.json')]);
    if (Array.isArray(leads)) leads.forEach(({ id, ...d }) => { if (id) base['leads/' + id] = d; });
    if (settings) base['config/goals'] = settings;
  })();

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(local)); }
    catch (e) { const err = new Error('Storage is full'); err.code = 'quota_exceeded'; throw err; }
  }
  const read = (path) => (Object.prototype.hasOwnProperty.call(local, path) ? local[path] : (base[path] || null));
  function docsIn(col) {
    const pre = col + '/', ids = new Set();
    for (const k of Object.keys(base)) if (k.startsWith(pre) && !k.slice(pre.length).includes('/')) ids.add(k.slice(pre.length));
    for (const k of Object.keys(local)) if (k.startsWith(pre) && !k.slice(pre.length).includes('/')) ids.add(k.slice(pre.length));
    const out = [];
    ids.forEach((id) => { const d = read(pre + id); if (d) out.push({ id, data: () => clone(d), exists: true }); });
    return out;
  }
  function fire(l) {
    try {
      if (l.kind === 'col') l.cb({ docs: docsIn(l.path), metadata: { fromCache: false } });
      else { const d = read(l.path); l.cb({ id: l.path.split('/').pop(), exists: !!d, data: () => clone(d) || undefined, metadata: { fromCache: false } }); }
    } catch (e) { console.warn(e); }
  }
  let pending = false;
  function notify() { if (pending) return; pending = true; setTimeout(() => { pending = false; listeners.forEach(fire); }, 0); }
  function write(path, value) { const prev = Object.prototype.hasOwnProperty.call(local, path) ? local[path] : undefined; local[path] = value; try { persist(); } catch (e) { if (prev === undefined) delete local[path]; else local[path] = prev; throw e; } notify(); }
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function doc(path) {
    return {
      id: path.split('/').pop(), path,
      async get() { await ready; const d = read(path); return { id: path.split('/').pop(), exists: !!d, data: () => clone(d) || undefined }; },
      async set(data) { await ready; write(path, clone(data)); },
      async update(data) { await ready; const cur = read(path); if (!cur) { const e = new Error('Not found'); e.code = 'not_found'; throw e; } write(path, { ...cur, ...clone(data) }); },
      async delete() { await ready; write(path, null); },
      onSnapshot(cb, onErr) { const l = { kind: 'doc', path, cb, onErr }; listeners.add(l); ready.then(() => fire(l)); return () => listeners.delete(l); }
    };
  }
  function collection(path) {
    return {
      path,
      doc: (id) => doc(path + '/' + id),
      async add(data) { await ready; const id = newId(); write(path + '/' + id, clone(data)); return doc(path + '/' + id); },
      onSnapshot(cb, onErr) { const l = { kind: 'col', path, cb, onErr }; listeners.add(l); ready.then(() => fire(l)); return () => listeners.delete(l); }
    };
  }
  const db = { doc, collection };

  const user = {
    id: async () => ME,
    isOwner: async () => true,
    canEdit: async () => true,
    can: async () => true,
    profiles: async (ids) => { const n = (() => { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } })(); const o = {}; (ids || []).forEach((i) => { o[i] = { name: i === ME ? (n || 'You') : '' }; }); return o; }
  };

  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename || 'download';
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }
  };

  window.claude = {
    async use(name) {
      if (name === 'db') { await ready; return db; }
      if (name === 'user') return user;
      if (name === 'downloads') return downloads;
      const e = new Error('Not available in the standalone app'); e.code = 'no_mcp'; throw e;
    }
  };

  /* backup / restore of this phone's own records */
  window.UCKER_LOCAL = {
    exportData() { return { app: 'ucker-sales-hq', version: 1, exportedAt: new Date().toISOString(), repName: (() => { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } })(), records: clone(local) }; },
    importData(obj) {
      if (!obj || obj.app !== 'ucker-sales-hq' || typeof obj.records !== 'object') throw new Error('bad file');
      const prev = local; local = clone(obj.records);
      try { persist(); } catch (e) { local = prev; throw e; }
      if (obj.repName) { try { localStorage.setItem(NAME_KEY, obj.repName); } catch (e) {} }
      notify();
    },
    getName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } },
    setName(n) { try { localStorage.setItem(NAME_KEY, n || ''); } catch (e) {} }
  };
})();
