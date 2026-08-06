/* Shopify connection settings.
 *
 * Fill these in and the whole site switches to live Shopify data: prices,
 * stock, cart and checkout. Leave them blank and the site runs off
 * products.js exactly as it does now, so the demo never breaks.
 *
 * The Storefront token is PUBLIC by design — it is meant to ship in
 * browser JavaScript. Do not put an Admin API token in this file.
 */
window.SHOPIFY_CONFIG = {
  // Your permanent store domain, e.g. 'kcs-custom-computers.myshopify.com'
  // (not a custom domain — this must be the myshopify.com one).
  domain: '',

  // Storefront API access token. Admin → Settings → Apps and sales channels
  // → Develop apps → your app → API credentials → Storefront API access token.
  storefrontToken: '',

  // Storefront API version. Shopify supports each for 12 months.
  apiVersion: '2026-01',

  // Formspree form ID for the custom-build quote form, e.g. 'xvgpwkqz'.
  // From your form's endpoint: https://formspree.io/f/XXXXXXXX
  formspreeId: '',

  // Where the account icon points. With Shopify's new customer accounts this
  // is https://shopify.com/<store-id>/account — copy it from Admin →
  // Settings → Customer accounts. Falls back to /account on your domain.
  accountUrl: ''
};
