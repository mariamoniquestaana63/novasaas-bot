const { Router } = require("express");
const { createClient } = require("@supabase/supabase-js");
const requireAuth = require("../middleware/requireAuth");

const router = Router();

// Per-request client factory using the user's token (RLS-safe)
function userClient(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

const anonClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const { data, error } = await anonClient.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

// POST /api/auth/logout
router.post("/logout", requireAuth, async (req, res) => {
  const { error } = await userClient(req.token).auth.signOut();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
