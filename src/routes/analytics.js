const { Router } = require('express');
const { createClient } = require('@supabase/supabase-js');
const { tenantAuth } = require('../middleware/tenantAuth');

const router = Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Per-tenant analytics dashboard data
router.get('/', tenantAuth, async (req, res) => {
  const tenantId = req.tenant.id;
  const { months = 3 } = req.query;

  const [usageSummary, recentEvents, topLeads] = await Promise.all([
    supabase
      .from('tenant_usage_summary')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('month', { ascending: false })
      .limit(Number(months)),

    supabase
      .from('usage_events')
      .select('event_type, tokens_used, cost_usd, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100),

    supabase
      .from('leads')
      .select('name, email, session_id, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20)
  ]);

  // Compute growth rate
  const summary = usageSummary.data || [];
  const growthRate = summary.length >= 2
    ? ((summary[0].chat_count - summary[1].chat_count) / (summary[1].chat_count || 1) * 100).toFixed(1)
    : null;

  res.json({
    tenant: { id: tenantId, plan: req.tenant.plan },
    usage_summary: summary,
    growth_rate_pct: growthRate,
    recent_events: recentEvents.data || [],
    top_leads: topLeads.data || [],
    cost_estimate: {
      this_month_usd: summary[0]?.total_cost_usd || 0,
      per_message_usd: summary[0]?.chat_count
        ? (summary[0].total_cost_usd / summary[0].chat_count).toFixed(6)
        : 0
    }
  });
});

// Platform-wide aggregate stats (public, for marketing)
router.get('/platform', async (req, res) => {
  const [tenantCount, messageCount, pluginCount, knowledgeCount] = await Promise.all([
    supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('usage_events').select('id', { count: 'exact', head: true }).eq('event_type', 'chat'),
    supabase.from('marketplace_plugins').select('id', { count: 'exact', head: true }).eq('is_public', true),
    supabase.from('knowledge_commons').select('id', { count: 'exact', head: true }).eq('is_public', true)
  ]);

  res.json({
    platform_stats: {
      active_tenants: tenantCount.count || 0,
      total_messages_handled: messageCount.count || 0,
      marketplace_plugins: pluginCount.count || 0,
      knowledge_commons_entries: knowledgeCount.count || 0,
      description: 'Powered by NovaSaaS AI OS — scale without hiring'
    }
  });
});

module.exports = router;
