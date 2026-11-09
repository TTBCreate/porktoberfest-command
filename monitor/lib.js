// Pure helpers: classification, page-to-text, diffing, dates. No network, no Firebase.
import crypto from 'node:crypto';

export const hash = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 16);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#038': '&', '#8217': '’', '#8216': '‘', '#8220': '“', '#8221': '”', '#8211': '–', '#8212': '—', '#039': "'", hellip: '…' };
export function decode(s) {
  return String(s ?? '')
    .replace(/&#(\d+);/g, (m, n) => ENTITIES['#' + n] ?? String.fromCodePoint(+n))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}
export const stripTags = s => decode(String(s ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Turn an HTML page into a list of meaningful text lines (layout removed). */
export function htmlToLines(html, ignorePatterns = []) {
  const ignore = ignorePatterns.map(p => new RegExp(p, 'i'));
  let s = String(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|iframe|template|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/header|\/footer|\/td|\/th|\/a)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  s = decode(s);
  const seen = new Set();
  const out = [];
  for (let line of s.split('\n')) {
    line = line.replace(/\s+/g, ' ').trim();
    if (line.length < 4) continue;
    if (ignore.some(r => r.test(line))) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out;
}

export function diffLines(prev = [], cur = []) {
  const p = new Set(prev), c = new Set(cur);
  return { added: cur.filter(l => !p.has(l)), removed: prev.filter(l => !c.has(l)) };
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function hits(text, words) {
  const t = ` ${text.toLowerCase()} `;
  return words.filter(w => new RegExp(`(^|[^a-z0-9])${esc(w.toLowerCase())}([^a-z0-9]|$)`).test(t));
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MON_RE = new RegExp(`\\b(${MONTHS.map(m => m.slice(0, 3) + '(?:' + m.slice(3) + ')?').join('|')})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d\\d))?`, 'gi');

/** Dates mentioned in text that fall within `windowDays` after `todayIso`. */
export function upcomingDates(text, todayIso, windowDays = 21) {
  const today = Date.parse(todayIso + 'T00:00:00Z');
  const found = [];
  for (const m of String(text).matchAll(MON_RE)) {
    const mi = MONTHS.findIndex(x => x.startsWith(m[1].toLowerCase().slice(0, 3)));
    const day = +m[2];
    if (mi < 0 || day < 1 || day > 31) continue;
    const yNow = +todayIso.slice(0, 4);
    const years = m[3] ? [+m[3]] : [yNow, yNow + 1];
    for (const y of years) {
      const t = Date.UTC(y, mi, day);
      const diff = Math.round((t - today) / 864e5);
      if (diff >= 0 && diff <= windowDays) { found.push(new Date(t).toISOString().slice(0, 10)); break; }
    }
  }
  return [...new Set(found)];
}

/** Classify an item. Returns { tier: 'crit'|'opp'|'info', reasons: [] } */
export function classify({ text, source = {}, todayIso, isInstagram = false }, rules) {
  const crit = hits(text, rules.critical);
  const dates = upcomingDates(text, todayIso, rules.dateWindowDays ?? 21);
  if (source.alwaysCritical) return { tier: 'crit', reasons: [`change on ${source.name}`, ...crit] };
  if (crit.length || dates.length) return { tier: 'crit', reasons: [...crit, ...dates.map(d => `date soon: ${d}`)] };
  const opp = hits(text, rules.opportunity);
  if (opp.length || isInstagram) return { tier: 'opp', reasons: opp.length ? opp : ['new Instagram post'] };
  return { tier: 'info', reasons: [] };
}

export const TEMPLATE_ACTION = {
  crit: 'Review today. Check whether this changes a deadline, requirement or our tent plans, and update the calendar.',
  opp: 'Decide within 48 hours whether to react. If yes, plan a quick Story or Reel using real team footage.',
  info: 'No action needed. Skim when convenient.',
};

/** Date/time parts in a time zone. */
export function zoned(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false, weekday: 'short' }).formatToParts(date).map(p => [p.type, p.value]));
  return { iso: `${parts.year}-${parts.month}-${parts.day}`, hour: +parts.hour % 24, weekday: parts.weekday };
}
export const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export const inQuietHours = (hour, q) => (q.start > q.end ? hour >= q.start || hour < q.end : hour >= q.start && hour < q.end);
export const excerpt = (s, n = 280) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
