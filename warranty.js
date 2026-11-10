/* The protection plan cards on the warranty page.
 *
 * The copy is static in plans.js; the prices are not. Shopify is the only
 * place a price is kept, so the cards wait for it rather than printing a
 * figure from last time KC changed one — the same rule the hero card and the
 * product pages follow.
 */
(function () {
  'use strict';

  var box = document.getElementById('plan-tiers');
  var note = document.getElementById('plan-tiers-note');
  if (!box || !window.Shopify) return;

  window.Shopify.loadCatalogue().then(function (cat) {
    if (cat.error) {
      // The page still reads as a page: everything above the cards is KC's
      // own words and does not need Shopify to be up.
      note.hidden = false;
      return;
    }

    var list = window.PlanTiers.tiers(cat.products);
    if (!list.length) { note.hidden = false; return; }

    box.innerHTML = list.map(function (x) {
      return window.PlanTiers.card(x,
        '<a class="btn btn--ghost btn--block tier__link" href="product.html?id=' +
          encodeURIComponent(x.product.id) + '">See this plan</a>');
    }).join('');
  });
})();
