// Admin helper (run locally or from the "Manage dashboard access" workflow).
//   node admin.js add-member someone@gmail.com admin|editor|viewer [alerts]
//   node admin.js remove-member someone@gmail.com
//   node admin.js list-members
import admin from 'firebase-admin';

const [cmd, email, role = 'editor', alertsFlag] = process.argv.slice(2);
if (!process.env.FIREBASE_SERVICE_ACCOUNT) { console.error('Set FIREBASE_SERVICE_ACCOUNT to the service account JSON.'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const key = e => String(e || '').trim().toLowerCase();

if (cmd === 'add-member' && email) {
  if (!['admin', 'editor', 'viewer'].includes(role)) { console.error('Role must be admin, editor or viewer.'); process.exit(1); }
  await db.collection('members').doc(key(email)).set({ role, alerts: role !== 'viewer' && alertsFlag === 'alerts', addedAt: Date.now(), addedBy: 'admin.js' }, { merge: true });
  console.log(`Added ${key(email)} as ${role}${alertsFlag === 'alerts' ? ' with alert emails' : ''}.`);
} else if (cmd === 'remove-member' && email) {
  await db.collection('members').doc(key(email)).delete();
  console.log(`Removed ${key(email)}.`);
} else if (cmd === 'list-members') {
  (await db.collection('members').get()).docs.forEach(d => console.log(d.id, d.data().role, d.data().alerts ? 'alerts' : ''));
} else {
  console.log('Usage: node admin.js add-member <email> <admin|editor|viewer> [alerts] | remove-member <email> | list-members');
}
process.exit(0);
