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
        'Pick a Prime Series build or grab a one-time deal.</div>';
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
      this.textContent = 'Redirecting…';
      this.disabled = true;
      if (!window.Cart.checkout()) {
        this.textContent = 'Checkout';
        this.disabled = false;
      }
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
