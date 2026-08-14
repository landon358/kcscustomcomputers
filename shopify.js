/* Shopify Storefront API client + cart state.
 *
 * Exposes two globals:
 *   window.Shopify — configured?, product loading, normalisation
 *   window.Cart    — cart state, mutations, checkout, change events
 *
 * Design note: Shopify is authoritative for commerce (price, availability,
 * variant IDs, images). products.js stays authoritative for presentation
 * (specs, benchmarks, blurbs) and is merged in by handle. That means the site
 * works the moment a token is added, without you having to move every spec
 * into a metafield first. Migrate to metafields later if you want.
 */
(function () {
  'use strict';

  var CFG = window.SHOPIFY_CONFIG || {};
  var configured = !!(CFG.domain && CFG.storefrontToken);
  var endpoint = configured
    ? 'https://' + CFG.domain + '/api/' + (CFG.apiVersion || '2026-01') + '/graphql.json'
    : null;

  var CART_KEY = 'kcc_cart_id';

  /* ------------------------------------------------------------ client ---- */

  function query(gql, variables) {
    if (!configured) return Promise.reject(new Error('Shopify not configured'));
    return fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': CFG.storefrontToken
      },
      body: JSON.stringify({ query: gql, variables: variables || {} })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Storefront API ' + r.status);
        return r.json();
      })
      .then(function (json) {
        if (json.errors && json.errors.length) {
          throw new Error(json.errors.map(function (e) { return e.message; }).join('; '));
        }
        return json.data;
      });
  }

  /* --------------------------------------------------------- products ---- */

  var PRODUCT_FIELDS = [
    'id handle title availableForSale tags',
    'description',
    'priceRange { minVariantPrice { amount currencyCode } }',
    'images(first: 8) { edges { node { url altText } } }',
    'variants(first: 1) { edges { node { id availableForSale quantityAvailable price { amount currencyCode } } } }'
  ].join(' ');

  var PRODUCTS_QUERY =
    'query Products($first: Int!) { products(first: $first) { edges { node { ' +
    PRODUCT_FIELDS + ' } } } }';

  // The live listings predate this site, so their handles are not the
  // catalogue ids. CFG.handles maps one onto the other; anything unmapped
  // falls through on its own handle so a newly added product still appears.
  var HANDLES = CFG.handles || {};
  function siteId(handle) { return HANDLES[handle] || handle; }

  // Shopify product -> the shape the rest of the site already renders.
  function normalise(node) {
    var variant = node.variants.edges.length ? node.variants.edges[0].node : null;
    var images = node.images.edges.map(function (e) { return e.node.url; });
    var tags = (node.tags || []).map(function (t) { return String(t).toLowerCase(); });
    var id = siteId(node.handle);
    var local = (window.PRODUCTS_STATIC || []).filter(function (p) {
      return p.id === id;
    })[0] || {};

    return {
      id: id,
      handle: node.handle,
      // Titles in Admin are plain ("Ryzen 5 5600X RTX 4060"); the catalogue
      // carries the typeset ones the design expects.
      name: local.name || node.title,
      // No tags on the live products, so the catalogue decides the section a
      // machine belongs to. Tags still win if they are ever added.
      kind: tags.indexOf('deal') !== -1 ? 'deal' : (local.kind || 'prime'),
      popular: tags.indexOf('popular') !== -1 || !!local.popular,
      price: Math.round(parseFloat(node.priceRange.minVariantPrice.amount)),
      currency: node.priceRange.minVariantPrice.currencyCode,
      inStock: node.availableForSale,
      stockNote: local.stockNote,
      variantId: variant ? variant.id : null,
      // The catalogue art is what the design was built against; Shopify's own
      // photography is the fallback for anything not in products.js.
      images: (local.images && local.images.length) ? local.images : images,
      // presentation extras still come from products.js, keyed by catalogue id
      tagline: local.tagline || '',
      blurb: local.blurb || node.description || '',
      specs: local.specs || [],
      fps: local.fps || []
    };
  }

  // Resolves to a product array either way: Shopify when configured and
  // reachable, the static catalogue otherwise. Never rejects.
  function loadProducts() {
    if (!configured) return Promise.resolve(window.PRODUCTS_STATIC.slice());

    return query(PRODUCTS_QUERY, { first: 50 })
      .then(function (data) {
        var list = data.products.edges.map(function (e) { return normalise(e.node); });
        if (!list.length) throw new Error('no products published to this channel');
        return list;
      })
      .catch(function (err) {
        console.warn('[shopify] falling back to static catalogue:', err.message);
        return window.PRODUCTS_STATIC.slice();
      });
  }

  /* ------------------------------------------------------------- cart ---- */

  var CART_FIELDS =
    'id checkoutUrl totalQuantity ' +
    'cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } } ' +
    'lines(first: 50) { edges { node { id quantity ' +
    'merchandise { ... on ProductVariant { id title ' +
    'price { amount currencyCode } image { url } ' +
    'product { title handle } } } } } }';

  var Q = {
    get: 'query Cart($id: ID!) { cart(id: $id) { ' + CART_FIELDS + ' } }',
    create: 'mutation CartCreate($lines: [CartLineInput!]) { cartCreate(input: { lines: $lines }) { cart { ' +
      CART_FIELDS + ' } userErrors { message } } }',
    add: 'mutation CartAdd($id: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $id, lines: $lines) { cart { ' +
      CART_FIELDS + ' } userErrors { message } } }',
    update: 'mutation CartUpdate($id: ID!, $lines: [CartLineUpdateInput!]!) { cartLinesUpdate(cartId: $id, lines: $lines) { cart { ' +
      CART_FIELDS + ' } userErrors { message } } }',
    remove: 'mutation CartRemove($id: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $id, lineIds: $lineIds) { cart { ' +
      CART_FIELDS + ' } userErrors { message } } }'
  };

  var state = null;          // normalised cart, or null
  var listeners = [];

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(state); } catch (e) { console.error(e); }
    });
  }

  function normaliseCart(cart) {
    if (!cart) return null;
    return {
      id: cart.id,
      checkoutUrl: cart.checkoutUrl,
      count: cart.totalQuantity,
      subtotal: parseFloat(cart.cost.subtotalAmount.amount),
      currency: cart.cost.subtotalAmount.currencyCode,
      lines: cart.lines.edges.map(function (e) {
        var n = e.node, m = n.merchandise;
        return {
          lineId: n.id,
          quantity: n.quantity,
          variantId: m.id,
          variantTitle: m.title,
          title: m.product.title,
          handle: m.product.handle,
          image: m.image ? m.image.url : null,
          price: parseFloat(m.price.amount)
        };
      })
    };
  }

  // Unwrap a mutation payload, surfacing Shopify's userErrors as real errors.
  function unwrap(key) {
    return function (data) {
      var payload = data[key];
      if (payload.userErrors && payload.userErrors.length) {
        throw new Error(payload.userErrors[0].message);
      }
      state = normaliseCart(payload.cart);
      if (state) localStorage.setItem(CART_KEY, state.id);
      emit();
      return state;
    };
  }

  // A cart can expire or be completed at checkout; clear the stale ID.
  function forget() {
    localStorage.removeItem(CART_KEY);
    state = null;
    emit();
  }

  function hydrate() {
    var id = localStorage.getItem(CART_KEY);
    if (!configured || !id) { emit(); return Promise.resolve(null); }

    return query(Q.get, { id: id })
      .then(function (data) {
        if (!data.cart) { forget(); return null; }
        state = normaliseCart(data.cart);
        emit();
        return state;
      })
      .catch(function (err) {
        console.warn('[cart] could not restore cart:', err.message);
        forget();
        return null;
      });
  }

  function add(variantId, quantity) {
    if (!configured) return Promise.reject(new Error('Shopify not configured'));
    if (!variantId) return Promise.reject(new Error('This product has no variant ID'));

    var lines = [{ merchandiseId: variantId, quantity: quantity || 1 }];
    var id = state && state.id;

    if (!id) return query(Q.create, { lines: lines }).then(unwrap('cartCreate'));

    return query(Q.add, { id: id, lines: lines })
      .then(unwrap('cartLinesAdd'))
      .catch(function (err) {
        // Stale cart ID — start a fresh one rather than failing the click.
        forget();
        return query(Q.create, { lines: lines }).then(unwrap('cartCreate'));
      });
  }

  function setQuantity(lineId, quantity) {
    if (quantity < 1) return remove(lineId);
    return query(Q.update, { id: state.id, lines: [{ id: lineId, quantity: quantity }] })
      .then(unwrap('cartLinesUpdate'));
  }

  function remove(lineId) {
    return query(Q.remove, { id: state.id, lineIds: [lineId] })
      .then(unwrap('cartLinesRemove'));
  }

  function checkout() {
    if (!state || !state.checkoutUrl) return false;
    window.location.href = state.checkoutUrl;
    return true;
  }

  /* ----------------------------------------------------------- export ---- */

  window.Shopify = {
    configured: configured,
    query: query,
    loadProducts: loadProducts,
    accountUrl: function () {
      if (CFG.accountUrl) return CFG.accountUrl;
      return configured ? 'https://' + CFG.domain + '/account' : null;
    }
  };

  window.Cart = {
    enabled: configured,
    get: function () { return state; },
    count: function () { return state ? state.count : 0; },
    onChange: function (fn) { listeners.push(fn); fn(state); },
    hydrate: hydrate,
    add: add,
    setQuantity: setQuantity,
    remove: remove,
    checkout: checkout
  };

  hydrate();
})();
