// Saves: a dawn snapshot, kept in this artifact's cloud store under your own private folder
// (data/users/<you>/), so the same run continues on your phone and your Mac. A local copy is kept too.
const KEY = 'hollowmere.save';

export function createSaves() {
  let db = null, uid = null;
  const ready = (async () => {
    try {
      if (!window.claude || !window.claude.use) return;
      const [d, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      uid = user ? await user.id() : null;
      db = uid ? d : null;
    } catch { db = null; }
  })();
  const ref = () => db.doc(`data/users/${uid}/hollowmere`);   // a document path has an even number of segments (4)
  const local = () => { try { const t = localStorage.getItem(KEY); return t ? JSON.parse(t) : null; } catch { return null; } };

  async function save(snap) {
    if (!snap) return null;
    const data = JSON.stringify(snap);
    try { localStorage.setItem(KEY, data); } catch { /* storage unavailable */ }
    await ready; if (!db) return 'local';
    try { await ref().set({ v: 1, at: snap.savedAt, day: snap.night, city: snap.city, data }); return 'cloud'; } catch { return 'local'; }
  }
  /** the newest save from the cloud or this device */
  async function load() {
    await ready;
    let cloud = null;
    if (db) try { const d = await ref().get(); if (d.exists) cloud = JSON.parse(d.data().data); } catch { cloud = null; }
    const here = local();
    if (cloud && here) return (cloud.savedAt || 0) >= (here.savedAt || 0) ? cloud : here;
    return cloud || here;
  }
  async function clear() {
    try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
    await ready; if (db) try { await ref().delete(); } catch { /* nothing to delete */ }
  }
  return { save, load, clear, ready, cloud: () => !!db };
}
