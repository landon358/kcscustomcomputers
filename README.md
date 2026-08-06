# KC's Custom Computers — static demo

Plain HTML, CSS and JavaScript. No build step, no dependencies to install.

## Run locally

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

## Host on GitHub Pages

1. Push the contents of this folder to the repository root (or to `/docs`).
2. Settings → Pages → Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The site appears at `https://<user>.github.io/<repo>/`.

`.nojekyll` is included so Pages serves every file as-is. All paths are
relative, so the site works from a project subpath without changes.

## Files

| File | What it is |
|---|---|
| `index.html` | Home. Scroll-driven hero build sequence, pre-built configurator, one-time deals, custom-build section. |
| `shop.html` | Pre-built catalogue with stock states. |
| `product.html` | Product detail. Reads `?id=` from the URL, e.g. `product.html?id=prime-m`. |
| `build-custom.html` | Custom PC configurator. |
| `styles.css` | Site stylesheet. Palette lives in `:root` custom properties. |
| `builder.css` | Configurator and mobile-nav styles. |
| `cart.css` | Cart drawer styles. |
| `shopify-config.js` | **Your store credentials. The only file you need to edit.** |
| `shopify.js` | Storefront API client, product loading, cart state. |
| `cart.js` | Cart drawer UI. Injects its own markup into every page. |
| `products.js` | Fallback catalogue + all presentation detail (specs, fps, copy). |
| `components.js` | Configurator part catalogue. |
| `home.js`, `shop.js`, `product.js`, `builder.js`, `nav.js` | Page logic. |
| `images/`, `media/` | Photography and the two hero clips. |

## Shopify

The site runs headless: this front end is static, Shopify is the commerce
backend, reached over the **Storefront API** from the browser.

| Concern | Where it lives |
|---|---|
| Design, layout, routing | This repo |
| Prices, stock, product images | Shopify, via Storefront API |
| Cart | Shopify `cart` mutations — cart lives on Shopify, only the cart ID is in `localStorage` |
| Checkout and payment | Shopify-hosted, via `cart.checkoutUrl` |
| Customer accounts | Shopify-hosted account pages |
| Custom-build quotes | Formspree (no payment — KC quotes manually) |

**Everything is off until you fill in `shopify-config.js`.** With it blank the
site renders from `products.js` exactly as before, so the demo never breaks.

### Getting the Storefront token

1. Shopify Admin → **Settings** → **Apps and sales channels** → **Develop apps**
2. **Create an app**, name it something like `Storefront`
3. **Configure Storefront API scopes**, tick:
   - `unauthenticated_read_product_listings`
   - `unauthenticated_read_product_inventory`
   - `unauthenticated_write_checkouts`
   - `unauthenticated_read_checkouts`
4. **Install app**, then **API credentials** → copy the **Storefront API access token**
5. Paste it and your `.myshopify.com` domain into `shopify-config.js`

That token is public by design — it is meant to ship in browser JavaScript.
Never put an Admin API token in this repo.

### Product setup

Each Shopify product's **handle** must match the `id` in `products.js`
(`prime-s`, `prime-m`, `deal-850`, …). Shopify then drives price, stock,
images and the variant ID, while `products.js` keeps supplying specs, fps
figures and copy — merged by handle in `shopify.js`.

Tag products `deal` to put them in the one-time-deals grid, and `popular` for
the "most popular" badge. Publish everything to the app's sales channel or the
API returns nothing.

### Custom-build quotes

The configurator has no pricing — it collects a spec and sends it to KC.
Create a form at [formspree.io](https://formspree.io), then put the ID from
its endpoint (`https://formspree.io/f/XXXXXXXX`) into `formspreeId`. Until
that is set the form still confirms to the user and logs the payload to the
console.

### Still to decide

Charging for custom builds needs a Shopify **draft order**, which requires the
Admin API and therefore a server — a Netlify Function with the Admin token in
an environment variable. Not built yet; quotes are manual for now.

## Notes

- Stock state is a single `inStock` boolean per product in `products.js`.
- The hero uses two MP4 clips driven by scroll position, with a hard cut at
  the halfway point. On phones the hero shortens and the component
  annotations are hidden.
- Component photography is manufacturer/retailer product renders. Confirm
  licensing before commercial use.
