const { createClient } = require("@supabase/supabase-js");

// One shared client for auth verification (uses anon key — safe for JWT validation)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = header.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = user;
  req.token = token;
  next();
}

module.exports = requireAuth;
