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

    var rows = prod[res] || [];
    var noData = !rows.length;
    // fall back to the 1080p line-up so the rows stay put across the switch
    if (noData) {
      rows = (prod.fps || []).map(function (f) { return [f[0], null]; });
    }

    var max = rows.reduce(function (a, f) { return Math.max(a, f[1] || 0); }, 1);
    $('p-bench').innerHTML = rows.map(function (f, i) {
      var has = typeof f[1] === 'number';
      return '<div class="bench' + (has ? '' : ' is-pending') + '">' +
        '<span class="bench__game">' + f[0] + '</span>' +
        '<span class="bench__bar' + (i === 1 ? ' bench__bar--2' : i === 2 ? ' bench__bar--3' : '') +
        '" style="flex:0 1 ' + (has ? Math.round(f[1] / max * 210) : 210) + 'px"></span>' +
        '<span class="bench__fps">' + (has ? f[1] + ' fps' : 'Not measured yet') + '</span></div>';
    }).join('');

    var label = (RES.filter(function (r) { return r[1] === res; })[0] || [])[2];
    $('p-bench-note').textContent = rows.length === 0
      ? 'No benchmarks recorded for this build yet.'
      : (noData
          ? 'Numbers pending — this machine is queued for ' + label + ' testing.'
          : 'Averages over a 10-minute run, high preset, no upscaling.');
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

  /* --------------------------------------------------------- repaint ---- */

  function paint() {
    document.title = p.name + " — KC's Custom Computers";
    $('crumb-name').textContent = p.name;
    $('p-kind').textContent = p.kind === 'deal' ? 'One-time deal' : 'Prime Series';
    $('p-name').textContent = p.name;
    $('p-tagline').textContent = p.tagline;
    $('p-price').textContent = window.money(p.price);
    $('p-blurb').textContent = p.blurb;

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
  }

  paint();

  window.Shopify.loadProducts().then(function (list) {
    window.PRODUCTS = list;
    var fresh = list.filter(function (x) { return x.id === handle; })[0];
    if (fresh) { p = fresh; shot = 0; }
    paint();
  });
})();
