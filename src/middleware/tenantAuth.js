const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const tenantCache = new Map();
const CACHE_TTL = 60_000; // 1 minute

async function tenantAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required. Get one at /api/tenants/signup' });
  }

  const cached = tenantCache.get(apiKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    req.tenant = cached.tenant;
    return next();
  }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*, plan_limits(*)')
    .eq('api_key', apiKey)
    .eq('is_active', true)
    .single();

  if (error || !tenant) {
    return res.status(401).json({ error: 'Invalid or inactive API key' });
  }

  tenantCache.set(apiKey, { tenant, ts: Date.now() });
  req.tenant = tenant;
  next();
}

async function trackUsage(tenantId, eventType, tokensUsed = 0) {
  const COST_PER_TOKEN = 0.000003; // $3 per million tokens (Claude Sonnet pricing)
  await supabase.from('usage_events').insert({
    tenant_id: tenantId,
    event_type: eventType,
    tokens_used: tokensUsed,
    cost_usd: tokensUsed * COST_PER_TOKEN
  });
}

module.exports = { tenantAuth, trackUsage };
