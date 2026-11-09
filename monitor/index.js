// Porktoberfest Command Center monitor.
// Usage: node index.js [auto|check|daily|trends|brief|test]
//   auto  (scheduled): check sources; mornings also send post reminders; Monday mornings also send the weekly brief.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { openStore } from './store.js';
import { channels, alertEmailHtml, briefEmailHtml, escapeHtml as h } from './notify.js';
import * as real from './sources.js';
import { trendIdeas } from './trends.js';
import { hash, diffLines, classify, TEMPLATE_ACTION, zoned, addDays, inQuietHours, excerpt } from './lib.js';

const readJson = f => JSON.parse(fs.readFileSync(new URL(f, import.meta.url)));

/* ---------- optional Claude summaries ---------- */
async function claudeDraft(alert, cfg) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const prompt = `You help the social media manager of Porktoberfest, an Oktoberfest-themed BBQ fundraising team at Hogs for the Cause (New Orleans, March 19-20, 2027). Brand: "MEAT. MUSTACHES. MAYHEM." Organizers penalized the team for AI-generated content, so suggested actions must use real team footage, archive footage or new filming, never AI-generated people or videos.

A new item was found on an official Hogs source.
Source: ${alert.source}
Tier: ${alert.tier}
Title: ${alert.title}
Text: ${alert.rawText}

Reply with JSON only: {"summary": "<1-2 plain sentences stating only what the source says>", "action": "<one concrete suggested action for Porktoberfest, max 30 words>"}`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: cfg.claudeModel, max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(30000),
    });
    const j = await r.json();
    const text = j.content?.[0]?.text || '';
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    if (parsed.summary && parsed.action) return parsed;
  } catch (e) { console.warn('Claude draft skipped:', e.message); }
  return null;
}

/* ---------- source checks ---------- */
async function checkSources(ctx) {
  const { cfg, rules, store, fetchers, today, log } = ctx;
  const runPrev = (await store.get('runs', 'latest')) || { sources: {} };
  const health = {};
  const newAlerts = [];

  for (const src of cfg.sources) {
    const prevHealth = runPrev.sources?.[src.id] || {};
    const snapId = src.id;
    try {
      const snap = (await store.get('snapshots', snapId)) || null;
      let found = [];
      let method;
      let warning;

      if (src.type === 'page') {
        const res = await fetchers.fetchPage(src, rules.ignoreLinePatterns);
        method = res.method;
        if (!res.lines.length) throw new Error('Page returned no readable text');
        if (snap?.lines) {
          const { added, removed } = diffLines(snap.lines, res.lines);
          if (added.length || removed.length) {
            const text = added.length ? added.join(' • ') : 'Removed: ' + removed.join(' • ');
            found.push({ key: hash(res.lines.join('\n')), title: `${src.name} changed`, text, url: src.url, pub: 'Not stated', meta: { added: added.slice(0, 20), removed: removed.slice(0, 20) } });
          }
        }
        await store.set('snapshots', snapId, { lines: res.lines, updatedAt: Date.now() }, false);
      } else {
        const res = src.type === 'wp-posts' ? await fetchers.fetchWpPosts(src) : await fetchers.fetchInstagram(src, cfg);
        method = res.method;
        warning = res.warning;
        const seen = new Set(snap?.seen || []);
        if (snap) found = res.items.filter(i => !seen.has(i.key));
        const merged = [...new Set([...res.items.map(i => i.key), ...(snap?.seen || [])])].slice(0, 200);
        await store.set('snapshots', snapId, { seen: merged, updatedAt: Date.now() }, false);
      }

      for (const item of found) {
        const { tier, reasons } = classify({ text: `${item.title} ${item.text}`, source: src, todayIso: today, isInstagram: src.type === 'instagram' }, rules);
        const alert = {
          tier, reasons, title: item.title, source: src.name, sourceId: src.id, url: item.url, pub: item.pub,
          found: today, createdAt: Date.now(), done: false, via: 'monitor',
          rawText: excerpt(item.text, 1200), summary: excerpt(item.text), action: TEMPLATE_ACTION[tier], aiDrafted: false,
          ...(item.meta ? { changes: item.meta } : {}),
        };
        const ai = await claudeDraft(alert, cfg);
        if (ai) Object.assign(alert, { summary: ai.summary, action: ai.action, aiDrafted: true });
        const id = `${src.id}-${hash(item.key)}`;
        if (await store.create('alerts', id, alert)) newAlerts.push({ id, ...alert });
      }
      health[src.id] = { ok: true, method, warning: warning || null, failStreak: 0, checkedAt: Date.now(), baseline: !snap, newItems: found.length };
      log(`✓ ${src.name}: ${snap ? `${found.length} new` : 'baseline saved'} (${method})${warning ? ' — ' + warning : ''}`);
    } catch (e) {
      const failStreak = (prevHealth.failStreak || 0) + 1;
      health[src.id] = { ok: false, error: String(e.message).slice(0, 400), failStreak, checkedAt: Date.now(), lastOkAt: prevHealth.ok ? prevHealth.checkedAt : prevHealth.lastOkAt || null };
      log(`✗ ${src.name}: ${e.message} (fail ${failStreak})`);
    }
  }
  await store.set('runs', 'latest', { at: Date.now(), sources: health }, false);
  return { newAlerts, health, prevHealth: runPrev.sources || {} };
}

