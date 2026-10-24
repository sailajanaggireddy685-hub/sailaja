/* NoteNest storage adapter.
   With Supabase configured, files and metadata are shared across users.
   Without configuration, it safely falls back to browser IndexedDB for local testing. */
const DB = (() => {
  const config = window.NOTENEST_CONFIG || {};
  const cloudEnabled = /^https:\/\//.test(config.SUPABASE_URL || '') &&
    config.SUPABASE_ANON_KEY && !String(config.SUPABASE_URL).includes('PASTE_') &&
    !String(config.SUPABASE_ANON_KEY).includes('PASTE_');
  const base = String(config.SUPABASE_URL || '').replace(/\/$/, '');
  const key = config.SUPABASE_ANON_KEY || '';
  const bucket = config.STORAGE_BUCKET || 'study-files';
  const DB_NAME = 'notenest';
  const STORE = 'files';

  async function request(path, options = {}) {
    const response = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...(options.body instanceof Blob ? { 'Content-Type': options.body.type || 'application/octet-stream' } : {}),
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Cloud storage error (${response.status}): ${body.slice(0, 240)}`);
    }
    if (response.status === 204) return null;
    const type = response.headers.get('content-type') || '';
    return type.includes('application/json') ? response.json() : response;
  }

  function openLocal() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('subject', 'subject'); store.createIndex('type', 'type');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function localRun(mode, action) {
    const db = await openLocal();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode); const req = action(tx.objectStore(STORE)); let result;
      if (req) req.onsuccess = () => { result = req.result; };
      tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Local storage operation failed.'));
    });
  }
  function publicUrl(path) { return `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`; }
  async function cloudPut(record) {
    const copy = { ...record };
    delete copy.blob;
    if (record.blob instanceof Blob) {
      const safeName = String(record.fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${record.id}/${safeName}`;
      await request(`/storage/v1/object/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'POST', headers: { 'x-upsert': 'true' }, body: record.blob
      });
      copy.storagePath = path;
    }
    if (!copy.storagePath && !copy.fileUrl) throw new Error('File is missing its cloud storage path. Please select the file again and upload it.');
    const payload = { id: String(copy.id), metadata: copy, storage_path: copy.storagePath || null };
    await request('/rest/v1/files?on_conflict=id', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(payload)
    });
    return { ...copy, fileUrl: copy.storagePath ? publicUrl(copy.storagePath) : copy.fileUrl };
  }
  async function cloudGetAll() {
    const rows = await request('/rest/v1/files?select=id,metadata,storage_path&order=created_at.desc');
    return rows.map(row => ({ ...row.metadata, id: row.id, storagePath: row.storage_path || row.metadata.storagePath,
      fileUrl: row.storage_path ? publicUrl(row.storage_path) : row.metadata.fileUrl, blob: null }));
  }
  async function cloudRemove(id) {
    const rows = await request(`/rest/v1/files?select=storage_path&id=eq.${encodeURIComponent(id)}`);
    await request(`/rest/v1/files?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (rows[0]?.storage_path) {
      const path = rows[0].storage_path.split('/').map(encodeURIComponent).join('/');
      await request(`/storage/v1/object/${encodeURIComponent(bucket)}/${path}`, { method: 'DELETE' });
    }
  }
  return {
    isCloud: () => cloudEnabled,
    modeMessage: () => cloudEnabled ? 'Cloud sharing enabled — files are shared with everyone who can access this site.' : 'Local demo mode — configure Supabase to share uploads across devices.',
    getAll: () => cloudEnabled ? cloudGetAll() : localRun('readonly', s => s.getAll()),
    get: id => cloudEnabled ? cloudGetAll().then(all => all.find(f => f.id === id)) : localRun('readonly', s => s.get(id)),
    put: record => cloudEnabled ? cloudPut(record) : localRun('readwrite', s => s.put(record)),
    remove: id => cloudEnabled ? cloudRemove(id) : localRun('readwrite', s => s.delete(id)),
    clear: async () => {
      if (!cloudEnabled) return localRun('readwrite', s => s.clear());
      const all = await cloudGetAll();
      for (const item of all) await cloudRemove(item.id);
    },
    putMany: async records => {
      if (!cloudEnabled) {
        const db = await openLocal();
        return new Promise((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); records.forEach(r => tx.objectStore(STORE).put(r)); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      }
      const saved = [];
      for (const record of records) saved.push(await cloudPut(record));
      return saved;
    },
    getBlob: async record => {
      if (record.blob instanceof Blob) return record.blob;
      if (!cloudEnabled || !record.fileUrl) throw new Error('File data is unavailable. Re-upload this file in cloud mode.');
      const response = await fetch(record.fileUrl);
      if (!response.ok) throw new Error('Could not download the file from cloud storage.');
      return response.blob();
    }
  };
})();
