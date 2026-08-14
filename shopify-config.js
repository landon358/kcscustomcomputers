/* Shopify connection settings.
 *
 * With these filled in the site runs on live Shopify data: prices, stock,
 * cart and checkout. Blank them out and it falls back to products.js, so the
 * demo never breaks.
 *
 * The Storefront token is PUBLIC by design — it is meant to ship in browser
 * JavaScript and is scoped to reading published products and driving a cart.
 * Do not put an Admin API token in this file.
 */
window.SHOPIFY_CONFIG = {
  // Permanent store domain (not the custom domain).
  domain: 'kccustomcomputers.myshopify.com',

  // Storefront API access token. Admin → Settings → Apps and sales channels
  // → Develop apps → your app → API credentials → Storefront API access token.
  storefrontToken: 'e6b28bf16fd7601c188238a0e8bec9f0',

  // Storefront API version. Shopify supports each for 12 months.
  apiVersion: '2026-01',

  // The public storefront, used for the custom-build quote form. That form
  // posts to Shopify's own contact endpoint on this domain, so a build request
  // arrives in the same inbox as every other message from the contact page —
  // no third-party form service in the middle.
  storeUrl: 'https://kcscustomcomputers.com',

  // Override only if the contact form ever moves off /contact.
  contactUrl: '',

  // Where the account icon points. With Shopify's new customer accounts this
  // is https://shopify.com/<store-id>/account — copy it from Admin →
  // Settings → Customer accounts. Blank falls back to /account on the store
  // domain, which redirects to whichever login the store has enabled.
  accountUrl: '',

  /* Which collection feeds which section of the site. Membership in Shopify
   * decides where a machine appears, so listing a new deal in Admin is enough
   * — no code change here. Both are read in Shopify's manual sort order, so
   * dragging products around in Admin reorders the site.
   */
  collections: {
    prime: 'pre-builts',   // "Pre-Builts"      -> shop grid + home configurator
    deal:  'my-pcs'        // "One Time Deals"  -> the one-time deals row
  },

  /* ---------------------------------------------------------------------
   * Adding a product without touching this repo
   *
   * 1. Create it in Shopify and add it to one of the collections above —
   *    a product in neither will not appear on the site at all.
   * 2. Give it these metafields, namespace `specs`. Each one must have
   *    "Storefront access" ticked in Admin or it reads back as null:
   *
   *      cpu  cooler  gpu  ram  storage  psu  case  os
   *          — one line of text each, e.g. ram = "32GB DDR5-6000"
   *      best_for
   *          — the tagline, e.g. "The one most people should buy."
   *      fps  fps_1440  fps_4k
   *          — benchmark bars, one field per resolution tab on the product
   *            page, each written as "Fortnite:215, CS2:300, Warzone:172".
   *            Only fps (1080p) is needed. A resolution left blank shows its
   *            games with muted bars and "queued for 1440p testing", so the
   *            tab is honest rather than empty — fill it in when the numbers
   *            exist and it starts showing them.
   *
   * Anything left blank falls back to that product's entry in products.js,
   * matched through the handles map below. A product with neither still
   * sells fine — it just shows an empty spec table.
   * ------------------------------------------------------------------- */

  /* The live products were listed before this site existed, so their handles
   * do not match the catalogue ids in products.js. This maps one to the other.
   * Shopify stays authoritative for price, stock and variant IDs; products.js
   * keeps the specs, benchmarks and copy, merged in by the id on the right.
   *
   * Handles come from Admin → Products → the product's URL slug. If you
   * relist a machine under a new handle, update it here.
   */
  handles: {
    'beginner-build':                          'prime-s',      // Prime S      $1300
    'beginner':                                'prime-s-pro',  // Prime S Pro  $1400
    'beginner-build-copy':                     'prime-m',      // Prime M      $1900
    'intermediate':                            'prime-m-pro',  // Prime M Pro  $2000
    'intermediate-build-copy':                 'prime-x',      // Prime X      $2550
    'ryzen-7-5800x3d-2070-super-gaming-pc':    'deal-850',     // 5600X/4060    $850
    'intel-i7-12700k-rtx-2070-super':          'deal-1150',    // 7500X3D/4060 $1150
    'ryzen-9-9900x-rtx-5070-ti-custom-build':  'deal-1350',    // 7500X3D/3080 $1350
    'ryzen-7-7800x3d-rtx-5070':                'deal-2100'     // 7800X3D/5070 $2100
  }
};
