const { Router } = require('express');
const { createClient } = require('@supabase/supabase-js');
const { tenantAuth, trackUsage } = require('../middleware/tenantAuth');
const { marketplace } = require('../services/MarketplaceService');
const { commons } = require('../services/KnowledgeCommons');

const router = Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Self-serve signup — zero human touch
router.post('/signup', async (req, res) => {
  const { name, slug, plan = 'starter', email } = req.body;
  if (!name || !slug || !email) {
    return res.status(400).json({ error: 'name, slug, and email are required' });
  }
  if (!/^[a-z0-9-]{3,32}$/.test(slug)) {
    return res.status(400).json({ error: 'slug must be 3-32 lowercase alphanumeric characters or hyphens' });
  }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .insert({ name, slug, plan, settings: { email } })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Slug already taken' });
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({
    message: 'Welcome to NovaSaaS! Your platform is ready.',
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan },
    api_key: tenant.api_key,
    quickstart: {
      embed_widget: `<script src="${process.env.FRONTEND_URL || 'https://your-domain.com'}/widget.js?tenant=${tenant.slug}&key=${tenant.api_key}"></script>`,
      api_base: `${process.env.FRONTEND_URL || 'https://your-domain.com'}/api`,
      docs: 'https://docs.novasaas.ai'
    }
  });
});

// Get tenant profile + usage
router.get('/me', tenantAuth, async (req, res) => {
  const { data: usage } = await supabase
    .from('tenant_usage_summary')
    .select('*')
    .eq('tenant_id', req.tenant.id)
    .order('month', { ascending: false })
    .limit(3);

  res.json({ tenant: req.tenant, usage: usage || [] });
});

// Upgrade plan
router.patch('/me/plan', tenantAuth, async (req, res) => {
  const { plan } = req.body;
  if (!['starter', 'pro', 'enterprise'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  const { data, error } = await supabase
    .from('tenants')
    .update({ plan })
    .eq('id', req.tenant.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: `Upgraded to ${plan}`, tenant: data });
});

// Rotate API key
router.post('/me/rotate-key', tenantAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('tenants')
    .update({ api_key: null }) // trigger default gen_random_bytes
    .eq('id', req.tenant.id)
    .select('api_key')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'API key rotated', api_key: data.api_key });
});

// --- Marketplace Routes ---
router.get('/marketplace', async (req, res) => {
  try {
    const plugins = await marketplace.listPlugins(req.query);
    res.json({ plugins });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/marketplace/:slug', async (req, res) => {
  try {
    const plugin = await marketplace.getPlugin(req.params.slug);
    res.json({ plugin });
  } catch (e) {
    res.status(404).json({ error: 'Plugin not found' });
  }
});

router.post('/marketplace/:slug/install', tenantAuth, async (req, res) => {
  try {
    const result = await marketplace.installPlugin(req.tenant.id, req.params.slug, req.body.config);
    res.json({ message: 'Plugin installed', installation: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/marketplace/:slug/uninstall', tenantAuth, async (req, res) => {
  try {
    await marketplace.uninstallPlugin(req.tenant.id, req.params.slug);
    res.json({ message: 'Plugin uninstalled' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/marketplace/publish', tenantAuth, async (req, res) => {
  try {
    const plugin = await marketplace.publishPlugin(req.tenant.id, req.body);
    res.status(201).json({ message: 'Plugin submitted for review', plugin });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/my-plugins', tenantAuth, async (req, res) => {
  try {
    const plugins = await marketplace.getTenantPlugins(req.tenant.id);
    res.json({ plugins });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Knowledge Commons Routes ---
router.get('/knowledge', async (req, res) => {
  const { q, category, limit } = req.query;
  try {
    const results = q
      ? await commons.search(q, { category, limit: Number(limit) || 5 })
      : await commons.getTopEntries({ category, limit: Number(limit) || 10 });
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/knowledge', tenantAuth, async (req, res) => {
  const { category, question, answer, isPublic } = req.body;
  if (!category || !question || !answer) {
    return res.status(400).json({ error: 'category, question, and answer required' });
  }
  try {
    const entry = await commons.contribute(req.tenant.id, { category, question, answer, isPublic });
    res.status(201).json({ message: 'Contributed to knowledge commons', entry });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/knowledge/:id/upvote', async (req, res) => {
  try {
    await commons.upvote(req.params.id);
    res.json({ message: 'Upvoted' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
