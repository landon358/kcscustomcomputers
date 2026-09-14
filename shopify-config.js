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
    prime:     'pre-builts',   // "AMD Prime"       -> shop grid + home configurator
    deal:      'my-pcs',       // "One Time Deals"  -> the one-time deals row
    accessory: 'accessories'   // "Accessories"     -> accessory cards + add-ons
  },

  /* Every OTHER collection in the store becomes a section of its own, so a
   * new category in Admin is a new section on the site with no code change.
   * See "Adding a collection" below.
   *
   * Collections that should never become one. `frontpage` is created by
   * Shopify on every store — it is not a category anyone made, and giving it
   * a heading would invent one. Add a handle here to retire a section without
   * deleting the collection.
   */
  hiddenCollections: ['frontpage'],

  /* How many of KC's own collections the home page will show at once. The
   * home page is a shop window, not the shop: past three extra rows the
   * pre-built configurator and the deals row stop being what people see. If
   * more collections than this have a home_order, the lowest numbers win and
   * the console says which were left off.
   */
  homeMaxSections: 3,

  /* ---------------------------------------------------------------------
   * Adding a product without touching this repo
   *
   * 1. Create it in Shopify and add it to one of the collections above —
   *    a product in neither will not appear on the site at all.
   * 2. Give it these metafields, namespace `specs`. Each one must have
   *    "Storefront access" ticked in Admin or it reads back as null:
   *
   *      cpu  motherboard  cooler  gpu  ram  storage  psu  case  os
   *          — one line of text each, e.g. ram = "32GB DDR5-6000"
   *      best_for
   *          — the tagline, the line under the product name. It is the most
   *            visible of these, so it wants a sentence, not a category.
   *      fps  fps_1440  fps_4k        (multi-line text)
   *          — benchmark bars, one field per resolution tab, written the way
   *            KC already writes them, one game per line:
   *                Fortnite: ~240+FPS
   *                Cyberpunk 2077 RTX: ~ 135+FPS
   *            Only fps (1080p) is needed. Put prose in one of the others —
   *            "Untested" — and that shows as the note for that tab instead
   *            of the site guessing at a status.
   *      bench_note
   *          — how the numbers were taken, e.g. "Tested at 1080p, High".
   *            Nothing is claimed about method unless this says so.
   *      benchmark_scores               (multi-line text)
   *          — 3DMark and anything else that is not a frame rate, same one
   *            per line. Renders as its own block; these share no scale with
   *            fps and would flatten the bars if mixed in.
   *
   * Anything left blank falls back to that product's entry in products.js,
   * matched through the handles map below. A product with neither still
   * sells fine — it just shows an empty spec table.
   * ------------------------------------------------------------------- */

  /* ---------------------------------------------------------------------
   * Adding an accessory — stands, cables, anything that is not a PC
   *
   * 1. Create the product as normal. Its description IS shown on its product
   *    page, unlike a PC's, so write it as a sentence or two for a buyer.
   * 2. Put it in the collection called "Accessories". The site knows it by
   *    its handle, `accessories` — Shopify makes that from the name, so keep
   *    the name or the handle will change with it. Being in this collection
   *    is what makes it an accessory: no spec table, no benchmarks, and
   *    offered as an add-on on every PC's product page.
   * 3. Colours, lengths and so on are Shopify OPTIONS, not metafields:
   *    Admin -> the product -> Variants -> "Add options like size or color".
   *    Name the option "Color" and give each value a plain colour name —
   *    White, Black, Red — and the picker shows a swatch of that colour next
   *    to the name. Anything else, like "Length: 60cm", shows as text.
   *    Give each variant its own photo and the page switches to it when that
   *    colour is picked.
   *
   * The Accessories collection is a normal shop section, so shop_order and
   * home_order from the next note work on it too. A stand he ALSO files under
   * another collection still renders as an accessory there.
   *
   * On a PC's product page, up to four in-stock accessories are offered as
   * add-ons, cheapest first, with a link to the rest. Out-of-stock ones are
   * left off rather than shown and disabled.
   * ------------------------------------------------------------------- */

  /* ---------------------------------------------------------------------
   * Adding a collection — a new section of the shop
   *
   * 1. Products -> Collections -> Create collection. Its NAME becomes the
   *    heading and its DESCRIPTION becomes the line underneath, so both are
   *    worth writing properly. Add the machines that belong in it.
   * 2. Publish it to the Online Store sales channel. An unpublished
   *    collection is invisible to this site, exactly like an unpublished
   *    product.
   *
   * That is enough. It appears on the shop page on the next page load.
   *
   * 3. To put it on the HOME page as well, give the collection a metafield —
   *    Settings -> Custom data -> Collections:
   *
   *      home_order   (integer)  its position on the home page. 1 sits
   *                              directly under the one-time deals, 2 under
   *                              that, and so on. LEAVE IT EMPTY and the
   *                              collection stays on the shop page only —
   *                              which is the default on purpose, so a
   *                              half-finished category cannot appear on the
   *                              front page by accident.
   *      shop_order   (integer)  its position on the shop page. This one
   *                              works on EVERY section there, AMD Prime and
   *                              One Time Deals included, so the whole page
   *                              runs 1, 2, 3... Sections without a number go
   *                              after the numbered ones. Two collections
   *                              given the same number sit in alphabetical
   *                              order. "Nothing here quite fits?" is always
   *                              last. (On the HOME page, AMD Prime and One
   *                              Time Deals still have fixed spots.)
   *      eyebrow      (text)     the small line above the heading, e.g.
   *                              "New this month". Optional.
   *
   *    Every one of these needs "Storefront access" ticked, same as the
   *    product metafields. Without it the field reads back as empty and the
   *    collection quietly behaves as though you never set it.
   *
   * Notes
   *   - An empty collection renders nothing at all. No heading over a blank
   *     row, so a category can be created before it is filled.
   *   - A machine may sit in several collections. It is listed in each, and
   *     the Pre-Builts and One Time Deals collections still decide what the
   *     configurator and the deals row show.
   *   - Products inside a section run in Shopify's manual order, so dragging
   *     them around in Admin reorders the site.
   * ------------------------------------------------------------------- */

  /* The live products were listed before this site existed, so their handles
   * do not match the catalogue ids in products.js. This maps one to the other.
   * Shopify stays authoritative for price, stock and variant IDs; products.js
   * keeps the specs, benchmarks and copy, merged in by the id on the right.
   *
   * Only the five Prime machines are mapped. The one-time deals deliberately
   * are not: KC relists those under whatever handle is free, so a slug that
   * meant one machine last month means another today, and pinning a catalogue
   * entry to it produced cards naming a machine that was not the one for sale.
   * Deals are described entirely by their Shopify metafields.
   *
   * Handles come from Admin → Products → the product's URL slug. If you
   * relist a Prime under a new handle, update it here.
   */
  handles: {
    'beginner-build':                          'prime-s',      // Prime S      $1300
    'beginner':                                'prime-s-pro',  // Prime S Pro  $1400
    'beginner-build-copy':                     'prime-m',      // Prime M      $1900
    'intermediate':                            'prime-m-pro',  // Prime M Pro  $2000
    'intermediate-build-copy':                 'prime-x'       // Prime X      $2550
  }
};
