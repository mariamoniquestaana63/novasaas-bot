#!/bin/bash
set -e

echo "=== Gravia SaaS Deploy ==="
echo ""

# 1. Deploy backend to Railway
echo "1/2 Deploying backend to Railway..."
cd "$(dirname "$0")/backend"

if ! command -v railway &>/dev/null; then
  npm install -g @railway/cli
fi

railway login
railway init --name gravia-backend
railway up --detach

BACKEND_URL=$(railway domain 2>/dev/null || echo "")
if [ -z "$BACKEND_URL" ]; then
  railway domain generate
  BACKEND_URL=$(railway domain)
fi
BACKEND_URL="https://$BACKEND_URL"
echo "Backend URL: $BACKEND_URL"

railway variables set \
  PORT=4000 \
  SUPABASE_URL="$(grep ^SUPABASE_URL .env | cut -d= -f2-)" \
  SUPABASE_ANON_KEY="$(grep ^SUPABASE_ANON_KEY .env | cut -d= -f2-)" \
  SUPABASE_SERVICE_KEY="$(grep ^SUPABASE_SERVICE_KEY .env | cut -d= -f2-)" \
  STRIPE_SECRET_KEY="$(grep ^STRIPE_SECRET_KEY .env | cut -d= -f2-)" \
  STRIPE_WEBHOOK_SECRET="$(grep ^STRIPE_WEBHOOK_SECRET .env | cut -d= -f2-)" \
  STRIPE_PRICE_STARTER="$(grep ^STRIPE_PRICE_STARTER .env | cut -d= -f2-)" \
  STRIPE_PRICE_PRO="$(grep ^STRIPE_PRICE_PRO .env | cut -d= -f2-)" \
  STRIPE_PRICE_ELITE="$(grep ^STRIPE_PRICE_ELITE .env | cut -d= -f2-)"

echo "Backend deployed ✅"

# 2. Deploy frontend to Vercel
echo "2/2 Deploying frontend to Vercel..."
cd "$(dirname "$0")/frontend"

if ! command -v vercel &>/dev/null; then
  npm install -g vercel
fi

vercel --prod \
  -e VITE_SUPABASE_URL="$(grep ^VITE_SUPABASE_URL .env | cut -d= -f2-)" \
  -e VITE_SUPABASE_ANON_KEY="$(grep ^VITE_SUPABASE_ANON_KEY .env | cut -d= -f2-)" \
  -e VITE_STRIPE_PUBLISHABLE_KEY="$(grep ^VITE_STRIPE_PUBLISHABLE_KEY .env | cut -d= -f2-)" \
  -e VITE_API_URL="$BACKEND_URL"

echo "Frontend deployed ✅"
echo ""
echo "Last step: Add Stripe webhook"
echo "  URL: $BACKEND_URL/api/stripe/webhook"
echo "  Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted"
echo "  Copy whsec_... → update STRIPE_WEBHOOK_SECRET in Railway dashboard"
