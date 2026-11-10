/* The protection plans, as KC describes them.
 *
 * One copy of the tier cards, used in two places: the warranty page and the
 * popup on the way to checkout. They used to be written out twice — the page
 * in HTML, the popup in cart.js — which is how the page came to advertise
 * $349.99 while the store charged $350.
 *
 * What lives here is only the part Shopify has no field for: the name KC uses
 * for the tier and what it covers, from his own plan sheet. Everything with a
 * number in it comes from the product:
 *
 *   price    the Shopify price, whatever it is today
 *   monthly  the `monthly` metafield, namespace `specs` — "10.99"
 *
 * `handle` ties a tier to its product. A tier whose product is not published
 * does not render at all, and a published plan with no tier here still sells:
 * it falls back to its Shopify name and price with no bullet list.
 */
window.PLAN_TIERS = [
  {
    handle: 'pc-protection-plan-plus-3-year',
    name: 'Protection Plan Plus',
    bullets: [
      'Priority scheduling for service requests',
      'Diagnostic testing and troubleshooting',
      'Remote technical support when appropriate',
      'Driver, firmware, and basic system-configuration assistance',
      'Assistance with eligible manufacturer or supplier warranty claims',
      '$0 labor cost for eligible manufacturer-approved replacement components'
    ]
  },
  {
    handle: 'pc-protection-plan-premium',
    name: 'Protection Plan Premium',
    tag: 'Most coverage',
    also: 'Everything in Plus, and:',
    bullets: [
      'System health checks and preventative maintenance',
      'Annual internal cleaning',
      'Annual comprehensive system health assessment',
      '$0 diagnostic fee for any issue, even when the problem is not covered by the plan'
    ]
  }
];

(function () {
  'use strict';

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // "10.99" -> "$10.99 a month". KC writes the figure, not the formatting.
  function monthlyLine(product) {
    var raw = (product && product.monthly) || '';
    if (!raw) return '';
    var n = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
    if (!isFinite(n)) return '';
    return window.money(n) + ' a month';
  }

  /* The tiers that have a published product behind them, in the order they
   * are listed above, each paired with its product. */
  function tiers(products) {
    var byHandle = {};
    (products || []).forEach(function (p) { byHandle[p.id] = p; });

    var paired = window.PLAN_TIERS
      .map(function (t) { return { tier: t, product: byHandle[t.handle] }; })
      .filter(function (x) { return x.product && x.product.inStock; });

    /* A plan KC has published but not described here still gets offered —
     * better a card with a name and a price than a plan nobody can buy
     * because the handle changed. */
    var known = {};
    window.PLAN_TIERS.forEach(function (t) { known[t.handle] = true; });
    (products || []).forEach(function (p) {
      if (p.kind === 'plan' && p.inStock && !known[p.id]) {
        paired.push({ tier: { handle: p.id, name: p.name, bullets: [] }, product: p });
      }
    });
    return paired;
  }

  /* One card. `button` is the HTML for whatever goes at the bottom — the
   * popup puts an Add button there, the warranty page nothing. */
  function card(x, button) {
    var t = x.tier, p = x.product;
    var monthly = monthlyLine(p);
    return '<article class="tier' + (t.tag ? ' tier--featured' : '') + '">' +
      '<header class="tier__head">' +
        (t.tag ? '<span class="tier__tag">' + esc(t.tag) + '</span>' : '') +
        '<h3>' + esc(t.name) + '</h3>' +
        '<p class="tier__price"><b>' + window.money(p.price) + '</b>' +
          '<span>for three years</span></p>' +
        (monthly ? '<p class="tier__alt">or <b>' + esc(monthly) + '</b></p>' : '') +
      '</header>' +
      (t.also ? '<p class="tier__also">' + esc(t.also) + '</p>' : '') +
      (t.bullets.length
        ? '<ul class="tier__list">' +
            t.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') +
          '</ul>'
        : '') +
      (button || '') +
    '</article>';
  }

  window.PlanTiers = { tiers: tiers, card: card, monthlyLine: monthlyLine };
})();
