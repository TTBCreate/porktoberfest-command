// Delivery: ntfy push and Gmail SMTP. Each channel is skipped quietly when its secrets are missing.
import nodemailer from 'nodemailer';

const env = process.env;

export function channels(cfg, { dry = false, log = console.log } = {}) {
  const topic = env.NTFY_TOPIC;
  const mailUser = env.GMAIL_USER, mailPass = env.GMAIL_APP_PASSWORD;
  // Recipients: dashboard members with alert emails on, plus anyone in ALERT_EMAIL_TO (comma-separated).
  const extra = String(env.ALERT_EMAIL_TO || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  let recipients = [...new Set(extra)];
  const mailTo = () => recipients.length > 0;
  const transport = mailUser && mailPass && !dry
    ? nodemailer.createTransport({ service: 'gmail', auth: { user: mailUser, pass: mailPass } }) : null;

  return {
    pushEnabled: !!topic,
    get emailEnabled() { return !!(mailUser && mailPass && mailTo()); },
    setRecipients(list) { recipients = [...new Set([...extra, ...list.map(x => x.toLowerCase())])]; },
    get recipients() { return recipients; },
    /** priority: 5 = urgent (critical), 3 = default, 2 = low */
    async push({ title, message, priority = 3, tags = [], click }) {
      if (!topic || dry) { log(`[push${topic ? ' dry' : ' off'}] p${priority} ${title} — ${message}`); return; }
      const body = { topic, title, message: message.slice(0, 3900), priority, tags };
      if (click) body.click = click;
      const r = await fetch(cfg.ntfyServer, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`ntfy ${r.status}: ${await r.text()}`);
    },
    async email({ subject, html, text }) {
      if (!transport || !recipients.length) { log(`[email${this.emailEnabled ? ' dry' : ' off'}] to ${recipients.length} · ${subject}`); return; }
      await transport.sendMail({ from: `Porktoberfest Command Center <${mailUser}>`, to: mailUser, bcc: recipients.join(','), subject, html, text });
    },
  };
}

const h = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TIER = { crit: ['Critical', '#B4352B'], opp: ['Content opportunity', '#A87A0E'], info: ['Informational', '#2F6DB5'] };

export function alertEmailHtml(alerts, dashboardUrl, heading) {
  const items = alerts.map(a => `
    <div style="border-left:4px solid ${TIER[a.tier][1]};padding:8px 12px;margin:0 0 14px;background:#FFFDF7">
      <div style="font-size:12px;color:#5E6577">${TIER[a.tier][0]} · ${h(a.source)} · published ${h(a.pub)} · found ${h(a.found)}${a.aiDrafted ? ' · summary AI-drafted' : ''}</div>
      <div style="font-size:16px;font-weight:600;margin:4px 0">${h(a.title)}</div>
      <div style="font-size:14px">${h(a.summary)}</div>
      <div style="font-size:14px;margin-top:6px"><b>Suggested action:</b> ${h(a.action)}</div>
      <div style="font-size:13px;margin-top:6px"><a href="${h(a.url)}">Open source</a></div>
    </div>`).join('');
  return `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1B2333;max-width:640px">
    <h2 style="color:#14284B;margin:0 0 12px">${h(heading)}</h2>${items}
    <p style="font-size:13px"><a href="${h(dashboardUrl)}">Open the Command Center</a></p></div>`;
}

export function briefEmailHtml(sections, dashboardUrl, weekLabel) {
  const body = sections.map(([title, lines]) => `
    <h3 style="color:#14284B;margin:18px 0 6px;font-size:16px">${h(title)}</h3>
    ${lines.length ? `<ul style="margin:0;padding-left:18px;font-size:14px">${lines.map(l => `<li style="margin:3px 0">${l}</li>`).join('')}</ul>` : '<p style="margin:0;font-size:14px;color:#5E6577">Nothing this week.</p>'}`).join('');
  return `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1B2333;max-width:640px">
    <h2 style="color:#14284B;margin:0">Porktoberfest Weekly Brief</h2><div style="color:#5E6577;font-size:13px">${h(weekLabel)}</div>
    ${body}<p style="font-size:13px;margin-top:18px"><a href="${h(dashboardUrl)}">Open the Command Center</a></p></div>`;
}
export { h as escapeHtml };
