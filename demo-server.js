/**
 * Demo server — stubs Supabase + Anthropic so every endpoint works locally
 * without real credentials. Stores state in-memory.
 */

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

// ── In-memory stores ─────────────────────────────────────────────────────────
const tenants = new Map();
const plugins = [
  { id: 'p1', slug: 'hubspot-crm',         name: 'HubSpot CRM',          category: 'crm',           is_verified: true,  install_count: 412, rating: 4.8, description: 'Sync leads to HubSpot automatically.' },
  { id: 'p2', slug: 'slack-notifications', name: 'Slack Notifications',   category: 'communication', is_verified: true,  install_count: 389, rating: 4.9, description: 'Get Slack alerts on new leads & escalations.' },
  { id: 'p3', slug: 'stripe-billing',      name: 'Stripe Billing',        category: 'automation',    is_verified: true,  install_count: 301, rating: 4.7, description: 'Handle subscription & payment queries via AI.' },
  { id: 'p4', slug: 'google-analytics',    name: 'Google Analytics 4',    category: 'analytics',     is_verified: true,  install_count: 278, rating: 4.6, description: 'Track chat engagement in GA4.' },
  { id: 'p5', slug: 'openai-fallback',     name: 'OpenAI Fallback',       category: 'ai',            is_verified: true,  install_count: 194, rating: 4.5, description: 'Route to GPT-4 for 99.99% uptime.' },
  { id: 'p6', slug: 'zendesk-tickets',     name: 'Zendesk Tickets',       category: 'crm',           is_verified: false, install_count: 156, rating: 4.3, description: 'Auto-create Zendesk tickets on escalation.' },
];
const tenantPlugins = new Map(); // tenantId → Set of plugin slugs
const knowledge = [];
const leads = [];
const usageEvents = [];
const chatLogs = new Map(); // sessionId → messages[]

// ── Helpers ───────────────────────────────────────────────────────────────────
function apiKey() { return crypto.randomBytes(32).toString('hex'); }
function id()     { return crypto.randomUUID(); }

function getTenantByKey(key) {
  for (const t of tenants.values()) if (t.api_key === key) return t;
  return null;
}

function tenantAuth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!key) return res.status(401).json({ error: 'API key required. Sign up at POST /api/tenants/signup' });
  const tenant = getTenantByKey(key);
  if (!tenant) return res.status(401).json({ error: 'Invalid API key' });
  req.tenant = tenant;
  next();
}

function trackUsage(tenantId, eventType, tokens = 0) {
  usageEvents.push({ tenant_id: tenantId, event_type: eventType, tokens_used: tokens, cost_usd: tokens * 0.000003, created_at: new Date().toISOString() });
}

// ── AI stub ──────────────────────────────────────────────────────────────────
const replies = {
  support: [
    "I'm Aria, your NovaSaaS support specialist! I can help with billing, troubleshooting, and account management. What do you need?",
    "Our plans start at $29/mo (Starter), $79/mo (Pro), and custom Enterprise pricing. Which fits your team?",
    "I can reset your password, check your subscription status, or walk you through any feature. What's going on?",
  ],
  sales: [
    "Hey, I'm Sam! Ready to help you grow. What's your biggest pain point with customer support today?",
    "Most teams on our Pro plan see 3x faster response times and 40% more leads captured. Want a demo?",
    "We can get you set up in under 10 minutes. What industry are you in?",
  ],
};

