/* Product detail page. Reads ?id= from the URL — that id is also the Shopify
 * product handle. Renders immediately from the static catalogue, then repaints
 * with live Shopify price/stock/variant data once it arrives. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var handle = new URLSearchParams(location.search).get('id');
  var p = window.byId(handle);
  var shot = 0;
  var qty = 1;
  var added = false;
  var pending = false;

  /* -------------------------------------------------------- gallery ---- */

  function renderShot() {
    if (!p.images.length) return;
    $('p-shot').src = p.images[shot];
    $('p-shot').alt = p.name;
    $('p-thumbs').innerHTML = p.images.map(function (src, i) {
      return '<button type="button" class="thumb' + (i === shot ? ' is-active' : '') +
        '" data-i="' + i + '"><img src="' + src + '" alt=""></button>';
    }).join('');
  }

  $('p-thumbs').addEventListener('click', function (ev) {
    var t = ev.target.closest('.thumb');
    if (!t) return;
    shot = Number(t.getAttribute('data-i'));
    renderShot();
  });

  /* ------------------------------------------------------ buy module ---- */

    /* Benchmarks, per resolution.
   *
   * 1080p is the set every machine has. 1440p and 4K arrive as KC measures
   * them, so a resolution with no numbers yet still lists the games with muted
   * bars and says what it is waiting for — the switch shows what is coming
   * instead of collapsing to an empty box.
   */
  var RES = [
    ['1080p', 'fps',     ''],
    ['1440p', 'fps1440', '1440p'],
    ['4K',    'fps4k',   '4K']
  ];
  var res = 'fps';

  function renderBench(prod) {
    $('p-res').innerHTML = RES.map(function (r) {
      return '<button type="button" role="tab" class="restab' + (r[1] === res ? ' is-on' : '') +
        '" data-res="' + r[1] + '" aria-selected="' + (r[1] === res) + '">' + r[0] + '</button>';
    }).join('');

    var list = prod[res] || [];
    var noData = !list.length;
    // fall back to the 1080p line-up so the rows stay put across the switch
    if (noData) {
      list = (prod.fps || []).map(function (r) {
        return { label: r.label, text: '', value: null };
      });
    }

    $('p-bench').innerHTML = bars(list, 'Not measured yet');

    var label = (RES.filter(function (r) { return r[1] === res; })[0] || [])[2];
    // KC's own note if he wrote one; otherwise say only what we actually know
    var measured = prod.benchNote || 'Measured on the bench.';
    // KC's own status for this resolution beats ours; he wrote "Untested",
    // not "queued for testing", and only he knows which is true.
    var his = (prod.fpsNotes || {})[res];
    $('p-bench-note').textContent = list.length === 0
      ? 'No benchmarks recorded for this build yet.'
      : (noData
          ? (his || 'Not yet tested at ' + label + '.')
          : measured);

    // 3DMark and similar: different scale entirely, so its own block or nothing
    var box = $('p-scores');
    if (box) {
      var sc = prod.scores || [];
      box.hidden = !sc.length;
      if (sc.length) {
        $('p-scores-list').innerHTML = sc.map(function (r) {
          return '<dl class="spec"><dt>' + esc(r.label) + '</dt><dd>' + esc(r.text) + '</dd></dl>';
        }).join('');
      }
    }
  }

  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* Bars are sized by the parsed number but labelled with what KC wrote, so
     "~240+FPS" reads as he meant it rather than as a bare 240. */
  function bars(list, emptyText) {
    var max = list.reduce(function (a, r) { return Math.max(a, r.value || 0); }, 1);
    return list.map(function (r, i) {
      var has = typeof r.value === 'number' && isFinite(r.value);
      return '<div class="bench' + (has ? '' : ' is-pending') + '">' +
        '<span class="bench__game">' + esc(r.label) + '</span>' +
        '<span class="bench__bar' + (i % 3 === 1 ? ' bench__bar--2' : i % 3 === 2 ? ' bench__bar--3' : '') +
        '" style="flex:0 1 ' + (has ? Math.round(r.value / max * 210) : 210) + 'px"></span>' +
        '<span class="bench__fps">' + esc(r.text || emptyText) + '</span></div>';
    }).join('');
  }

  // the tabs are rebuilt on every render, so listen on the container
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('.restab');
    if (!t) return;
    res = t.getAttribute('data-res');
    renderBench(p);
  });

  function renderBuy() {
    var buy = $('p-buy'), note = $('p-note');

    if (!p.inStock) {
      buy.textContent = 'Out of stock';
      buy.className = 'btn btn--disabled';
      buy.disabled = true;
      note.textContent = (p.stockNote || 'Currently unavailable') + ' — email to be notified when it is back.';
      note.className = 'buynote is-out';
      return;
    }

    buy.disabled = pending;
    buy.className = 'btn ' + (pending ? 'btn--disabled' : 'btn--primary');
    buy.textContent = pending ? 'Adding…' : (added ? 'Added to cart ✓' : 'Add to cart');
    buy.style.background = added && !pending ? 'var(--ink)' : '';

    note.className = 'buynote';
    if (added) {
      note.textContent = 'In your cart — open the cart to check out.';
    } else if (!window.Cart.enabled) {
      note.textContent = 'Demo mode · connect Shopify in shopify-config.js to take orders';
    } else {
      note.textContent = 'Ready to ship · local pickup in 24 hours';
    }
    $('q-val').textContent = qty;
  }

  $('q-inc').addEventListener('click', function () { qty = Math.min(5, qty + 1); added = false; renderBuy(); });
  $('q-dec').addEventListener('click', function () { qty = Math.max(1, qty - 1); added = false; renderBuy(); });

  $('p-buy').addEventListener('click', function () {
    if (!p.inStock || pending) return;

    // Not connected yet — open the drawer, which explains what is missing.
    if (!window.Cart.enabled) {
      added = true;
      renderBuy();
      window.CartUI.open();
      return;
    }

    pending = true;
    renderBuy();

    window.Cart.add(p.variantId, qty)
      .then(function () {
        added = true;
        window.CartUI.open();
      })
      .catch(function (err) {
        console.error('[cart]', err.message);
        $('p-note').textContent = 'Could not add to cart — ' + err.message;
        $('p-note').className = 'buynote is-out';
      })
      .then(function () {
        pending = false;
        renderBuy();
      });
  });

  /* ------------------------------------------------------------ seo ---- */

  /* product.html is one template rendering whichever machine ?id= names, so
     its title, description, canonical and Product schema have to be written
     per machine at runtime. Google renders JavaScript before indexing, so
     this is seen — but the static head still carries a sensible default in
     case a crawler that does not run JS gets here first. */
  var SEO_BASE = 'https://kcscustomcomputers.netlify.app';

  function setMeta(sel, attr, val) {
    var el = document.head.querySelector(sel);
    if (el) el.setAttribute(attr, val);
  }

  function paintSeo(p) {
    var url = SEO_BASE + '/product?id=' + encodeURIComponent(p.id);
    // Build from the headline parts, then drop whole specs until the closing
    // sentence fits. A hard slice cut mid-word ("...tested in Walled"), which
    // is what actually shows in a search result.
    var TAIL = '. Built and bench tested in Walled Lake, Michigan.';
    var picked = p.specs.slice(0, 4);
    var desc;
    do {
      var specs = picked.map(function (s) { return s[0] + ' ' + s[1]; }).join(', ');
      desc = p.name + ' — ' + (specs || 'hand-built gaming PC') + TAIL;
      picked = picked.slice(0, -1);
    } while (desc.length > 158 && picked.length);
    var title = p.name + ' | ' + window.money(p.price) + " | KC's Custom Computers";

    document.title = title;
    setMeta('meta[name="description"]', 'content', desc);
    setMeta('link[rel="canonical"]', 'href', url);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', desc);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', desc);
    if (p.images[0]) {
      var img = p.images[0].indexOf('http') === 0 ? p.images[0] : SEO_BASE + '/' + p.images[0];
      setMeta('meta[property="og:image"]', 'content', img);
      setMeta('meta[name="twitter:image"]', 'content', img);
    }

    var ld = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      description: desc,
      image: p.images.map(function (i) {
        return i.indexOf('http') === 0 ? i : SEO_BASE + '/' + i;
      }),
      brand: { '@type': 'Brand', name: "KC's Custom Computers" },
      offers: {
        '@type': 'Offer',
        url: url,
        price: String(p.price),
        priceCurrency: p.currency || 'USD',
        // stock is read live from Shopify, so this is never a stale claim
        availability: p.inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: "KC's Custom Computers" }
      }
    };
    if (p.specs.length) {
      ld.additionalProperty = p.specs.map(function (s) {
        return { '@type': 'PropertyValue', name: s[0], value: s[1] };
      });
    }

    var tag = document.getElementById('product-schema');
    if (!tag) {
      tag = document.createElement('script');
      tag.type = 'application/ld+json';
      tag.id = 'product-schema';
      document.head.appendChild(tag);
    }
    tag.textContent = JSON.stringify(ld);
  }

  /* --------------------------------------------------------- repaint ---- */

  function paint() {
    document.title = p.name + " — KC's Custom Computers";
    $('crumb-name').textContent = p.name;
    $('p-kind').textContent = p.kind === 'deal' ? 'One-time deal' : 'Prime Series';
    $('p-name').textContent = p.name;
    $('p-tagline').textContent = p.tagline;
    $('p-price').textContent = window.money(p.price);
    // an empty paragraph still takes its margin, so hide it outright
    var blurb = $('p-blurb');
    blurb.textContent = p.blurb || '';
    blurb.hidden = !p.blurb;

    var stock = $('p-stock');
    stock.textContent = p.inStock ? 'In stock' : 'Out of stock';
    stock.className = 'pill ' + (p.inStock ? 'pill--blue' : 'pill--out');

    $('p-specs').innerHTML = p.specs.map(function (s) {
      return '<dl class="spec"><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></dl>';
    }).join('');

    renderBench(p);

    $('p-related').innerHTML = window.PRODUCTS
      .filter(function (x) { return x.id !== p.id; })
      .slice(0, 4)
      .map(function (x) {
        return '<a class="card' + (x.inStock ? '' : ' card--out') + '" href="product.html?id=' + x.id + '">' +
          '<span class="card__shot"><img src="' + x.images[0] + '" alt="' + x.name + '"></span>' +
          '<span class="card__body">' +
            '<span class="card__title"><span class="name">' + x.name + '</span>' +
            '<span class="price">' + window.money(x.price) + '</span></span>' +
            '<span class="stock' + (x.inStock ? '' : ' is-out') + '">' + (x.inStock ? 'In stock' : 'Out of stock') + '</span>' +
          '</span></a>';
      }).join('');

    renderShot();
    renderBuy();
    paintSeo(p);
  }

  paint();

  window.Shopify.loadProducts().then(function (list) {
    window.PRODUCTS = list;
    var fresh = list.filter(function (x) { return x.id === handle; })[0];
    if (fresh) { p = fresh; shot = 0; }
    paint();
  });
})();
