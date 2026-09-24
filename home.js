/* Home page: scroll-driven hero build sequence + pre-built configurator. */
(function () {
  'use strict';

  var CLIPS = ['media/clip1.mp4', 'media/clip2.mp4'];
  var SEAM = 0.5;        // clip 1 owns the first half of the scroll, clip 2 the second
  var HEAD_TRIM = 0.06;  // skip the static frames at the very start of clip 1
  var EASE = 0.12;       // playhead smoothing

  var target = 0, eased = 0, sv = null, lenis = null;

  var clamp = function (v) { return Math.min(1, Math.max(0, v)); };
  var smooth = function (t) { return t * t * (3 - 2 * t); };
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------------------------------------------------- scroll ---- */

  function readScroll() {
    var sec = $('hero');
    if (!sec) return;
    var span = sec.offsetHeight - window.innerHeight;
    target = span > 0 ? clamp(-sec.getBoundingClientRect().top / span) : 0;
  }
  window.addEventListener('scroll', readScroll, { passive: true });

  /* --------------------------------------------- layer sizing helpers ---- */

  // scrolly-video cover-sizes its canvas; force contain so the whole build shows
  function fitMedia() {
    ['clip-a', 'clip-b'].forEach(function (id) {
      var host = $(id);
      if (!host) return;
      host.querySelectorAll('canvas, video').forEach(function (el) {
        el.style.setProperty('position', 'absolute', 'important');
        el.style.setProperty('inset', '0', 'important');
        el.style.setProperty('width', '100%', 'important');
        el.style.setProperty('height', '100%', 'important');
        el.style.setProperty('object-fit', 'contain', 'important');
      });
    });
  }

  // the annotation layer tracks the letterboxed video box, not the viewport.
  // The dots are positioned in percentages of that box, so the ratio has to be
  // the footage's own — a hardcoded one silently drifts when the clips change.
  var FALLBACK_AR = 1928 / 1076;
  function clipAR() {
    var host = $('clip-a');
    var el = host && (host.querySelector('video') || host.querySelector('canvas'));
    var w = el && (el.videoWidth || el.width), h = el && (el.videoHeight || el.height);
    return (w && h) ? w / h : FALLBACK_AR;
  }

  function fitCallouts() {
    var layer = $('callouts'), stage = $('hero-stage');
    if (!layer || !stage) return;
    var W = stage.clientWidth, H = stage.clientHeight, AR = clipAR();
    var w = Math.min(W, H * AR), h = w / AR;
    layer.style.width = w + 'px';
    layer.style.height = h + 'px';
    layer.style.left = (W - w) / 2 + 'px';
    layer.style.top = (H - h) / 2 + 'px';
  }

  // A resize changes the band height but not the scroll position, so both the
  // idle short-circuit and the every-tenth-frame sample gate would hold the old
  // plate indefinitely. Dropping lastFill defeats both.
  window.addEventListener('resize', function () { fitMedia(); fitCallouts(); lastFill = null; });

  /* --------------------------------------------------- letterbox plate ---- */

  // The stage contains the frame rather than covering it, so a band is left
  // above it and below it. The upper band is filled from the frame row it
  // actually touches, so the bench reads as one field rather than a video
  // sitting in a box.
  var SITE = [250, 250, 250];   // var(--plate)
  var probe = null, plateRow = null, lastFill = null, pageBgSet = false, sampleTick = 0;

  var rgb = function (c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; };
  var lerp = function (a, b, k) {
    return a.map(function (v, i) { return Math.round(v + (b[i] - v) * k); });
  };

  // A frame row is not one colour across its width — the case is dark at the
  // left, the bench pale at the right — so sample N columns and take the median
  // rather than trusting whatever single pixel happens to sit in the middle.
  function sampleRow(live, vw, vh, frac) {
    var N = 16;
    if (!probe) { probe = document.createElement('canvas'); probe.width = N; probe.height = 1; }
    var g = probe.getContext('2d', { willReadFrequently: true });
    var band = Math.max(1, Math.round(vh * 0.006));
    var y = Math.max(0, Math.min(vh - band, Math.round(vh * frac)));

    g.clearRect(0, 0, N, 1);
    g.drawImage(live, 0, y, vw, band, 0, 0, N, 1);
    var d = g.getImageData(0, 0, N, 1).data;

    // an unpainted canvas reads as transparent black — reject the sample
    // rather than latching the plate to #000
    var alpha = 0, dark = 0, cols = [], i, c;
    for (i = 0; i < N; i++) {
      alpha += d[i * 4 + 3];
      c = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
      cols.push(c);
      if (c[0] < 12 && c[1] < 12 && c[2] < 12) dark++;
    }
    if (alpha / N < 250 || dark === N) return null;

    return [0, 1, 2].map(function (o) {
      var v = cols.map(function (x) { return x[o]; }).sort(function (a, b) { return a - b; });
      return Math.round((v[(N >> 1) - 1] + v[N >> 1]) / 2);
    });
  }

  function paintPlate(p) {
    var stage = $('hero-stage');
    if (!stage) return;

    // scrolly-video hides its <video> and paints into a canvas, and the video
    // comes first in the DOM — ask for the canvas explicitly, or the probe
    // reads a display:none element.
    var host = $(p >= SEAM ? 'clip-b' : 'clip-a');
    var live = host && (host.querySelector('canvas') || host.querySelector('video'));
    var vw = live && (live.videoWidth || live.width);
    var vh = live && (live.videoHeight || live.height);

    // one sample every ten frames is plenty — the plate tone drifts slowly
    sampleTick++;
    if (!live || !vw || !vh || (sampleTick % 10 && plateRow && lastFill)) return;

    try {
      var row = sampleRow(live, vw, vh, 0.002);
      if (row) plateRow = row;
    } catch (e) { /* not decodable yet — keep the last good row */ }
    if (!plateRow) return;

    var sh = stage.clientHeight, ar = vw / vh;
    var cw = Math.min(stage.clientWidth, sh * ar);
    var top = Math.round((sh - cw / ar) / 2);

    // settles onto the site's own plate colour as the hero releases
    var exit = smooth(clamp((p - 0.88) / 0.12));
    var topCol = rgb(lerp(plateRow, SITE, exit));
    // Below the frame the page just becomes the page — no sampled bench tone,
    // so there is no grey bar hanging under the hero. A visible seam at the
    // frame's bottom edge is the accepted trade.
    var footCol = rgb(SITE);
    var fill = 'linear-gradient(to bottom, ' + topCol + ' 0px, ' + topCol + ' ' + top +
      'px, ' + footCol + ' ' + top + 'px, ' + footCol + ' 100%)';
    if (fill !== lastFill) { lastFill = fill; stage.style.background = fill; }

    // The sampled tone belongs to the bands inside the stage only — painting it
    // onto body/html put a bench-grey field under the whole page.
    if (!pageBgSet) {
      pageBgSet = true;
      document.documentElement.style.background = footCol;
      document.body.style.background = footCol;
    }
  }

  /* ------------------------------------------------------- rAF driver ---- */

  var coItems = null;
  var lastP = null, lastOnB = null, lastWant = -1, loopWarned = false;

  function frame(time) {
    try { tick(time); }
    catch (err) {
      if (!loopWarned) { loopWarned = true; console.error('[hero loop]', err); }
    }
    finally { requestAnimationFrame(frame); }
  }

  function tick(time) {
    if (!lenis && window.Lenis) {
      lenis = new window.Lenis({
        duration: 1.15,
        smoothWheel: true,
        anchors: { offset: -72 },
        easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }
      });
    }
    if (lenis) lenis.raf(time);

    eased += (target - eased) * EASE;
    if (Math.abs(target - eased) < 0.0002) eased = target;
    var p = eased;

    // Idle short-circuit. The seek, the pixel probe and the style writes below
    // only matter when the scroll position actually moved, and running them on
    // every frame at rest was most of the cost. At scrollY 0 the position never
    // changes, though, so keep going until the plate has landed once — gating
    // on the scroll delta alone left the hero on its fallback grey until the
    // visitor scrolled.
    if (lastP !== null && Math.abs(p - lastP) < 0.0004 && plateRow && lastFill) return;
    lastP = p;

    // build clip 2 a little before it is needed, so the seam is not a stall
    if (p > SEAM - 0.22) ensureClip2();

    // Only the clip on screen gets seeked — driving both doubles the decode
    // cost for a frame nobody sees.
    var onB = p >= SEAM;
    var want = onB ? clamp((p - SEAM) / (1 - SEAM))
                   : HEAD_TRIM + clamp(p / SEAM) * (1 - HEAD_TRIM);
    if (sv && sv[onB ? 1 : 0] &&
        (onB !== lastOnB || Math.abs(want - lastWant) > 0.0006)) {
      lastOnB = onB; lastWant = want;
      sv[onB ? 1 : 0].setTargetTimePercent(want, { jump: true });
    }

    // hard cut at the seam — clip 1's last frame straight into clip 2's first
    var mix = onB ? 1 : 0;
    var b = $('clip-b');
    if (b) b.style.opacity = mix;

    paintPlate(p);

    // headline clears out as soon as the build starts moving
    var out = 1 - smooth(clamp((p - 0.01) / 0.13));
    var title = $('hero-title');
    if (title) title.style.opacity = out;

    // annotations ride the exploded beat, then clear as the parts go in
    var layer = $('callouts');
    var CO_IN = 0.40, CO_OUT = 0.50;
    var shown = smooth(clamp((p - CO_IN) / 0.035)) * (1 - smooth(clamp((p - CO_OUT) / 0.045)));
    if (layer) {
      layer.style.opacity = shown;
      layer.style.visibility = shown > 0.001 ? 'visible' : 'hidden';
      if (!coItems) {
        // stagger by row — the heading, then each label with the dot it points
        // at, top down — rather than by flat node order, which cascades in a
        // sequence that has nothing to do with what the eye is following
        coItems = [];
        var heads = layer.querySelectorAll('.co-head, .co-sub');
        Array.prototype.forEach.call(heads, function (el) { coItems.push([el, 0]); });
        var labels = layer.querySelectorAll('.co-label');
        var dots = layer.querySelectorAll('.co-dot');
        Array.prototype.forEach.call(labels, function (el, i) {
          coItems.push([el, i + 1]);
          if (dots[i]) coItems.push([dots[i], i + 1]);
        });
      }
      coItems.forEach(function (pair) {
        var s = smooth(clamp((p - CO_IN - pair[1] * 0.0025) / 0.035)) *
                (1 - smooth(clamp((p - CO_OUT) / 0.045)));
        pair[0].style.opacity = s;
        pair[0].style.transform = 'translateY(' + ((1 - s) * 7) + 'px)';
      });
    }

    // spec card unfolds over the final stretch, fully open as the build finishes
    var e = smooth(clamp((p - 0.78) / 0.2));
    var card = $('hero-card'), det = $('card-specs'), tier = $('card-tier');
    if (card && det) {
      var inner = det.firstElementChild;
      card.style.width = (268 + Math.min(250, window.innerWidth * 0.17) * e) + 'px';
      card.style.bottom = (34 + 56 * e) + 'px';
      card.style.opacity = 1 - shown;
      card.style.visibility = shown > 0.985 ? 'hidden' : 'visible';
      det.style.height = (inner ? inner.offsetHeight * e : 0) + 'px';
      det.style.opacity = e;
      if (tier) tier.style.opacity = smooth(clamp((p - 0.88) / 0.1));
    }
  }

  /* ------------------------------------------------------- video init ---- */

  // scrolly-video's WebCodecs path decodes every frame into memory up front —
  // 289 frames at 1928x1076 is roughly 900MB per clip, and the two clips are
  // 27MB to download before any of that starts. A phone will not carry it: the
  // scrub stuttered, the decode got dropped, and the tab was killed outright on
  // smaller devices. Below the breakpoint the hero is a still of the finished
  // build instead (.hero__still), and nothing here runs at all.
  var SMALL = window.matchMedia('(max-width: 860px)');

  function makeClip(i) {
    return new window.ScrollyVideo({
      scrollyVideoContainer: $(i === 0 ? 'clip-a' : 'clip-b'),
      src: CLIPS[i],
      cover: false, sticky: false, full: false, trackScroll: false,
      transitionSpeed: 12, frameThreshold: 0.02,
      useWebCodecs: !SMALL.matches
    });
  }

  // Clip 2 is invisible until the seam at 50%. On a phone, building it up
  // front doubles both the memory bill and the initial download for nothing,
  // so hold it until the scroll gets close.
  function ensureClip2() {
    if (!sv || sv[1] || !window.ScrollyVideo) return;
    sv[1] = makeClip(1);
    fitMedia();
    // it sits at t=0 until the seam; nudge it so it actually decodes
    setTimeout(function () {
      if (!sv[1]) return;
      sv[1].setTargetTimePercent(0.35, { jump: true });
      setTimeout(function () {
        if (sv[1]) sv[1].setTargetTimePercent(0, { jump: true });
      }, 400);
    }, 300);
  }

  function initVideo() {
    // The still is doing the job; do not fetch or decode a frame of video.
    if (SMALL.matches) return;

    var a = $('clip-a'), b = $('clip-b');
    if (!window.ScrollyVideo || !a || !b) { setTimeout(initVideo, 250); return; }

    sv = [makeClip(0), null];

    readScroll();
    eased = target;
    fitMedia();
    fitCallouts();

    var mo = new MutationObserver(fitMedia);
    [a, b].forEach(function (n) {
      mo.observe(n, { attributes: true, attributeFilter: ['style', 'width', 'height'], childList: true, subtree: true });
    });

    // desktop has the headroom, so keep clip 2 warm from the start
    setTimeout(ensureClip2, 600);
  }

  // A phone rotated into landscape, or a window dragged wider, crosses the
  // breakpoint with no video built — pick it up rather than leaving the still.
  var onBreakpoint = function (e) { if (!e.matches && !sv) initVideo(); };
  if (SMALL.addEventListener) SMALL.addEventListener('change', onBreakpoint);
  else if (SMALL.addListener) SMALL.addListener(onBreakpoint);

  /* ----------------------------------------------------- configurator ---- */

  // The panel is narrow, so it uses the short forms of two spec labels. The
  // catalogue keeps the long ones, which is what the shop and product pages
  // want.
  var CFG_LABEL = { Memory: 'RAM', Power: 'PSU' };

  var SITE = window.SHOPIFY_CONFIG || {};
  var PRIME_HANDLE = (SITE.collections || {}).prime || 'pre-builts';

  /* One configurator, mounted on a section.
   *
   * This used to be a single block wired to fixed ids, which is why there
   * could only ever be one. Everything is found inside `root` by data-cfg and
   * the chosen machine lives in this closure, so AMD Prime and Intel Prime
   * each get their own and picking a chip in one leaves the other alone.
   */
  function configurator(root) {
    var el = function (name) { return root.querySelector('[data-cfg="' + name + '"]'); };
    var list = [];
    var section = null;
    var selected = null;

    root.addEventListener('click', function (ev) {
      var chip = ev.target.closest('.chip');
      if (!chip || !root.contains(chip)) return;
      selected = chip.getAttribute('data-id');
      render();
    });

    function render() {
      if (!list.length) return;
      // Opens on the middle of the range — the Prime M of five, as it always
      // did — and on the only machine when there is one.
      var p = list.filter(function (x) { return x.id === selected; })[0] ||
              list[Math.floor((list.length - 1) / 2)];
      selected = p.id;

      // The collection's own name and eyebrow once Shopify has answered, so
      // renaming "AMD Prime" in Admin renames it here too.
      if (section) {
        el('title').textContent = section.title;
        el('label').textContent = section.title.toUpperCase();
        el('eyebrow').textContent = section.eyebrow || '';
        el('eyebrow').hidden = !section.eyebrow;
        el('all').href = 'shop.html#collection-' + encodeURIComponent(section.handle);
      }

      el('chips').innerHTML = list.map(function (x) {
        return '<button class="chip' + (x.id === p.id ? ' is-active' : '') + '" data-id="' + x.id + '">' + x.name + '</button>';
      }).join('');

      // Pick rows by name, not by position. Taking the first N meant that adding
      // a spec field anywhere above them silently changed the home page. Every
      // hardware component is listed, in the product page's order; the OS is
      // left to the line under the price, which already says it.
      var want = ['CPU', 'Motherboard', 'Cooler', 'GPU', 'Memory', 'Storage', 'Power', 'Case'];
      var byLabel = {};
      p.specs.forEach(function (sp) { byLabel[sp[0]] = sp[1]; });
      var picked = want.filter(function (l) { return byLabel[l]; })
                       .map(function (l) { return [l, byLabel[l]]; });
      // an unfamiliar catalogue still fills the panel rather than emptying it
      if (!picked.length) picked = p.specs.slice(0, 8);

      el('specs').innerHTML = picked.map(function (sp) {
        return '<dl class="spec"><dt>' + (CFG_LABEL[sp[0]] || sp[0]) + '</dt><dd>' + sp[1] + '</dd></dl>';
      }).join('');

      // two games here; the full set is on the product page. Rows carry KC's own
      // wording ("~240+FPS"), so the label is printed rather than rebuilt.
      var top = (p.fps || []).slice(0, 2);
      var topMax = top.reduce(function (a, r) { return Math.max(a, r.value || 0); }, 1);
      el('bench').innerHTML = top.map(function (f, i) {
        var w = typeof f.value === 'number' ? Math.round(f.value / topMax * 210) : 210;
        return '<div class="bench"><span class="bench__game">' + f.label + '</span>' +
          '<span class="bench__bar' + (i === 1 ? ' bench__bar--2' : '') +
          '" style="flex:0 1 ' + w + 'px"></span>' +
          '<span class="bench__fps">' + f.text + '</span></div>';
      }).join('');
      // no heading over an empty space when a machine has no numbers yet
      el('bench-wrap').hidden = !top.length;

      if (p.images[0]) el('img').src = p.images[0];
      el('img').alt = p.name + ' build';
      el('tag').textContent = p.name + ' — AS BUILT';
      el('price').textContent = window.money(p.price);
      el('sub').innerHTML = p.name + ' &middot; Win 11 Pro included';
      el('buy').href = 'product.html?id=' + p.id;
    }

    return {
      update: function (products, sec) {
        list = products || [];
        section = sec || null;
        render();
      }
    };
  }

  // Taken before anything renders, so every copy starts from the untouched
  // markup rather than from whatever AMD Prime happens to be showing.
  var configTemplate = $('prebuilts').cloneNode(true);
  var primeConfig = configurator($('prebuilts'));
  var extraConfigs = [];

  /* A configurator for each collection in homeConfigurators, directly under
   * AMD Prime's, in the order listed. Built from Shopify data only: there is
   * no static fallback for them, so with Shopify unreachable they simply do
   * not appear, rather than showing an empty panel. */
  function renderExtraConfigurators(sections) {
    extraConfigs.forEach(function (node) { node.parentNode.removeChild(node); });
    extraConfigs = [];
    var blocks = [];

    var after = $('prebuilts');
    (SITE.homeConfigurators || []).forEach(function (handle) {
      var sec = (sections || []).filter(function (s) { return s.handle === handle; })[0];
      if (!sec || !sec.products.length) return;

      var node = configTemplate.cloneNode(true);
      node.id = 'home-' + handle;
      after.parentNode.insertBefore(node, after.nextSibling);
      after = node;
      extraConfigs.push(node);
      configurator(node).update(sec.products, sec);
      blocks.push({ el: node, order: sec.homeOrder });
    });
    return blocks;
  }

  /* The compact card every home row uses. `pill` is the small blue badge the
   * one-time deals carry; the collections KC adds have nothing to claim there,
   * so they pass nothing.
   */
  function compactCard(p, pill) {
    var spec = function (label) {
      return (p.specs.filter(function (s) { return s[0] === label; })[0] || [])[1];
    };
    // no stock pill on the home rows — the shop grid is where stock is read
    return '<a class="card card--deal' + (p.inStock ? '' : ' card--out') + '" href="product.html?id=' + p.id + '">' +
      '<span class="card__shot">' +
        '<img src="' + p.images[0] + '" alt="' + p.name + '" loading="lazy" decoding="async">' +
      '</span>' +
      '<span class="card__body">' +
        '<span class="card__title"><span class="price">' + window.money(p.price) + '</span>' +
        (pill ? '<span class="pill pill--blue">' + pill + '</span>' : '') + '</span>' +
        '<span class="name">' + p.name + '</span>' +
        '<span class="sub">' +
          // an accessory has no memory or storage to list, so say what it comes in
          (p.kind === 'accessory'
            ? ((p.options && p.options[0]) ? window.Shopify.esc(p.options[0].values.join(' · ')) : '')
            : [spec('Memory'), spec('Storage'), spec('Case')].filter(Boolean).join(' &middot; ')) +
        '</span>' +
      '</span></a>';
  }

  function renderDeals(section) {
    // Heading and sub-line from the collection itself, like every other section
    if (section) {
      var head = $('deals').querySelector('.section__head');
      head.querySelector('h2').textContent = section.title;
      var eb = head.querySelector('.eyebrow');
      eb.textContent = section.eyebrow || '';
      eb.hidden = !section.eyebrow;
    }
    var deals = window.PRODUCTS.filter(function (p) { return p.kind === 'deal'; });
    $('deal-grid').innerHTML = deals.map(function (p) { return compactCard(p, '1 of 1'); }).join('');
    // KC sells the one-offs as he gets them, so there will be stretches with
    // none. Hide the section rather than stand its heading over a blank row.
    var section = $('deals');
    if (section) section.hidden = !deals.length;
  }

  /* Collections KC has given a home_order, in the order he asked for.
   *
   * One row of four each. The home page is a shop window rather than the shop,
   * so a filled-up category adds a row, not twelve cards — the heading link
   * carries the rest to the shop page, where the section is listed in full.
   */
  function renderCollections(sections) {
    var flow = $('home-flow');
    var esc = window.Shopify.esc;

    // Last pass's rows go; this pass's are built fresh. Each is its own
    // section in the flow, so it can sort between the fixed blocks.
    Array.prototype.slice.call(flow.querySelectorAll('.home-collection'))
      .forEach(function (el) { el.parentNode.removeChild(el); });

    var rows = window.Shopify.homeSections(sections);
    var holder = document.createElement('div');
    holder.innerHTML = rows.map(function (s) {
      var shown = s.products.slice(0, 4);
      return '<section class="section section--tight home-collection" id="home-' + esc(s.handle) + '">' +
        '<div class="section__head">' +
          (s.eyebrow ? '<span class="eyebrow">' + esc(s.eyebrow) + '</span>' : '') +
          '<h2>' + esc(s.title) + '</h2>' +
          '<a class="spacer" style="font:600 13.5px var(--ui);color:var(--blue)" ' +
            'href="shop.html#collection-' + esc(s.handle) + '">' +
            (s.products.length > shown.length
              ? 'See all ' + s.products.length + ' &rarr;'
              : 'See all &rarr;') +
          '</a>' +
        '</div>' +
        (s.description ? '<p class="section__lede">' + esc(s.description) + '</p>' : '') +
        '<div class="grid grid--4">' +
          shown.map(function (p) { return compactCard(p, ''); }).join('') +
        '</div>' +
      '</section>';
    }).join('');

    var nodes = Array.prototype.slice.call(holder.children);
    nodes.forEach(function (el) { flow.insertBefore(el, $('build-your-own')); });
    return rows.map(function (s, i) { return { el: nodes[i], order: s.homeOrder }; });
  }

  /* Put every home section in KC's home_order (see Shopify.byOrder).
   *
   * AMD Prime, the Intel configurator and One Time Deals used to hold fixed
   * spots whatever their collections were numbered, so the numbers only sorted
   * the card rows against each other — which put Budget (2) below One Time
   * Deals (4). They all sort together now. "Spec your own machine" is not a
   * collection, so its number comes from customBuildHomeOrder instead.
   */
  function arrangeHome(blocks) {
    var flow = $('home-flow');
    window.Shopify.byOrder(blocks).forEach(function (b) { flow.appendChild(b.el); });
  }

  /* -------------------------------------------------------------- go ---- */

  // Nothing is drawn from a catalogue of our own any more, so the sections
  // below the hero stay empty until Shopify answers. The hero, the manifesto
  // and the custom-build block are ours and show immediately.
  $('prebuilts').hidden = true;
  $('deals').hidden = true;
  readScroll();
  eased = target;
  fitCallouts();
  requestAnimationFrame(frame);
  initVideo();

  // Live Shopify pricing, stock and collections, once they arrive. The static
  // catalogue has no collections, so the first pass above renders none.
  window.Shopify.loadCatalogue().then(function (cat) {
    if (cat.error) {
      // Say so where the machines would have been, and leave the rest of the
      // page — the hero and the custom-build block — as it is.
      var box = document.createElement('section');
      box.className = 'section section--tight';
      box.innerHTML = window.Shopify.unavailableHtml('our machines');
      $('home-flow').insertBefore(box, $('build-your-own'));
      return;
    }

    $('prebuilts').hidden = false;
    window.PRODUCTS = cat.products;
    var primeSection = cat.sections.filter(function (s) { return s.handle === PRIME_HANDLE; })[0];
    primeConfig.update(
      primeSection ? primeSection.products
                   : cat.products.filter(function (p) { return p.kind === 'prime'; }),
      primeSection);
    var configs = renderExtraConfigurators(cat.sections);
    var dealSection = cat.sections.filter(function (s) { return s.kind === 'deal'; })[0];
    renderDeals(dealSection);
    // A collection with its own configurator is not repeated as a card row.
    var asConfig = SITE.homeConfigurators || [];
    var rows = renderCollections(cat.sections.filter(function (s) { return asConfig.indexOf(s.handle) === -1; }));

    var custom = typeof SITE.customBuildHomeOrder === 'number' ? SITE.customBuildHomeOrder : null;
    // Listed in the page's natural order, which is what unnumbered sections
    // and ties fall back to.
    arrangeHome([{ el: $('prebuilts'), order: primeSection ? primeSection.homeOrder : null }]
      .concat(configs)
      .concat([{ el: $('deals'), order: dealSection ? dealSection.homeOrder : null }])
      .concat(rows)
      .concat([{ el: $('build-your-own'), order: custom }]));
  });
})();
