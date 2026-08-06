/* Shop Pre-Built: renders the catalogue. `inStock` is the Shopify-driven flag. */
(function () {
  'use strict';

  var pick = function (p, key) {
    var row = p.specs.filter(function (s) { return s[0] === key; })[0];
    return row ? row[1] : '—';
  };

  function primeCard(p) {
    var out = !p.inStock;
    return '' +
      '<article class="card' + (p.popular ? ' card--hero' : '') + (out ? ' card--out' : '') + '">' +
        '<a class="card__shot" href="product.html?id=' + p.id + '">' +
          (p.popular ? '<span class="pill pill--popular">MOST POPULAR</span>' : '') +
          '<span class="pill ' + (out ? 'pill--out' : 'pill--stock') + '">' + (out ? 'Out of stock' : 'In stock') + '</span>' +
          '<img src="' + p.images[0] + '" alt="' + p.name + ' build">' +
        '</a>' +
        '<div class="card__body">' +
          '<a class="card__title" href="product.html?id=' + p.id + '">' +
            '<span class="name">' + p.name + '</span>' +
            '<span class="price">' + window.money(p.price) + '</span>' +
          '</a>' +
          '<div style="margin-top:10px">' +
            ['CPU', 'GPU', 'Memory', 'Storage'].map(function (k) {
              return '<dl class="spec"><dt>' + k + '</dt><dd>' + pick(p, k) + '</dd></dl>';
            }).join('') +
          '</div>' +
          '<div class="card__foot">' +
            '<a class="link" href="product.html?id=' + p.id + '">Full details</a>' +
            (out
              ? '<span class="btn btn--disabled">Out of stock</span>'
              : '<a class="btn btn--primary" href="product.html?id=' + p.id + '">Purchase</a>') +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function dealCard(p) {
    var out = !p.inStock;
    return '' +
      '<article class="card card--deal' + (out ? ' card--out' : '') + '">' +
        '<a class="card__shot" href="product.html?id=' + p.id + '">' +
          '<span class="pill ' + (out ? 'pill--out' : 'pill--stock') + '">' + (out ? 'Out of stock' : 'In stock') + '</span>' +
          '<img src="' + p.images[0] + '" alt="' + p.name + '">' +
        '</a>' +
        '<div class="card__body">' +
          '<div class="card__title">' +
            '<span class="price">' + window.money(p.price) + '</span>' +
            '<span class="pill pill--blue">1 of 1</span>' +
          '</div>' +
          '<a class="name" href="product.html?id=' + p.id + '">' + p.name + '</a>' +
          '<div class="sub">' + [pick(p, 'Memory'), pick(p, 'Storage'), pick(p, 'Case')].join(' &middot; ') + '</div>' +
          (out
            ? '<span class="btn btn--disabled btn--block">' + (p.stockNote || 'Out of stock') + '</span>'
            : '<a class="btn btn--primary btn--block" href="product.html?id=' + p.id + '">Purchase</a>') +
        '</div>' +
      '</article>';
  }

  document.getElementById('prime-grid').innerHTML =
    window.PRODUCTS.filter(function (p) { return p.kind === 'prime'; }).map(primeCard).join('');

  document.getElementById('deal-grid').innerHTML =
    window.PRODUCTS.filter(function (p) { return p.kind === 'deal'; }).map(dealCard).join('');
})();
