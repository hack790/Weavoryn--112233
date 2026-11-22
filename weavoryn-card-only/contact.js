const { ADMIN, send, esc, isEmail, wrap } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const b = req.body || {};
  const clean = (v, n) => String(v || '').trim().slice(0, n);
  const name = clean(b.name, 80), email = clean(b.email, 120), message = clean(b.message, 1000);
  const topic = clean(b.topic, 40) || 'Other', order = clean(b.order, 40);
  if (!name || !isEmail(email) || !message) return res.status(400).json({ error: 'Please fill in your name, a valid email and a message.' });
  try {
    await send(ADMIN(), `[${topic}] message from ${name}`, wrap('New message', `<p><b>${esc(name)}</b> (${esc(email)})<br>Topic: ${esc(topic)}${order ? '<br>Order: ' + esc(order) : ''}</p><p>${esc(message).replace(/\n/g, '<br>')}</p>`));
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Contact email failed:', e.message);
    return res.status(500).json({ error: 'Could not send your message. Please try again.' });
  }
};
