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

  /* Every variant, not just the first.
   *
   * A PC is one variant, so reading the first was all this ever needed. An
   * accessory in four colours is four variants, each with its own price, stock
   * and photograph, and the one the buyer picks is the one that has to reach
   * the cart. Twenty covers colour x size with room to spare; a product with
   * more than that is not something the picker should be presenting anyway.
   */
  var PRODUCT_FIELDS = [
    'id handle title availableForSale tags productType',
    'description',
    'priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount } }',
    'images(first: 8) { edges { node { url altText } } }',
    'metafields(identifiers: [' + META_IDS + ']) { namespace key value }',
    'options { name optionValues { name } }',
    'variants(first: 20) { edges { node { id title availableForSale quantityAvailable ' +
      'price { amount currencyCode } image { url } selectedOptions { name value } } } }'
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
   * around in Admin reorders the section.
   *
   * The sizes are a ceiling on response time, not an API limit. An earlier
   * version of this comment said the Storefront API refuses queries costing
   * over 1000; that was never tested, and it is wrong — a query reporting a
   * cost of 7536 comes back fine. What does grow is the payload, and only
   * with what the store actually holds, so these are set generously above
   * KC's catalogue rather than tuned to a budget that is not enforced.
   */
  var CATALOGUE_QUERY =
    'query Catalogue($cols: Int!, $per: Int!) {' +
    '  collections(first: $cols) { nodes {' +
    '    handle title description' +
    '    metafields(identifiers: [' + COLLECTION_META_IDS + ']) { namespace key value }' +
    '    products(first: $per, sortKey: MANUAL) { nodes { ' + PRODUCT_FIELDS + ' } }' +
    '  } }' +
    '}';

  // Shopify product -> the shape the rest of the site already renders.
  // `section` is the collection the node came from, when it came from one.
  /* Options a buyer actually chooses between.
   *
   * Shopify gives every product at least one option, even a product with no
   * choices at all — it is called "Title" and its only value is "Default
   * Title". Rendering that would put a one-button picker on every PC page. An
   * option with a single value is not a choice either, so it is left off too.
   */
  function realOptions(node) {
    return (node.options || []).map(function (o) {
      return { name: o.name, values: (o.optionValues || []).map(function (v) { return v.name; }) };
    }).filter(function (o) {
      return o.values.length > 1 && !(o.name === 'Title' && o.values[0] === 'Default Title');
    });
  }

  function normalise(node, section) {
    var variants = node.variants.edges.map(function (e) {
      var v = e.node, opts = {};
      (v.selectedOptions || []).forEach(function (o) { opts[o.name] = o.value; });
      return {
        id: v.id,
        title: v.title,
        available: v.availableForSale,
        price: parseFloat(v.price.amount),
        image: v.image ? v.image.url : null,
        options: opts
      };
    });
    // The variant a page opens on: the first one that can actually be bought,
    // so an accessory whose first colour sold out does not open on a dead end.
    var variant = variants.filter(function (v) { return v.available; })[0] || variants[0] || null;
    var images = node.images.edges.map(function (e) { return e.node.url; });
    var tags = (node.tags || []).map(function (t) { return String(t).toLowerCase(); });
    var meta = metaMap(node.metafields);
    var metaSpecs = SPEC_FIELDS
      .filter(function (f) { return meta[f[0]]; })
      .map(function (f) { return [f[1], meta[f[0]]]; });
    // Each resolution falls back on its own, so KC can add 1440p numbers
    // without having to restate the 1080p ones.
    var fps = {}, fpsNotes = {};
    FPS_FIELDS.forEach(function (f) {
      var parsed = parseFps(meta[f[0]]);
      fps[f[1]] = parsed;
      // A field holding something that is not rows — "Untested", "Coming
      // soon" — is KC saying where he has got to. Keep his words rather than
      // discarding them and asserting our own status in their place.
      if (!parsed.length && meta[f[0]]) fpsNotes[f[1]] = meta[f[0]];
    });

    return {
      id: node.handle,
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
      name: node.title,
      // Collection membership first, then a tag, then the catalogue. The live
      // products carry no tags, so without the collections everything would
      // read as a prime and the deals row would come up empty.
      // The tags are the fallback for when collections cannot be read at all, so
      // an accessory tagged as one still does not render as a PC.
      kind: section || (tags.indexOf('deal') !== -1 ? 'deal'
        : (tags.indexOf('accessory') !== -1 ? 'accessory' : 'prime')),
      popular: tags.indexOf('popular') !== -1,
      price: parseFloat(node.priceRange.minVariantPrice.amount),
      // Set when variants differ in price, so a card can say "From $15"
      // instead of claiming the cheapest colour's price for all of them.
      priceMax: parseFloat((node.priceRange.maxVariantPrice || node.priceRange.minVariantPrice).amount),
      currency: node.priceRange.minVariantPrice.currencyCode,
      inStock: node.availableForSale,
      variantId: variant ? variant.id : null,
      variants: variants,
      options: realOptions(node),
      // Same reasoning: KC's own photographs of the machine he is actually
      // selling, and the catalogue art only if the store has none.
      images: images,
      /* Presentation: Shopify metafields first, products.js second.
       *
       * Each block falls back on its own — a product can carry its specs in
       * Admin while its benchmarks still come from the catalogue. Specs are
       * all-or-nothing within the block on purpose: a table half from Admin
       * and half from the repo would be a nightmare to debug.
       */
      tagline: meta.best_for || '',
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
      // ...except on an accessory. KC's PC descriptions are spec dumps, but a
      // stand has no spec table for the description to repeat, so there it is
      // the only prose there is and it is shown.
      blurb: meta.blurb ||
        (section === 'accessory' || tags.indexOf('accessory') !== -1
          ? String(node.description || '').trim() : ''),
      specs: metaSpecs,
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

  /* The CSS colour an option value names, or '' when it names none.
   *
   * KC names colours the way anyone would — White, Black, Matte Black, Silk
   * Gold — so the whole value is tried, then its last word. "60cm" or "Galaxy"
   * is not a colour and gets no swatch. Whatever comes back has been accepted
   * by CSS.supports as a colour, so it is safe inside a style attribute: a
   * string carrying anything more than a colour cannot pass.
   */
  function colourOf(value) {
    if (!window.CSS || !CSS.supports) return '';
    var words = String(value == null ? '' : value).toLowerCase().trim().split(/\s+/);
    var tries = [words.join(''), words[words.length - 1]];
    for (var i = 0; i < tries.length; i++) {
      if (tries[i] && CSS.supports('color', tries[i])) return tries[i];
    }
    return '';
  }

  function buildCatalogue(nodes) {
    var C = CFG.collections || {};
    var kindOf = function (h) {
      if (h === C.prime) return 'prime';
      if (h === C.deal) return 'deal';
      if (h === C.accessory) return 'accessory';
      return h;
    };

    /* The prime grid and the deals row filter on `kind`, and a machine can sit
     * in several collections at once — a Prime M could reasonably also be in
     * "Workstations". So the two reserved collections are read first and the
     * first one to claim a product sets its kind; later collections still list
     * it, they just do not re-badge it. Without this the sections KC adds
     * could quietly empty the home configurator.
     */
    // Accessories rank ahead of KC's own collections for the same reason: a
    // stand he also files under "New this month" is still a stand, and has to
    // render with the accessory card and the accessory product page.
    var RANK = { prime: 0, deal: 1, accessory: 2 };
    var rank = function (col) {
      var r = RANK[kindOf(col.handle)];
      return r === undefined ? 3 : r;
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
        var id = n.handle;
        if (!seen[id]) {
          seen[id] = normalise(n, kind);
          // The collection that claimed it, named the way KC named it. The
          // product page shows this above the machine's name, so renaming
          // "Summit Series - AMD" in Admin renames it there too.
          seen[id].sectionTitle = col.title || '';
        }
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
        // Accessories are deliberately NOT reserved: they are an ordinary
        // section KC places with shop_order, whose cards happen to differ.
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

  /* Order page blocks by KC's numbers — shop_order on the shop page,
   * home_order on the home page. Each block is { el, order }.
   *
   * Numbered first, lowest first. Anything without a number follows, in the
   * order the page already had it — so a section KC has not numbered lands at
   * the end instead of jumping the queue. Ties keep that order too, which means
   * two collections both set to 1 never swap places between visits.
   */
  function byOrder(blocks) {
    return (blocks || []).map(function (b, i) { return { b: b, i: i }; })
      .sort(function (x, y) {
        var a = x.b.order, c = y.b.order;
        var an = typeof a === 'number', cn = typeof c === 'number';
        if (an && cn && a !== c) return a - c;
        if (an !== cn) return an ? -1 : 1;
        return x.i - y.i;
      })
      .map(function (x) { return x.b; });
  }

  /* Resolves to { products, sections, error }.
   *
   * Never rejects: `error` is set instead, and every page shows the same
   * "could not load" message rather than any stand-in prices. There used to be
   * a hand-written catalogue to fall back on, and it was drawn first on every
   * page load — so a machine flashed up at last year's name and price before
   * the real one replaced it. Nothing beats showing nothing for a moment.
   *
   * Memoised, because a page may ask for products and sections separately and
   * there is no reason to make the same round trip twice.
   */
  var cataloguePromise = null;

  /* What a visitor sees when the catalogue cannot be loaded. One wording, in
   * one place, and it gives them a way to reach KC rather than a dead end. */
  function unavailableHtml(what) {
    return '<div class="unavailable" role="status">' +
      '<b>We couldn&rsquo;t load ' + (what || 'our machines') + ' just now.</b>' +
      '<p>Please refresh the page, or reach KC directly: ' +
      '<a href="tel:+12487979551">(248) 797-9551</a> or ' +
      '<a href="mailto:fegelykc@gmail.com">fegelykc@gmail.com</a>.</p></div>';
  }

  function loadCatalogue() {
    if (cataloguePromise) return cataloguePromise;

    var live = configured
      ? query(CATALOGUE_QUERY, { cols: 20, per: 30 }).then(function (data) {
          var nodes = (data.collections && data.collections.nodes) || [];
          var cat = buildCatalogue(nodes);
          // A store with no collections published to this channel resolves to
          // an empty list rather than erroring, so treat that as a miss.
          if (!cat.products.length) throw new Error('no collections published to this channel');
          cat.error = null;
          return cat;
        })
      : Promise.reject(new Error('Shopify is not configured'));

    cataloguePromise = live
      .catch(function (err) {
        // Collections unreadable, but the products themselves may not be —
        // worth one more ask before telling a visitor nothing is available.
        console.warn('[shopify] collections unavailable (' + err.message + '), reading all products');
        return loadFlat().then(function (list) {
          return { products: list, sections: [], error: null };
        });
      })
      .catch(function (err) {
        console.warn('[shopify] catalogue could not be loaded:', err.message);
        return { products: [], sections: [], error: err };
      });

    return cataloguePromise;
  }

  // The three pages that only want a product list still get one.
  /* The order Shopify itself calls best-selling.
   *
   * Sales figures are not in the Storefront API, but its ordering is: asking
   * for products by BEST_SELLING returns them ranked, and only the handles are
   * needed to apply that ranking to what is already loaded. Memoised, and
   * resolves to [] if it fails, which leaves the list in its normal order
   * rather than breaking the page.
   */
  var bestSellersPromise = null;

  function loadBestSellers() {
    if (bestSellersPromise) return bestSellersPromise;
    bestSellersPromise = (configured
      ? query('query Best($first: Int!) { products(first: $first, sortKey: BEST_SELLING) { nodes { handle } } }', { first: 60 })
          .then(function (data) {
            return data.products.nodes.map(function (n) { return n.handle; });
          })
      : Promise.reject(new Error('Shopify is not configured')))
      .catch(function (err) {
        console.warn('[shopify] best sellers unavailable:', err.message);
        return [];
      });
    return bestSellersPromise;
  }

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
      CART_FIELDS + ' } userErrors { message field } warnings { code message } } }',
    add: 'mutation CartAdd($id: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $id, lines: $lines) { cart { ' +
      CART_FIELDS + ' } userErrors { message field } warnings { code message } } }',
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

  /* Unwrap a mutation payload, surfacing Shopify's userErrors as real errors.
   *
   * The error remembers whether it was about the cart itself, because that is
   * the one failure a fresh cart can fix. Shopify reports a cart that has
   * expired or been checked out as a userError on the `cartId` field.
   *
   * Warnings are not errors and do not throw. They are how Shopify says it
   * did something other than what was asked — most importantly, "Only 1 item
   * was added to your cart due to availability" when a one-off is requested
   * twice. The cart has still changed, so state is updated and the warnings
   * are handed back for the page to show.
   */
  function unwrap(key) {
    return function (data) {
      var payload = data[key];
      if (payload.userErrors && payload.userErrors.length) {
        var e = payload.userErrors[0];
        var err = new Error(e.message);
        err.staleCart = (e.field || []).indexOf('cartId') !== -1;
        throw err;
      }
      state = normaliseCart(payload.cart);
      if (state) localStorage.setItem(CART_KEY, state.id);
      emit();
      return {
        cart: state,
        warnings: (payload.warnings || []).map(function (w) { return w.message; })
      };
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

  /* Add several lines in one request — a build and the add-ons picked with it.
   *
   * One request rather than one per line, so the drawer never opens on a
   * half-added order, and a slow connection is one wait instead of three.
   * Shopify adds each line independently: a colour that is out of stock comes
   * back as a warning while the build still goes in. Resolves to
   * { cart, warnings }.
   *
   * Only a cart that no longer exists is replaced. This used to start a fresh
   * cart on ANY failure, which meant a dropped connection or a rejected line
   * silently threw away everything the customer had already added.
   */
  function addLines(lines) {
    if (!configured) return Promise.reject(new Error('Shopify not configured'));
    lines = (lines || []).filter(function (l) { return l && l.merchandiseId; })
      .map(function (l) { return { merchandiseId: l.merchandiseId, quantity: l.quantity || 1 }; });
    if (!lines.length) return Promise.reject(new Error('Nothing to add — this product has no variant ID'));

    var id = state && state.id;
    if (!id) return query(Q.create, { lines: lines }).then(unwrap('cartCreate'));

    return query(Q.add, { id: id, lines: lines })
      .then(unwrap('cartLinesAdd'))
      .catch(function (err) {
        if (!err.staleCart) throw err;
        forget();
        return query(Q.create, { lines: lines }).then(unwrap('cartCreate'));
      });
  }

  function add(variantId, quantity) {
    return addLines([{ merchandiseId: variantId, quantity: quantity }]);
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
    byOrder: byOrder,
    loadBestSellers: loadBestSellers,
    unavailableHtml: unavailableHtml,
    esc: esc,
    colourOf: colourOf,
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
    addLines: addLines,
    setQuantity: setQuantity,
    remove: remove,
    checkout: checkout
  };

  hydrate();
})();
