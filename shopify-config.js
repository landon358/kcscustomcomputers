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

  // Formspree form ID for the custom-build quote form, e.g. 'xvgpwkqz'.
  // From your form's endpoint: https://formspree.io/f/XXXXXXXX
  formspreeId: '',

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
