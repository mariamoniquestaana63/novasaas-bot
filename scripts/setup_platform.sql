-- Multi-tenancy
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','pro','enterprise')),
  api_key TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Usage metering (near-zero marginal cost requires precise metering)
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'chat', 'lead_capture', 'plugin_call', 'api_call'
  tokens_used INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan limits
CREATE TABLE IF NOT EXISTS plan_limits (
  plan TEXT PRIMARY KEY,
  monthly_messages INTEGER NOT NULL,
  monthly_leads INTEGER NOT NULL,
  max_agents INTEGER NOT NULL,
  marketplace_plugins INTEGER NOT NULL,
  social_sharing BOOLEAN DEFAULT false,
  custom_branding BOOLEAN DEFAULT false
);

INSERT INTO plan_limits VALUES
  ('starter', 1000, 100, 2, 3, false, false),
  ('pro', 10000, 1000, 5, 20, true, true),
  ('enterprise', -1, -1, -1, -1, true, true)
ON CONFLICT (plan) DO NOTHING;

-- Marketplace: plugin/integration listings
CREATE TABLE IF NOT EXISTS marketplace_plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'crm', 'analytics', 'communication', 'ai', 'automation'
  author_tenant_id UUID REFERENCES tenants(id),
  config_schema JSONB DEFAULT '{}', -- JSON Schema for plugin config
  endpoint_url TEXT, -- webhook/API endpoint
  is_verified BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  install_count INTEGER DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant plugin installations
CREATE TABLE IF NOT EXISTS tenant_plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  plugin_id UUID REFERENCES marketplace_plugins(id),
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, plugin_id)
);

-- Social knowledge layer: shared insights across tenants (opt-in)
CREATE TABLE IF NOT EXISTS knowledge_commons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  category TEXT NOT NULL, -- 'support', 'sales', 'onboarding', 'technical'
  question_embedding vector(1536),
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  helpful_votes INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for vector search on commons
CREATE INDEX IF NOT EXISTS knowledge_commons_embedding_idx ON knowledge_commons
  USING ivfflat (question_embedding vector_cosine_ops) WITH (lists = 100);

-- Aggregate usage per tenant per month
CREATE OR REPLACE VIEW tenant_usage_summary AS
SELECT
  tenant_id,
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) FILTER (WHERE event_type = 'chat') AS chat_count,
  COUNT(*) FILTER (WHERE event_type = 'lead_capture') AS lead_count,
  SUM(tokens_used) AS total_tokens,
  SUM(cost_usd) AS total_cost_usd
FROM usage_events
GROUP BY tenant_id, DATE_TRUNC('month', created_at);

-- RPC: search knowledge commons by vector similarity
CREATE OR REPLACE FUNCTION search_knowledge_commons(
  query_embedding vector(1536),
  match_count INTEGER DEFAULT 5,
  min_votes INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  category TEXT,
  question_text TEXT,
  answer_text TEXT,
  helpful_votes INTEGER,
  similarity FLOAT
)
LANGUAGE SQL STABLE AS $$
  SELECT id, category, question_text, answer_text, helpful_votes,
    1 - (question_embedding <=> query_embedding) AS similarity
  FROM knowledge_commons
  WHERE is_public = true AND helpful_votes >= min_votes
  ORDER BY question_embedding <=> query_embedding
  LIMIT match_count;
$$;
