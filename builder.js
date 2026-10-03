/* Build Custom configurator: pick a part per category, then send the list to KC. */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var cats = window.CATEGORIES;
  var active = 0;
  var sel = {};        // categoryId -> optionId
  var free = {};       // categoryId -> that step's typed text

  // A step with freeText takes either a card or a description, so either one
  // satisfies it. Every other step is card-only.
  function filled(c) {
    if (sel[c.id]) return true;
    return !!c.freeText && text(c).length > 0;
  }

  function text(c) { return (free[c.id] || '').trim(); }

  // "Anything else?" is the one step nobody has to answer, so it is kept out
  // of the count, out of the progress bar and out of what unlocks the quote.
  function needed(c) { return !c.optional; }

  function chosenName(c) {
    var o = chosenOpt(c);
    if (o) return o.name;
    return c.freeText ? text(c) : '';
  }

  function chosenOpt(c) {
    return (c.options || []).filter(function (x) { return x.id === sel[c.id]; })[0] || null;
  }

  function complete() { return cats.filter(needed).every(filled); }

  /* --------------------------------------------------------- render ---- */

  function renderSummary() {
    var req = cats.filter(needed);
    var done = req.filter(filled).length;
    $('#sum-count').textContent = done + ' of ' + req.length;
    $('#sum-bar').style.width = (done / req.length * 100) + '%';

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
          '<span class="slot__name">' + (on ? chosenName(c)
            : (c.optional ? 'Optional' : 'Not chosen yet')) + '</span>' +
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
      $('#free-label').textContent = c.freeLabel || 'Or describe the one you want';
      $('#free-hint').textContent = c.freeHint || '';
      $('#free-hint').hidden = !c.freeHint;
      $('#case-input').placeholder = c.placeholder || '';
      $('#case-input').value = free[c.id] || '';
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
          // storage options carry no sub-line, and an empty one still takes its margin
          (o.note ? '<span class="opt__note">' + o.note + '</span>' : '') +
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

  // An optional step the visitor skipped is not a line in KC's email saying
  // "Anything else?: —". It simply is not there.
  function listed(c) { return needed(c) || filled(c); }

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
    free[cats[active].id] = e.target.value;
    renderSummary();
    $('#step-next').className = 'btn' + ((active < cats.length - 1 || complete()) ? ' btn--primary' : ' btn--disabled');
    $('#step-next').disabled = active === cats.length - 1 && !complete();
  });

  $('#step-back').addEventListener('click', function () { active = Math.max(0, active - 1); render(); });
  $('#step-next').addEventListener('click', function () {
    if (active < cats.length - 1) { active++; render(); }
    else if (complete()) openQuote();
  });
  $('#reset').addEventListener('click', function () { sel = {}; free = {}; active = 0; render(); });

  /* ----------------------------------------------------------- quote --- */

  function openQuote() {
    if (!complete()) return;
    $('#bom').innerHTML = cats.filter(listed).map(function (c) {
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

  /* Where a quote goes: Netlify Forms, the same as the Contact page.
   *
   * It used to post to Shopify's contact form, so the request reached KC's
   * inbox the way Shopify enquiries always had. But a form submitted to
   * Shopify takes the visitor with it: once Shopify moved to
   * shop.kcscustomcomputers.com, every quote ended on the old Shopify theme,
   * and Shopify will not send anyone back to another site afterwards.
   *
   * Sent in the background instead, so the visitor never leaves the popup and
   * sees the "Request sent" panel. Netlify emails each submission to whoever
   * is set up under Forms → Form notifications in the Netlify dashboard.
   */
  function buildList() {
    return cats.filter(listed).map(function (c) {
      return c.label + ': ' + (chosenName(c) || '—');
    }).join('\n');
  }

  function encode(fields) {
    return Object.keys(fields).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(fields[k]);
    }).join('&');
  }

  // If Netlify cannot be reached, the request is still one click from KC:
  // an email with the whole build already written out.
  function mailtoFallback(fields) {
    var body = 'Name: ' + fields.name + '\nEmail: ' + fields.email +
      (fields.phone ? '\nPhone: ' + fields.phone : '') +
      '\n\n' + fields.build + (fields.notes ? '\n\nNotes: ' + fields.notes : '');
    return 'mailto:fegelykc@gmail.com?subject=' +
      encodeURIComponent('Custom build request — ' + fields.name) +
      '&body=' + encodeURIComponent(body);
  }

  function resetSend() {
    var b = $('#send');
    b.textContent = 'Send my build request';
    b.disabled = !contactOk();
    b.className = 'btn btn--lg btn--block' + (contactOk() ? ' btn--primary' : ' btn--disabled');
  }

  $('#send').addEventListener('click', function () {
    if (!contactOk()) return;

    var btn = $('#send');
    var fields = {
      'form-name': 'quote',
      'bot-field': '',
      name: $('#f-name').value.trim(),
      email: $('#f-email').value.trim(),
      phone: $('#f-phone').value.trim(),
      build: buildList(),
      notes: $('#f-notes').value.trim()
    };

    btn.disabled = true;
    btn.className = 'btn btn--lg btn--block btn--disabled';
    btn.textContent = 'Sending…';
    $('#send-error').hidden = true;

    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: encode(fields)
    })
      .then(function (r) {
        // Netlify answers a stored submission with the page it was posted
        // to; anything else means it was not taken.
        if (!r.ok) throw new Error('form endpoint returned ' + r.status);
        $('#quote-form').hidden = true;
        $('#quote-sent').hidden = false;
        resetSend();
      })
      .catch(function (err) {
        console.warn('[quote]', err.message);
        var e = $('#send-error');
        e.innerHTML = 'Your request could not be sent. ' +
          '<a href="' + mailtoFallback(fields).replace(/"/g, '&quot;') + '">Email it to KC instead</a>' +
          ' — your parts list is already filled in.';
        e.hidden = false;
        resetSend();
      });
  });

  render();
})();
