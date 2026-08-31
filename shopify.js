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

  /* Collection-level metafields, so a section can carry its own settings.
   * Same two namespaces as products, for the same reason: Shopify's
   * Add-definition screen defaults to `custom`, and a field created there
   * instead of in `specs` reads back as null with nothing to say why.
   *
   *   home_order  which position this collection takes on the home page.
   *               Not set means it does not appear there at all.
   *   shop_order  its position on the shop page. Not set sorts it after the
   *               numbered ones, alphabetically.
   *   eyebrow     the small line above the heading. Optional.
   *
   * The heading and the line under it come from the collection's own title
   * and description, which every collection has already — so a collection
   * with no metafields at all still renders correctly.
   */
  var COLLECTION_META_KEYS = ['home_order', 'shop_order', 'eyebrow'];
  var COLLECTION_META_IDS = META_NAMESPACES.map(function (ns) {
    return COLLECTION_META_KEYS.map(function (k) {
      return '{namespace: "' + ns + '", key: "' + k + '"}';
    }).join(' ');
  }).join(' ');

  /* Every collection, and what is in it.
   *
   * Sections used to be two named lookups, which meant a new category in
   * Admin was invisible until someone edited this file. Reading the whole
   * list instead is what lets KC add one himself.
   *
   * Products come back in Shopify's manual sort order, so dragging them
   * around in Admin reorders the section. The sizes below are not arbitrary:
   * the Storefront API bills a query by the rows it could return, out of 1000,
   * and 20 collections x 30 products with all the metafields attached costs
   * 526. Raising either much further starts refusing the query outright.
   */
  var CATALOGUE_QUERY =
    'query Catalogue($cols: Int!, $per: Int!) {' +
    '  collections(first: $cols) { nodes {' +
    '    handle title description' +
    '    metafields(identifiers: [' + COLLECTION_META_IDS + ']) { namespace key value }' +
    '    products(first: $per, sortKey: MANUAL) { nodes { ' + PRODUCT_FIELDS + ' } }' +
    '  } }' +
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
      /* Shopify wins, for everything it knows.
       *
       * The catalogue used to supply the name because Admin titles were plain
       * where the design wanted typeset ones. Then KC relisted three deals
       * under their old handles — same slug, different machine — and the site
       * cheerfully paired a card headed "Ryzen 7 7800X3D · RTX 5070" with an
       * Intel i5-12400 spec sheet and a photograph of neither. A handle is not
       * a stable identity for a one-off, so nothing presentational may
       * override what the store actually says.
       */
      name: node.title || local.name,
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
      // Same reasoning: KC's own photographs of the machine he is actually
      // selling, and the catalogue art only if the store has none.
      images: images.length ? images : (local.images || []),
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

  /* ------------------------------------------------------- sections ---- */

  // Metafield values arrive as strings, and KC may well type "1." or " 2".
  // Anything that is not a number at all — including the empty string a
  // cleared field leaves behind — reads as "not set", which is what decides
  // whether a collection appears on the home page.
  function order(v) {
    if (v === undefined || v === null || String(v).trim() === '') return null;
    var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : null;
  }

  // Collections nobody made. `frontpage` is created by Shopify itself on every
  // store; putting a heading on the page for it would be inventing a category.
  var HIDDEN = (CFG.hiddenCollections || ['frontpage']).map(String);

  // Escape for the collection title, description and eyebrow. Unlike the rest
  // of the catalogue these are free text typed in Admin, and "Ryzen & Radeon"
  // should render as itself rather than as a broken entity.
  function esc(str) {
    return String(str === undefined || str === null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function buildCatalogue(nodes) {
    var C = CFG.collections || {};
    var kindOf = function (h) {
      return h === C.prime ? 'prime' : (h === C.deal ? 'deal' : h);
    };

    /* The prime grid and the deals row filter on `kind`, and a machine can sit
     * in several collections at once — a Prime M could reasonably also be in
     * "Workstations". So the two reserved collections are read first and the
     * first one to claim a product sets its kind; later collections still list
     * it, they just do not re-badge it. Without this the sections KC adds
     * could quietly empty the home configurator.
     */
    var rank = function (col) {
      var k = kindOf(col.handle);
      return k === 'prime' ? 0 : (k === 'deal' ? 1 : 2);
    };
    var ordered = nodes.slice().sort(function (a, b) { return rank(a) - rank(b); });

    var seen = {};
    var sections = [];

    ordered.forEach(function (col) {
      if (!col || !col.products || HIDDEN.indexOf(col.handle) !== -1) return;

      var kind = kindOf(col.handle);
      var meta = metaMap(col.metafields);
      var members = [];

      col.products.nodes.forEach(function (n) {
        var id = siteId(n.handle);
        if (!seen[id]) seen[id] = normalise(n, kind);
        members.push(seen[id]);
      });

      // An empty collection is a category KC has started, not a section with
      // nothing to say. Rendering it would put a heading over a blank row.
      if (!members.length) return;

      sections.push({
        handle: col.handle,
        title: col.title || col.handle,
        eyebrow: meta.eyebrow || '',
        description: String(col.description || '').trim(),
        homeOrder: order(meta.home_order),
        shopOrder: order(meta.shop_order),
        // The two the page already has hard-coded blocks for. They are still
        // returned, so anything wanting the full picture can see them, but the
        // generic renderers skip them or the page would show them twice.
        reserved: kind === 'prime' || kind === 'deal',
        kind: kind,
        products: ladder(members)
      });
    });

    var products = [];
    for (var id in seen) {
      if (Object.prototype.hasOwnProperty.call(seen, id)) products.push(seen[id]);
    }
    return { products: ladder(products), sections: sections };
  }

  // Shop page: everything KC added himself, numbered ones first in his order,
  // then the rest alphabetically. A collection with no metafields still lands
  // somewhere predictable rather than wherever Shopify happened to list it.
  function shopSections(sections) {
    return (sections || []).filter(function (s) { return !s.reserved; })
      .sort(function (a, b) {
        var ao = a.shopOrder, bo = b.shopOrder;
        if (ao !== null && bo !== null && ao !== bo) return ao - bo;
        if (ao !== null && bo === null) return -1;
        if (ao === null && bo !== null) return 1;
        return a.title.localeCompare(b.title);
      });
  }

  /* Home page: opt-in only. A collection appears there when it has a
   * home_order, and that number is its position.
   *
   * Silence meaning "no" rather than "yes, at the end" is the whole point —
   * a half-built category should not be able to reach the front page before
   * KC has decided it belongs there.
   */
  function homeSections(sections) {
    var picked = (sections || []).filter(function (s) {
      return !s.reserved && s.homeOrder !== null;
    }).sort(function (a, b) { return a.homeOrder - b.homeOrder; });

    var cap = CFG.homeMaxSections;
    cap = (typeof cap === 'number' && cap >= 0) ? cap : 3;
    if (picked.length > cap) {
      console.warn('[shopify] ' + picked.length + ' collections have a home_order but the ' +
        'home page shows ' + cap + ' (SHOPIFY_CONFIG.homeMaxSections). Not shown: ' +
        picked.slice(cap).map(function (s) { return s.title; }).join(', '));
    }
    return picked.slice(0, cap);
  }

  /* Resolves to { products, sections } either way: Shopify when configured and
   * reachable, the static catalogue otherwise. Never rejects.
   *
   * Both fallbacks return no sections. That is deliberate — sections only
   * exist in Shopify, and inventing them from products.js would put headings
   * on the page for categories the store does not have.
   *
   * Memoised, because the shop page asks for products and sections and there
   * is no reason to buy the same 526-point query twice.
   */
  var cataloguePromise = null;

  function loadCatalogue() {
    if (cataloguePromise) return cataloguePromise;

    var flat = function (list) { return { products: ladder(list), sections: [] }; };

    var live = configured
      ? query(CATALOGUE_QUERY, { cols: 20, per: 30 }).then(function (data) {
          var nodes = (data.collections && data.collections.nodes) || [];
          var cat = buildCatalogue(nodes);
          // A store with no collections published to this channel resolves to
          // an empty list rather than erroring, so treat that as a miss.
          if (!cat.products.length) throw new Error('no collections published to this channel');
          return cat;
        })
      : Promise.reject(new Error('Shopify not configured'));

    cataloguePromise = live
      .catch(function (err) {
        if (configured) {
          console.warn('[shopify] collections unavailable (' + err.message + '), reading all products');
        }
        return loadFlat().then(flat);
      })
      .catch(function (err) {
        console.warn('[shopify] falling back to static catalogue:', err.message);
        return flat(staticCatalogue());
      });

    return cataloguePromise;
  }

  // The three pages that only want a product list still get one.
  function loadProducts() {
    return loadCatalogue().then(function (c) { return c.products; });
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
    loadCatalogue: loadCatalogue,
    shopSections: shopSections,
    homeSections: homeSections,
    esc: esc,
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
