const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const plugins = [
  {
    slug: 'hubspot-crm',
    name: 'HubSpot CRM',
    description: 'Sync leads and contacts to HubSpot automatically when captured.',
    category: 'crm',
    config_schema: { type: 'object', properties: { api_key: { type: 'string', description: 'HubSpot Private App token' } }, required: ['api_key'] },
    is_verified: true,
    is_public: true
  },
  {
    slug: 'slack-notifications',
    name: 'Slack Notifications',
    description: 'Get notified in Slack when a lead is captured or escalation is needed.',
    category: 'communication',
    config_schema: { type: 'object', properties: { webhook_url: { type: 'string', description: 'Slack Incoming Webhook URL' } }, required: ['webhook_url'] },
    is_verified: true,
    is_public: true
  },
  {
    slug: 'stripe-billing',
    name: 'Stripe Billing',
    description: 'Handle subscription changes and payment inquiries via AI.',
    category: 'automation',
    config_schema: { type: 'object', properties: { secret_key: { type: 'string' }, webhook_secret: { type: 'string' } }, required: ['secret_key'] },
    is_verified: true,
    is_public: true
  },
  {
    slug: 'google-analytics',
    name: 'Google Analytics 4',
    description: 'Track chat widget engagement events in GA4.',
    category: 'analytics',
    config_schema: { type: 'object', properties: { measurement_id: { type: 'string' } }, required: ['measurement_id'] },
    is_verified: true,
    is_public: true
  },
  {
    slug: 'openai-fallback',
    name: 'OpenAI Fallback',
    description: 'Route to GPT-4 when Claude is unavailable for 99.99% uptime.',
    category: 'ai',
    config_schema: { type: 'object', properties: { api_key: { type: 'string' } }, required: ['api_key'] },
    is_verified: true,
    is_public: true
  },
  {
    slug: 'zendesk-tickets',
    name: 'Zendesk Tickets',
    description: 'Auto-create Zendesk tickets when AI cannot resolve an issue.',
    category: 'crm',
    config_schema: { type: 'object', properties: { subdomain: { type: 'string' }, email: { type: 'string' }, api_token: { type: 'string' } }, required: ['subdomain', 'email', 'api_token'] },
    is_verified: false,
    is_public: true
  }
];

async function main() {
  const { data, error } = await supabase
    .from('marketplace_plugins')
    .upsert(plugins, { onConflict: 'slug' })
    .select();
  if (error) { console.error('Seed error:', error); process.exit(1); }
  console.log(`Seeded ${data.length} marketplace plugins`);
}

main();
