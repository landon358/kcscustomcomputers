/* Build Custom configurator: pick a part per category, then send the list to KC. */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var cats = window.CATEGORIES;
  var active = 0;
  var sel = {};        // categoryId -> optionId
  var caseText = '';

  // The case step offers both stocked chassis and a free-text description, so
  // either one satisfies it. Every other step is card-only.
  function filled(c) {
    if (sel[c.id]) return true;
    return !!c.freeText && caseText.trim().length > 0;
  }

  function chosenName(c) {
    var o = chosenOpt(c);
    if (o) return o.name;
    return c.freeText ? caseText.trim() : '';
  }

  function chosenOpt(c) {
    return (c.options || []).filter(function (x) { return x.id === sel[c.id]; })[0] || null;
  }

  function complete() { return cats.every(filled); }

  /* --------------------------------------------------------- render ---- */

  function renderSummary() {
    var done = cats.filter(filled).length;
    $('#sum-count').textContent = done + ' of ' + cats.length;
    $('#sum-bar').style.width = (done / cats.length * 100) + '%';

    $('#slots').innerHTML = cats.map(function (c, i) {
      var on = filled(c);
      var o = chosenOpt(c);
      return '<button type="button" class="slot' + (on ? ' is-filled' : '') + (i === active ? ' is-active' : '') +
        '" data-go="' + i + '">' +
        '<span class="slot__thumb">' +
          (o ? '<img src="' + o.img + '" alt="">' : (on ? '✓' : ('0' + (i + 1)).slice(-2))) +
        '</span>' +
        '<span class="slot__text">' +
          '<span class="slot__cat">' + c.short.toUpperCase() + '</span>' +
          '<span class="slot__name">' + (on ? chosenName(c) : 'Not chosen yet') + '</span>' +
        '</span>' +
        '<span class="slot__mark">' + (on ? '✓' : '') + '</span>' +
      '</button>';
    }).join('');

    var ok = complete();
    var quote = $('#quote-btn');
    quote.className = 'btn btn--lg btn--block' + (ok ? ' btn--primary' : ' btn--disabled');
    quote.disabled = !ok;
    $('#quote-hint').textContent = ok
      ? 'Free, no obligation. Usually answered within a day.'
      : 'Choose a part in every category to send your list.';
  }

  function renderPicker() {
    var c = cats[active];

    $('#tabs').innerHTML = cats.map(function (x, i) {
      return '<button type="button" class="tab' + (i === active ? ' is-active' : (filled(x) ? ' is-filled' : '')) +
        '" data-go="' + i + '">' + x.short + '</button>';
    }).join('');

    $('#pick-title').textContent = c.label;
    $('#pick-blurb').textContent = c.blurb;

    $('#freetext').hidden = !c.freeText;
    if (c.freeText) {
      $('#case-input').placeholder = c.placeholder || '';
      $('#case-input').value = caseText;
    }

    var opts = c.options || [];
    $('#optgrid').hidden = !opts.length;
    if (!opts.length) {
      $('#optgrid').innerHTML = '';
    } else {
      $('#optgrid').innerHTML = opts.map(function (o) {
        return '<button type="button" class="opt' + (sel[c.id] === o.id ? ' is-on' : '') + '" data-pick="' + o.id + '">' +
          '<span class="opt__shot"><img src="' + o.img + '" alt="' + o.name + '" loading="lazy">' +
          '<span class="opt__tick">✓</span></span>' +
          '<span class="opt__name">' + o.name + '</span>' +
          '<span class="opt__note">' + o.note + '</span>' +
        '</button>';
      }).join('');
    }

    var back = $('#step-back');
    back.style.visibility = active === 0 ? 'hidden' : 'visible';

    var next = $('#step-next');
    var last = active === cats.length - 1;
    next.textContent = last ? 'Review and get a quote' : 'Next: ' + cats[active + 1].short;
    next.className = 'btn' + ((!last || complete()) ? ' btn--primary' : ' btn--disabled');
    next.disabled = last && !complete();
  }

  function render() { renderSummary(); renderPicker(); }

  /* ---------------------------------------------------------- events --- */

  document.addEventListener('click', function (ev) {
    var go = ev.target.closest('[data-go]');
    if (go) { active = Number(go.getAttribute('data-go')); render(); return; }

    var pick = ev.target.closest('[data-pick]');
    if (pick) {
      var id = pick.getAttribute('data-pick');
      var c = cats[active];
      sel[c.id] = sel[c.id] === id ? undefined : id;
      render();
      return;
    }
  });

  $('#case-input').addEventListener('input', function (e) {
    caseText = e.target.value;
    renderSummary();
    $('#step-next').className = 'btn' + ((active < cats.length - 1 || complete()) ? ' btn--primary' : ' btn--disabled');
    $('#step-next').disabled = active === cats.length - 1 && !complete();
  });

  $('#step-back').addEventListener('click', function () { active = Math.max(0, active - 1); render(); });
  $('#step-next').addEventListener('click', function () {
    if (active < cats.length - 1) { active++; render(); }
    else if (complete()) openQuote();
  });
  $('#reset').addEventListener('click', function () { sel = {}; caseText = ''; active = 0; render(); });

  /* ----------------------------------------------------------- quote --- */

  function openQuote() {
    if (!complete()) return;
    $('#bom').innerHTML = cats.map(function (c) {
      return '<dl class="spec"><dt>' + c.short.toUpperCase() + '</dt><dd>' + (chosenName(c) || '—') + '</dd></dl>';
    }).join('');
    $('#quote-form').hidden = false;
    $('#quote-sent').hidden = true;
    $('#modal').hidden = false;
  }
  function closeQuote() { $('#modal').hidden = true; }

  $('#quote-btn').addEventListener('click', openQuote);
  $('#modal-close').addEventListener('click', closeQuote);
  $('#sent-done').addEventListener('click', closeQuote);
  $('#modal').addEventListener('click', function (e) { if (e.target === $('#modal')) closeQuote(); });

  function contactOk() {
    return $('#f-name').value.trim() && /.+@.+\..+/.test($('#f-email').value);
  }

  ['#f-name', '#f-email'].forEach(function (s) {
    $(s).addEventListener('input', function () {
      var b = $('#send');
      b.className = 'btn btn--lg btn--block' + (contactOk() ? ' btn--primary' : ' btn--disabled');
      b.disabled = !contactOk();
    });
  });

  /* Where a quote goes.
   *
   * KC already takes enquiries through the Shopify contact form on
   * kcscustomcomputers.com/pages/contact, and those land in his inbox. This
   * posts the same fields to the same endpoint, so a build request arrives
   * exactly like every other message and nothing about his process changes.
   *
   * It has to be a real form submission, not fetch: Shopify does not send CORS
   * headers on /contact, so an XHR from this origin would be blocked. That
   * means the browser lands on his contact page, which shows Shopify's own
   * confirmation — worth it for a request that provably arrived rather than
   * one we hope did.
   */
  function contactAction() {
    var cfg = window.SHOPIFY_CONFIG || {};
    if (cfg.contactUrl) return cfg.contactUrl;
    if (cfg.storeUrl) return cfg.storeUrl.replace(/\/$/, '') + '/contact#ContactForm';
    if (cfg.domain) return 'https://' + cfg.domain + '/contact#ContactForm';
    return null;
  }

  // One readable block — Shopify emails the comment as plain text.
  function buildComment() {
    var lines = ['Custom build request', ''];
    cats.forEach(function (c) {
      lines.push(c.label + ': ' + (chosenName(c) || '—'));
    });
    var notes = $('#f-notes').value.trim();
    if (notes) lines.push('', 'Notes: ' + notes);
    return lines.join('\n');
  }

  function hiddenInput(form, name, value) {
    var i = document.createElement('input');
    i.type = 'hidden';
    i.name = name;
    i.value = value;
    form.appendChild(i);
  }

  $('#send').addEventListener('click', function () {
    if (!contactOk()) return;

    var btn = $('#send');
    var action = contactAction();

    if (!action) {
      // Nowhere to send it. Say so rather than showing a success panel.
      $('#send-error').textContent =
        'The quote form is not connected yet. Email KC directly and he will pick it up.';
      $('#send-error').hidden = false;
      return;
    }

    btn.disabled = true;
    btn.className = 'btn btn--lg btn--block btn--disabled';
    btn.textContent = 'Sending…';
    $('#send-error').hidden = true;

    var form = document.createElement('form');
    form.method = 'post';
    form.action = action;
    form.acceptCharset = 'UTF-8';
    form.style.display = 'none';

    // The field names are Shopify's, and match the contact form on his site.
    hiddenInput(form, 'form_type', 'contact');
    hiddenInput(form, 'utf8', '\u2713');
    hiddenInput(form, 'contact[Name]', $('#f-name').value.trim());
    hiddenInput(form, 'contact[email]', $('#f-email').value.trim());
    hiddenInput(form, 'contact[Phone number]', $('#f-phone').value.trim());
    hiddenInput(form, 'contact[Comment]', buildComment());

    document.body.appendChild(form);
    form.submit();
  });

  render();
})();
