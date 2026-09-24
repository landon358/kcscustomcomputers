/* Cart drawer UI. Injects its own markup, so every page gets it from a single
 * script tag. Reads and mutates state through window.Cart (shopify.js). */
(function () {
  'use strict';

  var root, scrim, body, foot, countEl;
  var busy = false;

  function money(n, currency) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: currency || 'USD',
        minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2
      }).format(n);
    } catch (e) {
      return '$' + n.toLocaleString('en-US');
    }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------------------------------------------------- markup ---- */

  function build() {
    scrim = document.createElement('div');
    scrim.className = 'cart-scrim';
    scrim.hidden = false;

    root = document.createElement('aside');
    root.className = 'cart';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Shopping cart');
    root.innerHTML =
      '<div class="cart__head">' +
        '<h2 class="cart__title">Cart <span class="cart__count" id="cart-count"></span></h2>' +
        '<button class="cart__close" id="cart-close" aria-label="Close cart">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
          'stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="cart__body" id="cart-body"></div>' +
      '<div class="cart__foot" id="cart-foot" hidden></div>';

    document.body.appendChild(scrim);
    document.body.appendChild(root);

    body = document.getElementById('cart-body');
    foot = document.getElementById('cart-foot');
    countEl = document.getElementById('cart-count');

    document.getElementById('cart-close').addEventListener('click', close);
    scrim.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('is-open')) close();
    });
  }

  /* ------------------------------------------------------ open/close ---- */

  var lastFocus = null;

  function open() {
    lastFocus = document.activeElement;
    root.classList.add('is-open');
    scrim.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    var btn = document.getElementById('cart-close');
    if (btn) btn.focus();
  }

  function close() {
    root.classList.remove('is-open');
    scrim.classList.remove('is-open');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------------------------------------------------------- render ---- */

  function renderEmpty() {
    if (!window.Cart.enabled) {
      body.innerHTML =
        '<div class="cart__setup">' +
          '<b>Cart is not connected yet.</b><br>' +
          'Add your store domain and Storefront API token to ' +
          '<code>shopify-config.js</code> and this drawer starts working — ' +
          'real stock, real totals, real checkout.' +
        '</div>';
    } else {
      body.innerHTML =
        '<div class="cart__empty"><b>Your cart is empty</b>' +
        'Pick a build from the shop, or grab a one-time deal.</div>';
    }
    foot.hidden = true;
    countEl.textContent = '';
  }

  function render(cart) {
    if (!root) return;

    if (!cart || !cart.lines.length) { renderEmpty(); syncBadges(0); return; }

    countEl.textContent = '(' + cart.count + ')';

    body.innerHTML = cart.lines.map(function (l) {
      return '' +
        '<div class="cline" data-line="' + esc(l.lineId) + '">' +
          '<span class="cline__shot">' +
            (l.image ? '<img src="' + esc(l.image) + '" alt="">' : '') +
          '</span>' +
          '<div>' +
            '<p class="cline__name">' + esc(l.title) + '</p>' +
            (l.variantTitle && l.variantTitle !== 'Default Title'
              ? '<div class="cline__variant">' + esc(l.variantTitle) + '</div>' : '') +
            '<div class="cqty">' +
              '<button type="button" data-act="dec" aria-label="Decrease quantity">&minus;</button>' +
              '<span>' + l.quantity + '</span>' +
              '<button type="button" data-act="inc" aria-label="Increase quantity">+</button>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<div class="cline__price">' + money(l.price * l.quantity, cart.currency) + '</div>' +
            '<button type="button" class="cline__remove" data-act="rm">Remove</button>' +
          '</div>' +
        '</div>';
    }).join('');

    foot.hidden = false;
    foot.innerHTML =
      '<div class="cart__row">' +
        '<span class="cart__row-label">Subtotal</span>' +
        '<span class="cart__row-value">' + money(cart.subtotal, cart.currency) + '</span>' +
      '</div>' +
      '<p class="cart__note">Shipping and tax calculated at checkout.</p>' +
      '<button class="btn btn--primary btn--lg btn--block" id="cart-checkout">Checkout</button>';

    document.getElementById('cart-checkout').addEventListener('click', function () {
      var btn = this;
      btn.textContent = 'Redirecting…';
      btn.disabled = true;

      offerProtection().then(function (go) {
        if (!go) { resetCheckoutButton(); return; }          // they closed the offer
        if (!window.Cart.checkout()) resetCheckoutButton();  // nothing to check out with
      });
    });

    syncBadges(cart.count);
  }

  // Line-level actions are delegated, so a re-render never orphans a handler.
  function wireBody() {
    body.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-act]');
      if (!btn || busy) return;

      var row = btn.closest('.cline');
      if (!row) return;

      var lineId = row.getAttribute('data-line');
      var act = btn.getAttribute('data-act');
      var cart = window.Cart.get();
      var line = cart && cart.lines.filter(function (l) { return l.lineId === lineId; })[0];
      if (!line) return;

      busy = true;
      row.style.opacity = '0.5';

      var op = act === 'rm'
        ? window.Cart.remove(lineId)
        : window.Cart.setQuantity(lineId, line.quantity + (act === 'inc' ? 1 : -1));

      op.catch(function (err) {
        console.error('[cart]', err.message);
        row.style.opacity = '';
      }).then(function () { busy = false; });
    });
  }

  function resetCheckoutButton() {
    var btn = document.getElementById('cart-checkout');
    if (!btn) return;
    btn.textContent = 'Checkout';
    btn.disabled = false;
  }

  /* Coming back from Shopify.
   *
   * Checkout leaves the site, and the browser's back button restores this page
   * exactly as it was left — including a Checkout button reading "Redirecting…"
   * and disabled, which then does nothing. So the drawer is rebuilt on the way
   * back in, and the cart re-read from Shopify: by then it may have been paid
   * for, in which case it is gone and the drawer should say so.
   */
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    resetCheckoutButton();
    if (window.Cart.enabled) window.Cart.hydrate();
    else render(window.Cart.get());
  });

  /* ------------------------------------------------- protection plan ---- */

  /* Offered once, on the way to checkout, when KC has a protection plan
   * published and it is not already in the cart. Resolves true to carry on to
   * checkout, false if the shopper closed the offer without choosing.
   *
   * Everything shown comes from the product in Shopify — its name, its own
   * description and its price — so what the plan covers is only ever what KC
   * wrote, never wording invented here.
   */
  var PLAN_DISMISSED = 'kcc_plan_offered';

  function findPlan() {
    var cfg = window.SHOPIFY_CONFIG || {};
    var handle = cfg.protectionPlanHandle || '';
    return (window.PRODUCTS || []).filter(function (p) {
      if (!p.inStock) return false;
      return handle ? p.id === handle || p.handle === handle
                    : /protection plan/i.test(p.name || '');
    })[0] || null;
  }

  function planInCart(plan) {
    var cart = window.Cart.get();
    if (!cart) return false;
    return cart.lines.some(function (l) { return l.handle === plan.handle || l.handle === plan.id; });
  }

  // The drawer opens on pages that never load the catalogue (contact, thanks),
  // so make sure it is there before looking for the plan. loadCatalogue is
  // memoised, so this costs nothing on a page that already has it.
  function withCatalogue() {
    if ((window.PRODUCTS || []).length || !window.Shopify || !window.Shopify.configured) {
      return Promise.resolve();
    }
    return window.Shopify.loadCatalogue().then(function (cat) {
      if (!cat.error) window.PRODUCTS = cat.products;
    });
  }

  function offerProtection() {
    return withCatalogue().then(showOffer);
  }

  function showOffer() {
    var plan = findPlan();
    var cart = window.Cart.get();
    var already = false;
    try { already = sessionStorage.getItem(PLAN_DISMISSED) === '1'; } catch (err) { /* private mode */ }

    if (!plan || !cart || already || planInCart(plan)) return Promise.resolve(true);

    var variant = (plan.variants || []).filter(function (v) { return v.available; })[0];
    if (!variant) return Promise.resolve(true);

    return new Promise(function (resolve) {
      var wrap = document.createElement('div');
      wrap.className = 'plan';
      wrap.setAttribute('role', 'dialog');
      wrap.setAttribute('aria-modal', 'true');
      wrap.setAttribute('aria-labelledby', 'plan-title');
      wrap.innerHTML =
        '<div class="plan__card">' +
          '<h2 class="plan__title" id="plan-title">Protect your purchase</h2>' +
          '<p class="plan__name">' + esc(plan.name) + ' &middot; ' + money(variant.price, cart.currency) + '</p>' +
          (plan.blurb ? '<p class="plan__copy">' + esc(plan.blurb) + '</p>' : '') +
          '<button type="button" class="btn btn--primary btn--lg btn--block" id="plan-add">' +
            'Add for ' + money(variant.price, cart.currency) + '</button>' +
          '<button type="button" class="plan__skip" id="plan-skip">No thanks, continue to checkout</button>' +
        '</div>';
      document.body.appendChild(wrap);
      document.getElementById('plan-add').focus();

      function finish(addIt) {
        try { sessionStorage.setItem(PLAN_DISMISSED, '1'); } catch (err) { /* private mode */ }
        if (!addIt) { wrap.remove(); resolve(true); return; }

        var add = document.getElementById('plan-add');
        add.disabled = true;
        add.textContent = 'Adding…';
        window.Cart.addLines([{ merchandiseId: variant.id, quantity: 1 }])
          .then(function () { wrap.remove(); resolve(true); })
          .catch(function (err) {
            console.error('[plan]', err.message);
            add.disabled = false;
            add.textContent = 'Could not add — continue to checkout';
            add.onclick = function () { wrap.remove(); resolve(true); };
          });
      }

      document.getElementById('plan-add').addEventListener('click', function () { finish(true); });
      document.getElementById('plan-skip').addEventListener('click', function () { finish(false); });
      wrap.addEventListener('click', function (e) {
        // closing without choosing leaves them in the cart, not at checkout
        if (e.target === wrap) { wrap.remove(); resolve(false); }
      });
      document.addEventListener('keydown', function onKey(e) {
        if (e.key !== 'Escape') return;
        document.removeEventListener('keydown', onKey);
        if (wrap.parentNode) { wrap.remove(); resolve(false); }
      });
    });
  }

  /* ------------------------------------------------------ nav wiring ---- */

  function syncBadges(n) {
    document.querySelectorAll('.nav__cart-badge').forEach(function (b) {
      b.textContent = n > 9 ? '9+' : String(n);
      b.classList.toggle('is-on', n > 0);
    });
  }

  function wireNav() {
    document.querySelectorAll('[aria-label="Cart"]').forEach(function (a) {
      a.classList.add('nav__cart');
      a.setAttribute('href', '#cart');
      if (!a.querySelector('.nav__cart-badge')) {
        var b = document.createElement('span');
        b.className = 'nav__cart-badge';
        b.textContent = '0';
        a.appendChild(b);
      }
      a.addEventListener('click', function (ev) { ev.preventDefault(); open(); });
    });

    var account = window.Shopify && window.Shopify.accountUrl();
    document.querySelectorAll('[aria-label="Account"]').forEach(function (a) {
      if (account) {
        a.setAttribute('href', account);
      } else {
        // No store configured — say so rather than dead-linking.
        a.setAttribute('href', '#account');
        a.addEventListener('click', function (ev) {
          ev.preventDefault();
          open();
        });
      }
    });
  }

  /* ------------------------------------------------------------ init ---- */

  function init() {
    build();
    wireBody();
    wireNav();
    window.Cart.onChange(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.CartUI = { open: open, close: close };
})();
