/* Product detail page. Reads ?id= from the URL and renders from products.js. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var p = window.byId(new URLSearchParams(location.search).get('id'));
  var shot = 0;
  var qty = 1;
  var added = false;

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

  /* -------------------------------------------------------- gallery ---- */

  function renderShot() {
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

  /* ---------------------------------------------------------- specs ---- */

  $('p-specs').innerHTML = p.specs.map(function (s) {
    return '<dl class="spec"><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></dl>';
  }).join('');

  var max = p.fps.reduce(function (a, f) { return Math.max(a, f[1]); }, 1);
  $('p-bench').innerHTML = p.fps.map(function (f, i) {
    return '<div class="bench"><span class="bench__game">' + f[0] + '</span>' +
      '<span class="bench__bar' + (i === 1 ? ' bench__bar--2' : i === 2 ? ' bench__bar--3' : '') +
      '" style="flex:0 1 ' + Math.round(f[1] / max * 210) + 'px"></span>' +
      '<span class="bench__fps">' + f[1] + ' fps</span></div>';
  }).join('');

  /* ------------------------------------------------------ buy module ---- */

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

    buy.textContent = added ? 'Added to cart ✓' : 'Add to cart';
    buy.className = 'btn btn--primary';
    buy.style.background = added ? 'var(--ink)' : '';
    note.textContent = added
      ? 'In your cart — checkout handled by Shopify.'
      : 'Ready to ship · local pickup in 24 hours';
    note.className = 'buynote';
    $('q-val').textContent = qty;
  }

  $('q-inc').addEventListener('click', function () { qty = Math.min(5, qty + 1); added = false; renderBuy(); });
  $('q-dec').addEventListener('click', function () { qty = Math.max(1, qty - 1); added = false; renderBuy(); });
  $('p-buy').addEventListener('click', function () {
    if (!p.inStock) return;
    added = true;
    renderBuy();
    // Shopify: POST { id: variantId, quantity: qty } to /cart/add.js here
  });

  /* -------------------------------------------------------- related ---- */

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
})();
