import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classify, htmlToLines, diffLines, upcomingDates, inQuietHours, zoned } from './lib.js';
import { memoryStore } from './store.js';
import { run } from './index.js';

const rules = JSON.parse(fs.readFileSync(new URL('./rules.json', import.meta.url)));
const T = '2026-11-07';

test('critical keywords win', () => {
  assert.equal(classify({ text: 'Social media competition rules announced', todayIso: T }, rules).tier, 'crit');
  assert.equal(classify({ text: 'Team registration deadline is Friday', todayIso: T }, rules).tier, 'crit');
});
test('opportunity keywords and Instagram default', () => {
  assert.equal(classify({ text: 'Early Bird Tickets for Hogs 2027 Are On Sale Now', todayIso: T }, rules).tier, 'opp');
  assert.equal(classify({ text: 'Happy Friday y’all', todayIso: T, isInstagram: true }, rules).tier, 'opp');
});
test('plain blog post is informational', () => {
  assert.equal(classify({ text: 'Welcome to our new website design', todayIso: T }, rules).tier, 'info');
});
test('no false match inside words', () => {
  // "due" must not match "residue"; "band" must not match "husband"
  assert.equal(classify({ text: 'Smoke residue and my husband', todayIso: T }, rules).tier, 'info');
});
test('always-critical source', () => {
  assert.equal(classify({ text: 'anything', source: { alwaysCritical: true, name: 'Team Registration 2027' }, todayIso: T }, rules).tier, 'crit');
});
test('dates within 21 days are critical, far dates are not', () => {
  assert.deepEqual(upcomingDates('Bring forms by Nov 20', T), ['2026-11-20']);
  assert.deepEqual(upcomingDates('Hogs returns March 19th & 20th, 2027', T), []);
  assert.deepEqual(upcomingDates('Opens January 3', '2026-12-20'), ['2027-01-03']);
});
test('page text extraction drops layout and noise', () => {
  const html = '<html><head><title>x</title><style>.a{}</style></head><body><nav><a>Tickets</a></nav><h1>Hogs Returns March 19th &amp; 20th, 2027</h1><p>10x10 Plot - $700</p><script>var x=1</script><footer>© 2026 Hogs for the Cause</footer></body></html>';
  const lines = htmlToLines(html, rules.ignoreLinePatterns);
  assert.deepEqual(lines, ['Tickets', 'Hogs Returns March 19th & 20th, 2027', '10x10 Plot - $700']);
});
test('diff finds added and removed lines', () => {
  assert.deepEqual(diffLines(['a1', 'b2'], ['b2', 'c3']), { added: ['c3'], removed: ['a1'] });
});
test('quiet hours wrap midnight', () => {
  const q = { start: 21, end: 7 };
  assert.equal(inQuietHours(22, q), true); assert.equal(inQuietHours(3, q), true);
  assert.equal(inQuietHours(7, q), false); assert.equal(inQuietHours(16, q), false);
});
test('Central time conversion', () => {
  assert.deepEqual(zoned(new Date('2026-11-09T13:40:00Z'), 'America/Chicago'), { iso: '2026-11-09', hour: 7, weekday: 'Mon' });
});

test('end to end: baseline, then new items alert and deliver', async () => {
  const store = memoryStore({ posts: { p1: { date: '2026-11-10', title: 'Some Things Never Leave You', prod: 'Idea', footage: 'Archive' } } });
  const sent = { push: [], email: [] };
  const notify = { async push(m) { sent.push.push(m); }, async email(m) { sent.email.push(m); } };
  let blog = [{ key: '4545', title: 'Early Bird Tickets', text: 'Early bird tickets on sale', url: 'https://x/1', pub: '2026-10-14' }];
  let reg = ['Team Registration is now open!', '10x10 Plot - $700'];
  let ig = [];
  const fetchers = {
    async fetchWpPosts() { return { method: 'api', items: blog }; },
    async fetchPage(src) { if (src.id === 'fest-registration') return { method: 'page', lines: reg }; return { method: 'page', lines: ['Static page text'] }; },
    async fetchInstagram() { if (ig === null) throw new Error('blocked'); return { method: 'Instagram API', items: ig }; },
  };
  const log = () => {};
  const monday = new Date('2026-11-09T13:40:00Z');

  await run({ mode: 'auto', store, fetchers, now: monday, log, notifyOverride: notify });
  assert.equal((await store.list('alerts')).length, 0, 'first run only saves baselines');
  assert.ok(sent.push.some(p => /due soon/.test(p.title)), 'morning post reminder sent');
  assert.ok(sent.email.some(e => /Weekly Brief/.test(e.subject)), 'Monday brief emailed');

  sent.push.length = 0; sent.email.length = 0;
  blog = [{ key: '4600', title: 'Social Media Competition rules for 2027', text: 'Teams must post by the deadline', url: 'https://x/2', pub: '2026-11-09' }, ...blog];
  reg = ['Team Registration is now closed', '10x10 Plot - $700'];
  ig = [{ key: 'ig1', title: 'Lineup reveal', text: 'Lineup reveal! Tag us', url: 'https://ig/1', pub: '2026-11-09' }];
  await run({ mode: 'check', store, fetchers, now: new Date('2026-11-09T22:40:00Z'), log, notifyOverride: notify });
  const alerts = await store.list('alerts');
  assert.equal(alerts.length, 3);
  assert.equal(alerts.filter(a => a.tier === 'crit').length, 2, 'blog rules post + registration change are critical');
  assert.equal(alerts.find(a => a.sourceId === 'ig-hogs').tier, 'opp');
  assert.equal(sent.push.filter(p => p.priority === 5).length, 2);
  assert.equal(sent.email.filter(e => e.subject.startsWith('[Critical]')).length, 2);
  assert.equal(sent.email.filter(e => /opportunit/.test(e.subject)).length, 1);

  // Same content again: no duplicates
  await run({ mode: 'check', store, fetchers, now: new Date('2026-11-10T13:40:00Z'), log, notifyOverride: notify });
  assert.equal((await store.list('alerts')).length, 3);

  // Instagram failing 3 runs in a row -> one "needs attention" push
  sent.push.length = 0; ig = null;
  for (let i = 0; i < 4; i++) await run({ mode: 'check', store, fetchers, now: new Date('2026-11-10T22:40:00Z'), log, notifyOverride: notify });
  assert.equal(sent.push.filter(p => p.title === 'Monitor needs attention').length, 1);
  const latest = await store.get('runs', 'latest');
  assert.equal(latest.sources['ig-hogs'].ok, false);
  assert.equal(latest.sources['ig-hogs'].failStreak, 4);
});

