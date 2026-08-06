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

  // the annotation layer tracks the letterboxed video box, not the viewport
  function fitCallouts() {
    var layer = $('callouts'), stage = $('hero-stage');
    if (!layer || !stage) return;
    var W = stage.clientWidth, H = stage.clientHeight, AR = 1928 / 1072;
    var w = Math.min(W, H * AR), h = w / AR;
    layer.style.width = w + 'px';
    layer.style.height = h + 'px';
    layer.style.left = (W - w) / 2 + 'px';
    layer.style.top = (H - h) / 2 + 'px';
  }

  window.addEventListener('resize', function () { fitMedia(); fitCallouts(); });

  /* ------------------------------------------------------- rAF driver ---- */

  var coItems = null;

  function frame(time) {
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

    if (sv) {
      sv[0].setTargetTimePercent(HEAD_TRIM + clamp(p / SEAM) * (1 - HEAD_TRIM), { jump: true });
      sv[1].setTargetTimePercent(clamp((p - SEAM) / (1 - SEAM)), { jump: true });
    }

    // hard cut at the seam — clip 1's last frame straight into clip 2's first
    var mix = p >= SEAM ? 1 : 0;
    var b = $('clip-b');
    if (b) b.style.opacity = mix;

    // page background tracks the plate colour of whichever clip is showing
    var host = $(mix > 0.5 ? 'clip-b' : 'clip-a');
    var canvas = host && host.querySelector('canvas');
    if (canvas && canvas.width) {
      try {
        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        var d = ctx.getImageData(Math.floor(canvas.width / 2), 2, 1, 1).data;
        if (d[3] > 0) {
          var col = 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')';
          if (col !== frame.lastPlate) {
            frame.lastPlate = col;
            document.documentElement.style.background = col;
            document.body.style.background = col;
          }
        }
      } catch (e) { /* tainted canvas — keep the static plate colour */ }
    }

    // headline clears out as soon as the build starts moving
    var out = 1 - smooth(clamp((p - 0.01) / 0.13));
    var title = $('hero-title');
    if (title) title.style.opacity = out;

    // component annotations land on clip 1's exploded end state
    var layer = $('callouts');
    var shown = smooth(clamp((p - 0.34) / 0.07)) * (1 - smooth(clamp((p - 0.455) / 0.05)));
    if (layer) {
      layer.style.opacity = shown;
      layer.style.visibility = shown > 0.001 ? 'visible' : 'hidden';
      if (!coItems) coItems = Array.prototype.slice.call(layer.querySelectorAll('.co-label, .co-dot, .co-head'));
      coItems.forEach(function (el, i) {
        var s = smooth(clamp((p - 0.34 - (i % 10) * 0.006) / 0.055)) * (1 - smooth(clamp((p - 0.455) / 0.05)));
        el.style.opacity = s;
        el.style.transform = 'translateY(' + ((1 - s) * 7) + 'px)';
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

    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------- video init ---- */

  function initVideo() {
    var a = $('clip-a'), b = $('clip-b');
    if (!window.ScrollyVideo || !a || !b) { setTimeout(initVideo, 250); return; }

    sv = CLIPS.map(function (src, i) {
      return new window.ScrollyVideo({
        scrollyVideoContainer: i === 0 ? a : b,
        src: src,
        cover: false, sticky: false, full: false, trackScroll: false,
        transitionSpeed: 12, frameThreshold: 0.02
      });
    });

    readScroll();
    eased = target;
    fitMedia();
    fitCallouts();

    var mo = new MutationObserver(fitMedia);
    [a, b].forEach(function (n) {
      mo.observe(n, { attributes: true, attributeFilter: ['style', 'width', 'height'], childList: true, subtree: true });
    });

    // clip 2 sits at t=0 through the whole first half; nudge it so it decodes
    setTimeout(function () {
      sv[1].setTargetTimePercent(0.35, { jump: true });
      setTimeout(function () { sv[1].setTargetTimePercent(0, { jump: true }); }, 400);
    }, 600);
  }

  /* ----------------------------------------------------- configurator ---- */

  var selected = 'prime-m';

  function renderConfig() {
    var primes = window.PRODUCTS.filter(function (p) { return p.kind === 'prime'; });
    var p = primes.filter(function (x) { return x.id === selected; })[0] || primes[2];
    var max = 370;

    $('cfg-chips').innerHTML = primes.map(function (x) {
      return '<button class="chip' + (x.id === selected ? ' is-active' : '') + '" data-id="' + x.id + '">' + x.name + '</button>';
    }).join('');

    $('cfg-specs').innerHTML = p.specs.slice(0, 6).map(function (s) {
      return '<dl class="spec"><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></dl>';
    }).join('');

    $('cfg-bench').innerHTML = p.fps.map(function (f, i) {
      return '<div class="bench"><span class="bench__game">' + f[0] + '</span>' +
        '<span class="bench__bar' + (i === 1 ? ' bench__bar--2' : i === 2 ? ' bench__bar--3' : '') +
        '" style="flex:0 1 ' + Math.round(f[1] / max * 210) + 'px"></span>' +
        '<span class="bench__fps">' + f[1] + ' fps</span></div>';
    }).join('');

    $('cfg-img').src = p.images[0];
    $('cfg-img').alt = p.name + ' build';
    $('cfg-tag').textContent = p.name.toUpperCase() + ' — AS BUILT';
    $('cfg-price').textContent = window.money(p.price);
    $('cfg-sub').innerHTML = p.name + ' &middot; Win 11 Pro included';
    $('cfg-buy').href = 'product.html?id=' + p.id;
  }

  function renderDeals() {
    $('deal-grid').innerHTML = window.PRODUCTS.filter(function (p) { return p.kind === 'deal'; }).map(function (p) {
      var mem = (p.specs.filter(function (s) { return s[0] === 'Memory'; })[0] || [])[1];
      var sto = (p.specs.filter(function (s) { return s[0] === 'Storage'; })[0] || [])[1];
      var cse = (p.specs.filter(function (s) { return s[0] === 'Case'; })[0] || [])[1];
      return '<a class="card card--deal' + (p.inStock ? '' : ' card--out') + '" href="product.html?id=' + p.id + '">' +
        '<span class="card__shot">' +
          '<span class="pill ' + (p.inStock ? 'pill--stock' : 'pill--out') + '">' + (p.inStock ? 'In stock' : 'Out of stock') + '</span>' +
          '<img src="' + p.images[0] + '" alt="' + p.name + '">' +
        '</span>' +
        '<span class="card__body">' +
          '<span class="card__title"><span class="price">' + window.money(p.price) + '</span>' +
          '<span class="pill pill--blue">1 of 1</span></span>' +
          '<span class="name">' + p.name + '</span>' +
          '<span class="sub">' + [mem, sto, cse].filter(Boolean).join(' &middot; ') + '</span>' +
        '</span></a>';
    }).join('');
  }

  document.addEventListener('click', function (ev) {
    var chip = ev.target.closest('.chip');
    if (!chip) return;
    selected = chip.getAttribute('data-id');
    renderConfig();
  });

  /* -------------------------------------------------------------- go ---- */

  renderConfig();
  renderDeals();
  readScroll();
  eased = target;
  fitCallouts();
  requestAnimationFrame(frame);
  initVideo();

  // Live Shopify pricing and stock, once it arrives.
  window.Shopify.loadProducts().then(function (list) {
    window.PRODUCTS = list;
    renderConfig();
    renderDeals();
  });
})();
