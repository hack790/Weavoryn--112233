const { ADMIN, db, userFrom, send, esc, wrap } = require('./_lib');

// Called after a customer signs in. Sends the welcome email and the admin alert once per account.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await userFrom(req);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  const meta = user.user_metadata || {};
  if (meta.welcomed) return res.status(200).json({ ok: true, skipped: true });

  const { error } = await db().auth.admin.updateUserById(user.id, { user_metadata: { ...meta, welcomed: true } });
  if (error) return res.status(500).json({ error: 'Could not update the account.' });

  const name = esc(meta.name || 'there');
  try { await send(user.email, 'Welcome to WEAVORYN', wrap('Welcome to WEAVORYN', `<p>Hi ${name}, thank you for creating an account. Your details are saved for a faster checkout next time.</p>`)); } catch (e) { console.error('Welcome email failed:', e.message); }
  try { await send(ADMIN(), 'New customer registered', wrap('New customer registered', `<p>Name: ${name}<br>Email: ${esc(user.email)}<br>Registered: ${esc(user.created_at)}</p><p>Passwords are never included in this email.</p>`)); } catch (e) { console.error('Admin alert failed:', e.message); }
  return res.status(200).json({ ok: true });
};
