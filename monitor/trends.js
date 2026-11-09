// Weekly trend ideas: Claude researches current social trends with web search and drafts
// 3 ready-to-make ideas (trend, why it fits, brief, shot list, suggested post date).
// Requires ANTHROPIC_API_KEY. Every trend must cite a page the search actually returned;
// otherwise it is stored as a creative suggestion, not a verified trend.
// Also writes briefs for trends the team logged with "Log a trend I spotted".
import { hash, addDays } from './lib.js';

const ROADMAP = {
  10: 'November: Reignite. Ease back in with nostalgic archive footage, team personality, cooking humor, build toward Giving Tuesday (Dec 1).',
  11: 'December: Entertain and Fundraise. Giving Tuesday, Hog on the Nog holiday series, Christmas comedy with real footage, sponsor appreciation, year-end giving. About 2 feed posts a week.',
  0: 'January: Build Momentum. Cooking trials, team introductions, sponsor recruitment, menu development, fundraising updates. 2-3 feed posts a week.',
  1: 'February: Mobilize. Mardi Gras humor (Mardi Gras is Feb 9, 2027), cooking content, team challenges, sponsor features, fundraising pushes, countdowns. About 3 feed posts a week.',
  2: 'March: Final Countdown. Menu reveals, location news, sponsor recognition, donations, event prep, live festival coverage Mar 19-20, post-event celebration. 4-5 posts a week, then daily.',
};
const SERIES = ['Behind the Brat', 'Meet the Meatheads', 'The Pitmaster Files', 'More Than Meat', 'Hog on the Nog', 'Sponsor spotlights', '80s action-movie parodies', 'Fundraising milestones', 'Holiday comedy', 'Event countdowns'];

export function buildPrompt({ today, posts, pastTrends, count, spotted = [] }) {
  const month = new Date(today + 'T12:00:00Z').getUTCMonth();
  const upcoming = posts.filter(p => p.date >= today && p.date <= addDays(today, 28)).sort((a, b) => a.date.localeCompare(b.date))
    .map(p => `${p.date}: ${p.title} (${p.format || p.platform || ''})`).join('\n') || 'none';
  return `You are the trend researcher for Porktoberfest, an Oktoberfest-themed barbecue competition and fundraising team at Hogs for the Cause in New Orleans (festival March 19-20, 2027, UNO Lakefront). Instagram: @porktoberfest_. Pitmaster: Nick Cormier of Envie Smokehouse. Hogs for the Cause supports families facing pediatric brain cancer.

BRAND: "MEAT. MUSTACHES. MAYHEM." Lederhosen, dirndls, fake mustaches, beer steins, Bavarian references, 1980s action-movie parody, dramatic cinematic editing, absurd humor delivered with exaggerated seriousness, real barbecue footage, heartfelt mission storytelling. Voice: warm, funny, slightly irreverent, nostalgic, occasionally heartfelt. No generic nonprofit or corporate language.

HARD RULE: Organizers kept the team out of the 2026 social media top three for using too much AI-generated content. Every idea must be made with REAL footage: archive clips from past years, new filming of the social media manager (she will appear on camera and in costume), real cooking footage of Nick, real sponsors and supporters. Never AI-generated people, AI video, or fabricated events. Do not depend on other team members supplying new footage regularly.

TODAY: ${today}. Campaign phase: ${ROADMAP[month] || 'Off-season planning.'}
ALREADY ON THE CALENDAR (next 4 weeks):
${upcoming}
TRENDS ALREADY SUGGESTED (do not repeat): ${pastTrends.join('; ') || 'none'}

TEAM-SPOTTED TRENDS NEEDING A BRIEF (the team saw these themselves; write a brief for each, you may search to understand them):
${spotted.length ? spotted.map(t => `- id ${t.id}: ${t.trendName} | example: ${t.sources?.[0]?.url || 'none'} | notes: ${t.trendWhat || 'none'} | fades: ${t.timeSensitivity || '2-3 weeks'}`).join('\n') : 'none'}

TASK: Use web search to find ${count} social media trends that are current right now (seen in roughly the last 3 weeks) on Instagram Reels or TikTok and fit this brand: Reel editing styles, comedy formats, memes, nostalgia/80s, sports or pop-culture moments, holiday hooks, Oktoberfest/barbecue humor, grassroots fundraising formats, New Orleans culture. Prefer recent trend roundups and articles that describe the trend and link examples. Then design one Porktoberfest post per trend.

RULES FOR HONESTY:
- Every trend needs at least one source URL that your search actually returned. Do not invent URLs, view counts or popularity.
- Do not name a specific trending sound unless a source names it. Otherwise give an audio direction such as "pick a current trending dramatic-reveal sound in the Instagram audio browser".
- If you cannot find enough verifiable trends, return fewer and fill the rest with clearly labeled creative suggestions ("verified": false, empty sources).

SUGGESTED DATE: pick a date between ${addDays(today, 2)} and ${addDays(today, 21)} that does not already have a post, fits the trend's time sensitivity (fast trends sooner), and suits the campaign phase.

Reply with ONLY a JSON object, no prose: {"ideas": [...], "briefs": [...]}.
"briefs" has one entry per team-spotted trend above (empty array if none), each with: {"id": "the id given", "whyRelevant", "title", "series", "type", "effort", "footage", "concept", "hook", "shotList", "audio", "editing", "caption", "cta", "suggestedDate"} using the same rules as below.
"ideas" is an array of new trend ideas, each with exactly these keys:
{"trendName": "", "trendWhat": "2-3 sentences: what the trend is and how people do it", "sources": [{"title": "", "url": "https://..."}], "verified": true, "whyRelevant": "1-2 sentences", "title": "Porktoberfest post name", "series": "one of: ${SERIES.join(', ')}", "type": "Reel|Story|Carousel", "effort": "Low|Medium|High", "footage": "authentic footage needed (archive vs. new filming)", "concept": "2-3 sentences", "hook": "first 1-2 seconds, on-screen text or line", "shotList": ["shot 1 with timing", "shot 2", "..."], "audio": "", "editing": "", "caption": "draft caption in brand voice", "cta": "", "suggestedDate": "YYYY-MM-DD", "timeSensitivity": "This week|2-3 weeks|Evergreen", "expires": "YYYY-MM-DD (when the trend will likely feel stale)"}`;
}

