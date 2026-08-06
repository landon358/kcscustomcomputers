/* Build Custom configurator: pick a part per category, then send the list to KC. */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var cats = window.CATEGORIES;
  var active = 0;
  var sel = {};        // categoryId -> optionId
  var caseText = '';

  function filled(c) { return c.freeText ? caseText.trim().length > 0 : !!sel[c.id]; }

  function chosenName(c) {
    if (c.freeText) return caseText.trim();
    var o = (c.options || []).filter(function (x) { return x.id === sel[c.id]; })[0];
    return o ? o.name : '';
  }

  function chosenOpt(c) {
    if (c.freeText) return null;
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

    if (c.freeText) {
      $('#optgrid').innerHTML = '';
      $('#optgrid').hidden = true;
      $('#freetext').hidden = false;
      $('#case-input').placeholder = c.placeholder || '';
      $('#case-input').value = caseText;
    } else {
      $('#freetext').hidden = true;
      $('#optgrid').hidden = false;
      $('#optgrid').innerHTML = c.options.map(function (o) {
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

  $('#send').addEventListener('click', function () {
    if (!contactOk()) return;
    var payload = {
      parts: cats.map(function (c) { return { category: c.label, choice: chosenName(c) || null }; }),
      contact: {
        name: $('#f-name').value.trim(),
        email: $('#f-email').value.trim(),
        phone: $('#f-phone').value.trim()
      },
      notes: $('#f-notes').value.trim(),
      submittedAt: new Date().toISOString()
    };

    // BACKEND HOOK ---------------------------------------------------------
    // POST `payload` to KC's quote endpoint. Any of these work:
    //   fetch('/apps/quote', { method:'POST', headers:{'Content-Type':'application/json'},
    //                          body: JSON.stringify(payload) })
    // Shopify app proxy, a Netlify function, Formspree, or a plain mailto.
    console.log('[quote request]', payload);
    // ----------------------------------------------------------------------

    $('#quote-form').hidden = true;
    $('#quote-sent').hidden = false;
  });

  render();
})();
