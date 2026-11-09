// Fetchers. Each returns { items: [{key, title, text, url, pub}] } for feeds, or { lines } for pages.
import { stripTags, htmlToLines } from './lib.js';

const UA = 'Mozilla/5.0 (compatible; PorktoberfestCommandCenter/1.0; +https://github.com)';

async function get(url, headers = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*', ...headers }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
  return r;
}

export async function fetchWpPosts(src) {
  const r = await get(src.url, { Accept: 'application/json' });
  const type = r.headers.get('content-type') || '';
  if (!type.includes('json')) throw new Error(`Expected JSON, got ${type || 'unknown'}`);
  const posts = await r.json();
  if (!Array.isArray(posts)) throw new Error('Unexpected posts API response');
  return {
    method: 'WordPress posts API',
    items: posts.map(p => ({
      key: String(p.id),
      title: stripTags(p.title?.rendered),
      text: stripTags(p.title?.rendered) + ' ' + stripTags(p.excerpt?.rendered),
      url: p.link,
      pub: String(p.date || '').slice(0, 10) || 'Not stated',
    })),
  };
}

export async function fetchPage(src, ignorePatterns) {
  const r = await get(src.url, { Accept: 'text/html' });
  return { method: 'Page check', lines: htmlToLines(await r.text(), ignorePatterns) };
}

const igItem = (id, caption, url, ts) => {
  const text = String(caption || '').replace(/\s+/g, ' ').trim();
  const first = text.split(/(?<=[.!?])\s|\n/)[0] || 'New post';
  return { key: String(id), title: first.length > 90 ? first.slice(0, 89) + '…' : first, text: text || 'New Instagram post (no caption)', url, pub: ts ? String(ts).slice(0, 10) : 'Not stated' };
};

/** Instagram: 1) official Graph API business discovery, 2) public profile endpoint (best effort). */
export async function fetchInstagram(src, cfg) {
  const token = process.env.IG_ACCESS_TOKEN, igUser = process.env.IG_USER_ID;
  const errors = [];
  if (token && igUser) {
    try {
      const fields = `business_discovery.username(${src.username}){media.limit(12){id,caption,permalink,timestamp}}`;
      const url = `https://graph.facebook.com/${cfg.instagramApiVersion}/${igUser}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
      const j = await r.json();
      if (j.error) throw new Error(`Graph API: ${j.error.message}`);
      const media = j.business_discovery?.media?.data || [];
      return { method: 'Instagram API', items: media.map(m => igItem(m.id, m.caption, m.permalink, m.timestamp)) };
    } catch (e) { errors.push(e.message); }
  } else errors.push('Instagram API not connected (IG_ACCESS_TOKEN / IG_USER_ID missing)');

  try {
    const r = await get(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${src.username}`, { 'x-ig-app-id': '936619743392459', Accept: 'application/json' });
    const j = await r.json();
    const edges = j?.data?.user?.edge_owner_to_timeline_media?.edges;
    if (!Array.isArray(edges)) throw new Error('Public profile returned no posts');
    return {
      method: 'Instagram public profile (fallback)',
      warning: errors.join('; '),
      items: edges.map(({ node: n }) => igItem(n.id, n.edge_media_to_caption?.edges?.[0]?.node?.text, `https://www.instagram.com/p/${n.shortcode}/`, n.taken_at_timestamp ? new Date(n.taken_at_timestamp * 1000).toISOString() : '')),
    };
  } catch (e) { errors.push(`Fallback: ${e.message}`); }
  throw new Error(errors.join(' | '));
}
