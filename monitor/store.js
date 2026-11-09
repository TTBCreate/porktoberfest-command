// Firestore when FIREBASE_SERVICE_ACCOUNT is set; otherwise an in-memory dry-run store.
import admin from 'firebase-admin';

export function openStore() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) return memoryStore();
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
  const db = admin.firestore();
  return {
    dry: false,
    async get(col, id) { const d = await db.collection(col).doc(id).get(); return d.exists ? d.data() : null; },
    async set(col, id, data, merge = true) { await db.collection(col).doc(id).set(data, { merge }); },
    async create(col, id, data) {
      try { await db.collection(col).doc(id).create(data); return true; }
      catch (e) { if (e.code === 6 || /already exists/i.test(e.message)) return false; throw e; }
    },
    async list(col) { const s = await db.collection(col).get(); return s.docs.map(d => ({ id: d.id, ...d.data() })); },
  };
}

export function memoryStore(seed = {}) {
  const m = new Map(Object.entries(seed).map(([c, docs]) => [c, new Map(Object.entries(docs))]));
  const c = col => (m.has(col) || m.set(col, new Map()), m.get(col));
  return {
    dry: true,
    _data: m,
    async get(col, id) { return c(col).get(id) ?? null; },
    async set(col, id, data, merge = true) { c(col).set(id, merge ? { ...(c(col).get(id) || {}), ...data } : data); },
    async create(col, id, data) { if (c(col).has(id)) return false; c(col).set(id, data); return true; },
    async list(col) { return [...c(col).entries()].map(([id, d]) => ({ id, ...d })); },
  };
}