import { parseIdeas, buildPrompt } from './trends.js';
const fakeClaude = () => ({ content: [
  { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'instagram reel trends november 2026' } },
  { type: 'web_search_tool_result', tool_use_id: 's1', content: [{ type: 'web_search_result', url: 'https://www.example-trends.com/reels-trends-november/', title: 'Reels trends this week' }] },
  { type: 'text', text: 'Here you go: ' + JSON.stringify({ briefs: [{ id: 'trend-spot1', concept: 'Brief for the spotted trend', title: 'Spotted post', shotList: ['a'], suggestedDate: '2026-11-14' }, { id: 'not-requested', concept: 'ignore me' }], ideas: [
    { trendName: 'Slow-motion hero walk', trendWhat: 'People film a dramatic slow-motion walk toward the camera.', sources: [{ title: 'Reels trends this week', url: 'https://example-trends.com/reels-trends-november' }], verified: true, whyRelevant: 'Fits 80s parody.', title: 'The Pitmasters Walk In', series: '80s action-movie parodies', type: 'Reel', effort: 'Low', footage: 'Archive: team walking at the tent', concept: 'Team walks in slow-mo.', hook: 'They came to smoke.', shotList: ['0-2s wide shot', '2-6s slow-mo walk'], audio: 'Pick a dramatic trending sound', editing: 'Slow-mo, VHS', caption: 'Walking in like...', cta: 'Follow', suggestedDate: '2026-11-12', timeSensitivity: 'This week', expires: '2026-11-25' },
    { trendName: 'Made-up trend', trendWhat: 'x', sources: [{ title: 'fake', url: 'https://invented.example/abc' }], verified: true, whyRelevant: 'y', title: 'Idea two', series: 'Not a series', type: 'Reel', effort: 'Low', footage: '', concept: '', hook: '', shotList: [], audio: '', editing: '', caption: '', cta: '', suggestedDate: 'soon', timeSensitivity: 'Evergreen', expires: '' },
  ] }) },
] });

test('trend ideas: sources must come from real search results', () => {
  const ideas = parseIdeas(fakeClaude(), { today: '2026-11-09', count: 3 });
  assert.equal(ideas.length, 2);
  assert.equal(ideas[0].verified, true);
  assert.equal(ideas[0].sources.length, 1);
  assert.equal(ideas[1].verified, false, 'invented URL is dropped and idea marked as a creative suggestion');
  assert.equal(ideas[1].sources.length, 0);
  assert.equal(ideas[1].series, '80s action-movie parodies', 'unknown series falls back');
  assert.match(ideas[1].suggestedDate, /^\d{4}-\d{2}-\d{2}$/);
});
test('trend prompt carries the AI-content rule and calendar', () => {
  const p = buildPrompt({ today: '2026-11-09', posts: [{ date: '2026-11-10', title: 'Some Things Never Leave You' }], pastTrends: ['Old trend'], count: 3 });
  assert.match(p, /REAL footage/); assert.match(p, /TEAM-SPOTTED/); assert.match(p, /Some Things Never Leave You/); assert.match(p, /Old trend/);
});
test('Monday run stores trend ideas, radar entries and includes them in the brief', async () => {
  process.env.ANTHROPIC_API_KEY = 'test';
  const store = memoryStore({ ideas: { 'trend-spot1': { origin: 'trend', spotted: true, needsBrief: true, trendName: 'Team saw this', status: 'New', sources: [{ url: 'https://instagram.com/reel/x' }] } } });
  const sent = { push: [], email: [] };
  const notify = { async push(m) { sent.push.push(m); }, async email(m) { sent.email.push(m); } };
  const fetchers = { async fetchWpPosts() { return { method: 'api', items: [] }; }, async fetchPage() { return { method: 'page', lines: ['x text'] }; }, async fetchInstagram() { return { method: 'api', items: [] }; }, callClaude: async () => fakeClaude() };
  await run({ mode: 'auto', store, fetchers, now: new Date('2026-11-09T13:40:00Z'), log: () => {}, notifyOverride: notify });
  const ideas = await store.list('ideas');
  assert.equal(ideas.filter(i => i.origin === 'trend' && !i.spotted).length, 2);
  const spot = await store.get('ideas', 'trend-spot1');
  assert.equal(spot.needsBrief, false); assert.equal(spot.concept, 'Brief for the spotted trend'); assert.equal(spot.aiDrafted, true);
  assert.ok(sent.email.find(e => /Weekly Brief/.test(e.subject)).html.includes('The Pitmasters Walk In'));
  // Next Monday the same trends are not duplicated
  await run({ mode: 'auto', store, fetchers, now: new Date('2026-11-16T13:40:00Z'), log: () => {}, notifyOverride: notify });
  assert.equal((await store.list('ideas')).filter(i => i.origin === 'trend' && !i.spotted).length, 2);
  delete process.env.ANTHROPIC_API_KEY;
});
