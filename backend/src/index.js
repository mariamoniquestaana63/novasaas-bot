require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const Stripe  = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const app    = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
const db     = createClient(
  process.env.SUPABASE_URL    ?? "",
  process.env.SUPABASE_SERVICE_KEY ?? ""
);
const anonDb = createClient(
  process.env.SUPABASE_URL     ?? "",
  process.env.SUPABASE_ANON_KEY ?? ""
);

const PLANS = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro:     process.env.STRIPE_PRICE_PRO,
  elite:   process.env.STRIPE_PRICE_ELITE,
};

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch (err) {
    console.error("[Webhook] Bad signature:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  const obj = event.data.object;
  if (event.type === "checkout.session.completed" && obj.mode === "subscription") {
    const userId = obj.metadata?.user_id;
    if (userId) {
      const sub = await stripe.subscriptions.retrieve(obj.subscription);
      await upsertSubscription(userId, obj.customer, sub);
    }
  }
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const customer = await stripe.customers.retrieve(obj.customer);
    const userId = customer.metadata?.user_id;
    if (userId) await upsertSubscription(userId, obj.customer, obj);
  }
  res.json({ received: true });
});

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const { data: { user }, error } = await anonDb.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid token" });
  req.user = user;
  next();
}

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", plans: Object.keys(PLANS) })
);

app.post("/api/checkout", requireAuth, async (req, res) => {
  const { plan } = req.body;
  const priceId = PLANS[plan];
  if (!priceId) return res.status(400).json({ error: `Unknown plan: ${plan}` });
  const customerId = await getOrCreateCustomer(req.user.id, req.user.email);
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/dashboard?upgraded=1`,
    cancel_url:  `${process.env.FRONTEND_URL}/pricing`,
    subscription_data: { trial_period_days: 14, metadata: { user_id: req.user.id } },
    metadata: { user_id: req.user.id },
    allow_promotion_codes: true,
  });
  res.json({ url: session.url });
});

app.post("/api/portal", requireAuth, async (req, res) => {
  const { data } = await db.from("subscriptions").select("stripe_customer_id").eq("user_id", req.user.id).single();
  if (!data?.stripe_customer_id) return res.status(404).json({ error: "No billing account" });
  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${process.env.FRONTEND_URL}/dashboard`,
  });
  res.json({ url: session.url });
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

app.post("/api/waitlist", async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "Valid email required" });
  const { error } = await db.from("waitlist").insert([{ email }]);
  if (error?.code === "23505") return res.json({ success: true, already: true });
  if (error) return res.status(500).json({ error: "Could not save" });
  res.json({ success: true });
});

async function getOrCreateCustomer(userId, email) {
  const { data } = await db.from("subscriptions").select("stripe_customer_id").eq("user_id", userId).single();
  if (data?.stripe_customer_id) return data.stripe_customer_id;
  const customer = await stripe.customers.create({ email, metadata: { user_id: userId } });
  return customer.id;
}

async function upsertSubscription(userId, customerId, sub) {
  const priceId = sub.items?.data[0]?.price?.id;
  const plan = Object.entries(PLANS).find(([, v]) => v === priceId)?.[0] ?? "free";
  await db.from("subscriptions").upsert(
    {
      user_id:                userId,
      stripe_customer_id:     customerId,
      stripe_subscription_id: sub.id,
      status:                 sub.status,
      plan,
      current_period_end:     new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end:   sub.cancel_at_period_end,
    },
    { onConflict: "user_id" }
  );
}

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => console.log(`✅ Gravia backend :${PORT}`));
