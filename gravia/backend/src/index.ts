import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Plans: starter / pro / elite → single Stripe price ID each
const PLANS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER!,
  pro:     process.env.STRIPE_PRICE_PRO!,
  elite:   process.env.STRIPE_PRICE_ELITE!,
};

// ── Stripe webhook — raw body, mount before express.json() ───────────────────
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: any) {
      console.error("[Webhook] Signature error:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    const obj = event.data.object as any;

    switch (event.type) {
      case "checkout.session.completed": {
        if (obj.mode !== "subscription") break;
        const userId: string | undefined = obj.metadata?.user_id;
        if (!userId) break;
        const sub = await stripe.subscriptions.retrieve(obj.subscription as string);
        await upsertSubscription(userId, obj.customer as string, sub);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const customer = await stripe.customers.retrieve(obj.customer as string) as Stripe.Customer;
        const userId = customer.metadata?.user_id;
        if (!userId) break;
        await upsertSubscription(userId, obj.customer as string, obj as Stripe.Subscription);
        break;
      }
    }

    res.json({ received: true });
  }
);

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

// ── Auth middleware ───────────────────────────────────────────────────────────
const anonClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error || !user) { res.status(401).json({ error: "Invalid token" }); return; }

  (req as any).user = user;
  next();
}

// ── GET /health ───────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", plans: Object.keys(PLANS) }));

// ── POST /checkout ────────────────────────────────────────────────────────────
app.post("/checkout", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { plan } = req.body as { plan: string };
  const user = (req as any).user;

  const priceId = PLANS[plan];
  if (!priceId) {
    res.status(400).json({ error: `Unknown plan: ${plan}. Valid: ${Object.keys(PLANS).join(", ")}` });
    return;
  }

  const customerId = await getOrCreateCustomer(user.id, user.email);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/dashboard?upgraded=1`,
    cancel_url:  `${process.env.FRONTEND_URL}/pricing`,
    subscription_data: {
      trial_period_days: 14,
      metadata: { user_id: user.id },
    },
    metadata: { user_id: user.id },
    allow_promotion_codes: true,
  });

  res.json({ url: session.url });
});

// ── POST /portal ──────────────────────────────────────────────────────────────
app.post("/portal", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { data } = await db.from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).single();
  if (!data?.stripe_customer_id) { res.status(404).json({ error: "No billing account" }); return; }

  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${process.env.FRONTEND_URL}/dashboard`,
  });

  res.json({ url: session.url });
});

// ── GET /subscription ─────────────────────────────────────────────────────────
app.get("/subscription", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { data, error } = await db
    .from("subscriptions")
    .select("status, plan, current_period_end, cancel_at_period_end")
    .eq("user_id", user.id)
    .single();

  if (error || !data) { res.json({ subscribed: false, plan: "free" }); return; }
  res.json({ subscribed: true, ...data });
});

// ── POST /waitlist ────────────────────────────────────────────────────────────
app.post("/waitlist", async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Valid email required" }); return;
  }
  const { error } = await db.from("waitlist").insert([{ email }]);
  if (error?.code === "23505") { res.json({ success: true, already: true }); return; }
  if (error) { res.status(500).json({ error: "Could not save" }); return; }
  res.json({ success: true });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getOrCreateCustomer(userId: string, email: string): Promise<string> {
  const { data } = await db.from("subscriptions").select("stripe_customer_id").eq("user_id", userId).single();
  if (data?.stripe_customer_id) return data.stripe_customer_id;

  const customer = await stripe.customers.create({ email, metadata: { user_id: userId } });
  return customer.id;
}

async function upsertSubscription(userId: string, customerId: string, sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price?.id;
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

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => console.log(`✅ Gravia backend on :${PORT}`));
