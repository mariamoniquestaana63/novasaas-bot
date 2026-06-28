require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const crypto  = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const db  = createClient(
  process.env.SUPABASE_URL    ?? "",
  process.env.SUPABASE_SERVICE_KEY ?? ""
);
const anonDb = createClient(
  process.env.SUPABASE_URL     ?? "",
  process.env.SUPABASE_ANON_KEY ?? ""
);

const PM_SECRET = process.env.PAYMONGO_SECRET_KEY ?? "";
const PM_BASE   = "https://api.paymongo.com/v1";
const PM_AUTH   = "Basic " + Buffer.from(PM_SECRET + ":").toString("base64");

const PLAN_AMOUNTS = {
  starter: { amount: 149900, name: "Bayesian Starter",  interval: "month" },
  pro:     { amount: 399900, name: "Bayesian Pro",      interval: "month" },
  elite:   { amount: 999900, name: "Bayesian Elite",    interval: "month" },
};

async function pmRequest(method, path, body) {
  const opts = {
    method,
    headers: { Authorization: PM_AUTH, "Content-Type": "application/json", Accept: "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${PM_BASE}${path}`, opts);
  const json = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(json.errors ?? json));
  return json;
}

// ── PayMongo webhook — raw body before express.json() ────────────────────────
app.post("/api/paymongo/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["paymongo-signature"];
  if (!sig) return res.status(400).json({ error: "Missing signature" });

  const whSecret = process.env.PAYMONGO_WEBHOOK_SECRET ?? "";
  if (whSecret) {
    const parts = sig.split(",");
    const tPart = parts.find(p => p.startsWith("t="));
    const tePart = parts.find(p => p.startsWith("te="));
    if (tPart && tePart) {
      const ts = tPart.slice(2);
      const expected = tePart.slice(3);
      const payload = `${ts}.${req.body.toString()}`;
      const computed = crypto.createHmac("sha256", whSecret).update(payload).digest("hex");
      if (computed !== expected) {
        console.error("[Webhook] Bad signature");
        return res.status(400).json({ error: "Invalid signature" });
      }
    }
  }

  let event;
  try {
    event = JSON.parse(req.body.toString());
  } catch {
    return res.status(400).json({ error: "Bad JSON" });
  }

  const type = event.data?.attributes?.type;
  const data = event.data?.attributes?.data;

  if (type === "checkout_session.payment.paid") {
    const attrs = data?.attributes;
    const meta = attrs?.metadata;
    const userId = meta?.user_id;
    const plan = meta?.plan;
    if (userId && plan) {
      const paymentId = attrs?.payments?.[0]?.id ?? data?.id;
      await upsertSubscription(userId, paymentId, plan, "active");
    }
  }

  if (type === "payment.paid") {
    const attrs = data?.attributes;
    const meta = attrs?.metadata;
    const userId = meta?.user_id;
    const plan = meta?.plan;
    if (userId && plan) {
      await upsertSubscription(userId, data?.id, plan, "active");
    }
  }

  res.json({ received: true });
});

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

// ── Auth middleware ────────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const { data: { user }, error } = await anonDb.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid token" });
  req.user = user;
  next();
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", plans: Object.keys(PLAN_AMOUNTS) })
);

app.post("/api/checkout", requireAuth, async (req, res) => {
  const { plan } = req.body;
  const planInfo = PLAN_AMOUNTS[plan];
  if (!planInfo) return res.status(400).json({ error: `Unknown plan: ${plan}` });

  try {
    const result = await pmRequest("POST", "/checkout_sessions", {
      data: {
        attributes: {
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          description: `${planInfo.name} — Monthly subscription`,
          line_items: [{
            currency: "PHP",
            amount: planInfo.amount,
            name: planInfo.name,
            quantity: 1,
          }],
          payment_method_types: ["card", "gcash", "grab_pay", "paymaya"],
          success_url: `${process.env.FRONTEND_URL}/dashboard?upgraded=1`,
          cancel_url:  `${process.env.FRONTEND_URL}/pricing`,
          metadata: {
            user_id: req.user.id,
            plan,
          },
        },
      },
    });

    const checkoutUrl = result.data?.attributes?.checkout_url;
    res.json({ url: checkoutUrl });
  } catch (err) {
    console.error("[Checkout]", err.message);
    res.status(500).json({ error: "Could not create checkout session" });
  }
});

app.post("/api/portal", requireAuth, async (req, res) => {
  res.json({ url: `${process.env.FRONTEND_URL}/pricing` });
});

app.get("/api/subscription", requireAuth, async (req, res) => {
  const { data, error } = await db
    .from("subscriptions")
    .select("status, plan, current_period_end, cancel_at_period_end")
    .eq("user_id", req.user.id)
    .single();
  if (error || !data) return res.json({ subscribed: false, plan: "free" });
  res.json({ subscribed: true, ...data });
});

app.post("/api/cancel", requireAuth, async (req, res) => {
  const { data, error } = await db
    .from("subscriptions")
    .select("*")
    .eq("user_id", req.user.id)
    .single();
  if (error || !data) return res.status(404).json({ error: "No subscription" });
  await db.from("subscriptions").update({ cancel_at_period_end: true }).eq("user_id", req.user.id);
  res.json({ success: true });
});

app.post("/api/waitlist", async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "Valid email required" });
  const { error } = await db.from("waitlist").insert([{ email }]);
  if (error?.code === "23505") return res.json({ success: true, already: true });
  if (error) return res.status(500).json({ error: "Could not save" });
  res.json({ success: true });
});

// ── Admin ─────────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "mariamoniquestaana63@gmail.com";

app.get("/api/admin/stats", requireAuth, async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL)
    return res.status(403).json({ error: "Forbidden" });

  const [subsResult, waitlistResult, usersResult] = await Promise.all([
    db.from("subscriptions").select("plan, status, current_period_end, cancel_at_period_end, user_id"),
    db.from("waitlist").select("email, created_at").order("created_at", { ascending: false }),
    db.auth.admin.listUsers(),
  ]);

  const subs = subsResult.data ?? [];
  const waitlist = waitlistResult.data ?? [];
  const users = usersResult.data?.users ?? [];

  const activeSubs = subs.filter(s => s.status === "active" || s.status === "trialing");
  const planCounts = { starter: 0, pro: 0, elite: 0 };
  const planMrr    = { starter: 1499, pro: 3999, elite: 9999 };
  let mrr = 0;
  for (const s of activeSubs) {
    if (planCounts[s.plan] !== undefined) planCounts[s.plan]++;
    mrr += planMrr[s.plan] ?? 0;
  }

  const subscribersWithEmail = subs.map(s => {
    const u = users.find(u => u.id === s.user_id);
    return { ...s, email: u?.email ?? "—" };
  });

  res.json({
    stats: {
      total_users:    users.length,
      active_subs:    activeSubs.length,
      waitlist_count: waitlist.length,
      mrr,
      plans: planCounts,
    },
    subscribers: subscribersWithEmail,
    waitlist,
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function upsertSubscription(userId, paymentId, plan, status) {
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await db.from("subscriptions").upsert(
    {
      user_id:                userId,
      paymongo_payment_id:    paymentId,
      status,
      plan,
      current_period_end:     periodEnd.toISOString(),
      cancel_at_period_end:   false,
    },
    { onConflict: "user_id" }
  );
}

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => console.log(`✅ Bayesian backend :${PORT}`));
