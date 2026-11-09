// Porktoberfest Command Center — dashboard.
// Live mode: Google sign-in + Firestore. Demo mode (Firebase not configured yet): starting content in memory, nothing saved.
import { firebaseConfig } from './firebase-config.js';
import { SEED_POSTS, SEED_IDEAS, SEED_ALERTS, SEED_SETTINGS } from './seed.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const DEMO = !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('PASTE');

const S = { alerts: [], posts: [], ideas: [], members: [], settings: {}, run: null, user: null, member: null };
const ROLES = { admin: 'Admin', editor: 'Full access', viewer: 'Dashboard only' };
const canEdit = () => S.member?.role === 'admin';            // calendar, ideas, alerts, deadlines
const canFund = () => ['admin', 'editor'].includes(S.member?.role); // fundraising details only
const isAdmin = () => S.member?.role === 'admin';
const UI = { view: 'overview', calMode: 'month', calMonth: null, alertFilter: 'open', listFilter: 'all' };
const VIEWS = [
  { id: 'overview', name: 'Overview' }, { id: 'alerts', name: 'Alerts' },
  { id: 'calendar', name: 'Content Calendar' }, { id: 'ideas', name: 'Idea Bank' }, { id: 'brief', name: 'Weekly Brief' },
  { id: 'footage', name: 'Footage Library', tag: 'Phase 3' }, { id: 'funds', name: 'Fundraising & Sponsors', tag: 'Phase 2' },
  { id: 'analytics', name: 'Analytics', tag: 'Phase 2' }, { id: 'team', name: 'Team access', admin: true }];
