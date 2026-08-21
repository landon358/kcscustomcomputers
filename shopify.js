/* Shopify Storefront API client + cart state.
 *
 * Exposes two globals:
 *   window.Shopify — configured?, product loading, normalisation
 *   window.Cart    — cart state, mutations, checkout, change events
 *
 * Design note: Shopify is authoritative for commerce (price, availability,
 * variant IDs, images). products.js stays authoritative for presentation
 * (specs, benchmarks, copy) and is merged in by handle. That means the site
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

  /* ------------------------------------------------------- metafields ---- */

  /* Presentation can live in Shopify instead of products.js, so KC can list a
   * machine without anyone touching this repo. Namespace `specs`, and each
   * field has to be ticked "Storefront access" in Admin or it reads as null.
   *
   * The order here is the order the spec table renders in. The home
   * configurator picks its rows by label rather than taking the first N, so
   * adding a field here cannot silently change what the home page shows.
   */
  var SPEC_FIELDS = [
    ['cpu',         'CPU'],
    ['motherboard', 'Motherboard'],
    ['cooler',  'Cooler'],
    ['gpu',     'GPU'],
    ['ram',     'Memory'],
    ['storage', 'Storage'],
    ['psu',     'Power'],
    ['case',    'Case'],
    ['os',      'OS']
  ];
  // best_for fills the tagline; the three fps fields fill the benchmark bars,
  // one per resolution tab on the product page.
  var FPS_FIELDS = [['fps', 'fps'], ['fps_1440', 'fps1440'], ['fps_4k', 'fps4k']];
  var META_KEYS = SPEC_FIELDS.map(function (f) { return f[0]; })
    .concat(['best_for', 'blurb', 'bench_note', 'benchmark_scores'])
    .concat(FPS_FIELDS.map(function (f) { return f[0]; }));

  /* Shopify's Add-definition screen defaults the namespace to `custom`, and
   * changing it is an easy step to miss on one field out of twelve — which
   * would fail silently, since a missing metafield and a wrong namespace look
   * identical from here. So both are read and whichever carries a value wins.
   */
  var META_NAMESPACES = ['specs', 'custom'];
  var META_IDS = META_NAMESPACES.map(function (ns) {
    return META_KEYS.map(function (k) {
      return '{namespace: "' + ns + '", key: "' + k + '"}';
    }).join(' ');
  }).join(' ');

  var PRODUCT_FIELDS = [
    'id handle title availableForSale tags',
    'description',
    'priceRange { minVariantPrice { amount currencyCode } }',
    'images(first: 8) { edges { node { url altText } } }',
    'metafields(identifiers: [' + META_IDS + ']) { namespace key value }',
    'variants(first: 1) { edges { node { id availableForSale quantityAvailable price { amount currencyCode } } } }'
  ].join(' ');

  // Shopify returns one slot per identifier, null for the ones not set. Keys
  // are collapsed across namespaces; `specs` wins if a key somehow exists in
  // both, since that is the one this site documents.
  function metaMap(nodes) {
    var out = {};
    (nodes || []).forEach(function (m) {
      if (!m || !m.key || !String(m.value).trim()) return;
      if (out[m.key] && m.namespace !== 'specs') return;
      out[m.key] = String(m.value).trim();
    });
    return out;
  }

  /* Benchmarks, in the shape KC already writes them.
   *
   * His own listings read like this, one per line:
   *
   *     Fortnite: ~240+FPS
   *     Cyberpunk 2077 RTX: ~ 135+FPS
   *     Timespy: ~ 19,400
   *
   * So the parser takes what he types rather than asking him to restate it.
   * Three things follow from that:
   *
   *   - Rows split on newlines first. A comma cannot be the delimiter when a
   *     value can be "19,400".
   *   - The label is everything before the LAST colon, so "Cyberpunk 2077 RTX"
   *     survives having one of its own.
   *   - The text is kept exactly as written and shown that way. The "~" and
   *     the "+" are doing real work — he is saying "about this, or better" —
   *     and rendering a bare "240 fps" would claim a precision he does not.
   *     The number is parsed only to size the bar.
   */
  // products.js still stores pairs; bring them into the parser's shape so the
  // renderers only ever see one kind of row.
  function rows(list) {
    return (list || []).map(function (r) {
      if (r && typeof r === 'object' && !r.length) return r;
      var n = Number(r[1]);
      return { label: String(r[0]), value: isFinite(n) ? n : null,
               text: isFinite(n) ? n + ' fps' : String(r[1]) };
    });
  }

  function parseFps(raw) {
    if (!raw) return [];
    raw = String(raw).trim();

    if (raw.charAt(0) === '[') {
      try {
        var j = JSON.parse(raw);
        if (Object.prototype.toString.call(j) === '[object Array]') {
          return j.filter(function (r) { return r && r.length >= 2; })
                  .map(function (r) {
                    var n = Number(r[1]);
                    return { label: String(r[0]), value: isFinite(n) ? n : null,
                             text: isFinite(n) ? n + ' fps' : String(r[1]) };
                  });
        }
      } catch (e) { /* fall through to the plain form */ }
    }

    // newline, then semicolon, and only then comma — so a thousands separator
    // inside a value is never mistaken for a row break
    var rows;
    if (/[\r\n]/.test(raw)) rows = raw.split(/[\r\n]+/);
    else if (raw.indexOf(';') !== -1) rows = raw.split(';');
    else rows = raw.split(',');

    return rows.map(function (row) {
      row = row.replace(/^[\s•*◦-]+/, '').trim();     // strip bullets
      if (!row) return null;
      var i = row.lastIndexOf(':');
      if (i < 1) return null;
      var label = row.slice(0, i).trim();
      var text = row.slice(i + 1).trim();
      if (!label || !text) return null;
      var m = text.replace(/(\d),(?=\d{3}\b)/g, '$1').match(/\d+(?:\.\d+)?/);
      // a bare number carries no unit; anything KC wrote himself is left alone
      if (/^\d+(?:\.\d+)?$/.test(text)) text += ' fps';
      return { label: label, text: text, value: m ? parseFloat(m[0]) : null };
    }).filter(Boolean);
  }

  var PRODUCTS_QUERY =
    'query Products($first: Int!) { products(first: $first) { edges { node { ' +
    PRODUCT_FIELDS + ' } } } }';

  // Collections are the authority on which section a machine belongs to, read
  // in Shopify's manual sort order so Admin controls the running order too.
  var SECTIONS_QUERY =
    'query Sections($prime: String!, $deal: String!, $first: Int!) {' +
    '  prime: collection(handle: $prime) { products(first: $first, sortKey: MANUAL) { nodes { ' + PRODUCT_FIELDS + ' } } }' +
    '  deal:  collection(handle: $deal)  { products(first: $first, sortKey: MANUAL) { nodes { ' + PRODUCT_FIELDS + ' } } }' +
    '}';

  // The live listings predate this site, so their handles are not the
  // catalogue ids. CFG.handles maps one onto the other; anything unmapped
  // falls through on its own handle so a newly added product still appears.
  var HANDLES = CFG.handles || {};
  function siteId(handle) { return HANDLES[handle] || handle; }

  // Shopify product -> the shape the rest of the site already renders.
  // `section` is the collection the node came from, when it came from one.
  function normalise(node, section) {
    var variant = node.variants.edges.length ? node.variants.edges[0].node : null;
    var images = node.images.edges.map(function (e) { return e.node.url; });
    var tags = (node.tags || []).map(function (t) { return String(t).toLowerCase(); });
    var id = siteId(node.handle);
    var local = (window.PRODUCTS_STATIC || []).filter(function (p) {
      return p.id === id;
    })[0] || {};

    var meta = metaMap(node.metafields);
    var metaSpecs = SPEC_FIELDS
      .filter(function (f) { return meta[f[0]]; })
      .map(function (f) { return [f[1], meta[f[0]]]; });
    // Each resolution falls back on its own, so KC can add 1440p numbers
    // without having to restate the 1080p ones.
    var fps = {}, fpsNotes = {};
    FPS_FIELDS.forEach(function (f) {
      var parsed = parseFps(meta[f[0]]);
      fps[f[1]] = parsed.length ? parsed : rows(local[f[1]]);
      // A field holding something that is not rows — "Untested", "Coming
      // soon" — is KC saying where he has got to. Keep his words rather than
      // discarding them and asserting our own status in their place.
      if (!parsed.length && meta[f[0]]) fpsNotes[f[1]] = meta[f[0]];
    });

    return {
      id: id,
      handle: node.handle,
      // Titles in Admin are plain ("Ryzen 5 5600X RTX 4060"); the catalogue
      // carries the typeset ones the design expects.
      name: local.name || node.title,
      // Collection membership first, then a tag, then the catalogue. The live
      // products carry no tags, so without the collections everything would
      // read as a prime and the deals row would come up empty.
      kind: section || (tags.indexOf('deal') !== -1 ? 'deal' : (local.kind || 'prime')),
      popular: tags.indexOf('popular') !== -1 || !!local.popular,
      price: Math.round(parseFloat(node.priceRange.minVariantPrice.amount)),
      currency: node.priceRange.minVariantPrice.currencyCode,
      inStock: node.availableForSale,
      stockNote: local.stockNote,
      variantId: variant ? variant.id : null,
      // The catalogue art is what the design was built against; Shopify's own
      // photography is the fallback for anything not in products.js.
      images: (local.images && local.images.length) ? local.images : images,
      /* Presentation: Shopify metafields first, products.js second.
       *
       * Each block falls back on its own — a product can carry its specs in
       * Admin while its benchmarks still come from the catalogue. Specs are
       * all-or-nothing within the block on purpose: a table half from Admin
       * and half from the repo would be a nightmare to debug.
       */
      tagline: meta.best_for || local.tagline || '',
      /* No blurb for now.
       *
       * What was here was demo copy of mine making claims nobody had checked
       * ("high refresh at 1440p in everything current"), on a store taking
       * real orders. And node.description is not a substitute: KC's
       * descriptions are spec dumps — "CPU: ... Motherboard: ... Memory: ..."
       * — which as a paragraph under the spec table would just repeat it in
       * worse form.
       *
       * The plumbing stays so a `blurb` metafield fills it the moment there
       * is real prose to show. Until then the section hides itself.
       */
      blurb: meta.blurb || local.blurb || '',
      specs: metaSpecs.length ? metaSpecs : (local.specs || []),
      fps: fps.fps,
      fps1440: fps.fps1440,
      fps4k: fps.fps4k,
      // 3DMark and friends: a second block of scores that are not frame rates
      // and share no scale with them, so they render on their own.
      scores: parseFps(meta.benchmark_scores),
      // per-resolution status lines, where he wrote one instead of numbers
      fpsNotes: fpsNotes,
      // How the numbers were taken. His words, not ours — the site used to
      // assert a methodology nobody had verified.
      benchNote: meta.bench_note || ''
    };
  }

  // The static catalogue stores fps as pairs; the renderers expect parser rows,
  // so give the fallback path the same shape the Shopify path produces.
  function staticCatalogue() {
    return (window.PRODUCTS_STATIC || []).map(function (p) {
      var out = {};
      for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) out[k] = p[k];
      out.fps = rows(p.fps);
      out.fps1440 = rows(p.fps1440);
      out.fps4k = rows(p.fps4k);
      out.scores = rows(p.scores);
      out.benchNote = p.benchNote || '';
      return out;
    });
  }

  // Both grids read as a price ladder — the shop copy sells "from $1,300" and
  // the cards step up from there. Admin's manual order is not that ladder, and
  // rather than ask KC to keep two orderings in sync, price decides.
  function ladder(list) {
    return list.slice().sort(function (a, b) { return a.price - b.price; });
  }

  // Every published product, used when the collections are missing or empty.
  function loadFlat() {
    return query(PRODUCTS_QUERY, { first: 50 }).then(function (data) {
      var list = data.products.edges.map(function (e) { return normalise(e.node); });
      if (!list.length) throw new Error('no products published to this channel');
      return ladder(list);
    });
  }

  // Resolves to a product array either way: Shopify when configured and
  // reachable, the static catalogue otherwise. Never rejects.
  function loadProducts() {
    if (!configured) return Promise.resolve(ladder(staticCatalogue()));

    var C = CFG.collections || {};
    var byCollection = (C.prime || C.deal)
      ? query(SECTIONS_QUERY, { prime: C.prime || '', deal: C.deal || '', first: 40 })
          .then(function (data) {
            var list = [];
            ['prime', 'deal'].forEach(function (kind) {
              var col = data[kind];
              if (!col) return;
              col.products.nodes.forEach(function (n) { list.push(normalise(n, kind)); });
            });
            // A renamed or unpublished collection resolves to null rather than
            // erroring, so treat an empty result as a miss and go flat.
            if (!list.length) throw new Error('collections empty or not published to this channel');
            return ladder(list);
          })
      : Promise.reject(new Error('no collections configured'));

    return byCollection
      .catch(function (err) {
        console.warn('[shopify] collections unavailable (' + err.message + '), reading all products');
        return loadFlat();
      })
      .catch(function (err) {
        console.warn('[shopify] falling back to static catalogue:', err.message);
        return ladder(staticCatalogue());
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
