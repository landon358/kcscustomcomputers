/* Mobile navigation toggle, shared by every page. */
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
})();