const visibleViews = () => VIEWS.filter(v => !v.admin || isAdmin());
const TIER = { crit: { name: 'Critical', cls: 'c-crit', color: 'var(--red)' }, opp: { name: 'Content opportunity', cls: 'c-opp', color: 'var(--gold)' }, info: { name: 'Informational', cls: 'c-info', color: 'var(--blue)' } };
const PROD = ['Idea', 'Scripted', 'Footage gathered', 'Editing', 'Ready', 'Posted'];
const PUB = ['Not scheduled', 'Scheduled', 'Published'];
const TREND_STATUS = ['New', 'Saved', 'Planned', 'Used', 'Expired'];
const SEASON = { start: new Date(2026, 10, 1), end: new Date(2027, 2, 31) };

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => (/^https?:\/\//i.test(u || '') ? u : '');
const iso = c => `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`;
const today = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
const d = s => new Date(s + 'T00:00:00');
const fmt = s => (/^\d{4}-\d{2}-\d{2}/.test(s || '') ? d(s.slice(0, 10)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : esc(s || 'Not stated'));
const days = s => Math.round((d(s) - today()) / 864e5);
const money = n => (n || n === 0 ? '$' + Number(n).toLocaleString() : '');
const ago = ms => { if (!ms) return 'never'; const m = Math.round((Date.now() - ms) / 6e4); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hr ago` : `${Math.round(m / 1440)} days ago`; };
function toast(msg, err) { const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; $('#toastHost').replaceChildren(t); setTimeout(() => t.remove(), err ? 6000 : 2500); }

/* ---------- data layer ---------- */
let fs = null, db = null;
const data = {
  async set(col, id, val) { if (DEMO) { upsertLocal(col, id, val); return; } await fs.setDoc(fs.doc(db, col, id), val, { merge: true }); },
  async remove(col, id) { if (DEMO) { S[col] = S[col].filter(x => x.id !== id); render(); return; } await fs.deleteDoc(fs.doc(db, col, id)); },
};
function upsertLocal(col, id, val) {
  if (col === 'settings') { S.settings = { ...S.settings, ...val }; render(); return; }
  const i = S[col].findIndex(x => x.id === id);
  if (i >= 0) S[col][i] = { ...S[col][i], ...val }; else S[col].push({ id, ...val });
  render();
}
async function act(fn, ok, allowed = canEdit()) { if (!allowed) { toast('Your access can\u2019t change this.', true); return; } try { await fn(); if (ok) toast(ok); } catch (e) { console.error(e); toast(e.code === 'permission-denied' ? 'You don’t have permission to change this.' : `Couldn’t save: ${e.message}`, true); } }
const newId = p => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function loadSeed() {
  const writes = [
    ...SEED_POSTS.map(({ id, ...v }) => ['posts', id, v]),
    ...SEED_IDEAS.map(({ id, ...v }) => ['ideas', id, v]),
    ...SEED_ALERTS.map(({ id, ...v }) => ['alerts', id, v]),
    ['settings', 'main', SEED_SETTINGS],
  ];
  if (DEMO) { writes.forEach(([c, id, v]) => upsertLocal(c, id, v)); return; }
  const batch = fs.writeBatch(db);
  writes.forEach(([c, id, v]) => batch.set(fs.doc(db, c, id), v, { merge: true }));
  await batch.commit();
}

/* ---------- boot ---------- */
function gate(msg, actionsHtml = '') { $('#shell').hidden = true; $('#gate').hidden = false; $('#gateMsg').innerHTML = msg; $('#gateActions').innerHTML = actionsHtml; }
function openShell() { $('#gate').hidden = true; $('#shell').hidden = false; render(); }

async function boot() {
  try { const v = localStorage.getItem('pk-view'); if (v && VIEWS.some(x => x.id === v)) UI.view = v; } catch (e) {}
  if (DEMO) {
    S.user = { email: 'demo' }; S.member = { role: 'admin' };
    SEED_POSTS.forEach(p => S.posts.push({ ...p })); SEED_IDEAS.forEach(i => S.ideas.push({ ...i })); SEED_ALERTS.forEach(a => S.alerts.push({ ...a }));
    S.settings = structuredClone(SEED_SETTINGS);
    S.members = [{ id: 'admin@example.com', role: 'admin', alerts: true }];
    // Demo only: one example card so the layout can be reviewed. Real ideas come from Monday research.
    S.ideas.push({ id: 'demo-example', origin: 'trend', example: true, verified: false, aiDrafted: true, status: 'New', observed: iso(today()),
      trendName: 'Example layout only. Real trends, with source links, arrive each Monday.',
      trendWhat: 'This card shows how a researched trend will look: what the trend is, how people do it, and links to where it was seen.',
      whyRelevant: 'Each idea explains why it suits the brand and the current campaign phase.',
      title: 'Example: The Pitmasters Walk In', series: '80s action-movie parodies', type: 'Reel', effort: 'Low',
      footage: 'Archive: team walking up to the tent in costume; Nick at the smoker',
      concept: 'An over-serious slow-motion walk-in, cut like an 80s action trailer, ending on the smoker lid opening.',
      hook: 'On-screen: "They said barbecue was a hobby."',
      shotList: ['0-2s: black screen, hook text', '2-6s: slow-motion walk-in, archive clip', '6-10s: freeze frame name cards', '10-14s: smoker lid opens, smoke fills frame', '14-16s: logo card, MEAT. MUSTACHES. MAYHEM.'],
      audio: 'Pick a dramatic trailer-style sound that is currently trending in the Instagram audio browser.',
      editing: 'Slow motion, VHS overlay, freeze frames, hard cut on the lid.', caption: 'They walked in. The brisket never saw it coming.', cta: 'Follow for the full mission',
      suggestedDate: iso(new Date(today().getTime() + 6 * 864e5)), timeSensitivity: '2-3 weeks', expires: iso(new Date(today().getTime() + 20 * 864e5)), sources: [] });
    openShell(); return;
  }
  const [{ initializeApp }, auth, store] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')]);
  const app = initializeApp(firebaseConfig);
  const A = auth.getAuth(app); fs = store; db = store.getFirestore(app);
  const provider = new auth.GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
  let subs = [];
  window.__signIn = () => auth.signInWithPopup(A, provider).catch(e => { if (e.code !== 'auth/popup-closed-by-user') toast(e.message, true); });
  window.__signOut = () => auth.signOut(A);
  auth.onAuthStateChanged(A, async u => {
    subs.forEach(f => f()); subs = []; S.user = u;
    if (!u) { gate('Sign in with the Google account that has access.', '<button class="btn primary" onclick="__signIn()">Sign in with Google</button>'); return; }
    try {
      const m = await store.getDoc(store.doc(db, 'members', u.email.toLowerCase()));
      if (!m.exists()) throw new Error('not a member');
      S.member = m.data();
      document.body.classList.toggle('readonly', !canEdit());
    } catch (e) {
      gate(`<b>${esc(u.email)}</b> doesn’t have access yet. Ask the admin to add this address.`, '<button class="btn" onclick="__signOut()">Use a different account</button>'); return;
    }
    const onErr = e => toast(`Live updates stopped: ${e.message}`, true);
    for (const col of ['alerts', 'posts', 'ideas']) subs.push(store.onSnapshot(store.collection(db, col), s => { S[col] = s.docs.map(x => ({ id: x.id, ...x.data() })); render(); }, onErr));
    subs.push(store.onSnapshot(store.doc(db, 'settings', 'main'), s => { S.settings = s.data() || {}; render(); }, onErr));
    if (isAdmin()) subs.push(store.onSnapshot(store.collection(db, 'members'), s => { S.members = s.docs.map(x => ({ id: x.id, ...x.data() })); render(); }, onErr));
    subs.push(store.onSnapshot(store.doc(db, 'runs', 'latest'), s => { S.run = s.exists() ? s.data() : null; render(); }, () => {}));
    openShell();
  });
}

/* ---------- shell ---------- */
function nav() {
  const open = S.alerts.filter(a => a.tier === 'crit' && !a.done).length;
  $('#nav').innerHTML = visibleViews().map(v => `<button data-v="${v.id}" ${v.id === UI.view ? 'aria-current="page"' : ''}><span>${v.name}</span>${v.id === 'alerts' && open ? `<span class="count">${open}</span>` : v.tag ? `<span class="tag">${v.tag}</span>` : ''}</button>`).join('');
  $('#mnav').innerHTML = visibleViews().map(v => `<option value="${v.id}" ${v.id === UI.view ? 'selected' : ''}>${v.name}${v.tag ? ' (' + v.tag + ')' : ''}</option>`).join('');
  $('#who').innerHTML = DEMO ? 'Demo mode' : `${esc(S.user?.email)} · ${ROLES[S.member?.role] || ''}<br><button onclick="__signOut()">Sign out</button>`;
}
function go(v) { if (!visibleViews().some(x => x.id === v)) v = 'overview'; UI.view = v; try { localStorage.setItem('pk-view', v); } catch (e) {} render(); window.scrollTo(0, 0); }
const head = (t, sub, right = '') => `<div class="head"><div><h2>${t}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${right}</div>`;
function topBanner() {
  if (!DEMO && S.member?.role === 'editor') return `<div class="banner" role="note"><b>Full access.</b><span>You can see everything and update fundraising details. Ask an admin to change posts, ideas or alerts.</span></div>`;
  if (!DEMO && !canEdit()) return `<div class="banner" role="note"><b>Dashboard only.</b><span>You can see everything here but can\u2019t make changes.</span></div>`;
  if (DEMO) return `<div class="banner" role="note" style="flex-wrap:wrap"><b>Demo mode.</b><span style="flex:1;min-width:220px">Nothing here is saved; a page refresh resets everything. Alerts shown were captured by hand on Nov 7, 2026.</span><label for="demo-role" style="display:flex;gap:6px;align-items:center;font-size:12px;font-weight:600">Preview as<select id="demo-role">${Object.entries(ROLES).map(([k, n]) => `<option value="${k}" ${S.member?.role === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>`;
  if (!S.posts.length && !S.ideas.length && S.member?.role === 'admin') return `<div class="banner" role="note"><b>Empty dashboard.</b><span>Load the November plan, idea bank, deadlines and the alerts found during setup.</span><button class="btn primary" data-seed style="margin-left:auto">Load starting content</button></div>`;
  return '';
}

/* ---------- alerts ---------- */
function provChips(a) {
  return `${a.via === 'monitor' ? '<span class="prov">Live</span>' : '<span class="prov">Captured by hand</span>'}${a.aiDrafted ? '<span class="prov">AI-drafted</span>' : ''}`;
}
function alertHTML(a, compact) {
  const t = TIER[a.tier] || TIER.info, url = safeUrl(a.url);
  const ch = a.changes && !compact ? `${a.changes.added?.length ? `<ul class="changes">${a.changes.added.slice(0, 8).map(l => `<li>Added: ${esc(l)}</li>`).join('')}</ul>` : ''}${a.changes.removed?.length ? `<ul class="changes">${a.changes.removed.slice(0, 8).map(l => `<li>Removed: ${esc(l)}</li>`).join('')}</ul>` : ''}` : '';
  return `<div class="alert"><div class="stripe" style="background:${t.color}"></div><div>
   <div class="row"><span class="chip ${t.cls}">${t.name}</span><span>${esc(a.source)}</span><span>Published: ${fmt(a.pub)}</span><span>Found: ${fmt(a.found)}</span>${provChips(a)}${a.done ? '<span class="chip c-ok">Done</span>' : ''}</div>
   <h4>${esc(a.title)}</h4>${compact ? '' : `<p>${esc(a.summary)}</p>${ch}`}
   <div class="action"><b>Suggested action:</b> ${esc(a.action)}</div>
   <div class="row" style="margin-top:6px">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">Open source</a>` : ''}${compact ? '' : `<button class="btn" data-done="${esc(a.id)}">${a.done ? 'Reopen' : 'Mark done'}</button>`}</div></div></div>`;
}
const sortAlerts = list => list.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

function alertsView() {
  const f = UI.alertFilter;
  const list = sortAlerts(S.alerts.filter(a => (f === 'open' ? !a.done : f === 'all' ? true : a.tier === f && !a.done)));
  return topBanner() + head('Official Hogs Alerts', 'hogsforthecause.org · hogsfest.org · @hogsforthecause. Checked 7:40 am and 4:40 pm CT.',
    `<div class="seg" role="group" aria-label="Filter alerts">${[['open', 'Open'], ['crit', 'Critical'], ['opp', 'Opportunities'], ['info', 'Info'], ['all', 'All incl. done']].map(([k, n]) => `<button data-af="${k}" aria-pressed="${f === k}">${n}</button>`).join('')}</div>`) +
    `<div class="panel">${list.map(a => alertHTML(a, false)).join('') || '<div class="empty"><b>No alerts here</b>New items from official sources appear after each check.</div>'}</div>`;
}

/* ---------- overview ---------- */
function monitorPanel() {
  const r = S.run;
  if (!r) return `<div class="empty"><b>No checks yet</b>The monitor writes its status here after its first run.</div>`;
  const names = { 'hog-blog': 'Hog Blog', 'fest-home': 'hogsfest.org home', 'fest-registration': 'Team Registration', 'fest-faqs': 'FAQs', 'ig-hogs': '@hogsforthecause' };
  return `<div style="font-size:12px;color:var(--muted);margin-bottom:6px">Last check ${ago(r.at)}</div>` + Object.entries(r.sources || {}).map(([id, s]) =>
    `<div class="src"><div><b>${esc(names[id] || id)}</b>${s.ok ? `<div style="font-size:12px;color:var(--muted)">${esc(s.method || '')}${s.warning ? ' · fallback used' : ''}</div>` : `<div class="e">${esc(s.error)}</div>`}</div><span class="chip ${s.ok ? 'c-ok' : s.failStreak >= 3 ? 'c-crit' : 'c-opp'}">${s.ok ? 'OK' : `Failed ×${s.failStreak}`}</span></div>`).join('');
}
function overview() {
  const st = S.settings || {};
  const attn = sortAlerts(S.alerts.filter(a => a.tier !== 'info' && !a.done)).sort((a, b) => (a.tier === 'crit' ? 0 : 1) - (b.tier === 'crit' ? 0 : 1));
  const next = S.posts.filter(p => days(p.date) >= 0 && days(p.date) <= 14).sort((a, b) => a.date.localeCompare(b.date));
  const dl = (st.deadlines || []).filter(x => days(x.date) >= 0).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const ev = st.eventStart ? new Date(st.eventStart) : new Date('2027-03-19T15:30:00-05:00');
  const cd = Math.max(0, Math.ceil((ev - new Date()) / 864e5));
  const pct = st.goal && st.verifiedTotal ? Math.min(100, Math.round(st.verifiedTotal / st.goal * 100)) : null;
  return topBanner() + head('Overview', today().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })) +
  `<div class="grid ov"><div class="grid">
    <div class="countdown"><div class="n">${cd}</div><div><div class="lbl">days to Hogs 2027</div><div class="meta">${esc(st.eventLabel || 'March 19–20 · UNO Lakefront')} · ${st.tent ? 'Tent ' + esc(st.tent) : '2027 tent location not confirmed (A5 in past years)'}</div></div></div>
    <div class="panel"><h3>Needs attention <button class="btn" data-v="alerts">All alerts</button></h3>${attn.length ? attn.slice(0, 4).map(a => alertHTML(a, true)).join('') : '<div class="empty"><b>Nothing waiting</b>Critical alerts and content opportunities land here.</div>'}</div>
  </div><div class="grid">
    <div class="panel"><h3>Next 14 days <button class="btn" data-v="calendar">Calendar</button></h3><div class="list">${next.length ? next.map(p => `<div class="item"><div class="date">${fmt(p.date)}</div><div><button class="pill" style="all:unset;cursor:pointer;font-weight:600" data-post="${esc(p.id)}">${esc(p.title)}</button><div class="d">${esc(p.format)} · <span class="chip ${p.prod === 'Ready' || p.prod === 'Posted' ? 'c-ok' : 'c-mute'}">${esc(p.prod)}</span></div></div></div>`).join('') : '<div class="empty">No posts in the next two weeks.</div>'}</div></div>
    <div class="panel"><h3>Deadlines <button class="btn" data-settings>Edit</button></h3><div class="list">${dl.length ? dl.map(x => `<div class="item"><div class="date">${fmt(x.date)}</div><div><div class="t">${esc(x.title)}</div><div class="d">${x.note ? esc(x.note) + ' · ' : ''}${days(x.date)} days</div></div></div>`).join('') : '<div class="empty">No upcoming deadlines entered.</div>'}</div></div>
    <div class="panel"><h3>Fundraising ${canFund() ? '<button class="btn" data-fund>Update</button>' : ''}</h3>
      <div style="display:flex;gap:20px;flex-wrap:wrap"><div><div class="money">${st.verifiedTotal ? money(st.verifiedTotal) : 'Not entered'}</div><div style="color:var(--muted);font-size:12px">Verified 2027 total${st.totalAsOf ? ' as of ' + fmt(st.totalAsOf) : ''} ${st.verifiedTotal ? '<span class="prov">Entered</span>' : ''}</div></div>
      <div><div class="money">${st.goal ? money(st.goal) : 'Not set'}</div><div style="color:var(--muted);font-size:12px">2027 goal</div></div></div>
      ${pct !== null ? `<div style="height:8px;background:var(--surface-2);border-radius:4px;margin-top:10px"><div style="height:100%;width:${pct}%;background:var(--gold);border-radius:4px"></div></div>` : ''}
      <p style="font-size:12px;color:var(--muted);margin:10px 0 0">${esc(st.history || '')}${st.donationUrl ? ` · <a href="${esc(safeUrl(st.donationUrl))}" target="_blank" rel="noopener">Donation link</a>` : ' · Donation link not verified yet'}</p></div>
    <div class="panel"><h3>Monitor status</h3>${monitorPanel()}</div>
  </div></div>`;
}

/* ---------- calendar ---------- */
function calendarView() {
  if (!UI.calMonth) { const t = today(); UI.calMonth = t < SEASON.start || t > SEASON.end ? new Date(SEASON.start) : new Date(t.getFullYear(), t.getMonth(), 1); }
  const right = `<div class="toolbar" style="margin:0"><div class="seg" role="group" aria-label="View"><button data-cm="month" aria-pressed="${UI.calMode === 'month'}">Calendar</button><button data-cm="list" aria-pressed="${UI.calMode === 'list'}">List</button></div><button class="btn primary" data-addpost>New post</button></div>`;
  let body = '';
  const events = S.settings.events || [];
  if (UI.calMode === 'month') {
    const y = UI.calMonth.getFullYear(), m = UI.calMonth.getMonth(), first = new Date(y, m, 1), start = new Date(first); start.setDate(1 - first.getDay());
    const canPrev = first > SEASON.start, canNext = new Date(y, m + 1, 1) <= SEASON.end;
    let cells = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(x => `<div class="dow">${x}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const c = new Date(start); c.setDate(start.getDate() + i); const ci = iso(c);
      const ps = S.posts.filter(p => p.date === ci), ev = events.filter(x => x.date === ci);
      cells += `<div class="day ${c.getMonth() !== m ? 'out' : ''} ${+c === +today() ? 'today' : ''}"><span class="num">${c.getDate()}</span>${ev.map(x => `<span class="pill ev">${esc(x.title)}</span>`).join('')}${ps.map(p => `<button class="pill ${p.hero ? 'hero' : ''}" data-post="${esc(p.id)}" title="${esc(p.title)} · ${esc(p.prod)}">${esc(p.title)}</button>`).join('')}</div>`;
    }
    body = `<div class="toolbar"><button class="btn" data-mo="-1" ${canPrev ? '' : 'disabled'} aria-label="Previous month">‹</button><b style="min-width:140px;text-align:center">${first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b><button class="btn" data-mo="1" ${canNext ? '' : 'disabled'} aria-label="Next month">›</button><span style="color:var(--muted);font-size:12px">Season runs Nov 2026 – Mar 2027</span></div><div class="cal">${cells}</div>`;
  } else {
    const camps = [...new Set(S.posts.map(p => p.campaign).filter(Boolean))];
    const list = S.posts.filter(p => UI.listFilter === 'all' || p.campaign === UI.listFilter || p.prod === UI.listFilter).sort((a, b) => a.date.localeCompare(b.date));
    body = `<div class="toolbar"><label for="lf" style="font-size:12px;color:var(--muted)">Filter</label><select id="lf"><option value="all">All posts</option>${camps.map(c => `<option ${UI.listFilter === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}${PROD.map(s => `<option ${UI.listFilter === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    <div class="panel tablewrap"><table><thead><tr><th>Date</th><th>Post</th><th>Series</th><th>Format</th><th>Production</th><th>Publishing</th></tr></thead><tbody>${list.map(p => `<tr class="click" data-post="${esc(p.id)}"><td class="date">${fmt(p.date)}</td><td><b>${esc(p.title)}</b><div style="color:var(--muted);font-size:12px">${esc(p.campaign)}</div></td><td>${esc(p.series)}</td><td>${esc(p.format)}</td><td><span class="chip ${p.prod === 'Ready' || p.prod === 'Posted' ? 'c-ok' : 'c-mute'}">${esc(p.prod)}</span></td><td>${esc(p.pub)}${p.url ? ` · <a href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener">post</a>` : ''}</td></tr>`).join('') || '<tr><td colspan="6">No posts match.</td></tr>'}</tbody></table></div>`;
  }
  return topBanner() + head('Content Calendar', 'Click a post to edit or reschedule. Posts due within 48 hours that aren’t Ready trigger a morning reminder.', right) + body;
}

/* ---------- ideas ---------- */
function ideasView() {
  const f = UI.ideaFilter || 'trend';
  const t0 = iso(today());
  const live = i => i.status !== 'Dismissed' && !(i.origin === 'trend' && i.expires && i.expires < t0 && i.status !== 'Planned');
  const list = S.ideas.filter(i => (f === 'all' ? live(i) : f === 'trend' ? i.origin === 'trend' && live(i) : f === 'series' ? i.origin !== 'trend' && live(i) : !live(i)))
    .sort((a, b) => (a.origin === 'trend' && b.origin === 'trend') ? (a.suggestedDate || '').localeCompare(b.suggestedDate || '') : (a.series || '').localeCompare(b.series || ''));
  const counts = { trend: S.ideas.filter(i => i.origin === 'trend' && live(i)).length, series: S.ideas.filter(i => i.origin !== 'trend' && live(i)).length };
  const card = i => {
    if (i.origin !== 'trend') return `<div class="card"><span class="chip c-info" style="align-self:flex-start">${esc(i.series)}</span><h4>${esc(i.title)}</h4><div style="font-size:13px">${esc(i.note)}</div><div class="tags"><span class="chip c-mute">${esc(i.type)}</span><span class="chip c-mute">Effort: ${esc(i.effort)}</span><span class="chip c-mute">${esc(i.footage)}</span></div><div style="display:flex;gap:6px;margin-top:auto;flex-wrap:wrap"><button class="btn" data-idea="${esc(i.id)}">Edit</button><button class="btn" data-schedule="${esc(i.id)}">Put on calendar</button></div></div>`;
    const left = i.expires ? days(i.expires) : null;
    return `<div class="card" style="border-top:3px solid ${i.verified ? 'var(--gold)' : 'var(--line)'}">
      <div class="tags"><span class="chip ${i.verified ? 'c-opp' : 'c-mute'}">${i.spotted ? 'Spotted by team' : i.verified ? 'Trend' : 'Creative suggestion'}</span>${i.example ? '<span class="chip c-crit">Example layout</span>' : ''}${i.status === 'Planned' ? '<span class="chip c-ok">On calendar</span>' : ''}${i.needsBrief && !i.concept ? '<span class="chip c-info">Brief coming Monday</span>' : ''}${i.aiDrafted ? '<span class="prov">AI-drafted</span>' : ''}</div>
      <h4>${esc(i.title)}</h4>
      <div style="font-size:12px;color:var(--muted)"><b style="color:var(--fg)">${i.verified ? 'Trend' : 'Idea'}:</b> ${esc(i.trendName)}</div>
      <div style="font-size:13px">${esc(i.trendWhat)}</div>
      <div class="action" style="margin-top:0"><b>Post it:</b> ${i.suggestedDate ? fmt(i.suggestedDate) : 'date not set'} · ${esc(i.type)} · effort ${esc(i.effort)}${left !== null && left >= 0 ? ` · stale in ~${left} days` : ''}</div>
      <div style="display:flex;gap:6px;margin-top:auto;flex-wrap:wrap"><button class="btn primary" data-brief="${esc(i.id)}">Open brief</button><button class="btn" data-editbrief="${esc(i.id)}">Edit</button>${i.status !== 'Planned' ? `<button class="btn" data-schedule="${esc(i.id)}">Put on calendar</button><button class="btn" data-dismiss="${esc(i.id)}">Dismiss</button>` : ''}</div></div>`;
  };
  return topBanner() + head('Idea Bank', 'Trend ideas arrive every Monday with a ready-to-make brief. Spotted a trend yourself? Log it and it gets a brief too.', `<div class="toolbar" style="margin:0"><button class="btn primary" data-logtrend>Log a trend I spotted</button><button class="btn" data-addidea>New series idea</button></div>`) +
  `<div class="toolbar"><div class="seg" role="group" aria-label="Show">${[['trend', `From trends (${counts.trend})`], ['series', `Series ideas (${counts.series})`], ['all', 'All'], ['archive', 'Dismissed & expired']].map(([k, n]) => `<button data-if="${k}" aria-pressed="${f === k}">${n}</button>`).join('')}</div></div>` +
  (list.length ? `<div class="cards">${list.map(card).join('')}</div>` : f === 'trend' ? `<div class="empty"><b>No trend ideas yet</b>Every Monday morning Claude researches current Instagram and TikTok trends and adds 3 ideas here, each with the trend, example links, a brief, a shot list and a suggested post date. Trends the team spots can be logged here any time.</div>` : '<div class="empty">Nothing here.</div>');
}
function openIdeaBrief(id) {
  const i = S.ideas.find(x => x.id === id); if (!i) return;
  const sec = (t, body) => body ? `<div style="border-top:1px solid var(--line);padding-top:10px"><div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:4px">${t}</div>${body}</div>` : '';
  const p = s => s ? `<p style="margin:0 0 6px">${esc(s)}</p>` : '';
  $('#drawerHost').innerHTML = `<div class="scrim" data-close></div><div class="drawer" role="dialog" aria-modal="true" aria-label="Trend brief"><h3>${esc(i.title)}</h3>
    <div class="tags" style="display:flex;gap:5px;flex-wrap:wrap"><span class="chip ${i.verified ? 'c-opp' : 'c-mute'}">${i.spotted ? 'Spotted by team' : i.verified ? 'Verified trend' : 'Creative suggestion (no verified source)'}</span><span class="chip c-info">${esc(i.series)}</span><span class="prov">${i.spotted ? `Logged ${fmt(i.observed)}${i.spottedBy ? ' by ' + esc(i.spottedBy) : ''}` : 'Researched ' + fmt(i.observed)}${i.aiDrafted ? ' · brief AI-drafted' : ''}</span></div>
    ${sec('The trend', `<p style="margin:0 0 6px"><b>${esc(i.trendName)}</b></p>${p(i.trendWhat)}${(i.sources || []).length ? `<ul style="margin:0;padding-left:18px">${i.sources.map(s => `<li><a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}</ul>` : '<p style="margin:0;color:var(--muted)">No source found. Treat this as an original idea, not a trend.</p>'}`)}
    ${sec('Why it fits Porktoberfest', p(i.whyRelevant))}
    ${i.needsBrief && !i.concept ? sec('Brief', '<p style="margin:0;color:var(--muted)">Claude will write the brief, shot list and suggested date in Monday\u2019s batch. Or click Edit to write it now.</p>') : ''}
    ${sec('Plan', `<p style="margin:0">Post on <b>${i.suggestedDate ? fmt(i.suggestedDate) : 'date not set'}</b> · ${esc(i.type)} · effort ${esc(i.effort)} · ${esc(i.timeSensitivity)}${i.expires ? ` · likely stale after ${fmt(i.expires)}` : ''}</p>`)}
    ${sec('Concept', p(i.concept))}
    ${sec('Hook', p(i.hook))}
    ${sec('Shot list', (i.shotList || []).length ? `<ol style="margin:0;padding-left:20px">${i.shotList.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : '')}
    ${sec('Footage needed', p(i.footage))}
    ${sec('Audio', p(i.audio))}
    ${sec('Editing', p(i.editing))}
    ${sec('Caption draft', p(i.caption))}
    ${sec('Call to action', p(i.cta))}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">${i.status !== 'Planned' ? `<button class="btn primary" data-schedule="${esc(i.id)}">Put on calendar${i.suggestedDate ? ' for ' + fmt(i.suggestedDate) : ''}</button><button class="btn" data-editbrief="${esc(i.id)}">Edit</button>` : '<span class="chip c-ok">Already on the calendar</span>'}<button class="btn" data-close>Close</button></div></div>`;
}

/* ---------- brief ---------- */
function briefView() {
  const wk = S.posts.filter(p => days(p.date) >= 0 && days(p.date) <= 7).sort((a, b) => a.date.localeCompare(b.date));
  const recent = sortAlerts(S.alerts.filter(a => (a.createdAt || 0) >= Date.now() - 7 * 864e5));
  const missing = S.posts.filter(p => days(p.date) >= 0 && days(p.date) <= 14 && !['Ready', 'Posted'].includes(p.prod));
  const dl = (S.settings.deadlines || []).filter(x => days(x.date) >= 0 && days(x.date) <= 30);
  const trendIdeas = S.ideas.filter(i => i.origin === 'trend' && !i.example && i.status === 'New' && !(i.expires && i.expires < iso(today())));
  const openCrit = S.alerts.filter(a => a.tier === 'crit' && !a.done);
  const st = S.settings;
  const li = arr => arr.length ? `<ul>${arr.join('')}</ul>` : '<p style="margin:0;color:var(--muted)">Nothing this week.</p>';
  return topBanner() + head('Weekly Brief', `Week of ${today().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} · built live from this dashboard; the same brief is emailed Monday mornings`) +
  `<div class="panel brief">
   <section><h4>1. New official announcements</h4>${li(recent.map(a => `<li><span class="chip ${TIER[a.tier].cls}">${TIER[a.tier].name}</span> <a href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener">${esc(a.title)}</a></li>`))}</section>
   <section><h4>2. Important deadlines</h4>${li(dl.map(x => `<li>${fmt(x.date)} · ${esc(x.title)} (${days(x.date)} days)</li>`))}</section>
   <section><h4>3. Trend ideas waiting in the Idea Bank</h4>${li(trendIdeas.map(i => `<li><b>${esc(i.title)}</b>${i.suggestedDate ? ' for ' + fmt(i.suggestedDate) : ''} · ${i.sources?.[0] ? `<a href="${esc(safeUrl(i.sources[0].url))}" target="_blank" rel="noopener">${esc(i.trendName)}</a>` : esc(i.trendName) + ' (creative suggestion)'}${i.needsBrief && !i.concept ? ' · brief coming Monday' : ''}</li>`))}</section>
   <section><h4>4. Content opportunities</h4>${li(S.alerts.filter(a => a.tier === 'opp' && !a.done).map(a => `<li>${esc(a.title)}: ${esc(a.action)}</li>`))}</section>
   <section><h4>5. Posts in the next 7 days</h4>${li(wk.map(p => `<li>${fmt(p.date)} · ${esc(p.title)} (${esc(p.prod)})</li>`))}</section>
   <section><h4>6. Production tasks and missing assets</h4>${li(missing.map(p => `<li>${esc(p.title)} (${fmt(p.date)}): ${esc(p.footage || 'footage TBD')}</li>`))}</section>
   <section><h4>7. Fundraising and sponsors</h4><p style="margin:0">${st.goal ? 'Goal ' + money(st.goal) : 'No 2027 goal entered'} · ${st.verifiedTotal ? 'Verified ' + money(st.verifiedTotal) : 'No verified total entered'}</p></section>
   <section><h4>8. Suggested priorities</h4>${li([...openCrit.slice(0, 3).map(a => `<li>Resolve: ${esc(a.title)}</li>`), ...missing.filter(p => days(p.date) <= 7).slice(0, 3).map(p => `<li>Finish ${esc(p.title)} for ${fmt(p.date)}</li>`)])}</section>
  </div>`;
}
function teamView() {
  if (!isAdmin()) return head('Team access', '') + '<div class="empty">Only admins can manage access.</div>';
  const list = S.members.slice().sort((a, b) => a.id.localeCompare(b.id));
  const me = (S.user?.email || '').toLowerCase();
  return topBanner() + head('Team access', 'People sign in with the Google account you add here.') +
  `<div class="panel" style="margin-bottom:16px"><h3>Invite someone</h3>
    <div class="toolbar" style="margin:0;align-items:flex-end">
      <label for="m-email" style="display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:600;color:var(--muted);flex:1;min-width:220px">Google email<input id="m-email" type="text" inputmode="email" autocomplete="off" placeholder="name@gmail.com"></label>
      <label for="m-role" style="display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:600;color:var(--muted)">Access<select id="m-role"><option value="editor">Full access</option><option value="viewer">Dashboard only</option><option value="admin">Admin</option></select></label>
      <label for="m-alerts" style="display:flex;gap:6px;align-items:center;font-size:13px;padding-bottom:6px"><input id="m-alerts" type="checkbox"> Email alerts</label>
      <button class="btn primary" data-addmember>Add</button>
    </div>
    <p style="font-size:12px;color:var(--muted);margin:10px 0 0"><b>Admin</b> edits everything and manages this list. <b>Full access</b> sees everything, can get alert emails, and can update fundraising details only. <b>Dashboard only</b> can view but not change anything, and gets no alerts. Phone push goes to anyone you give the ntfy channel name to.</p></div>
  <div class="panel tablewrap"><table><thead><tr><th>Person</th><th>Access</th><th>Alert emails</th><th></th></tr></thead><tbody>${list.map(m => {
    const self = m.id === me;
    return `<tr><td>${esc(m.id)}${self ? ' <span class="chip c-mute">you</span>' : ''}</td>
      <td><select data-mrole="${esc(m.id)}" aria-label="Access for ${esc(m.id)}" ${self ? 'disabled' : ''}>${Object.entries(ROLES).map(([k, n]) => `<option value="${k}" ${m.role === k ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
      <td><input type="checkbox" data-malerts="${esc(m.id)}" aria-label="Alert emails for ${esc(m.id)}" ${m.alerts ? 'checked' : ''} ${m.role === 'viewer' ? 'disabled' : ''}></td>
      <td>${self ? '' : `<button class="btn danger" data-delmember="${esc(m.id)}">Remove</button>`}</td></tr>`; }).join('')}</tbody></table></div>`;
}
const phaseView = (t, phase, what) => head(t, `${phase}, planned after the MVP`) + `<div class="empty"><b>Coming in ${phase}</b>${what}</div>`;

function render() {
  if ($('#shell').hidden) return;
  nav();
  const v = UI.view;
  $('#main').innerHTML = v === 'overview' ? overview() : v === 'alerts' ? alertsView() : v === 'calendar' ? calendarView() : v === 'ideas' ? ideasView() : v === 'brief' ? briefView() : v === 'team' ? teamView() :
    v === 'footage' ? phaseView('Footage Library', 'Phase 3', 'Links to archive clips in the team’s shared folder, tagged by category and assigned to planned posts.') :
    v === 'funds' ? phaseView('Fundraising & Sponsors', 'Phase 2', 'Goal, verified totals, milestones, Giving Tuesday results, sponsor commitments and deliverables. For now, the goal and verified total are edited from the Overview.') :
    phaseView('Analytics', 'Phase 2', 'Instagram insights by reporting window, kept separate from lifetime post metrics. CSV import plus manual entry.');
}

/* ---------- drawers ---------- */
const field = (o, k, l, t = 'text') => `<label for="f-${k}">${l}<input id="f-${k}" type="${t}" value="${esc(o[k])}"></label>`;
const area = (o, k, l, r = 3) => `<label for="f-${k}">${l}<textarea id="f-${k}" rows="${r}">${esc(o[k])}</textarea></label>`;
const pick = (o, k, l, opts) => `<label for="f-${k}">${l}<select id="f-${k}">${opts.map(x => `<option ${o[k] === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>`;
const val = k => $('#f-' + k).value.trim();
function drawer(title, inner, onSave, extra = '', keepSave = false) {
  $('#drawerHost').innerHTML = `<div class="scrim" data-close></div><div class="drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3>${inner}
   <p id="f-err" style="color:var(--red);font-size:12px;margin:0" hidden></p>
   <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap"><button class="btn primary" id="f-save" ${keepSave ? 'data-keep' : ''}>Save</button><button class="btn" data-close>Cancel</button>${extra}</div></div>`;
  $('#drawerHost input, #drawerHost textarea')?.focus();
  $('#f-save').onclick = onSave;
}
const closeDrawer = () => { $('#drawerHost').innerHTML = ''; };
const fail = msg => { const e = $('#f-err'); e.textContent = msg; e.hidden = false; };

const POST_FIELDS = ['title', 'date', 'platform', 'campaign', 'series', 'format', 'concept', 'hook', 'script', 'caption', 'footage', 'audio', 'editing', 'cta', 'prod', 'pub', 'url', 'results'];
function openPost(id, preset = {}, fromIdea = null) {
  const p = id ? S.posts.find(x => x.id === id) : { date: iso(today()), platform: 'Instagram Reel', prod: 'Idea', pub: 'Not scheduled', ...preset };
  if (!p) return;
  drawer(id ? 'Edit post' : 'New post', `${field(p, 'title', 'Title')}<div class="two">${field(p, 'date', 'Date', 'date')}${field(p, 'platform', 'Platform')}</div><div class="two">${field(p, 'campaign', 'Campaign')}${field(p, 'series', 'Content series')}</div>${field(p, 'format', 'Format')}
   ${area(p, 'concept', 'Concept')}${field(p, 'hook', 'Hook')}${area(p, 'script', 'Script', 4)}${area(p, 'caption', 'Caption')}${field(p, 'footage', 'Footage needed')}<div class="two">${field(p, 'audio', 'Audio direction')}${field(p, 'editing', 'Editing instructions')}</div>${field(p, 'cta', 'Call to action')}
   <div class="two">${pick(p, 'prod', 'Production status', PROD)}${pick(p, 'pub', 'Publishing status', PUB)}</div>${field(p, 'url', 'Post URL', 'url')}${area(p, 'results', 'Performance results', 2)}`,
   () => {
     const v = Object.fromEntries(POST_FIELDS.map(k => [k, val(k)]));
     if (!v.title) return fail('Add a title.');
     if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return fail('Pick a date.');
     if (v.url && !safeUrl(v.url)) return fail('Post URL must start with https://');
     const dt = d(v.date); if (dt >= SEASON.start && dt <= SEASON.end) UI.calMonth = new Date(dt.getFullYear(), dt.getMonth(), 1);
     const pid = id || newId('p');
     if (preset.trendName && !id) v.trendName = preset.trendName;
     closeDrawer(); act(async () => { await data.set('posts', pid, { ...v, ...(fromIdea ? { ideaId: fromIdea } : {}), updatedAt: Date.now() }); if (fromIdea) await data.set('ideas', fromIdea, { status: 'Planned', postId: pid }); }, fromIdea ? 'Added to the calendar' : 'Saved');
   }, id ? `<button class="btn danger" data-delpost="${esc(id)}" style="margin-left:auto">Delete</button>` : '');
}
function logTrend() {
  drawer('Log a trend I spotted', `${field({}, 'name', 'What’s the trend? (short name)')}${field({}, 'url', 'Link to an example (required)', 'url')}${area({}, 'what', 'What did you see? How do people do it?', 3)}
   ${pick({ window: '2-3 weeks' }, 'window', 'How fast will it fade?', ['This week', '2-3 weeks', 'Evergreen'])}
   <label for="f-needsBrief" style="flex-direction:row;align-items:center;gap:8px;font-size:13px;color:var(--fg)"><input id="f-needsBrief" type="checkbox" checked> Have Claude write the brief in Monday’s batch</label>`,
   () => {
     if (!val('name') || !safeUrl(val('url'))) return fail('Add a name and a link to an example.');
     const life = { 'This week': 7, '2-3 weeks': 21, 'Evergreen': 90 }[val('window')];
     let host = ''; try { host = new URL(val('url')).host.replace(/^www\./, ''); } catch (e) {}
     const v = { origin: 'trend', spotted: true, verified: true, aiDrafted: false, status: 'New', needsBrief: $('#f-needsBrief').checked,
       trendName: val('name'), trendWhat: val('what'), sources: [{ title: `Example on ${host}`, url: val('url') }], observed: iso(today()), spottedBy: S.user?.email || '',
       title: val('name'), series: '80s action-movie parodies', type: 'Reel', effort: 'Medium', timeSensitivity: val('window'),
       expires: iso(new Date(today().getTime() + life * 864e5)), suggestedDate: '', concept: '', shotList: [], createdAt: Date.now() };
     closeDrawer(); UI.ideaFilter = 'trend'; act(() => data.set('ideas', newId('trend'), v), v.needsBrief ? 'Logged. Brief coming Monday.' : 'Logged');
   });
}
const SERIES = ['Behind the Brat', 'Meet the Meatheads', 'The Pitmaster Files', 'More Than Meat', 'Hog on the Nog', 'Sponsor spotlights', '80s action-movie parodies', 'Fundraising milestones', 'Holiday comedy', 'Event countdowns'];
function editBrief(id) {
  const i = S.ideas.find(x => x.id === id); if (!i) return;
  const o = { ...i, shotText: (i.shotList || []).join('\n') };
  drawer('Edit trend idea', `${field(o, 'title', 'Post name')}${field(o, 'trendName', 'Trend')}${area(o, 'trendWhat', 'What the trend is', 2)}
   <div class="two">${field(o, 'suggestedDate', 'Suggested post date', 'date')}${pick(o, 'timeSensitivity', 'How fast it fades', ['This week', '2-3 weeks', 'Evergreen'])}</div>
   <div class="two">${pick(o, 'series', 'Series', SERIES)}${pick(o, 'type', 'Format', ['Reel', 'Story', 'Carousel'])}</div>${pick(o, 'effort', 'Effort', ['Low', 'Medium', 'High'])}
   ${area(o, 'concept', 'Concept')}${field(o, 'hook', 'Hook')}${area(o, 'shotText', 'Shot list (one shot per line)', 5)}${field(o, 'footage', 'Footage needed')}
   <div class="two">${field(o, 'audio', 'Audio')}${field(o, 'editing', 'Editing')}</div>${area(o, 'caption', 'Caption draft', 2)}${field(o, 'cta', 'Call to action')}`,
   () => {
     if (!val('title')) return fail('Add a post name.');
     const v = { title: val('title'), trendName: val('trendName'), trendWhat: val('trendWhat'), suggestedDate: val('suggestedDate'), timeSensitivity: val('timeSensitivity'), series: val('series'), type: val('type'), effort: val('effort'),
       concept: val('concept'), hook: val('hook'), shotList: val('shotText').split('\n').map(x => x.trim()).filter(Boolean), footage: val('footage'), audio: val('audio'), editing: val('editing'), caption: val('caption'), cta: val('cta') };
     if (v.concept) v.needsBrief = false;
     closeDrawer(); act(() => data.set('ideas', id, v), 'Saved');
   });
}
function openIdea(id) {
  const i = id ? S.ideas.find(x => x.id === id) : { type: 'Reel', effort: 'Low' };
  const series = ['Behind the Brat', 'Meet the Meatheads', 'The Pitmaster Files', 'More Than Meat', 'Hog on the Nog', 'Sponsor spotlights', '80s action-movie parodies', 'Fundraising milestones', 'Holiday comedy', 'Event countdowns'];
  drawer(id ? 'Edit idea' : 'New idea', `${field(i, 'title', 'Idea')}${pick(i, 'series', 'Series', series)}${area(i, 'note', 'Notes')}<div class="two">${pick(i, 'type', 'Content type', ['Reel', 'Story', 'Carousel', 'Photo', 'Live'])}${pick(i, 'effort', 'Production effort', ['Low', 'Medium', 'High'])}</div>${field(i, 'footage', 'Footage requirements')}`,
   () => {
     if (!val('title')) return fail('Add the idea.');
     const v = { title: val('title'), series: val('series'), note: val('note'), type: val('type'), effort: val('effort'), footage: val('footage') };
     closeDrawer(); act(() => data.set('ideas', id || newId('i'), v), 'Saved');
   }, id ? `<button class="btn danger" data-delidea="${esc(id)}" style="margin-left:auto">Delete</button>` : '');
}
function openSettings() {
  const st = S.settings || {};
  const dl = (st.deadlines || []).map(x => [x.date, x.title, x.note].filter(Boolean).join(' | ')).join('\n');
  drawer('Event details & deadlines', `${field(st, 'tent', '2027 tent location (leave blank until confirmed)')}
   <label for="f-deadlines">Deadlines, one per line: YYYY-MM-DD | title | note<textarea id="f-deadlines" rows="6">${esc(dl)}</textarea></label>`,
   () => {
     const deadlines = [];
     for (const line of val('deadlines').split('\n').map(l => l.trim()).filter(Boolean)) {
       const [date, title, note] = line.split('|').map(s => s.trim());
       if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !title) return fail(`Check this line: "${line}"`);
       deadlines.push({ date, title, note: note || '' });
     }
     const v = { tent: val('tent'), deadlines };
     closeDrawer(); act(() => data.set('settings', 'main', v), 'Saved');
   });
}
function openFund() {
  const st = S.settings || {};
  drawer('Fundraising details', `<div class="two">${field(st, 'goal', '2027 fundraising goal ($)', 'number')}${field(st, 'verifiedTotal', 'Verified total raised ($)', 'number')}</div>${field(st, 'totalAsOf', 'Total verified as of', 'date')}${field(st, 'donationUrl', 'Verified 2027 donation URL', 'url')}
   <p style="font-size:12px;color:var(--muted);margin:0">Enter only confirmed figures. They appear on the Overview and in the Monday brief.</p>`,
   () => {
     if (val('donationUrl') && !safeUrl(val('donationUrl'))) return fail('Donation URL must start with https://');
     const num = k => (val(k) === '' ? null : Number(val(k)));
     for (const k of ['goal', 'verifiedTotal']) if (val(k) !== '' && !(Number(val(k)) >= 0)) return fail('Amounts must be zero or more.');
     const v = { goal: num('goal'), verifiedTotal: num('verifiedTotal'), totalAsOf: val('totalAsOf'), donationUrl: val('donationUrl'), fundUpdatedAt: Date.now(), fundUpdatedBy: S.user?.email || '' };
     closeDrawer(); act(() => data.set('settings', 'main', v), 'Fundraising updated', canFund());
   }, '', true);
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('button, [data-post], [data-close]'); if (!t) return;
  const ds = t.dataset;
  if (ds.close !== undefined) return closeDrawer();
  if (ds.v) return go(ds.v);
  if (ds.seed !== undefined) return act(loadSeed, 'Starting content loaded');
  if (ds.done) { const a = S.alerts.find(x => x.id === ds.done); return act(() => data.set('alerts', a.id, { done: !a.done, doneAt: a.done ? null : Date.now() })); }
  if (ds.af) { UI.alertFilter = ds.af; return render(); }
  if (ds.cm) { UI.calMode = ds.cm; return render(); }
  if (ds.mo && !t.disabled) { UI.calMonth = new Date(UI.calMonth.getFullYear(), UI.calMonth.getMonth() + Number(ds.mo), 1); return render(); }
  if (ds.post) return openPost(ds.post);
  if (ds.addpost !== undefined) return openPost(null);
  if (ds.logtrend !== undefined) return logTrend();
  if (ds.editbrief) return editBrief(ds.editbrief);
  if (ds.addidea !== undefined) return openIdea(null);
  if (ds.idea) return openIdea(ds.idea);
  if (ds.settings !== undefined) return openSettings();
  if (ds.fund !== undefined) return openFund();
  if (ds.schedule) {
    const i = S.ideas.find(x => x.id === ds.schedule);
    const trend = i.origin === 'trend';
    return openPost(null, { title: i.title, series: i.series, concept: trend ? i.concept : i.note, footage: i.footage, format: i.type, platform: i.type === 'Story' ? 'Instagram Story' : 'Instagram Reel',
      ...(trend ? { ...(i.suggestedDate ? { date: i.suggestedDate } : {}), hook: i.hook, script: (i.shotList || []).map((s, n) => `${n + 1}. ${s}`).join('\n'), audio: i.audio, editing: i.editing, caption: i.caption, cta: i.cta, campaign: '', trendName: i.trendName } : {}) }, i.id);
  }
  if (ds.brief) return openIdeaBrief(ds.brief);
  if (ds.if) { UI.ideaFilter = ds.if; return render(); }
  if (ds.dismiss) return act(() => data.set('ideas', ds.dismiss, { status: 'Dismissed' }), 'Dismissed');
  if (ds.delpost) { if (t.dataset.armed) { closeDrawer(); return act(() => data.remove('posts', ds.delpost), 'Post deleted'); } t.dataset.armed = '1'; t.textContent = 'Tap again to delete'; return; }
  if (ds.addmember !== undefined) {
    const email = $('#m-email').value.trim().toLowerCase(), role = $('#m-role').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Enter a full email address.', true);
    if (S.members.some(m => m.id === email)) return toast('That person already has access.', true);
    return act(() => data.set('members', email, { role, alerts: role !== 'viewer' && $('#m-alerts').checked, addedAt: Date.now(), addedBy: S.user?.email || '' }), `Added ${email}. They can sign in now.`);
  }
  if (ds.delmember) { if (t.dataset.armed) return act(() => data.remove('members', ds.delmember), 'Access removed'); t.dataset.armed = '1'; t.textContent = 'Tap again to remove'; return; }
  if (ds.delidea) { if (t.dataset.armed) { closeDrawer(); return act(() => data.remove('ideas', ds.delidea), 'Idea deleted'); } t.dataset.armed = '1'; t.textContent = 'Tap again to delete'; return; }
});
document.addEventListener('change', e => {
  if (e.target.id === 'demo-role' && DEMO) { S.member.role = e.target.value; document.body.classList.toggle('readonly', !canEdit()); if (!visibleViews().some(v => v.id === UI.view)) UI.view = 'overview'; render(); toast(`Previewing as ${ROLES[S.member.role]}`); }
  if (e.target.id === 'lf') { UI.listFilter = e.target.value; render(); }
  if (e.target.id === 'mnav') go(e.target.value);
  if (e.target.dataset.mrole) { const r = e.target.value; act(() => data.set('members', e.target.dataset.mrole, r === 'viewer' ? { role: r, alerts: false } : { role: r }), 'Access updated'); }
  if (e.target.dataset.malerts) act(() => data.set('members', e.target.dataset.malerts, { alerts: e.target.checked }), e.target.checked ? 'Alert emails on' : 'Alert emails off');
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

boot().catch(e => { console.error(e); gate(`The dashboard couldn’t start: ${esc(e.message)}`); });
