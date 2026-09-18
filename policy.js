/* The Privacy Policy and Terms & Conditions pages.
 *
 * Both are shown word for word as KC's Shopify store publishes them — the same
 * text a customer is linked to at checkout — so there is one policy to keep
 * current, in Admin -> Settings -> Policies, and never a second copy here that
 * drifts from it. Shopify also rewrites its generated policies when the law
 * changes, which a copy pasted into this repo would silently miss.
 *
 * Why it is fetched the long way round. The Storefront API does hand over the
 * policy, but as Shopify's raw template: literal {{ shop_name }} and
 * {{ last_updated }} placeholders, and {% if selling_to_europe %} blocks that
 * depend on store settings the API does not expose. Filling those in here
 * would mean guessing at four settings and inventing a "last updated" date.
 * So the API is only asked WHERE the policy lives, and the page Shopify has
 * already rendered is fetched instead.
 *
 * A browser will not fetch that page from this site directly — Shopify sends
 * no CORS header — so Netlify fetches it on the server: _redirects proxies
 * /policy-src/ to KC's policies on checkout.shopify.com. That also means
 * this only works on the deployed site; locally, and if anything fails, the
 * page says so and links to the policy on Shopify rather than showing nothing.
 */
(function () {
  'use strict';

  var root = document.getElementById('policy');
  if (!root) return;

  var which = root.getAttribute('data-policy');          // privacyPolicy | termsOfService
  var name = root.getAttribute('data-name') || 'this policy';
  var PROXY = '/policy-src';
  var CONTACT = '<a href="contact.html">get in touch with KC</a>';

  function show(message) {
    root.innerHTML = '<p class="policy__status">' + message + '</p>';
    root.setAttribute('aria-busy', 'false');
  }

  /* Only KC's own policy text survives: no scripts, styles, frames, forms or
   * inline handlers, and no javascript: links. It comes from KC's own store,
   * but it is still HTML fetched from somewhere else and put into this page.
   * Links open in a new tab, since every one of them leaves the site. */
  function clean(node) {
    Array.prototype.forEach.call(
      node.querySelectorAll('script, style, link, meta, iframe, object, embed, form, input, button'),
      function (el) { el.parentNode.removeChild(el); });

    Array.prototype.forEach.call(node.querySelectorAll('*'), function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (at) {
        var n = at.name.toLowerCase();
        // aria-describedby pointed at Shopify's hidden strings, which are not kept
        if (n.indexOf('on') === 0 || n === 'style' || n === 'class' || n === 'id' ||
            n === 'aria-describedby') el.removeAttribute(at.name);
        if ((n === 'href' || n === 'src') && /^\s*javascript:/i.test(at.value)) el.removeAttribute(at.name);
      });
      if (el.tagName === 'A' && el.getAttribute('href')) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener');
      }
    });
    return node;
  }

  if (!window.Shopify || !window.Shopify.configured) {
    show('The ' + name + ' could not be loaded. Please ' + CONTACT + ' for a copy.');
    return;
  }

  var policyUrl = null;

  window.Shopify.query('{ shop { policy: ' + which + ' { url } } }')
    .then(function (data) {
      var policy = data.shop && data.shop.policy;
      // Not written in Shopify yet. Say so plainly rather than show a blank page.
      if (!policy) {
        show('KC has not published the ' + name + ' yet. If you have a question about ordering, ' +
             'warranty or returns in the meantime, please ' + CONTACT + '.');
        return;
      }
      policyUrl = policy.url;

      var src = new URL(policy.url);
      // The proxy only covers checkout.shopify.com; anywhere else, link to it.
      if (src.hostname !== 'checkout.shopify.com') throw new Error('policy is not on checkout.shopify.com');

      return fetch(PROXY + src.pathname + src.search)
        .then(function (r) {
          if (!r.ok) throw new Error('policy request returned ' + r.status);
          return r.text();
        })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          // Shopify's policy page: the policy is the body's first block, and a
          // second, hidden one holds screen-reader strings that belong to its
          // own layout. A 404 page or anything else unexpected is rejected
          // rather than shown as though it were the policy.
          var content = doc.body && doc.body.classList.contains('page-policies')
            ? doc.body.querySelector(':scope > div') : null;
          if (!content || !content.textContent.trim()) throw new Error('unexpected policy page');

          root.innerHTML = '';
          root.appendChild(clean(document.importNode(content, true)));
          root.setAttribute('aria-busy', 'false');
        });
    })
    .catch(function (err) {
      console.warn('[policy]', err.message);
      show(policyUrl
        ? 'The ' + name + ' could not be shown here. <a href="' + policyUrl.replace(/"/g, '&quot;') +
          '" target="_blank" rel="noopener">Read it on Shopify</a>, or ' + CONTACT + '.'
        : 'The ' + name + ' could not be loaded. Please ' + CONTACT + ' for a copy.');
    });
})();
