const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// Prices live on the server so a customer can never change them in the browser.
const CATALOG = {
  'Essential Hoodie': 79, 'Pro Wireless Headphones': 249, 'Mechanical Keyboard': 149, 'Smartwatch Pro': 299,
  'Oversized Hoodie': 99, 'Sport Watch': 199, 'Gaming Monitor': 329, 'Digital Watch': 89,
};
const ADMIN = () => process.env.ADMIN_EMAIL || 'hassan.anees2014@gmail.com';

const db = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

// Returns the signed-in user for a request (or null). The token is verified by Supabase.
async function userFrom(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return null;
  const { data, error } = await db().auth.getUser(token);
  return error ? null : data.user;
}

const transport = () => nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
});
const send = (to, subject, html) => transport().sendMail({ from: `"WEAVORYN" <${process.env.GMAIL_USER}>`, to, subject, html });

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Number(n).toFixed(2);
const isEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length < 120;

function wrap(title, body) {
  return '<div style="background:#E9E1D3;padding:24px 12px;font-family:Helvetica,Arial,sans-serif;color:#2A2118">' +
    '<table role="presentation" width="100%" style="max-width:600px;margin:0 auto;background:#F6F1E8;border-radius:16px"><tr><td style="padding:28px;text-align:center;border-bottom:1px solid #cfc3ae;font:500 28px Georgia,serif">WEAVORYN.</td></tr>' +
    '<tr><td style="padding:28px;font-size:15px;line-height:1.6"><h2 style="margin:0 0 16px;font:400 24px Georgia,serif">' + esc(title) + '</h2>' + body + '</td></tr>' +
    '<tr><td style="padding:18px;text-align:center;font-size:12px;color:#7a6c5a">WEAVORYN. Less noise. More meaning.</td></tr></table></div>';
}

// Items and totals. Never contains card or password data.
function orderHtml(o) {
  const td = 'padding:8px 0;border-bottom:1px solid #cfc3ae;';
  const r = (a, b) => `<tr><td style="${td}">${a}</td><td style="${td}text-align:right">${b}</td></tr>`;
  const rows = o.items.map((i) => r(esc(i.n) + ' &times; ' + i.q, money(i.t))).join('') +
    (Number(o.discount) ? r('Discount (10%)', '-' + money(o.discount)) : '') +
    r('Shipping', Number(o.shipping) ? money(o.shipping) : 'Free') +
    r('<b>Total</b>', '<b>' + money(o.total) + '</b>');
  return `<table role="presentation" width="100%" style="font-size:14px;margin:0 0 16px">${rows}</table>`;
}

module.exports = { CATALOG, ADMIN, db, userFrom, transport, send, esc, money, isEmail, wrap, orderHtml };