export async function realCallClaude({ prompt, model, apiKey }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 6000, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }], messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(240000),
  });
  const j = await r.json();
  if (j.error) throw new Error(`Claude API: ${j.error.message || j.error.type}`);
  return j;
}

const norm = u => { try { const x = new URL(u); return (x.host.replace(/^www\./, '') + x.pathname.replace(/\/$/, '')).toLowerCase(); } catch { return ''; } };

export function extractJson(text) {
  const o = text.indexOf('{'), a = text.indexOf('[');
  if (o >= 0 && (a < 0 || o < a)) {
    const j = JSON.parse(text.slice(o, text.lastIndexOf('}') + 1));
    return { ideas: Array.isArray(j.ideas) ? j.ideas : [], briefs: Array.isArray(j.briefs) ? j.briefs : [] };
  }
  if (a >= 0) return { ideas: JSON.parse(text.slice(a, text.lastIndexOf(']') + 1)), briefs: [] };
  throw new Error('No ideas returned');
}

/** Briefs for team-spotted trends (their link came from the team, so no search check). */
export function parseBriefs(response, { today, ids }) {
  const text = (response.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const okDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  return extractJson(text).briefs.filter(b => ids.includes(b.id)).map(b => ({
    id: b.id,
    patch: {
      whyRelevant: String(b.whyRelevant || ''), title: String(b.title || '').slice(0, 120) || undefined,
      series: SERIES.includes(b.series) ? b.series : undefined, type: ['Reel', 'Story', 'Carousel'].includes(b.type) ? b.type : undefined,
      effort: ['Low', 'Medium', 'High'].includes(b.effort) ? b.effort : undefined,
      footage: String(b.footage || ''), concept: String(b.concept || ''), hook: String(b.hook || ''),
      shotList: (Array.isArray(b.shotList) ? b.shotList : []).map(String).slice(0, 12),
      audio: String(b.audio || ''), editing: String(b.editing || ''), caption: String(b.caption || ''), cta: String(b.cta || ''),
      suggestedDate: okDate(b.suggestedDate) && b.suggestedDate > today ? b.suggestedDate : addDays(today, 7),
      needsBrief: false, aiDrafted: true, briefDraftedAt: Date.now(),
    },
  })).map(x => ({ id: x.id, patch: Object.fromEntries(Object.entries(x.patch).filter(([, v]) => v !== undefined)) }));
}

/** Pull the JSON ideas out of the response and check every source against real search results. */
export function parseIdeas(response, { today, count }) {
  const blocks = response.content || [];
  const searched = new Set();
  for (const b of blocks) if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) for (const r of b.content) if (r.url) searched.add(norm(r.url));
  const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('');
  const raw = extractJson(text).ideas;
  const okDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  return raw.slice(0, count).map(i => {
    const sources = (Array.isArray(i.sources) ? i.sources : []).filter(s => /^https:\/\//.test(s?.url || '') && searched.has(norm(s.url)));
    const verified = sources.length > 0;
    let date = okDate(i.suggestedDate) ? i.suggestedDate : addDays(today, 7);
    if (date < addDays(today, 1)) date = addDays(today, 2);
    return {
      origin: 'trend', aiDrafted: true, verified, status: 'New',
      trendName: String(i.trendName || 'Untitled trend').slice(0, 120),
      trendWhat: String(i.trendWhat || ''), whyRelevant: String(i.whyRelevant || ''),
      sources: sources.slice(0, 4).map(s => ({ title: String(s.title || s.url).slice(0, 140), url: s.url })),
      observed: today,
      title: String(i.title || i.trendName || 'Trend idea').slice(0, 120),
      series: SERIES.includes(i.series) ? i.series : '80s action-movie parodies',
      type: ['Reel', 'Story', 'Carousel'].includes(i.type) ? i.type : 'Reel',
      effort: ['Low', 'Medium', 'High'].includes(i.effort) ? i.effort : 'Medium',
      footage: String(i.footage || ''), concept: String(i.concept || ''), hook: String(i.hook || ''),
      shotList: (Array.isArray(i.shotList) ? i.shotList : []).map(String).slice(0, 12),
      audio: String(i.audio || ''), editing: String(i.editing || ''), caption: String(i.caption || ''), cta: String(i.cta || ''),
      suggestedDate: date,
      timeSensitivity: ['This week', '2-3 weeks', 'Evergreen'].includes(i.timeSensitivity) ? i.timeSensitivity : '2-3 weeks',
      expires: okDate(i.expires) ? i.expires : addDays(today, 21),
      note: String(i.concept || ''),
    };
  });
}

/** Research new trend ideas, write briefs for team-spotted trends, return what was added. */
export async function trendIdeas(ctx) {
  const { store, today, cfg, log, fetchers } = ctx;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !fetchers.callClaude) { log('Trend ideas skipped: ANTHROPIC_API_KEY not set'); return []; }
  const count = cfg.trendIdeasPerWeek || 3;
  const [posts, ideas] = await Promise.all([store.list('posts'), store.list('ideas')]);
  const pastTrends = ideas.filter(i => i.origin === 'trend').map(i => i.trendName).slice(-40);
  const spotted = ideas.filter(i => i.spotted && i.needsBrief && !i.concept && i.status !== 'Dismissed').slice(0, 5);
  const prompt = buildPrompt({ today, posts, pastTrends, count, spotted });
  const call = fetchers.callClaude || realCallClaude;
  const response = await call({ prompt, model: cfg.trendsModel, apiKey });
  const found = parseIdeas(response, { today, count });
  const briefs = parseBriefs(response, { today, ids: spotted.map(t => t.id) });
  for (const b of briefs) await store.set('ideas', b.id, b.patch);
  if (briefs.length) log(`Briefs written for ${briefs.length} team-spotted trend(s)`);
  const added = [];
  for (const idea of found) {
    const id = `trend-${hash(idea.trendName.toLowerCase())}`;
    if (!(await store.create('ideas', id, { ...idea, createdAt: Date.now() }))) continue;
    added.push({ id, ...idea });
  }
  log(`Trend ideas: ${added.length} added (${added.filter(i => i.verified).length} verified trends)`);
  added.briefs = briefs.length;
  return added;
}
