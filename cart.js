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

  /* The gate on the way to checkout.
   *
   * Checkout no longer leaves for Shopify on its own. It opens this, and the
   * only way through is a choice: add a plan, or "No thanks". Closing it
   * (Escape, or the backdrop) is neither — that leaves the shopper in their
   * cart rather than quietly sending them to pay.
   *
   * Two steps, the way KC described it. The first asks. The second shows the
   * tiers, because "which one" is a different question from "do you want one"
   * and asking both at once is how people answer neither.
   *
   * Skipped entirely when a plan is already in the cart. Someone who added
   * one on the product page has answered; asking again is nagging a customer
   * for agreeing with you.
   *
   * Every word about a plan — its name, its description, its price — comes
   * from the product in Shopify. Nothing about what is covered is written
   * here, because nothing here would be KC's to promise.
   */

  function findPlans() {
    var all = window.PRODUCTS || [];
    // The protection collection is the real answer.
    var listed = (window.Shopify && window.Shopify.plans)
      ? window.Shopify.plans(all) : [];
    if (listed.length) return listed;

    /* Nothing there: fall back on the handle, then on the name.
     *
     * KC filed his first plan under Accessories, and a plan that is published
     * and sellable should be offered whichever collection he put it in. This
     * is what keeps that working until it is moved. */
    var handle = (window.SHOPIFY_CONFIG || {}).protectionPlanHandle || '';
    return all.filter(function (p) {
      if (!p.inStock) return false;
      return handle ? p.id === handle || p.handle === handle
                    : /protection plan/i.test(p.name || '');
    });
  }

  function sellable(plan) {
    return (plan.variants || []).filter(function (v) { return v.available; })[0] || null;
  }

  function planInCart(plans) {
    var cart = window.Cart.get();
    if (!cart) return false;
    return plans.some(function (plan) {
      return cart.lines.some(function (l) {
        return l.handle === plan.handle || l.handle === plan.id;
      });
    });
  }

  // The drawer opens on pages that never load the catalogue (contact, thanks),
  // so make sure it is there before looking for the plans. loadCatalogue is
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
    var cart = window.Cart.get();
    var plans = findPlans().filter(sellable);

    // Nothing to offer, or they already have one: checkout as it always was.
    if (!cart || !plans.length || planInCart(plans)) return Promise.resolve(true);

    return new Promise(function (resolve) {
      var wrap = document.createElement('div');
      wrap.className = 'plan';
      wrap.setAttribute('role', 'dialog');
      wrap.setAttribute('aria-modal', 'true');
      wrap.setAttribute('aria-labelledby', 'plan-title');
      document.body.appendChild(wrap);

      function skipRow(label) {
        return '<button type="button" class="plan__skip" id="plan-skip">' + label + '</button>';
      }

      /* Step one: the question. */
      function ask() {
        wrap.innerHTML =
          '<div class="plan__card">' +
            '<h2 class="plan__title" id="plan-title">Protect your purchase</h2>' +
            '<p class="plan__copy">A protection plan covers the care around your ' +
              'machine — priority service, diagnostics and labor — for as long as ' +
              'you keep it.</p>' +
            '<button type="button" class="btn btn--primary btn--lg btn--block" id="plan-yes">' +
              'Add a protection plan</button>' +
            skipRow('No thanks') +
          '</div>';
        document.getElementById('plan-yes').focus();
        document.getElementById('plan-yes').addEventListener('click', choose);
        document.getElementById('plan-skip').addEventListener('click', function () { leave(); });
      }

      /* Step two: which one. */
      function choose() {
        wrap.innerHTML =
          '<div class="plan__card plan__card--wide">' +
            '<h2 class="plan__title" id="plan-title">Choose your plan</h2>' +
            '<div class="plan__tiers">' +
              plans.map(function (plan, i) {
                var v = sellable(plan);
                /* The one line that tells the tiers apart, from the plan's
                 * `best_for` metafield — KC's words, the same field every
                 * machine uses for its tagline.
                 *
                 * Not the Shopify description: that is the whole agreement,
                 * and it arrives as one flat string with its own heading
                 * folded into the first sentence, so any attempt to cut it to
                 * card length reads as a stutter of the name above it. The
                 * full text is one click away under the tiers. */
                var line = plan.tagline || '';
                return '<div class="plan__tier">' +
                  '<h3 class="plan__tier-name">' + esc(plan.name) + '</h3>' +
                  '<p class="plan__tier-price">' + money(v.price, cart.currency) + '</p>' +
                  (line ? '<p class="plan__tier-copy">' + esc(line) + '</p>' : '') +
                  '<button type="button" class="btn btn--primary btn--block" ' +
                    'data-pick="' + i + '">Add this plan</button>' +
                '</div>';
              }).join('') +
            '</div>' +
            '<p class="plan__terms"><a href="warranty.html">What each plan covers, in full</a></p>' +
            skipRow('No thanks, continue to checkout') +
          '</div>';
        var first = wrap.querySelector('[data-pick]');
        if (first) first.focus();
        wrap.querySelectorAll('[data-pick]').forEach(function (b) {
          b.addEventListener('click', function () { add(plans[Number(b.getAttribute('data-pick'))], b); });
        });
        document.getElementById('plan-skip').addEventListener('click', function () { leave(); });
      }

      function add(plan, btn) {
        var v = sellable(plan);
        wrap.querySelectorAll('[data-pick]').forEach(function (b) { b.disabled = true; });
        btn.textContent = 'Adding…';
        window.Cart.addLines([{ merchandiseId: v.id, quantity: 1 }])
          .then(function () { leave(); })
          .catch(function (err) {
            console.error('[plan]', err.message);
            // The plan could not be added. Say so, and do not hold the
            // checkout hostage over it.
            wrap.querySelectorAll('[data-pick]').forEach(function (b) { b.disabled = false; });
            btn.textContent = 'Could not add — continue to checkout';
            btn.onclick = function () { leave(); };
          });
      }

      // Carry on to Shopify.
      function leave() {
        close();
        resolve(true);
      }

      // Closed without answering: back to the cart, not to the payment page.
      function dismiss() {
        close();
        resolve(false);
      }

      function close() {
        document.removeEventListener('keydown', onKey);
        if (wrap.parentNode) wrap.remove();
      }

      function onKey(e) { if (e.key === 'Escape') dismiss(); }

      wrap.addEventListener('click', function (e) { if (e.target === wrap) dismiss(); });
      document.addEventListener('keydown', onKey);
      ask();
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