/* ---------- delivery ---------- */
async function deliverAlerts(ctx, newAlerts, health, prevHealth) {
  const { cfg, notify, quiet } = ctx;
  const crit = newAlerts.filter(a => a.tier === 'crit');
  const opp = newAlerts.filter(a => a.tier === 'opp');

  for (const a of crit) {
    await notify.push({ title: `⚠ Hogs: ${a.title}`.slice(0, 120), message: `${a.summary}\n\nAction: ${a.action}`, priority: 5, tags: ['rotating_light'], click: a.url });
    await notify.email({ subject: `[Critical] ${a.title}`, html: alertEmailHtml([a], cfg.dashboardUrl, 'Critical Hogs alert'), text: `${a.title}\n${a.summary}\nAction: ${a.action}\n${a.url}` });
  }
  if (opp.length) {
    if (!quiet) {
      for (const a of opp) await notify.push({ title: `Hogs: ${a.title}`.slice(0, 120), message: `${a.summary}\n\nIdea: ${a.action}`, priority: 3, tags: ['bulb'], click: a.url });
    }
    await notify.email({ subject: `${opp.length} new content ${opp.length === 1 ? 'opportunity' : 'opportunities'} from Hogs`, html: alertEmailHtml(opp, cfg.dashboardUrl, 'New content opportunities'), text: opp.map(a => `${a.title}\n${a.url}`).join('\n\n') });
  }
  // Health: alert once when a source reaches N consecutive failures.
  const broken = Object.entries(health).filter(([id, s]) => !s.ok && s.failStreak === cfg.failAlertAfter);
  if (broken.length) {
    const names = broken.map(([id, s]) => `${cfg.sources.find(x => x.id === id)?.name}: ${s.error}`).join('\n');
    await notify.push({ title: 'Monitor needs attention', message: `These sources failed ${cfg.failAlertAfter} checks in a row:\n${names}`, priority: 4, tags: ['warning'], click: cfg.dashboardUrl });
  }
  const recovered = Object.entries(health).filter(([id, s]) => s.ok && (prevHealth[id]?.failStreak || 0) >= cfg.failAlertAfter);
  if (recovered.length) await notify.push({ title: 'Monitor recovered', message: recovered.map(([id]) => cfg.sources.find(x => x.id === id)?.name).join(', ') + ' working again.', priority: 2, tags: ['white_check_mark'] });
}

const READY = new Set(['Ready', 'Posted']);
async function postReminders(ctx) {
  const { store, notify, today, cfg, log } = ctx;
  const posts = await store.list('posts');
  const soon = posts.filter(p => p.date >= today && p.date <= addDays(today, 2) && !READY.has(p.prod)).sort((a, b) => a.date.localeCompare(b.date));
  log(`Post reminders: ${soon.length} due within 48 hours and not ready`);
  if (!soon.length) return;
  await notify.push({
    title: `${soon.length} post${soon.length > 1 ? 's' : ''} due soon, not ready`,
    message: soon.map(p => `${p.date.slice(5)} · ${p.title} (${p.prod || 'Idea'})`).join('\n'),
    priority: 3, tags: ['calendar'], click: cfg.dashboardUrl,
  });
}