function aiReply(message) {
  const lower = message.toLowerCase();
  const pool = lower.includes('price') || lower.includes('demo') || lower.includes('trial') ? replies.sales : replies.support;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Platform info
app.get('/', (req, res) => res.json({
  name: 'NovaSaaS AI OS',
  version: '1.0.0',
  description: 'Scalable multi-tenant AI platform — unlimited tenants, near-zero marginal cost',
  mode: '🟡 DEMO (in-memory, no external credentials needed)',
  endpoints: {
    signup:      'POST /api/tenants/signup',
    me:          'GET  /api/tenants/me           (x-api-key)',
    marketplace: 'GET  /api/tenants/marketplace',
    install:     'POST /api/tenants/marketplace/:slug/install  (x-api-key)',
    knowledge:   'GET  /api/tenants/knowledge',
    contribute:  'POST /api/tenants/knowledge    (x-api-key)',
    analytics:   'GET  /api/analytics            (x-api-key)',
    platform:    'GET  /api/analytics/platform',
    chat:        'POST /api/chat',
    leads:       'POST /api/leads',
  }
}));

// ── Tenant self-serve onboarding ──────────────────────────────────────────────
app.post('/api/tenants/signup', (req, res) => {
  const { name, slug, plan = 'starter', email } = req.body;
  if (!name || !slug || !email) return res.status(400).json({ error: 'name, slug, email required' });
  if (!/^[a-z0-9-]{3,32}$/.test(slug)) return res.status(400).json({ error: 'slug must be 3-32 lowercase chars/hyphens' });
  if ([...tenants.values()].some(t => t.slug === slug)) return res.status(409).json({ error: 'Slug already taken' });

  const tenant = { id: id(), slug, name, plan, email, api_key: apiKey(), created_at: new Date().toISOString(), is_active: true };
  tenants.set(tenant.id, tenant);
  tenantPlugins.set(tenant.id, new Set());

  res.status(201).json({
    message: '🎉 Welcome to NovaSaaS! Your platform is ready.',
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan },
    api_key: tenant.api_key,
    quickstart: {
      embed_widget: `<script src="https://app.novasaas.ai/widget.js?tenant=${slug}&key=${tenant.api_key}"></script>`,
      api_base: 'http://localhost:3000/api',
      next: `curl http://localhost:3000/api/tenants/me -H "x-api-key: ${tenant.api_key}"`,
    }
  });
});

app.get('/api/tenants/me', tenantAuth, (req, res) => {
  const t = req.tenant;
  const events = usageEvents.filter(e => e.tenant_id === t.id);
  const thisMonth = events.filter(e => e.created_at.startsWith(new Date().toISOString().slice(0,7)));
  res.json({
    tenant: { id: t.id, name: t.name, slug: t.slug, plan: t.plan, created_at: t.created_at },
    usage: {
      this_month: { chats: thisMonth.filter(e=>e.event_type==='chat').length, tokens: thisMonth.reduce((s,e)=>s+e.tokens_used,0) },
      all_time:   { events: events.length }
    },
    installed_plugins: [...(tenantPlugins.get(t.id)||[])],
  });
});

