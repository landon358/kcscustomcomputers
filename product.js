/* Product detail page. Reads ?id= from the URL — that id is also the Shopify
 * product handle. Renders immediately from the static catalogue, then repaints
 * with live Shopify price/stock/variant data once it arrives.
 *
 * One template, two kinds of product. A PC gets its spec table, benchmarks and
 * a list of accessories to add to the build. An accessory gets its options —
 * colour, length — and none of the PC furniture.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var handle = new URLSearchParams(location.search).get('id');
  var p = window.byId(handle);
  var shot = 0;
  var qty = 1;
  var added = false;
  var pending = false;
  var warnings = [];      // what Shopify said it did instead, after an add
  var failure = '';       // why the last add did not happen at all
  var sel = {};           // this accessory's chosen options, e.g. { Color: 'Black' }
  var addons = {};        // add-on id -> { on, variant } on a PC's page

  var ADDON_LIMIT = 4;
  var ACCESSORY_HANDLE =
    ((window.SHOPIFY_CONFIG || {}).collections || {}).accessory || 'accessories';

  var isAccessory = function (x) { return x && x.kind === 'accessory'; };

  /* -------------------------------------------------------- gallery ---- */

  function renderShot() {
    if (!p.images.length) return;
    $('p-shot').src = p.images[shot];
    $('p-shot').alt = p.name;
    $('p-thumbs').innerHTML = p.images.map(function (src, i) {
      return '<button type="button" class="thumb' + (i === shot ? ' is-active' : '') +
        '" data-i="' + i + '"><img src="' + src + '" alt=""></button>';
    }).join('');
  }

  $('p-thumbs').addEventListener('click', function (ev) {
    var t = ev.target.closest('.thumb');
    if (!t) return;
    shot = Number(t.getAttribute('data-i'));
    renderShot();
  });

  /* ------------------------------------------------------ buy module ---- */

    /* Benchmarks, per resolution.
   *
   * 1080p is the set every machine has. 1440p and 4K arrive as KC measures
   * them, so a resolution with no numbers yet still lists the games with muted
   * bars and says what it is waiting for — the switch shows what is coming
   * instead of collapsing to an empty box.
   */
  var RES = [
    ['1080p', 'fps',     ''],
    ['1440p', 'fps1440', '1440p'],
    ['4K',    'fps4k',   '4K']
  ];
  var res = 'fps';

  function renderBench(prod) {
    $('p-res').innerHTML = RES.map(function (r) {
      return '<button type="button" role="tab" class="restab' + (r[1] === res ? ' is-on' : '') +
        '" data-res="' + r[1] + '" aria-selected="' + (r[1] === res) + '">' + r[0] + '</button>';
    }).join('');

    var list = prod[res] || [];
    var noData = !list.length;
    // fall back to the 1080p line-up so the rows stay put across the switch
    if (noData) {
      list = (prod.fps || []).map(function (r) {
        return { label: r.label, text: '', value: null };
      });
    }

    $('p-bench').innerHTML = bars(list, 'Not measured yet');

    var label = (RES.filter(function (r) { return r[1] === res; })[0] || [])[2];
    // KC's own note if he wrote one; otherwise say only what we actually know
    var measured = prod.benchNote || 'Measured on the bench.';
    // KC's own status for this resolution beats ours; he wrote "Untested",
    // not "queued for testing", and only he knows which is true.
    var his = (prod.fpsNotes || {})[res];
    $('p-bench-note').textContent = list.length === 0
      ? 'No benchmarks recorded for this build yet.'
      : (noData
          ? (his || 'Not yet tested at ' + label + '.')
          : measured);

    // 3DMark and similar: different scale entirely, so its own block or nothing
    var box = $('p-scores');
    if (box) {
      var sc = prod.scores || [];
      box.hidden = !sc.length;
      if (sc.length) {
        $('p-scores-list').innerHTML = sc.map(function (r) {
          return '<dl class="spec"><dt>' + esc(r.label) + '</dt><dd>' + esc(r.text) + '</dd></dl>';
        }).join('');
      }
    }
  }

  // Quotes too: option values and add-on names now land inside attributes.
  function esc(t) {
    return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Bars are sized by the parsed number but labelled with what KC wrote, so
     "~240+FPS" reads as he meant it rather than as a bare 240. */
  function bars(list, emptyText) {
    var max = list.reduce(function (a, r) { return Math.max(a, r.value || 0); }, 1);
    return list.map(function (r, i) {
      var has = typeof r.value === 'number' && isFinite(r.value);
      return '<div class="bench' + (has ? '' : ' is-pending') + '">' +
        '<span class="bench__game">' + esc(r.label) + '</span>' +
        '<span class="bench__bar' + (i % 3 === 1 ? ' bench__bar--2' : i % 3 === 2 ? ' bench__bar--3' : '') +
        '" style="flex:0 1 ' + (has ? Math.round(r.value / max * 210) : 210) + 'px"></span>' +
        '<span class="bench__fps">' + esc(r.text || emptyText) + '</span></div>';
    }).join('');
  }

  // the tabs are rebuilt on every render, so listen on the container
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('.restab');
    if (!t) return;
    res = t.getAttribute('data-res');
    renderBench(p);
  });

  /* -------------------------------------------------------- variants ---- */

  var available = function (v) { return v && v.available; };

  // The static catalogue predates variants, so anything without them gets one
  // made from the product itself and the rest of the page never has to care.
  function variantsOf(x) {
    return (x.variants && x.variants.length) ? x.variants
      : [{ id: x.variantId, price: x.price, available: x.inStock, image: null, options: {} }];
  }

  function variantOf(x, id) {
    var vs = variantsOf(x);
    return vs.filter(function (v) { return v.id === id; })[0] ||
      vs.filter(available)[0] || vs[0];
  }

  // What the buy button adds on this page: the variant matching every chosen
  // option, or the product's own on a PC with nothing to choose.
  function current() {
    var names = Object.keys(sel);
    var vs = variantsOf(p);
    return vs.filter(function (v) {
      return names.every(function (n) { return v.options[n] === sel[n]; });
    })[0] || variantOf(p, p.variantId);
  }

  function copy(o) {
    var out = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out[k] = o[k];
    return out;
  }

  // Open on the variant Shopify's data says to — the first one in stock.
  function resetSelection() {
    var v = variantOf(p, p.variantId);
    sel = v ? copy(v.options) : {};
    addons = {};
    warnings = [];
    failure = '';
    added = false;
  }

  /* The best variant for one option value, given everything else chosen.
   *
   * Picking "Black" when "Black / 60cm" exists but "Black / 30cm" does not
   * should land on the one that exists rather than on nothing. So: an exact
   * match on the other options if there is one, in stock first; failing that,
   * any variant with this value, in stock first.
   */
  function pickFor(name, value) {
    var vs = variantsOf(p).filter(function (v) { return v.options[name] === value; });
    var others = Object.keys(sel).filter(function (n) { return n !== name; });
    var exact = vs.filter(function (v) {
      return others.every(function (n) { return v.options[n] === sel[n]; });
    });
    return exact.filter(available)[0] || exact[0] || vs.filter(available)[0] || vs[0] || null;
  }

  // A swatch, when the option value names a colour (see Shopify.colourOf).
  function swatch(value) {
    var c = window.Shopify.colourOf(value);
    return c ? '<span class="swatch" style="background:' + c + '" aria-hidden="true"></span>' : '';
  }

  // Rebuilding a list under the cursor drops keyboard focus, so put it back on
  // the element carrying the same data-* attributes once the new one exists.
  function keepFocus(container, render) {
    var a = document.activeElement, selector = '';
    if (a && container.contains(a)) {
      Array.prototype.forEach.call(a.attributes, function (at) {
        if (at.name.indexOf('data-') === 0) {
          selector += '[' + at.name + '="' + at.value.replace(/["\\]/g, '\\$&') + '"]';
        }
      });
    }
    render();
    if (selector) {
      var el = container.querySelector(selector);
      if (el) el.focus();
    }
  }

  /* ------------------------------------------------ accessory options ---- */

  function renderOptions() {
    var box = $('p-opts');
    var opts = isAccessory(p) ? (p.options || []) : [];
    box.hidden = !opts.length;
    if (!opts.length) { box.innerHTML = ''; return; }

    keepFocus(box, function () {
      box.innerHTML = opts.map(function (o) {
        return '<div class="choice">' +
          '<div class="choice__label" id="choice-' + esc(o.name) + '">' + esc(o.name) +
            (sel[o.name] ? ' <b>' + esc(sel[o.name]) + '</b>' : '') + '</div>' +
          '<div class="choice__values" role="radiogroup" aria-labelledby="choice-' + esc(o.name) + '">' +
          o.values.map(function (val) {
            var on = sel[o.name] === val;
            var out = !available(pickFor(o.name, val));
            return '<button type="button" class="optval' + (on ? ' is-on' : '') + (out ? ' is-out' : '') + '"' +
              ' role="radio" aria-checked="' + on + '" data-opt="' + esc(o.name) + '" data-val="' + esc(val) + '">' +
              swatch(val) + esc(val) + (out ? '<span class="sr"> (sold out)</span>' : '') +
              '</button>';
          }).join('') +
          '</div></div>';
      }).join('');
    });
  }

  $('p-opts').addEventListener('click', function (ev) {
    var b = ev.target.closest('.optval');
    if (!b) return;
    var v = pickFor(b.getAttribute('data-opt'), b.getAttribute('data-val'));
    if (!v) return;
    // adopt that variant's whole combination, so the page never shows a pairing
    // of options that does not exist as something to buy
    sel = copy(v.options);
    // and its photograph, when KC gave that variant one
    var i = v.image ? p.images.indexOf(v.image) : -1;
    if (i !== -1) { shot = i; renderShot(); }
    added = false;
    warnings = [];
    failure = '';
    renderOptions();
    renderPrice();
    renderBuy();
  });

  /* ---------------------------------------------------- PC add-ons ------ */

  /* Accessories offered on a PC's page.
   *
   * Only ones that can be bought: an add-on shown greyed out is a reason not
   * to add the build. Cheapest first, since that is the order the catalogue
   * already runs in and a $15 stand is the easy yes. Capped so a long
   * accessories range does not push the spec table off the page — the header
   * link carries the rest, and says how many there are.
   */
  function addonList() {
    if (isAccessory(p) || !available(current())) return { shown: [], total: 0 };
    var all = (window.PRODUCTS || []).filter(function (x) {
      return isAccessory(x) && x.inStock && variantsOf(x).some(available);
    });
    return { shown: all.slice(0, ADDON_LIMIT), total: all.length };
  }

  function addonState(x) {
    if (!addons[x.id]) addons[x.id] = { on: false, variant: variantOf(x, x.variantId).id };
    return addons[x.id];
  }

  function addonRow(x) {
    var st = addonState(x);
    var v = variantOf(x, st.variant);
    var opts = x.options || [];
    var picker = '';

    if (opts.length === 1) {
      // one choice, almost always colour: small swatch buttons, one per variant
      picker = '<div class="addon__vals">' + variantsOf(x).map(function (vv) {
        var val = vv.options[opts[0].name];
        var on = vv.id === st.variant;
        return '<button type="button" class="optval optval--sm' + (on ? ' is-on' : '') +
          (vv.available ? '' : ' is-out') + '"' + (vv.available ? '' : ' disabled') +
          ' aria-pressed="' + on + '" data-addon="' + esc(x.id) + '" data-variant="' + esc(vv.id) + '"' +
          ' aria-label="' + esc(x.name + ', ' + val + (vv.available ? '' : ', sold out')) + '">' +
          swatch(val) + esc(val) + '</button>';
      }).join('') + '</div>';
    } else if (opts.length > 1) {
      // several choices would be a wall of buttons in a row this size
      picker = '<div class="addon__vals"><select class="addon__select" data-addon-select="' + esc(x.id) + '"' +
        ' aria-label="' + esc(x.name) + ' options">' +
        variantsOf(x).map(function (vv) {
          return '<option value="' + esc(vv.id) + '"' + (vv.id === st.variant ? ' selected' : '') +
            (vv.available ? '' : ' disabled') + '>' + esc(vv.title) + (vv.available ? '' : ' — sold out') +
            '</option>';
        }).join('') + '</select></div>';
    }

    var img = (v && v.image) || x.images[0] || '';
    return '<li class="addon' + (st.on ? ' is-on' : '') + '">' +
      '<label class="addon__pick">' +
        '<input type="checkbox" data-addon-toggle="' + esc(x.id) + '"' + (st.on ? ' checked' : '') + '>' +
        '<span class="addon__box" aria-hidden="true"></span>' +
        '<span class="sr">Add ' + esc(x.name) + ' to this build</span>' +
        (img ? '<img class="addon__shot" src="' + esc(img) + '" alt="" loading="lazy" decoding="async">'
             : '<span class="addon__shot"></span>') +
      '</label>' +
      '<div class="addon__body">' +
        '<a class="addon__name" href="product.html?id=' + encodeURIComponent(x.id) + '">' + esc(x.name) + '</a>' +
        picker +
      '</div>' +
      '<span class="addon__price">+' + window.money(v ? v.price : x.price) + '</span>' +
    '</li>';
  }

  function renderAddons() {
    var box = $('p-addons');
    var list = addonList();
    box.hidden = !list.shown.length;
    if (!list.shown.length) { box.innerHTML = ''; return; }

    keepFocus(box, function () {
      box.innerHTML =
        '<div class="addons__head">' +
          '<span class="block__label">ADD TO YOUR BUILD</span>' +
          (list.total > list.shown.length
            ? '<a href="shop.html#collection-' + esc(ACCESSORY_HANDLE) + '">All ' + list.total + ' accessories &rarr;</a>'
            : '') +
        '</div>' +
        '<ul class="addons__list">' + list.shown.map(addonRow).join('') + '</ul>';
    });
  }

  // The picked add-ons that will actually go in the cart with the build.
  function chosenAddons() {
    return addonList().shown.filter(function (x) {
      return addons[x.id] && addons[x.id].on;
    }).map(function (x) {
      return { product: x, variant: variantOf(x, addons[x.id].variant) };
    }).filter(function (a) { return available(a.variant); });
  }

  function addonsChanged() {
    added = false;
    warnings = [];
    failure = '';
    renderAddons();
    renderBuy();
  }

  $('p-addons').addEventListener('change', function (ev) {
    var t = ev.target, id;
    if ((id = t.getAttribute('data-addon-toggle'))) {
      addons[id].on = t.checked;
      addonsChanged();
    } else if ((id = t.getAttribute('data-addon-select'))) {
      addons[id].variant = t.value;
      addons[id].on = true;
      addonsChanged();
    }
  });

  $('p-addons').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-addon][data-variant]');
    if (!b || b.disabled) return;
    var st = addons[b.getAttribute('data-addon')];
    if (!st) return;
    st.variant = b.getAttribute('data-variant');
    // choosing a colour is choosing the stand
    st.on = true;
    addonsChanged();
  });

  /* ------------------------------------------------------ buy module ---- */

  function renderPrice() {
    $('p-price').textContent = window.money(current().price);
    var cur = current();
    var stock = $('p-stock');
    stock.textContent = cur.available ? 'In stock' : 'Out of stock';
    stock.className = 'pill ' + (cur.available ? 'pill--blue' : 'pill--out');
  }

  function label(a) {
    var vals = Object.keys(a.variant.options || {}).filter(function (n) {
      return (a.product.options || []).some(function (o) { return o.name === n; });
    }).map(function (n) { return a.variant.options[n]; });
    return a.product.name + (vals.length ? ' (' + vals.join(', ') + ')' : '');
  }

  function renderBuy() {
    var buy = $('p-buy'), note = $('p-note');
    var cur = current();

    if (!cur.available) {
      buy.textContent = 'Out of stock';
      buy.className = 'btn btn--disabled';
      buy.disabled = true;
      buy.style.background = '';
      // an accessory sold out in one colour is not sold out
      note.textContent = p.inStock && isAccessory(p)
        ? 'Sold out in this option — pick another above.'
        : (p.stockNote || 'Currently unavailable') + ' — email to be notified when it is back.';
      note.className = 'buynote is-out';
      $('q-val').textContent = qty;
      return;
    }

    var extras = chosenAddons();
    var total = cur.price * qty + extras.reduce(function (sum, a) { return sum + a.variant.price; }, 0);

    buy.disabled = pending;
    buy.className = 'btn ' + (pending ? 'btn--disabled' : 'btn--primary');
    buy.textContent = pending ? 'Adding…'
      : (added ? 'Added to cart ✓'
        : (extras.length ? 'Add to cart · ' + window.money(total) : 'Add to cart'));
    buy.style.background = added && !pending ? 'var(--ink)' : '';

    note.className = 'buynote';
    if (failure) {
      note.textContent = 'Could not add to cart — ' + failure;
      note.className = 'buynote is-out';
    } else if (warnings.length) {
      // Shopify added something other than what was asked for — usually less
      // of a one-off than the quantity picked. Say so rather than "added ✓".
      note.textContent = warnings.join(' ');
      note.className = 'buynote is-out';
    } else if (added) {
      note.textContent = 'In your cart — open the cart to check out.';
    } else if (!window.Cart.enabled) {
      note.textContent = 'Demo mode · connect Shopify in shopify-config.js to take orders';
    } else if (extras.length) {
      note.textContent = 'With ' + extras.map(label).join(', ');
    } else {
      note.textContent = 'Ready to ship · local pickup in 24 hours';
    }
    $('q-val').textContent = qty;
  }

  function changedQty() { added = false; warnings = []; failure = ''; renderBuy(); }
  $('q-inc').addEventListener('click', function () { qty = Math.min(5, qty + 1); changedQty(); });
  $('q-dec').addEventListener('click', function () { qty = Math.max(1, qty - 1); changedQty(); });

  $('p-buy').addEventListener('click', function () {
    var cur = current();
    if (!cur.available || pending) return;

    // Not connected yet — open the drawer, which explains what is missing.
    if (!window.Cart.enabled) {
      added = true;
      renderBuy();
      window.CartUI.open();
      return;
    }

    var extras = chosenAddons();
    // The build and its add-ons in one request, so the drawer opens on the
    // whole order. Add-ons go in one each whatever the build quantity: two
    // PCs is rarely two identical stands, and the drawer can change it.
    var lines = [{ merchandiseId: cur.id, quantity: qty }].concat(extras.map(function (a) {
      return { merchandiseId: a.variant.id, quantity: 1 };
    }));

    pending = true;
    warnings = [];
    failure = '';
    renderBuy();

    window.Cart.addLines(lines)
      .then(function (res) {
        added = true;
        warnings = (res && res.warnings) || [];
        // They are in the cart now. Left ticked, a second click on the button
        // would add a second stand the buyer only asked for once.
        extras.forEach(function (a) { addons[a.product.id].on = false; });
        renderAddons();
        window.CartUI.open();
      })
      .catch(function (err) {
        console.error('[cart]', err.message);
        // Held in state rather than written straight to the note. It used to
        // be written directly, and the renderBuy() below replaced it with
        // "Ready to ship" before anyone could read it.
        failure = err.message;
      })
      .then(function () {
        pending = false;
        renderBuy();
      });
  });

  /* ------------------------------------------------------------ seo ---- */

  /* product.html is one template rendering whichever machine ?id= names, so
     its title, description, canonical and Product schema have to be written
     per machine at runtime. Google renders JavaScript before indexing, so
     this is seen — but the static head still carries a sensible default in
     case a crawler that does not run JS gets here first. */
  var SEO_BASE = 'https://kcscustomcomputers.com';

  function setMeta(sel, attr, val) {
    var el = document.head.querySelector(sel);
    if (el) el.setAttribute(attr, val);
  }

  function paintSeo(p) {
    var url = SEO_BASE + '/product?id=' + encodeURIComponent(p.id);
    // Build from the headline parts, then drop whole specs until the closing
    // sentence fits. A hard slice cut mid-word ("...tested in Walled"), which
    // is what actually shows in a search result.
    var desc;
    if (isAccessory(p)) {
      // Its own description, cut at a word rather than mid-word, or a plain
      // statement of what and where if KC has not written one.
      desc = p.name + ' — ' + (p.blurb || "an accessory from KC's Custom Computers, Walled Lake, Michigan.");
      if (desc.length > 158) desc = desc.slice(0, 157).replace(/\s+\S*$/, '') + '…';
    } else {
      var TAIL = '. Built and bench tested in Walled Lake, Michigan.';
      var picked = p.specs.slice(0, 4);
      do {
        var specs = picked.map(function (s) { return s[0] + ' ' + s[1]; }).join(', ');
        desc = p.name + ' — ' + (specs || 'hand-built gaming PC') + TAIL;
        picked = picked.slice(0, -1);
      } while (desc.length > 158 && picked.length);
    }
    var title = p.name + ' | ' + window.money(p.price) + " | KC's Custom Computers";

    document.title = title;
    setMeta('meta[name="description"]', 'content', desc);
    setMeta('link[rel="canonical"]', 'href', url);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', desc);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', desc);
    if (p.images[0]) {
      var img = p.images[0].indexOf('http') === 0 ? p.images[0] : SEO_BASE + '/' + p.images[0];
      setMeta('meta[property="og:image"]', 'content', img);
      setMeta('meta[name="twitter:image"]', 'content', img);
    }

    var ld = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      description: desc,
      image: p.images.map(function (i) {
        return i.indexOf('http') === 0 ? i : SEO_BASE + '/' + i;
      }),
      brand: { '@type': 'Brand', name: "KC's Custom Computers" },
      offers: {
        '@type': 'Offer',
        url: url,
        price: String(p.price),
        priceCurrency: p.currency || 'USD',
        // stock is read live from Shopify, so this is never a stale claim
        availability: p.inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: "KC's Custom Computers" }
      }
    };
    if (p.specs.length) {
      ld.additionalProperty = p.specs.map(function (s) {
        return { '@type': 'PropertyValue', name: s[0], value: s[1] };
      });
    }

    var tag = document.getElementById('product-schema');
    if (!tag) {
      tag = document.createElement('script');
      tag.type = 'application/ld+json';
      tag.id = 'product-schema';
      document.head.appendChild(tag);
    }
    tag.textContent = JSON.stringify(ld);
  }

  /* --------------------------------------------------------- repaint ---- */

  function paint() {
    var acc = isAccessory(p);

    document.title = p.name + " — KC's Custom Computers";
    $('crumb-name').textContent = p.name;
    $('crumb-link').textContent = acc ? 'Accessories' : 'Shop Pre-Built';
    $('crumb-link').href = acc ? 'shop.html#collection-' + ACCESSORY_HANDLE : 'shop.html';
    $('p-kind').textContent = acc ? 'Accessory' : (p.kind === 'deal' ? 'One-time deal' : 'Prime Series');
    $('p-name').textContent = p.name;
    $('p-tagline').textContent = p.tagline;
    // an empty paragraph still takes its margin, so hide it outright
    var tagline = $('p-tagline');
    tagline.hidden = !p.tagline;
    var blurb = $('p-blurb');
    blurb.textContent = p.blurb || '';
    blurb.hidden = !p.blurb;

    /* The PC furniture. "Windows 11 Pro included", a spec table, benchmark
     * tabs and a labor warranty all describe a computer; on a GPU stand every
     * one of them would be either empty or untrue. A spec table is kept if
     * KC did fill one in for an accessory — a cable's length, say. */
    $('p-price-note').hidden = acc;
    $('p-specs-block').hidden = acc && !p.specs.length;
    $('p-bench-block').hidden = acc;
    $('p-warranty').hidden = acc;

    $('p-specs').innerHTML = p.specs.map(function (s) {
      return '<dl class="spec"><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></dl>';
    }).join('');

    if (acc) $('p-scores').hidden = true;
    else renderBench(p);

    // Related stays within its kind: other machines under a machine, other
    // accessories under an accessory. Mixed, the cheapest stand would lead
    // "Also on the bench" under every $2,000 build, since the list runs
    // cheapest first.
    var related = window.PRODUCTS.filter(function (x) {
      return x.id !== p.id && isAccessory(x) === acc;
    }).slice(0, 4);
    $('p-related-label').textContent = acc ? 'More accessories' : 'Also on the bench';
    $('p-related').closest('section').hidden = !related.length;

    $('p-related').innerHTML = related
      .map(function (x) {
        return '<a class="card' + (x.inStock ? '' : ' card--out') + '" href="product.html?id=' + x.id + '">' +
          '<span class="card__shot"><img src="' + x.images[0] + '" alt="' + x.name + '"></span>' +
          '<span class="card__body">' +
            '<span class="card__title"><span class="name">' + x.name + '</span>' +
            '<span class="price">' + (x.priceMax > x.price ? 'From ' : '') + window.money(x.price) + '</span></span>' +
            '<span class="stock' + (x.inStock ? '' : ' is-out') + '">' + (x.inStock ? 'In stock' : 'Out of stock') + '</span>' +
          '</span></a>';
      }).join('');

    renderShot();
    renderOptions();
    renderPrice();
    renderAddons();
    renderBuy();
    paintSeo(p);
  }

  /* Paint straight away only if the static catalogue actually has this page.
   *
   * byId() falls back to Prime M for an id it does not know, which was harmless
   * when every page was a Prime. A deal or an accessory is only in Shopify, so
   * its page opened as a $1,900 Prime M — name, photo, specs, title — and then
   * swapped to a $15 stand a moment later. Until the live data lands, show
   * nothing rather than the wrong product.
   */
  var main = $('main');
  var known = (window.PRODUCTS_STATIC || []).some(function (x) { return x.id === handle; });
  resetSelection();
  if (known || !window.Shopify.configured) paint();
  else main.style.visibility = 'hidden';

  window.Shopify.loadProducts().then(function (list) {
    window.PRODUCTS = list;
    /* By the site's id first, then by Shopify handle. The Primes have ids of
     * their own (prime-s) that differ from their handles (beginner-build), and
     * links from KC's old Shopify storefront — /products/beginner-build, now
     * forwarded here by _redirects — carry the handle. */
    var fresh = list.filter(function (x) { return x.id === handle; })[0] ||
                list.filter(function (x) { return x.handle === handle; })[0];
    if (fresh) { p = fresh; shot = 0; resetSelection(); }
    paint();
    main.style.visibility = '';
  });
})();
