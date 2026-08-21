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

  /* Netlify strips data-netlify during post-processing, so the attribute
   * still being here at runtime means the build never scanned this page and
   * the form is not registered.
   *
   * This used to also stand down on any *.netlify.app hostname, which was
   * wrong: being served by Netlify is not the same as having been processed
   * by it. On a Netlify site whose deploy predated form detection, the
   * hostname matched, this script stood aside, and the browser posted
   * straight at a static file — a 404, with the fallback that exists to
   * prevent exactly that sitting switched off. The attribute is the only
   * signal that actually means anything.
   */
  if (!form.hasAttribute('data-netlify')) return;

  var MAILTO = 'fegelykc@gmail.com';

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
