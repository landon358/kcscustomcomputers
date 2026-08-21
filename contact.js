/* Contact form.
 *
 * The form is written for Netlify Forms — data-netlify, a honeypot, and a
 * form-name input. Netlify wires those up at deploy time by parsing the HTML,
 * which means they only do anything on a site Netlify itself deploys.
 *
 * This site is on GitHub Pages, where a POST to a static file is a 405. So
 * until it moves, submission falls back to opening the visitor's mail client
 * with everything they typed already in the body — nothing is lost, and the
 * moment the site is deployed to Netlify this script stands down on its own.
 */
(function () {
  'use strict';

  var form = document.querySelector('form[name="contact"]');
  if (!form) return;

  // Netlify strips data-netlify at deploy time, so its presence at runtime is
  // a reliable signal that the build never processed this page.
  var onNetlify = !form.hasAttribute('data-netlify') ||
    /\.netlify\.(app|com)$/.test(location.hostname);
  if (onNetlify) return;

  var MAILTO = 'hello@kccustom.pc';

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var get = function (n) {
      var el = form.querySelector('[name="' + n + '"]');
      return el ? el.value.trim() : '';
    };
    if (!get('name') || !get('email') || !get('message')) return;

    var body = [
      'Name: ' + get('name'),
      'Email: ' + get('email'),
      get('phone') ? 'Phone: ' + get('phone') : null,
      'About: ' + get('topic'),
      '',
      get('message')
    ].filter(function (l) { return l !== null; }).join('\n');

    window.location.href = 'mailto:' + MAILTO +
      '?subject=' + encodeURIComponent('Website enquiry — ' + get('name')) +
      '&body=' + encodeURIComponent(body);

    var hint = document.getElementById('contact-fallback');
    if (hint) hint.hidden = false;
  });
})();
