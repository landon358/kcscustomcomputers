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
| `products.js` | Pre-built catalogue. `inStock` drives the out-of-stock state. |
| `components.js` | Configurator part catalogue. |
| `home.js`, `shop.js`, `product.js`, `builder.js`, `nav.js` | Page logic. |
| `images/`, `media/` | Photography and the two hero clips. |

## Hooks left for the backend

Search the source for these:

- **`BACKEND HOOK`** in `builder.js` — where the custom-build quote payload
  should be POSTed (Shopify app proxy, Netlify function, Formspree, etc).
  It currently logs the payload to the console.
- **Cart and account links** — `href=""` on the two nav icon buttons, marked
  with a comment in every page. Point them at `/cart` and `/account`.
- **Add to cart** in `product.js` — currently sets local state only.

## Notes

- Stock state is a single `inStock` boolean per product in `products.js`.
- The hero uses two MP4 clips driven by scroll position, with a hard cut at
  the halfway point. On phones the hero shortens and the component
  annotations are hidden.
- Component photography is manufacturer/retailer product renders. Confirm
  licensing before commercial use.
