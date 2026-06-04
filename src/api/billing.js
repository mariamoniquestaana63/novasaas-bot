const { Router } = require("express");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const requireAuth = require("../middleware/requireAuth");

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Maps Stripe Price IDs to plan names — set these in your env
const PLANS = {
  starter: process.env.STRIPE_PRICE_STARTER,  // e.g. price_xxx
  pro: process.env.STRIPE_PRICE_PRO,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

async function getOrCreateCustomer(userId, email) {
  const { data } = await db
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .single();

  if (data?.stripe_customer_id) return data.stripe_customer_id;

  const customer = await stripe.customers.create({ email, metadata: { supabase_user_id: userId } });
  return customer.id;
}

// POST /api/billing/checkout  { plan: "starter" | "pro" | "enterprise" }
router.post("/checkout", requireAuth, async (req, res) => {
  const { plan } = req.body;
  const priceId = PLANS[plan];
  if (!priceId) return res.status(400).json({ error: `Unknown plan: ${plan}` });

  const customerId = await getOrCreateCustomer(req.user.id, req.user.email);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/billing/cancel`,
    subscription_data: {
      metadata: { supabase_user_id: req.user.id },
      trial_period_days: 14,
    },
  });

  res.json({ url: session.url });
});

// POST /api/billing/portal  — redirects to Stripe customer portal
router.post("/portal", requireAuth, async (req, res) => {
  const { data } = await db
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", req.user.id)
    .single();

  if (!data?.stripe_customer_id) {
    return res.status(404).json({ error: "No billing account found" });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${process.env.FRONTEND_URL}/billing`,
  });

  res.json({ url: session.url });
});

// GET /api/billing/status  — current subscription for the logged-in user
router.get("/status", requireAuth, async (req, res) => {
  const { data, error } = await db
    .from("subscriptions")
    .select("status, plan, current_period_end, stripe_customer_id")
    .eq("user_id", req.user.id)
    .single();

  if (error || !data) return res.json({ subscribed: false });
  res.json({ subscribed: true, ...data });
});

// POST /api/billing/webhook  — Stripe webhook (raw body required)
router.post(
  "/webhook",
  (req, _res, next) => {
    // express.json() has already run for all other routes; we need the raw buffer here.
    // server.js mounts this route BEFORE express.json(), so req.body is the raw Buffer.
    next();
  },
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("[Stripe Webhook] Signature verification failed:", err.message);
      return res.status(400).json({ error: err.message });
    }

    const sub = event.data.object;

    switch (event.type) {
      case "checkout.session.completed": {
        // Subscription created via checkout — seed the row
        if (sub.mode !== "subscription") break;
        const userId = sub.metadata?.supabase_user_id || sub.subscription_data?.metadata?.supabase_user_id;
        if (!userId) break;
        const subscription = await stripe.subscriptions.retrieve(sub.subscription);
        await upsertSubscription(userId, sub.customer, subscription);
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const customer = await stripe.customers.retrieve(sub.customer);
        const userId = customer.metadata?.supabase_user_id;
        if (!userId) break;
        await upsertSubscription(userId, sub.customer, sub);
        break;
      }
    }

    res.json({ received: true });
  }
);

async function upsertSubscription(userId, customerId, stripeSub) {
  const priceId = stripeSub.items?.data[0]?.price?.id;
  const plan = Object.entries(PLANS).find(([, v]) => v === priceId)?.[0] ?? "unknown";

  await db.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: stripeSub.id,
      status: stripeSub.status,
      plan,
      current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
    },
    { onConflict: "user_id" }
  );
}

module.exports = router;
