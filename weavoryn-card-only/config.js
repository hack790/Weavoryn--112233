// Public values only (the anon key is designed to be public). Reads them from Vercel environment variables.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ url: process.env.SUPABASE_URL || '', anon: process.env.SUPABASE_ANON_KEY || '' });
};
