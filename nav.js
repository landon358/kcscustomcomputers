/* Nav: mobile toggle, and the solid bar once the hero is past. */
(function () {
  var btn = document.getElementById('nav-toggle');
  var menu = document.getElementById('nav-actions');
  if (!btn || !menu) return;

  btn.addEventListener('click', function () {
    var open = menu.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // close after tapping a link
  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) {
      menu.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  /* The home page's bar is transparent on purpose — the hero frame runs
   * straight through it, which is how the sequence reads as one field rather
   * than a video in a box. That only works while the hero is behind it. Once
   * the page scrolls on, the wordmark and links sit on whatever section
   * happens to be underneath, and against the pale manifesto type they stop
   * being readable.
   *
   * Watched with an IntersectionObserver rather than a scroll handler. The
   * home page scrolls under Lenis and the hero is a sticky stage inside a
   * 420vh section, so "has the hero gone past" is a question about geometry,
   * not about scroll offsets — and the observer answers it without running
   * anything on every frame of a scroll that is already driving a video.
   *
   * Every other page ships nav--solid in its markup and is left alone.
   */
  var nav = document.querySelector('.nav');
  var hero = document.getElementById('hero');

  if (nav && hero && !nav.classList.contains('nav--solid') && window.IntersectionObserver) {
    // fires the moment the hero's last pixel clears the bottom of the bar
    new IntersectionObserver(function (entries) {
      nav.classList.toggle('nav--solid', !entries[0].isIntersecting);
    }, { rootMargin: '-' + nav.offsetHeight + 'px 0px 0px 0px', threshold: 0 })
      .observe(hero);
  }
})();
