const { ADMIN, db, userFrom, send, esc, wrap, orderHtml } = require('./_lib');

// Order management for the store owner. Safepay webhooks alone mark card orders paid.
module.exports = async (req, res) => {
  const user = await userFrom(req);
  if (!user || String(user.email || '').toLowerCase() !== ADMIN().toLowerCase()) return res.status(403).json({ error: 'Not allowed' });
  const sb = db();

  if (req.method === 'GET') {
    const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false }).limit(100);
    return error ? res.status(500).json({ error: error.message }) : res.status(200).json({ orders: data });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, action } = req.body || {};
  const { data: o } = await sb.from('orders').select('*').eq('id', id).single();
  if (!o) return res.status(404).json({ error: 'Order not found' });
  if (action === 'paid') return res.status(400).json({ error: 'Card payments are marked paid only after Safepay confirms them.' });
  if (action === 'refund') return res.status(400).json({ error: 'Issue card refunds from your Safepay dashboard.' });

  const upd = {}; let customerEmail;
  const hi = esc(o.customer.first || 'there');
  if (action === 'shipped') {
    if (o.status !== 'processing' || !o.paid) return res.status(400).json({ error: 'Only paid processing orders can be marked shipped.' });
    upd.status = 'shipped';
    customerEmail = [`Your WEAVORYN order ${o.number} has shipped`, 'Your order has shipped', `<p>Hi ${hi}, your order ${o.number} is on its way. Thank you for shopping with WEAVORYN.</p>` + orderHtml(o)];
  } else if (action === 'cancelled') {
    if (!['pending', 'processing'].includes(o.status)) return res.status(400).json({ error: 'This order cannot be cancelled.' });
    if (o.paid) return res.status(400).json({ error: 'Refund the card payment in Safepay before cancelling this paid order.' });
    upd.status = 'cancelled';
    customerEmail = [`Your WEAVORYN order ${o.number} was cancelled`, 'Order cancelled', `<p>Hi ${hi}, your unpaid order ${o.number} has been cancelled. Reply to this email if you have any questions.</p>`];
  } else return res.status(400).json({ error: 'Unknown action' });

  const { error } = await sb.from('orders').update(upd).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  const updated = { ...o, ...upd };
  try { await send(o.email, customerEmail[0], wrap(customerEmail[1], customerEmail[2])); } catch (e) { console.error('Customer email failed:', e.message); }
  return res.status(200).json({ order: updated });
};
