const { Safepay } = require('@sfpy/node-sdk');
const { CATALOG, db, userFrom } = require('./_lib');

const safepay = () => new Safepay({
  environment: process.env.SAFEPAY_ENV || 'sandbox',
  apiKey: process.env.SAFEPAY_API_KEY,
  v1Secret: process.env.SAFEPAY_V1_SECRET,
  webhookSecret: process.env.SAFEPAY_WEBHOOK_SECRET,
});

const siteUrl = () => {
  const value = process.env.SITE_URL || (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`);
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.origin : null;
  } catch (_) { return null; }
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const required = ['SAFEPAY_API_KEY', 'SAFEPAY_V1_SECRET', 'SAFEPAY_WEBHOOK_SECRET'];
  if (required.some((key) => !process.env[key]) || !siteUrl()) {
    return res.status(503).json({ error: 'Card checkout is not configured yet.' });
  }

  const b = req.body || {};
  const c = b.customer || {};
  const clean = (v, n) => String(v || '').trim().slice(0, n || 200);
  const cust = { first: clean(c.first, 60), last: clean(c.last, 60), email: clean(c.email, 120), phone: clean(c.phone, 40), country: clean(c.country, 60), address: clean(c.address, 160), city: clean(c.city, 80), postcode: clean(c.postcode, 20), notes: clean(c.notes, 500) };
  if (!cust.first || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cust.email) || !cust.address || !cust.city) {
    return res.status(400).json({ error: 'Please fill in your name, a valid email and your address.' });
  }

  const items = []; let sub = 0;
  for (const it of (Array.isArray(b.items) ? b.items : []).slice(0, 30)) {
    const price = CATALOG[it && it.n]; const q = Math.min(10, Math.max(0, parseInt(it && it.q, 10) || 0));
    if (price && q) { items.push({ n: it.n, q, t: price * q }); sub += price * q; }
  }
  if (!items.length) return res.status(400).json({ error: 'Your cart is empty.' });

  const discount = String(b.coupon || '').toUpperCase() === 'WELCOME10' ? sub * 0.1 : 0;
  const shipping = sub - discount >= 100 ? 0 : 9;
  const total = Number((sub - discount + shipping).toFixed(2));
  // Store prices and the storefront are currently denominated in US dollars.
  const currency = 'USD';

  const number = 'WV' + Date.now().toString().slice(-8);
  const user = await userFrom(req);
  const order = { number, user_id: user ? user.id : null, email: cust.email, customer: cust, items, subtotal: sub, discount, shipping, total, currency, status: 'pending', paid: false, payment_provider: 'safepay' };

  try {
    const sp = safepay();
    const payment = await sp.payments.create({ amount: Math.round(total * 100), currency });
    if (!payment || !payment.token) throw new Error('Safepay did not return a payment token.');

    const root = siteUrl();
    const checkoutUrl = sp.checkout.create({
      token: payment.token,
      orderId: number,
      cancelUrl: `${root}/?payment=cancelled&order=${encodeURIComponent(number)}`,
      redirectUrl: `${root}/?payment=return&order=${encodeURIComponent(number)}`,
      source: 'custom',
      webhooks: true,
    });

    const { error } = await db().from('orders').insert({ ...order, payment_reference: payment.token });
    if (error) throw error;
    return res.status(200).json({ ok: true, number, total, checkoutUrl });
  } catch (e) {
    console.error('Card checkout setup failed:', e.message);
    return res.status(502).json({ error: 'We could not start card checkout. Please try again.' });
  }
};
