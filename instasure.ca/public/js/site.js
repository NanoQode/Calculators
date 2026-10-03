/* Instasure.ca — progressive enhancement for server-rendered pages. No framework, no third parties. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var money = function (n) {
    n = Number(n) || 0;
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: n < 100 ? 2 : 0, minimumFractionDigits: n < 100 ? 2 : 0 }).format(n);
  };
  var debounce = function (fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; };

  // ───────────── Consent, ids & attribution ─────────────
  function getCookie(n) { var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : null; }
  function setCookie(n, v, maxAge) { document.cookie = n + '=' + encodeURIComponent(v) + '; Path=/; Max-Age=' + maxAge + '; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); }
  function rid() { var a = new Uint8Array(12); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; }); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }

  var consent = getCookie('is_consent');
  var visitor = null, session = null, isEntry = false;
  function initIds() {
    if (consent !== '1') return;
    visitor = getCookie('isv') || rid();
    setCookie('isv', visitor, 31536000);
    session = getCookie('iss');
    if (!session) { session = rid(); isEntry = true; }
    setCookie('iss', session, 1800);
  }
  initIds();

  var params = new URLSearchParams(location.search);
  var utm = {};
  ['source', 'medium', 'campaign', 'term', 'content'].forEach(function (k) { var v = params.get('utm_' + k); if (v) utm[k] = v.slice(0, 120); });
  var attr = {};
  try {
    attr = JSON.parse(sessionStorage.getItem('is_attr') || 'null') || {};
    if (!attr.landing) { attr = { landing: location.pathname, ref: document.referrer || '', utm: utm }; sessionStorage.setItem('is_attr', JSON.stringify(attr)); }
    else if (Object.keys(utm).length) { attr.utm = utm; sessionStorage.setItem('is_attr', JSON.stringify(attr)); }
  } catch (e) { attr = { landing: location.pathname, ref: document.referrer || '', utm: utm }; }

  function beacon(payload) {
    payload.v = visitor; payload.s = session; payload.p = location.pathname;
    var body = JSON.stringify(payload);
    if (navigator.sendBeacon) navigator.sendBeacon('/api/t', new Blob([body], { type: 'text/plain' }));
    else fetch('/api/t', { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(function () {});
  }
  function track(name, data) { beacon({ t: 'ev', n: name, d: data || {} }); }
  window.instasureTrack = track;
  if (!/^\/admin/.test(location.pathname)) beacon({ t: 'pv', r: document.referrer, ti: document.title, u: utm, e: isEntry });

  var banner = $('#consent');
  if (banner && consent === null) banner.classList.remove('hidden');
  $$('[data-consent]').forEach(function (b) {
    b.addEventListener('click', function () {
      consent = b.getAttribute('data-consent');
      setCookie('is_consent', consent, 31536000);
      if (consent === '1') { initIds(); if (window.gtag) window.gtag('consent', 'update', { analytics_storage: 'granted' }); }
      banner.classList.add('hidden');
    });
  });

  function attribution() { return { utm: attr.utm || {}, _ref: attr.ref || '', _landing: attr.landing || '', _page: location.pathname, _v: visitor || '', _s: session || '' }; }

  // ───────────── Navigation ─────────────
  var drawer = $('#drawer');
  $$('[data-drawer-open]').forEach(function (b) { b.addEventListener('click', function () { drawer.classList.remove('hidden'); b.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; var c = $('[data-drawer-close] , button[data-drawer-close]', drawer); if (c) c.focus(); }); });
  $$('[data-drawer-close]').forEach(function (b) { b.addEventListener('click', closeDrawer); });
  function closeDrawer() { if (!drawer) return; drawer.classList.add('hidden'); document.body.style.overflow = ''; $$('[data-drawer-open]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); }); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeDrawer(); $$('details[data-menu][open]').forEach(function (d) { d.open = false; }); } });
  document.addEventListener('click', function (e) { $$('details[data-menu][open]').forEach(function (d) { if (!d.contains(e.target)) d.open = false; }); });

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-track]');
    if (el) track(el.getAttribute('data-track'), { label: el.getAttribute('data-label') || '', href: el.getAttribute('href') || '' });
    var p = e.target.closest('[data-print]');
    if (p) window.print();
  });
  $$('details[data-track-open]').forEach(function (d) { d.addEventListener('toggle', function () { if (d.open) track('faq_open', { q: ($('h3', d) || {}).textContent || '' }); }, { once: false }); });
  $$('[data-ts]').forEach(function (i) { i.value = String(Date.now()); });

  // ───────────── Estimate API ─────────────
  var inflight = 0;
  function estimate(product, inputs) {
    var id = ++inflight;
    return fetch('/api/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ product: product, quote_inputs: inputs }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (id !== inflight || !j.ok) throw new Error('stale'); return j.estimate; });
  }

  // ───────────── Segmented controls & option cards (shared) ─────────────
  function wireSeg(root) {
    $$('[data-seg]', root).forEach(function (seg) {
      var key = seg.getAttribute('data-seg');
      var hidden = seg.parentElement.querySelector('input[type=hidden][name="qi[' + key + ']"], input[type=hidden][name="' + key + '"]');
      $$('button[data-val]', seg).forEach(function (b) {
        b.addEventListener('click', function () {
          $$('button[data-val]', seg).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          if (hidden) { hidden.value = b.getAttribute('data-val'); hidden.dispatchEvent(new Event('change', { bubbles: true })); }
        });
      });
    });
    $$('[data-opt-card]', root).forEach(function (card) {
      var input = $('input', card);
      input.addEventListener('change', function () {
        $$('input[name="' + input.name + '"]', root).forEach(function (other) {
          var c = other.closest('[data-opt-card]');
          var on = other.checked;
          c.classList.toggle('is-active', on);
          var chk = $('[data-check]', c);
          if (chk) { chk.textContent = on ? 'check_circle' : 'radio_button_unchecked'; chk.classList.toggle('text-secondary', on); chk.classList.toggle('text-outline-variant', !on); }
        });
      });
    });
    $$('[data-money-in]', root).forEach(function (r) {
      var out = $('[data-money-out="' + r.getAttribute('data-money-in') + '"]', root);
      r.addEventListener('input', function () { if (out) out.textContent = money(r.value); });
    });
  }

  // ───────────── Home / product quote widget ─────────────
  var RANGES = { life: [100000, 2000000, 50000, 500000, ['$100k', '$1M', '$2M']], health: [25000, 500000, 5000, 100000, ['$25k', '$250k', '$500k']] };
  $$('[data-quote-widget]').forEach(function (root) {
    var product = root.getAttribute('data-product');
    var form = $('[data-qw-form]', root);
    var activeTab = $('[data-qw-tab][aria-selected="true"]', root);
    var flow = activeTab ? activeTab.getAttribute('data-flow') : (root.getAttribute('data-flow') || 'life');
    var single = !$('[data-qw-tab]', root);
    if (single) {
      var map = { 'term-life-insurance': 'life', 'life-insurance': 'life', 'whole-life-insurance': 'life', 'no-medical-life-insurance': 'life', 'mortgage-life-insurance': 'life', 'critical-illness-insurance': 'health', 'disability-insurance': 'health', 'health-dental-insurance': 'health', 'travel-insurance': 'travel', 'super-visa-insurance': 'travel', 'car-insurance': 'auto', 'home-insurance': 'property', 'condo-insurance': 'property', 'tenant-insurance': 'property', 'business-insurance': 'business', 'contractor-insurance': 'business', 'professional-liability-insurance': 'business', 'group-benefits': 'business' };
      flow = map[product] || 'life';
    }
    var cov = $('#qw-coverage', root) || $('[name=coverage]', root);
    var covLabel = $('[data-qw-coverage-label]', root);
    var rangeLabels = $('[data-qw-range-labels]', root);

    function visible(el) { var f = el.closest('[data-qw-fields]'); return !f || f.getAttribute('data-qw-fields').split(' ').indexOf(flow) !== -1; }
    function applyFlow() {
      $$('[data-qw-fields]', root).forEach(function (f) {
        var on = f.getAttribute('data-qw-fields').split(' ').indexOf(flow) !== -1;
        f.classList.toggle('hidden', !on);
        if (on && f.classList.contains('flex-col') === false && f.className.indexOf('flex') !== -1) f.classList.add('flex');
        if (on) f.classList.remove('hidden');
      });
      if (cov && RANGES[flow]) {
        var r = RANGES[flow];
        if (Number(cov.min) !== r[0]) { cov.min = r[0]; cov.max = r[1]; cov.step = r[2]; cov.value = r[3]; }
        if (rangeLabels) rangeLabels.innerHTML = r[4].map(function (s) { return '<span>' + s + '</span>'; }).join('');
      }
      if (cov && covLabel) covLabel.textContent = money(cov.value);
      if (product === 'super-visa-insurance') { var al = $('label[for=qw-age]', root); if (al) al.textContent = 'Visitor’s age'; var ag = $('#qw-age', root); if (ag && Number(ag.value) < 40) ag.value = 62; }
      form.action = '/quote/' + product + '/';
    }
    function collect() {
      var o = {};
      $$('[data-qw-input]', root).forEach(function (el) { if (visible(el) && el.name && el.value !== '') o[el.name] = el.value; });
      $$('input[form="' + form.id + '"]').forEach(function (el) { if (el.name && el.value) o[el.name] = el.value; });
      if (product === 'super-visa-insurance' && o.age) o.visitor_age = o.age;
      return o;
    }
    var price = $('[data-qw-price]', root), period = $('[data-qw-period]', root), rng = $('[data-qw-range]', root), ex = $('[data-qw-example]', root);
    var recalc = debounce(function () {
      estimate(product, collect()).then(function (e) {
        price.textContent = money(e.low); period.textContent = e.periodLabel;
        if (rng) rng.textContent = 'Typical range ' + money(e.low) + '–' + money(e.high);
        if (ex) ex.textContent = 'Example: ' + e.example + ' · as of ' + e.asOf + '. Estimate, not an offer.';
      }).catch(function () {});
    }, 220);

    $$('[data-qw-tab]', root).forEach(function (t) {
      t.addEventListener('click', function () {
        $$('[data-qw-tab]', root).forEach(function (x) {
          var on = x === t;
          x.setAttribute('aria-selected', on ? 'true' : 'false');
          x.classList.toggle('bg-surface-container-lowest', on); x.classList.toggle('text-primary-container', on); x.classList.toggle('shadow-sm', on); x.classList.toggle('text-on-surface-variant', !on);
        });
        product = t.getAttribute('data-qw-tab'); flow = t.getAttribute('data-flow');
        if (flow === 'property') { var pressed = $('[data-qw-product][aria-pressed="true"]', root); if (pressed) product = pressed.getAttribute('data-qw-product'); }
        applyFlow(); recalc();
      });
    });
    $$('[data-qw-product]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('[data-qw-product]', root).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        product = b.getAttribute('data-qw-product'); applyFlow(); recalc();
      });
    });
    $$('[data-qw-smoker]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('[data-qw-smoker]', root).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        $('input[name=smoker]', root).value = b.getAttribute('data-qw-smoker'); recalc();
      });
    });
    root.addEventListener('input', function (e) { if (e.target === cov && covLabel) covLabel.textContent = money(cov.value); recalc(); });
    root.addEventListener('change', recalc);
    form.addEventListener('submit', function () { track('quote_start', { product: product, from: 'widget' }); });
    applyFlow();
  });

  // ───────────── Multi-step quote flow ─────────────
  var qf = $('[data-quote-flow]');
  if (qf) (function () {
    var product = qf.getAttribute('data-product'), flow = qf.getAttribute('data-flow');
    var steps = $$('[data-step]', qf), cur = 0, billing = 'monthly', last = null;
    var stageLabel = $('[data-stage-label]'), stageTitle = $('[data-stage-title]'), bar = $('[data-progress]'), barLabel = $('[data-progress-label]');
    function show(i) {
      cur = Math.max(0, Math.min(steps.length - 1, i));
      steps.forEach(function (s, j) { s.hidden = j !== cur; });
      var pct = Math.round(((cur + 1) / (steps.length + 1)) * 100);
      if (stageLabel) stageLabel.textContent = 'STAGE 0' + (cur + 1) + '/0' + (steps.length + 1);
      if (stageTitle) stageTitle.textContent = steps[cur].getAttribute('data-title');
      if (bar) bar.style.width = pct + '%';
      if (barLabel) barLabel.textContent = pct + '% complete';
      track('quote_step', { product: product, step: cur + 1 });
      var top = qf.getBoundingClientRect().top + window.scrollY - 90;
      if (window.scrollY > top) window.scrollTo({ top: top, behavior: 'smooth' });
      var first = $('input:not([type=hidden]):not(.sr-only), select', steps[cur]); if (first && cur > 0) first.focus({ preventScroll: true });
    }
    function validStep(i) {
      var ok = true;
      $$('input, select, textarea', steps[i]).forEach(function (el) { if (ok && el.willValidate && !el.checkValidity()) { el.reportValidity(); ok = false; } });
      return ok;
    }
    $$('[data-next]', qf).forEach(function (b) { b.addEventListener('click', function () { if (validStep(cur)) show(cur + 1); }); });
    $$('[data-prev]', qf).forEach(function (b) { b.addEventListener('click', function () { show(cur - 1); }); });
    wireSeg(qf);

    var covIn = $('[data-coverage]', qf), covOut = $('[data-coverage-out]', qf);
    if (covIn) {
      covIn.addEventListener('input', function () { covOut.textContent = money(covIn.value); syncPresets(); });
      $$('[data-preset]', qf).forEach(function (b) { b.addEventListener('click', function () { covIn.value = b.getAttribute('data-preset'); covIn.dispatchEvent(new Event('input', { bubbles: true })); }); });
    }
    function syncPresets() {
      $$('[data-preset]', qf).forEach(function (b) {
        var on = Number(b.getAttribute('data-preset')) === Number(covIn.value);
        b.className = 'py-2 px-3 rounded-xl font-label-md text-label-md text-center transition-all ' + (on ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface hover:bg-surface-container');
      });
    }

    var prov = $('[data-province]', qf), city = $('[data-city]', qf), postal = $('[data-postal]', qf), wait = $('[data-waitlist-note]', qf);
    var serviceable = wait ? JSON.parse(wait.getAttribute('data-serviceable') || '[]') : [];
    var FSA = { A: 'nl', B: 'ns', C: 'pe', E: 'nb', G: 'qc', H: 'qc', J: 'qc', K: 'on', L: 'on', M: 'on', N: 'on', P: 'on', R: 'mb', S: 'sk', T: 'ab', V: 'bc', Y: 'yt', X: 'nt' };
    function filterCities() {
      if (!city) return;
      var p = prov.value;
      $$('optgroup', city).forEach(function (g) { var on = !p || g.getAttribute('data-prov') === p; g.hidden = !on; g.disabled = !on; });
      var sel = city.options[city.selectedIndex];
      if (sel && sel.getAttribute('data-prov') && sel.getAttribute('data-prov') !== p) city.value = '';
      if (wait) wait.classList.toggle('hidden', !p || serviceable.indexOf(p) !== -1);
    }
    if (prov) { prov.addEventListener('change', filterCities); filterCities(); }
    if (postal) postal.addEventListener('input', function () {
      var v = postal.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (v.length > 3) v = v.slice(0, 3) + ' ' + v.slice(3, 6);
      postal.value = v;
      var p = FSA[v[0]]; if (p && prov && prov.value !== p) { prov.value = p; filterCities(); }
    });

    function inputs() {
      var o = {};
      $$('[name^="qi["]', qf).forEach(function (el) {
        if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
        o[el.name.slice(3, -1)] = el.value;
      });
      if (prov && prov.value) o.province = prov.value;
      if (city && city.value) o.city = city.value;
      return o;
    }
    var livePrice = $('[data-live-price]'), livePeriod = $('[data-live-period]');
    function paint() {
      if (!last) return;
      var annual = billing === 'annual' && last.periodLabel === '/mo';
      var f = function (n) { return annual ? money(n * 12 * 0.92) : money(n); };
      livePrice.textContent = f(last.low); livePeriod.textContent = annual ? '/yr' : last.periodLabel;
      $$('[data-tier]').forEach(function (row, i) { var t = last.tiers[i]; if (!t) return; $('[data-tier-name]', row).textContent = t.name; $('[data-tier-price]', row).innerHTML = f(t.monthly) + '<span class="font-body-sm text-body-sm text-on-surface-variant">' + (annual ? '/yr' : last.periodLabel) + '</span>'; });
      var ex = $('[data-example]'); if (ex) ex.textContent = 'Example: ' + last.example + ' · ' + last.asOf;
      var ri = $('[data-range-inline]'); if (ri) ri.textContent = money(last.low) + '–' + money(last.high) + last.periodLabel;
      var data = inputs(), age = Number(data.age || 0), coverage = Number(data.coverage || 0);
      var et = $('[data-elig-title]'), eb = $('[data-elig-body]');
      if (et && (flow === 'life' || flow === 'health')) {
        if (data.smoker === 'yes') { et.textContent = 'Smoker rates apply — options still available'; eb.textContent = 'Quitting for 12 months usually qualifies you for non-smoker rates; an advisor can compare insurers that treat vaping and cannabis differently.'; }
        else if (age && age <= 50 && (!coverage || coverage <= 1000000)) { et.textContent = 'You may qualify for no-exam approval'; eb.textContent = 'Healthy applicants your age are often approved on health questions alone — no needles or nurse visit.'; }
        else if (age > 60) { et.textContent = 'Simplified-issue options available'; eb.textContent = 'At your age a short medical or simplified-issue policy may be the fastest route — your advisor will compare both.'; }
        else { et.textContent = 'Full underwriting usually gets the best price'; eb.textContent = 'For larger amounts insurers may ask for a quick paramedical exam — often at home and free to you.'; }
      }
    }
    var recalc = debounce(function () { estimate(product, inputs()).then(function (e) { last = e; paint(); }).catch(function () {}); }, 200);
    qf.addEventListener('input', recalc);
    qf.addEventListener('change', recalc);
    $$('[data-billing]').forEach(function (b) {
      b.addEventListener('click', function () {
        billing = b.getAttribute('data-billing');
        $$('[data-billing]').forEach(function (x) {
          var on = x === b; x.setAttribute('aria-pressed', on ? 'true' : 'false');
          x.classList.toggle('bg-secondary', on); x.classList.toggle('text-on-secondary', on); x.classList.toggle('md:bg-surface-container-lowest', on); x.classList.toggle('md:text-on-surface', on); x.classList.toggle('shadow-sm', on); x.classList.toggle('opacity-80', !on);
        });
        if (!last) recalc(); else paint();
      });
    });

    var err = $('[data-form-error]', qf), submit = $('[data-submit]', qf);
    qf.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validStep(cur)) return;
      var fd = new FormData(qf);
      var payload = attribution();
      fd.forEach(function (v, k) { if (k.indexOf('qi[') !== 0) payload[k] = v; });
      payload.quote_inputs = inputs();
      payload.consent_marketing = fd.get('consent_marketing') === 'yes';
      submit.disabled = true; submit.innerHTML = 'Finding your options… <span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>';
      fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j.ok) throw j;
          track('quote_complete', { product: product, ref: j.ref });
          location.href = j.redirect;
        })
        .catch(function (j) {
          submit.disabled = false; submit.innerHTML = 'View my quotes <span class="material-symbols-outlined text-[18px]">arrow_forward</span>';
          err.textContent = (j && j.error) || 'Something went wrong — please try again.'; err.classList.remove('hidden');
          var field = j && j.field && qf.querySelector('[name="' + j.field + '"]');
          if (field) { var st = field.closest('[data-step]'); show(steps.indexOf(st)); field.focus(); }
        });
    });

    var dlg = $('[data-save-dialog]'), saveForm = $('[data-save-form]'), saveMsg = $('[data-save-msg]');
    var saveBtn = $('[data-save-later]');
    if (saveBtn && dlg && dlg.showModal) {
      saveBtn.addEventListener('click', function () { var em = $('[name=email]', qf); if (em && em.value) $('[name=email]', saveForm).value = em.value; dlg.showModal(); track('save_progress', { product: product }); });
      saveForm.addEventListener('submit', function (e) {
        if (e.submitter && e.submitter.value === 'cancel') return;
        e.preventDefault();
        var payload = attribution();
        payload.lead_type = 'partial'; payload.product = product; payload.email = $('[name=email]', saveForm).value;
        payload.consent_marketing = $('[name=consent_marketing]', saveForm).checked;
        payload.province = prov ? prov.value : ''; payload.quote_inputs = inputs(); payload._ts = String(Date.now() - 5000);
        fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
          .then(function (r) { return r.json(); })
          .then(function (j) { saveMsg.classList.remove('hidden'); saveMsg.className = 'font-body-sm text-body-sm ' + (j.ok ? 'text-secondary' : 'text-error'); saveMsg.textContent = j.ok ? 'Saved! Check your inbox for your resume link.' : j.error; if (j.ok) setTimeout(function () { dlg.close(); }, 1600); });
      });
    } else if (saveBtn) saveBtn.hidden = true;

    show(0);
    track('quote_start', { product: product, from: 'flow' });
    recalc();
  })();

  // ───────────── Generic lead forms (contact, calculators) ─────────────
  $$('[data-lead-form], [data-calc-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form), payload = attribution();
      fd.forEach(function (v, k) { payload[k] = v; });
      payload.consent_marketing = fd.get('consent_marketing') === 'yes';
      if (form.hasAttribute('data-calc-form') && window.__calcResult) payload.quote_inputs = window.__calcResult;
      var btn = $('button[type=submit], button:not([type])', form); if (btn) btn.disabled = true;
      var msg = $('[data-calc-msg]', form);
      fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j.ok) throw j;
          if (form.hasAttribute('data-calc-form')) { msg.className = 'sm:col-span-2 font-body-sm text-body-sm text-secondary'; msg.textContent = 'Sent! Check your inbox' + (fd.get('phone') ? ' — an advisor will also be in touch.' : '.'); form.reset(); }
          else location.href = j.redirect;
        })
        .catch(function (j) {
          if (btn) btn.disabled = false;
          var text = (j && j.error) || 'Something went wrong — please try again.';
          if (msg) { msg.className = 'sm:col-span-2 font-body-sm text-body-sm text-error'; msg.textContent = text; } else alert(text);
        });
    });
  });

  // ───────────── Knowledge center ─────────────
  var hubTabs = $('[data-hub-tabs]');
  if (hubTabs) {
    $$('button[data-hub]', hubTabs).forEach(function (b) {
      b.addEventListener('click', function () {
        var hub = b.getAttribute('data-hub');
        $$('button[data-hub]', hubTabs).forEach(function (x) {
          var on = x === b; x.setAttribute('aria-selected', on ? 'true' : 'false');
          x.className = 'px-4 py-2 rounded-full font-label-md text-label-md transition-all ' + (on ? 'bg-primary-container text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container');
        });
        var n = 0;
        $$('[data-guide-grid] [data-guide]').forEach(function (g) { var on = hub === 'all' || g.getAttribute('data-hub') === hub; g.style.display = on ? '' : 'none'; if (on) n++; });
        var empty = $('[data-guide-empty]'); if (empty) empty.classList.toggle('hidden', n > 0);
      });
    });
  }
  var gs = $('[data-guide-search]');
  if (gs) {
    var input = $('input[name=q]', gs), out = $('[data-search-results]', gs);
    input.addEventListener('input', debounce(function () {
      var q = input.value.trim();
      if (q.length < 2) { out.classList.add('hidden'); return; }
      fetch('/api/search?q=' + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (j) {
        track('search', { q: q, n: j.results.length });
        out.classList.remove('hidden');
        out.innerHTML = j.results.length ? j.results.map(function (r) {
          var a = document.createElement('a'); a.href = r.url; a.className = 'block px-3 py-2 rounded-lg hover:bg-surface-container-low';
          var t = document.createElement('span'); t.className = 'block font-label-lg text-label-lg text-on-surface'; t.textContent = r.title;
          var c = document.createElement('span'); c.className = 'block font-body-sm text-body-sm text-on-surface-variant'; c.textContent = (r.category ? r.category + ' · ' : '') + (r.excerpt || '').slice(0, 110);
          a.appendChild(t); a.appendChild(c); return a.outerHTML;
        }).join('') : '<p class="px-3 py-2 font-body-sm text-body-sm text-on-surface-variant">No matches yet — try another term or <a class="link" href="/contact/">ask an advisor</a>.</p>';
      });
    }, 250));
  }
  var mini = $('[data-mini-income]');
  if (mini) mini.addEventListener('input', function () {
    $('[data-mini-income-out]').textContent = money(mini.value) + ' / yr';
    $('[data-mini-cover]').textContent = money(mini.value * 10);
  });

  // ───────────── Results / compare billing toggle ─────────────
  var rb = $$('[data-results-billing]');
  rb.forEach(function (b) {
    b.addEventListener('click', function () {
      var annual = b.getAttribute('data-results-billing') === 'annual';
      rb.forEach(function (x) { var on = x === b; x.setAttribute('aria-pressed', on ? 'true' : 'false'); x.classList.toggle('bg-primary-container', on); x.classList.toggle('text-on-primary', on); x.classList.toggle('text-on-surface-variant', !on); });
      $$('[data-price]').forEach(function (el) { var m = Number(el.getAttribute('data-monthly')); el.textContent = money(annual ? m * 12 * 0.92 : m); });
      $$('[data-period]').forEach(function (el) { el.textContent = annual ? '/yr' : '/mo'; });
      $$('[data-table-price]').forEach(function (el) { var m = Number(el.getAttribute('data-monthly')); el.textContent = money(annual ? m * 12 * 0.92 : m) + (annual ? '/yr' : '/mo'); });
    });
  });

  window.InstasureUI = { money: money, estimate: estimate, debounce: debounce, wireSeg: wireSeg, track: track };
})();
