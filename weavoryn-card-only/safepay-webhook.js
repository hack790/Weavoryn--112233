const { Safepay } = require('@sfpy/node-sdk');
const { ADMIN, db, send, esc, wrap, orderHtml } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  if (!process.env.SAFEPAY_API_KEY || !process.env.SAFEPAY_V1_SECRET || !process.env.SAFEPAY_WEBHOOK_SECRET) {
    return res.status(503).send('Safepay is not configured');
  }

  const sp = new Safepay({
    environment: process.env.SAFEPAY_ENV || 'sandbox',
    apiKey: process.env.SAFEPAY_API_KEY,
    v1Secret: process.env.SAFEPAY_V1_SECRET,
    webhookSecret: process.env.SAFEPAY_WEBHOOK_SECRET,
  });
  if (!sp.verify.webhook(req)) return res.status(401).send('Invalid signature');

  const event = req.body && req.body.data;
  const state = String(event && (event.state || event.status) || '').toUpperCase();
  if (state !== 'PAID') return res.status(200).send('Ignored');

  const tracker = String(event.tracker || '');
  if (!tracker) return res.status(400).send('Missing payment tracker');

  const sb = db();
  const { data: order, error: findError } = await sb.from('orders').select('*').eq('payment_reference', tracker).maybeSingle();
  if (findError) return res.status(500).send('Could not find order');
  if (!order) return res.status(404).send('Order not found');
  if (order.paid) return res.status(200).send('Already processed');

  const { data: paidOrder, error: updateError } = await sb.from('orders')
    .update({ paid: true, status: 'processing' })
    .eq('id', order.id).eq('paid', false).select('*').maybeSingle();
  if (updateError) return res.status(500).send('Could not update order');
  if (!paidOrder) return res.status(200).send('Already processed');

  const name = `${order.customer.first} ${order.customer.last}`.trim();
  const address = `${order.customer.address}, ${order.customer.city}, ${order.customer.postcode}, ${order.customer.country}`;
  const total = `${order.currency || 'USD'} ${Number(order.total).toFixed(2)}`;
  try {
    await send(ADMIN(), `Paid order ${order.number} - ${total}`, wrap('New paid order ' + order.number,
      orderHtml(order) + `<p><b>${esc(name)}</b><br>${esc(order.email)}<br>${esc(order.customer.phone || '')}<br>${esc(address)}</p>` + (order.customer.notes ? `<p>Notes: ${esc(order.customer.notes)}</p>` : '')));
  } catch (e) { console.error('Admin email failed:', e.message); }
  try {
    await send(order.email, `Your WEAVORYN order ${order.number} is confirmed`, wrap('Payment confirmed',
      `<p>Hi ${esc(order.customer.first)}, payment for order <b>${esc(order.number)}</b> is confirmed.</p>` + orderHtml(order) + `<p>Delivering to: ${esc(address)}</p><p>We will email you again when it ships.</p>`));
  } catch (e) { console.error('Customer email failed:', e.message); }

  return res.status(200).send('OK');
};
