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

  /* An accessory: a stand, a cable. No spec rows to show, so the card says
   * what the buyer can choose instead — the colours it comes in — with a swatch
   * for each one a browser recognises as a colour.
   */
  function accessoryCard(p) {
    var esc = window.Shopify.esc;
    var out = !p.inStock;
    var opts = p.options || [];
    var first = opts[0];
    var swatches = first ? first.values.map(function (v) {
      var c = window.Shopify.colourOf(v);
      return c ? '<span class="swatch" style="background:' + c + '" title="' + esc(v) + '"></span>' : '';
    }).join('') : '';
    var sub = first ? first.values.join(' &middot; ') : '';

    return '' +
      '<article class="card card--deal card--accessory' + (out ? ' card--out' : '') + '">' +
        '<a class="card__shot" href="product.html?id=' + encodeURIComponent(p.id) + '">' +
          '<span class="pill ' + (out ? 'pill--out' : 'pill--stock') + '">' + (out ? 'Out of stock' : 'In stock') + '</span>' +
          (p.images[0] ? '<img src="' + esc(p.images[0]) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async">' : '') +
        '</a>' +
        '<div class="card__body">' +
          '<div class="card__title">' +
            '<span class="price">' + (p.priceMax > p.price ? '<small>From</small> ' : '') + window.money(p.price) + '</span>' +
            (swatches ? '<span class="swatches">' + swatches + '</span>' : '') +
          '</div>' +
          '<a class="name" href="product.html?id=' + encodeURIComponent(p.id) + '">' + esc(p.name) + '</a>' +
          (sub ? '<div class="sub">' + esc(first.name) + ': ' + sub + '</div>' : '') +
          (out
            ? '<span class="btn btn--disabled btn--block">Out of stock</span>'
            : '<a class="btn btn--primary btn--block" href="product.html?id=' + encodeURIComponent(p.id) + '">' +
                (opts.length > 1 ? 'Choose options'
                  : (first ? 'Choose ' + esc(first.name.toLowerCase()) : 'View details')) + '</a>') +
        '</div>' +
      '</article>';
  }

  /* A collection KC added himself.
   *
   * It gets the same full card as the pre-builts rather than the compact deal
   * one: a new category is an unknown quantity, and the card carrying its CPU,
   * GPU, memory and storage says what the machine is without anyone having to
   * click. Heading, sub-line and eyebrow are his text, escaped.
   */
  function collectionSection(s) {
    var esc = window.Shopify.esc;
    var allAccessories = s.products.every(function (p) { return p.kind === 'accessory'; });
    return '' +
      '<section class="section section--tight" id="collection-' + esc(s.handle) + '">' +
        '<div class="section__head">' +
          (s.eyebrow ? '<span class="eyebrow">' + esc(s.eyebrow) + '</span>' : '') +
          '<h2>' + esc(s.title) + '</h2>' +
        '</div>' +
        (s.description ? '<p class="section__lede">' + esc(s.description) + '</p>' : '') +
        // The card follows the product, not the collection: a stand filed under
        // "New this month" alongside a PC still gets the accessory card. A
        // section of nothing but accessories uses the tighter four-up grid,
        // since a stand does not need a PC card's width.
        '<div class="grid ' + (allAccessories ? 'grid--4' : 'grid--3') + '">' +
          s.products.map(function (p) {
            return p.kind === 'accessory' ? accessoryCard(p) : primeCard(p);
          }).join('') +
        '</div>' +
      '</section>';
  }

  function paint(sections) {
    document.getElementById('prime-grid').innerHTML =
      window.PRODUCTS.filter(function (p) { return p.kind === 'prime'; }).map(primeCard).join('');

    var deals = window.PRODUCTS.filter(function (p) { return p.kind === 'deal'; });
    document.getElementById('deal-grid').innerHTML = deals.map(dealCard).join('');
    // Hide the heading rather than stand it over an empty row. KC sells the
    // one-offs as he gets them, so there will be stretches with none.
    var dealSection = document.getElementById('deal-grid').closest('section');
    if (dealSection) dealSection.hidden = !deals.length;

    var host = document.getElementById('collection-sections');
    if (host) {
      host.innerHTML = window.Shopify.shopSections(sections).map(collectionSection).join('');
    }
  }

  /* The home page links to a section here by its anchor, but the sections do
   * not exist when the browser goes looking for it — they arrive with the
   * Shopify response, several hundred milliseconds later. So the jump has to
   * be made again once the target is actually on the page.
   *
   * Only from the top, and only once: if the visitor has started reading by
   * the time the data lands, yanking them elsewhere is worse than the link
   * quietly not having worked.
   */
  function honourHash() {
    if (!window.location.hash || window.scrollY > 0) return;
    var target = document.getElementById(window.location.hash.slice(1));
    if (target) target.scrollIntoView();
  }

  // Paint from the static catalogue immediately, then again with live
  // Shopify pricing, stock and collections once they land. The static
  // catalogue has no collections, so the first pass renders none.
  paint([]);
  window.Shopify.loadCatalogue().then(function (cat) {
    window.PRODUCTS = cat.products;
    paint(cat.sections);
    honourHash();
  });
})();
