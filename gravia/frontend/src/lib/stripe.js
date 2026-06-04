export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "";

// Lazy-load Stripe.js only when needed (avoids loading on every page)
let stripePromise = null;
export function getStripe() {
  if (!stripePromise && STRIPE_PUBLISHABLE_KEY) {
    stripePromise = import("@stripe/stripe-js").then(({ loadStripe }) =>
      loadStripe(STRIPE_PUBLISHABLE_KEY)
    );
  }
  return stripePromise;
}