app.patch('/api/tenants/me/plan', tenantAuth, (req, res) => {
  const { plan } = req.body;
  if (!['starter','pro','enterprise'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
  req.tenant.plan = plan;
  res.json({ message: `Upgraded to ${plan}`, plan });
});

// ── Marketplace ───────────────────────────────────────────────────────────────
app.get('/api/tenants/marketplace', (req, res) => {
  let list = [...plugins];
  if (req.query.category) list = list.filter(p => p.category === req.query.category);
  if (req.query.search)   list = list.filter(p => p.name.toLowerCase().includes(req.query.search.toLowerCase()));
  res.json({ plugins: list, total: list.length });
});

app.get('/api/tenants/marketplace/:slug', (req, res) => {
  const p = plugins.find(p => p.slug === req.params.slug);
  if (!p) return res.status(404).json({ error: 'Plugin not found' });
  res.json({ plugin: p });
});

app.post('/api/tenants/marketplace/:slug/install', tenantAuth, (req, res) => {
  const p = plugins.find(p => p.slug === req.params.slug);
  if (!p) return res.status(404).json({ error: 'Plugin not found' });
  tenantPlugins.get(req.tenant.id).add(p.slug);
  p.install_count++;
  trackUsage(req.tenant.id, 'plugin_install');
  res.json({ message: `✅ ${p.name} installed`, plugin: p.slug, config: req.body.config || {} });
});

app.delete('/api/tenants/marketplace/:slug/uninstall', tenantAuth, (req, res) => {
  tenantPlugins.get(req.tenant.id)?.delete(req.params.slug);
  res.json({ message: `Uninstalled ${req.params.slug}` });
});

app.get('/api/tenants/my-plugins', tenantAuth, (req, res) => {
  const installed = [...(tenantPlugins.get(req.tenant.id)||[])];
  res.json({ plugins: installed.map(slug => plugins.find(p=>p.slug===slug)).filter(Boolean) });
});

app.post('/api/tenants/marketplace/publish', tenantAuth, (req, res) => {
  const { slug, name, description, category, endpoint_url } = req.body;
  if (!slug || !name || !category) return res.status(400).json({ error: 'slug, name, category required' });
  const plugin = { id: id(), slug, name, description, category, endpoint_url, author_tenant_id: req.tenant.id, is_verified: false, is_public: true, install_count: 0, rating: 0, created_at: new Date().toISOString() };
  plugins.push(plugin);
  res.status(201).json({ message: '📦 Plugin submitted for review', plugin });
});

// ── Knowledge Commons ─────────────────────────────────────────────────────────
app.get('/api/tenants/knowledge', (req, res) => {
  const { q, category, limit = 10 } = req.query;
  let results = knowledge.filter(k => k.is_public);
  if (category) results = results.filter(k => k.category === category);
  if (q) results = results.filter(k => k.question_text.toLowerCase().includes(q.toLowerCase()) || k.answer_text.toLowerCase().includes(q.toLowerCase()));
  results = results.sort((a,b) => b.helpful_votes - a.helpful_votes).slice(0, Number(limit));
  res.json({ results, total: results.length });
});

app.post('/api/tenants/knowledge', tenantAuth, (req, res) => {
  const { category, question, answer, isPublic = true } = req.body;
  if (!category || !question || !answer) return res.status(400).json({ error: 'category, question, answer required' });
  const entry = { id: id(), tenant_id: req.tenant.id, category, question_text: question, answer_text: answer, is_public: isPublic, helpful_votes: 0, total_views: 0, created_at: new Date().toISOString() };
  knowledge.push(entry);
  res.status(201).json({ message: '🧠 Added to knowledge commons', entry });
});

app.post('/api/tenants/knowledge/:id/upvote', (req, res) => {
  const entry = knowledge.find(k => k.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });
  entry.helpful_votes++;
  res.json({ message: 'Upvoted', helpful_votes: entry.helpful_votes });
});

// ── Analytics ─────────────────────────────────────────────────────────────────
app.get('/api/analytics', tenantAuth, (req, res) => {
  const tid = req.tenant.id;
  const events = usageEvents.filter(e => e.tenant_id === tid);
  const month = new Date().toISOString().slice(0,7);
  const thisMonth = events.filter(e => e.created_at.startsWith(month));
  res.json({
    tenant: { id: tid, plan: req.tenant.plan },
    this_month: {
      chats:        thisMonth.filter(e=>e.event_type==='chat').length,
      leads:        thisMonth.filter(e=>e.event_type==='lead_capture').length,
      plugin_calls: thisMonth.filter(e=>e.event_type==='plugin_install').length,
      tokens_used:  thisMonth.reduce((s,e)=>s+e.tokens_used,0),
      cost_usd:     +thisMonth.reduce((s,e)=>s+e.cost_usd,0).toFixed(6),
    },
    all_time: { events: events.length },
    installed_plugins: [...(tenantPlugins.get(tid)||[])],
  });
});

app.get('/api/analytics/platform', (req, res) => {
  res.json({
    platform_stats: {
      active_tenants:           tenants.size,
      total_messages_handled:   usageEvents.filter(e=>e.event_type==='chat').length,
      marketplace_plugins:      plugins.length,
      knowledge_commons_entries: knowledge.filter(k=>k.is_public).length,
      total_leads_captured:     leads.length,
      description: 'Powered by NovaSaaS AI OS — scale without hiring',
    }
  });
});

// ── Chat ──────────────────────────────────────────────────────────────────────
app.post('/api/chat', (req, res) => {
  const { messages = [], session_id = id() } = req.body;
  const last = messages[messages.length - 1]?.content || 'Hello';
  const reply = aiReply(last);

  if (!chatLogs.has(session_id)) chatLogs.set(session_id, []);
  chatLogs.get(session_id).push({ role: 'user', content: last }, { role: 'assistant', content: reply });

  const tokenEstimate = Math.round((last.length + reply.length) / 4);
  trackUsage('demo', 'chat', tokenEstimate);

  res.json({ response: reply, session_id, tokens_used: tokenEstimate, cost_usd: +(tokenEstimate * 0.000003).toFixed(6) });
});

// ── Leads ─────────────────────────────────────────────────────────────────────
app.post('/api/leads', (req, res) => {
  const { name, email, session_id } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  const lead = { id: id(), name, email, session_id, captured_at: new Date().toISOString() };
  leads.push(lead);
  trackUsage('demo', 'lead_capture');
  res.status(201).json({ message: '✅ Lead captured', lead });
});

app.get('/api/leads', (req, res) => {
  res.json({ leads: [...leads].reverse(), total: leads.length });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(3000, () => console.log('🚀 NovaSaaS Demo running on http://localhost:3000'));
