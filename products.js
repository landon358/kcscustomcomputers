/* Shared helpers, and the live product list.
 *
 * This file used to carry a hand-written copy of the catalogue, used both as
 * presentation detail and as a fallback when Shopify could not be reached. It
 * is gone: every machine's specs, benchmarks and photographs live in Shopify
 * now, and the copy here was a page's first paint — so a product page opened
 * showing last year's name and price for a second before the real one
 * arrived. Nothing is drawn now until Shopify answers.
 */

// Filled by shopify.js once the catalogue arrives.
window.PRODUCTS = [];

// Whole dollars when the price is whole — every PC is — and cents when it is
// not. Rounding everything read fine at $1,850 and would print a $14.99 stand
// as $15, and an add-on total that disagreed with the cart by a cent a line.
window.money = function (n) {
  n = Number(n) || 0;
  var cents = Math.round(n * 100) % 100 !== 0;
  return '$' + n.toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0
  });
};