async function weeklyBrief(ctx) {
  const { store, notify, today, cfg, log } = ctx;
  const [alerts, posts, settings] = await Promise.all([store.list('alerts'), store.list('posts'), store.get('settings', 'main')]);
  const weekAgo = Date.now() - 7 * 864e5;
  const s = settings || {};
  const link = (t, u) => (u ? `<a href="${h(u)}">${h(t)}</a>` : h(t));
  const tierName = { crit: 'Critical', opp: 'Opportunity', info: 'Info' };
  const recent = alerts.filter(a => (a.createdAt || 0) >= weekAgo).sort((a, b) => (a.tier > b.tier ? 1 : -1));
  const deadlines = (s.deadlines || []).filter(d => d.date >= today && d.date <= addDays(today, 30)).sort((a, b) => a.date.localeCompare(b.date));
  const next7 = posts.filter(p => p.date >= today && p.date <= addDays(today, 7)).sort((a, b) => a.date.localeCompare(b.date));
  const missing = posts.filter(p => p.date >= today && p.date <= addDays(today, 14) && !READY.has(p.prod));
  const openCrit = alerts.filter(a => a.tier === 'crit' && !a.done);
  const priorities = [
    ...openCrit.slice(0, 3).map(a => `Resolve: ${h(a.title)}`),
    ...missing.filter(p => p.date <= addDays(today, 7)).slice(0, 3).map(p => `Finish ${h(p.title)} for ${p.date.slice(5)}: ${h(p.footage || 'footage TBD')}`),
  ];
  const sections = [
    ['1. New official Hogs announcements', recent.map(a => `<b>${tierName[a.tier]}</b> · ${link(a.title, a.url)}`)],
    ['2. Important deadlines (next 30 days)', deadlines.map(d => `${d.date.slice(5)} · ${h(d.title)}${d.note ? ' — ' + h(d.note) : ''}`)],
    ['3. New trend ideas (ready-to-make briefs in the Idea Bank)', [
      ...(ctx.trendIdeas || []).map(i => `<b>${h(i.title)}</b> for ${i.suggestedDate.slice(5)} \u00b7 trend: ${i.sources[0] ? link(i.trendName, i.sources[0].url) : h(i.trendName) + ' (creative suggestion, not a verified trend)'} \u00b7 effort ${h(i.effort)}`),
      ...(ctx.trendError ? [`Trend research didn\u2019t run this week: ${h(ctx.trendError)}`] : []),
      ...(ctx.trendIdeas?.briefs ? [`Briefs written for ${ctx.trendIdeas.briefs} trend(s) the team spotted.`] : [])]],
    ['4. Content opportunities', alerts.filter(a => a.tier === 'opp' && !a.done).slice(0, 6).map(a => `${h(a.title)}: ${h(a.action)}`)],
    ['5. Posts in the next 7 days', next7.map(p => `${p.date.slice(5)} · ${h(p.title)} (${h(p.prod || 'Idea')})`)],
    ['6. Production tasks and missing assets', missing.map(p => `${h(p.title)} (${p.date.slice(5)}): ${h(p.footage || 'footage TBD')}`)],
    ['7. Fundraising and sponsors', [s.goal ? `Goal $${Number(s.goal).toLocaleString()}` : 'No 2027 goal entered', s.verifiedTotal ? `Verified total $${Number(s.verifiedTotal).toLocaleString()} (as of ${h(s.totalAsOf || 'date not entered')})` : 'No verified 2027 total entered']],
    ['8. Suggested priorities', priorities],
  ];
  const week = `Week of ${today}`;
  log(`Weekly brief: ${recent.length} new alerts, ${next7.length} posts this week`);
  await notify.email({ subject: `Porktoberfest Weekly Brief — ${week}`, html: briefEmailHtml(sections, cfg.dashboardUrl, week), text: sections.map(([t, l]) => `${t}\n${l.map(x => ' - ' + x.replace(/<[^>]+>/g, '')).join('\n')}`).join('\n\n') });
  await notify.push({ title: 'Weekly brief is in your inbox', message: `${recent.length} new announcements · ${(ctx.trendIdeas || []).length} new trend ideas · ${next7.length} posts this week · ${missing.length} need assets`, priority: 3, tags: ['newspaper'], click: cfg.dashboardUrl });
}

/* ---------- entry ---------- */
export async function run({ mode = 'auto', store, fetchers = real, now = new Date(), log = console.log, notifyOverride } = {}) {
  const cfg = readJson('./config.json');
  const rules = readJson('./rules.json');
  store = store || openStore();
  const z = zoned(now, cfg.timezone);
  const ctx = { cfg, rules, store, fetchers, log, today: z.iso, quiet: inQuietHours(z.hour, cfg.quietHours) };
  ctx.notify = notifyOverride || channels(cfg, { dry: store.dry, log });
  if (ctx.notify.setRecipients) {
    const members = await store.list('members');
    ctx.notify.setRecipients(members.filter(m => m.alerts && m.role !== 'viewer').map(m => m.id));
  }
  log(`Mode ${mode} · ${z.iso} ${z.hour}:00 CT${store.dry ? ' · DRY RUN (no Firebase credentials)' : ''}`);

  if (mode === 'test') {
    await ctx.notify.push({ title: 'Porktoberfest test alert', message: 'Push is working. Real alerts will look like this.', priority: 3, tags: ['tada'], click: cfg.dashboardUrl });
    await ctx.notify.email({ subject: 'Porktoberfest Command Center: test email', html: '<p>Email alerts are working.</p>', text: 'Email alerts are working.' });
    return ctx;
  }
  if (mode === 'auto' || mode === 'check') {
    const { newAlerts, health, prevHealth } = await checkSources(ctx);
    await deliverAlerts(ctx, newAlerts, health, prevHealth);
    ctx.newAlerts = newAlerts;
  }
  const morning = z.hour < 12;
  if (mode === 'daily' || (mode === 'auto' && morning)) await postReminders(ctx);
  const monday = mode === 'auto' && morning && z.weekday === 'Mon';
  if (mode === 'trends' || mode === 'brief' || monday) {
    try {
      ctx.trendIdeas = await trendIdeas(ctx);
      if (ctx.trendIdeas.length && mode === 'trends') await ctx.notify.push({ title: `${ctx.trendIdeas.length} new trend ideas`, message: ctx.trendIdeas.map(i => `${i.suggestedDate.slice(5)} \u00b7 ${i.title} (${i.trendName})`).join('\n'), priority: 3, tags: ['sparkles'], click: cfg.dashboardUrl });
    } catch (e) { log(`Trend ideas failed: ${e.message}`); ctx.trendError = e.message; }
  }
  if (mode === 'brief' || monday) await weeklyBrief(ctx);
  return ctx;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run({ mode: process.argv[2] || 'auto' }).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
