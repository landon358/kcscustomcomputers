/* The sign-in invitation, once per visit.
 *
 * KC asked for this: a panel on arrival offering a Shopify sign-in for faster
 * checkout and order history, with the way to close it arriving five seconds
 * later.
 *
 * Two things are deliberate about how it is built:
 *
 *   - Once per visit, not once per page. It is keyed to sessionStorage, so
 *     arriving from anywhere shows it and clicking through the site does not
 *     show it again. Closing it, or signing in, settles it for the visit.
 *
 *   - The close button is delayed; the panel is not a trap. Escape and a
 *     click outside it both work from the first frame, the page behind keeps
 *     scrolling, and the button holds its place in the layout the whole time
 *     so nothing jumps when it appears.
 *
 * Worth knowing: Google treats a panel over the content on arrival as an
 * intrusive interstitial on phones, and it can cost search ranking. If that
 * shows up in the numbers, the fix is to show it on the second page instead
 * of the first, which is a one-line change here.
 */
(function () {
  'use strict';

  var SEEN = 'kcc_welcome';
  var DELAY = 5000;

  // Not over the checkout flow, and not on a page someone has landed on from
  // Shopify coming back — those are mid-purchase, which is the worst moment
  // to ask anyone to sign in.
  var QUIET = ['/thanks', '/404'];

  function quiet() {
    var path = location.pathname.replace(/\.html$/, '');
    return QUIET.some(function (p) { return path.indexOf(p) !== -1; });
  }

  function seen() {
    try { return sessionStorage.getItem(SEEN) === '1'; } catch (err) { return false; }
  }
  function remember() {
    try { sessionStorage.setItem(SEEN, '1'); } catch (err) { /* private mode */ }
  }

  function show() {
    var href = (window.Shopify && window.Shopify.accountUrl && window.Shopify.accountUrl()) || '';
    if (!href) return;              // no store to sign in to

    var wrap = document.createElement('div');
    wrap.className = 'welcome';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'false');
    wrap.setAttribute('aria-labelledby', 'welcome-title');
    wrap.innerHTML =
      '<div class="welcome__card">' +
        '<button type="button" class="welcome__close is-waiting" id="welcome-close" ' +
          'aria-label="Close">&times;</button>' +
        '<h2 class="welcome__title" id="welcome-title">Welcome to KC’s Custom Computers</h2>' +
        '<p class="welcome__copy">Sign in for faster checkout, or to view your orders.</p>' +
        '<a class="btn btn--primary btn--lg btn--block" id="welcome-go" href="' + href + '">Sign in</a>' +
      '</div>';
    document.body.appendChild(wrap);
    remember();

    var close = document.getElementById('welcome-close');
    var timer = setTimeout(function () { close.classList.remove('is-waiting'); }, DELAY);

    function done() {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      if (wrap.parentNode) wrap.remove();
    }
    function onKey(e) { if (e.key === 'Escape') done(); }

    close.addEventListener('click', done);
    document.getElementById('welcome-go').addEventListener('click', done);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) done(); });
    document.addEventListener('keydown', onKey);
  }

  if (!seen() && !quiet()) {
    // After the page has drawn, so the first thing anyone sees is the site.
    if (document.readyState === 'complete') show();
    else window.addEventListener('load', show);
  }
})();
