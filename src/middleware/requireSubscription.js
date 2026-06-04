const { createClient } = require("@supabase/supabase-js");

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function requireSubscription(req, res, next) {
  const userId = req.user.id;

  const { data, error } = await db
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return res.status(402).json({ error: "No active subscription", code: "NO_SUBSCRIPTION" });
  }

  const isActive =
    data.status === "active" ||
    data.status === "trialing" ||
    // grace: treat past_due as still accessible briefly
    (data.status === "past_due" && new Date(data.current_period_end) > new Date());

  if (!isActive) {
    return res.status(402).json({ error: "Subscription inactive", code: "SUBSCRIPTION_INACTIVE", status: data.status });
  }

  req.subscription = data;
  next();
}

module.exports = requireSubscription;
