/* Instasure calculators — pure client-side maths; premiums come from /api/estimate. */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';
  var UI = window.InstasureUI;
  if (!UI) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var money = UI.money;
  var root = $('[data-calc]');
  if (!root) return;
  var form = $('[data-calc-inputs]', root);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  UI.wireSeg(root);
  var kind = root.getAttribute('data-calc');
  var val = function (n) { var el = form.elements[n]; if (!el) return 0; if (el.type === 'checkbox') return el.checked; return el.value; };
  var num = function (n) { return Math.max(0, Number(val(n)) || 0); };
  var R = function (n) { return $('[data-result="' + n + '"]', root); };
  var tracked = false;
  function used() { if (!tracked) { tracked = true; UI.track('calculator_use', { calc: kind }); } }

  function bars(container, items, total) {
    container.innerHTML = '';
    items.forEach(function (it) {
      var row = document.createElement('div');
      var pct = total > 0 ? Math.max(2, Math.round((Math.abs(it.v) / total) * 100)) : 0;
      row.innerHTML = '<div class="flex justify-between font-label-sm text-label-sm text-primary-fixed-dim"><span></span><span></span></div><div class="h-2 rounded-full bg-surface-container-lowest/10 overflow-hidden"><div class="h-full rounded-full"></div></div>';
      row.children[0].children[0].textContent = it.label;
      row.children[0].children[1].textContent = (it.v < 0 ? '−' : '') + money(Math.abs(it.v));
      var fill = row.children[1].children[0]; fill.style.width = pct + '%'; fill.className = 'h-full rounded-full ' + (it.v < 0 ? 'bg-on-tertiary-container' : 'bg-secondary-fixed');
      container.appendChild(row);
    });
  }

  var calcs = {
    'life-needs': function () {
      var income = num('income') * (num('pct') / 100) * num('years');
      var parts = [
        { label: 'Income replacement', v: income },
        { label: 'Mortgage', v: num('mortgage') },
        { label: 'Other debts', v: num('debts') },
        { label: 'Education', v: num('kids') * num('edu') },
        { label: 'Final expenses', v: num('final') },
        { label: 'Savings', v: -num('savings') },
        { label: 'Existing coverage', v: -num('existing') },
      ];
      var raw = parts.reduce(function (s, p) { return s + p.v; }, 0);
      var total = Math.max(0, Math.ceil(raw / 50000) * 50000);
      var pctOut = $('[data-out="pct"]', root); if (pctOut) pctOut.textContent = val('pct') + '%';
      R('total').textContent = money(total);
      bars(R('bars'), parts.filter(function (p) { return p.v !== 0; }), parts.reduce(function (s, p) { return s + Math.max(0, p.v); }, 0));
      R('cta').href = '/quote/term-life-insurance/?coverage=' + Math.min(total, 3000000) + '&age=' + num('age');
      window.__calcResult = { calculator: 'life-needs', coverage: total, age: num('age'), sex: val('sex'), smoker: val('smoker'), term: 20, income: num('income') };
      if (total > 0) UI.estimate('term-life-insurance', { coverage: Math.min(total, 3000000), age: num('age'), sex: val('sex'), smoker: val('smoker'), term: 20 }).then(function (e) {
        R('premium').textContent = money(e.low) + '–' + money(e.high) + e.periodLabel; R('example').textContent = 'Example: ' + e.example + ' · ' + e.asOf;
      }).catch(function () {});
      else { R('premium').textContent = '$0 — you may already be covered'; R('example').textContent = ''; }
    },
    mortgage: function () {
      var P = num('balance'), years = Math.max(5, Math.min(30, num('years'))), rate = num('rate') / 100 / 12, age = num('age');
      var n = years * 12, pmt = rate > 0 ? P * rate / (1 - Math.pow(1 + rate, -n)) : P / n;
      var band = age <= 30 ? 0.09 : age <= 40 ? 0.15 : age <= 45 ? 0.24 : age <= 50 ? 0.33 : age <= 55 ? 0.5 : age <= 60 ? 0.71 : 0.98;
      var bal = P, bankTotal = 0, pts = [];
      for (var m = 0; m < n; m++) {
        if (m % 12 === 0) pts.push({ y: m / 12, bank: bal });
        bankTotal += (bal / 1000) * band;
        bal = Math.max(0, bal * (1 + rate) - pmt);
      }
      pts.push({ y: years, bank: 0 });
      R('bankAvg').textContent = money(bankTotal / n) + '/mo';
      R('bankTotal').textContent = money(bankTotal);
      var term = years <= 12 ? 10 : years <= 22 ? 20 : 30;
      window.__calcResult = { calculator: 'mortgage', coverage: P, term: term, age: age, sex: val('sex'), smoker: val('smoker') };
      R('cta').href = '/quote/mortgage-life-insurance/?coverage=' + Math.round(P / 25000) * 25000 + '&age=' + age;
      UI.estimate('term-life-insurance', { coverage: P, age: age, sex: val('sex'), smoker: val('smoker'), term: term }).then(function (e) {
        var termTotal = e.mid * 12 * Math.min(years, term);
        R('termAvg').textContent = money(e.mid) + '/mo'; R('termTotal').textContent = money(termTotal) + ' over ' + Math.min(years, term) + ' yrs';
        chart(pts, P, years);
      }).catch(function () { chart(pts, P, years); });
    },
    contents: function () {
      var keys = ['living', 'bedrooms', 'kitchen', 'electronics', 'clothing', 'jewellery', 'sports', 'other'];
      var total = keys.reduce(function (s, k) { return s + num(k); }, 0);
      var condo = val('kind') === 'condo';
      $$('[data-condo-only]', root).forEach(function (el) { el.classList.toggle('hidden', !condo); });
      var limit = Math.ceil(total / 5000) * 5000;
      R('contents').textContent = money(limit);
      var items = ['Personal liability: $2,000,000 recommended', 'Additional living expenses: included in most comprehensive policies'];
      if (num('jewellery') > 5000) items.unshift('Schedule jewellery separately — typical sub-limits are a few thousand dollars');
      if (condo) { items.unshift('Deductible assessment: at least ' + money(num('corpded'))); items.unshift('Improvements & betterments: ' + money(num('improvements'))); }
      R('list').innerHTML = '';
      items.forEach(function (t) { var li = document.createElement('li'); li.className = 'flex gap-2'; li.innerHTML = '<span class="material-symbols-outlined text-[18px] text-secondary-fixed">check_circle</span><span></span>'; li.children[1].textContent = t; R('list').appendChild(li); });
      var product = condo ? 'condo-insurance' : 'tenant-insurance';
      R('cta').href = '/quote/' + product + '/?contents=' + limit + '&province=' + val('province');
      root.closest('main').querySelector('[data-calc-capture] input[name=product]').value = product;
      window.__calcResult = { calculator: 'contents', contents: limit, improvements: condo ? num('improvements') : 0, province: val('province') };
      UI.estimate(product, { contents: limit, improvements: condo ? num('improvements') : 0, province: val('province') }).then(function (e) { R('premium').textContent = money(e.low) + '–' + money(e.high) + e.periodLabel; }).catch(function () {});
    },
    business: function () {
      var recs = [];
      if (val('clients') || val('contract')) recs.push(['Commercial general liability (' + (val('cgl_limit') === '5m' ? '$5M' : val('cgl_limit') === '1m' ? '$1M' : '$2M') + ')', 'Third-party injury and property damage — usually required by contracts and landlords.']);
      if (val('advice')) recs.push(['Professional liability (E&O)', 'Covers claims that your advice or service caused a financial loss.']);
      if (val('data')) recs.push(['Cyber & privacy liability', 'Breach response, ransomware and notification costs under Canadian privacy law.']);
      if (val('equipment')) recs.push(['Property, tools & equipment', 'Replaces inventory, tools and equipment after theft, fire or damage.']);
      if (val('vehicles')) recs.push(['Commercial auto', 'Personal auto policies may not cover regular business use.']);
      if (num('employees') >= 2) recs.push(['Group benefits / key person', 'Retain staff and protect the business if a key person can’t work.']);
      if (!recs.length) recs.push(['Commercial general liability', 'The foundation of almost every small-business policy.']);
      R('list').innerHTML = '';
      recs.forEach(function (r) { var li = document.createElement('li'); li.innerHTML = '<p class="font-label-lg text-label-lg flex gap-2"><span class="material-symbols-outlined text-[18px] text-secondary-fixed">check_circle</span><span></span></p><p class="font-body-sm text-body-sm text-primary-fixed-dim pl-7"></p>'; li.children[0].children[1].textContent = r[0]; li.children[1].textContent = r[1]; R('list').appendChild(li); });
      var inputs = { industry: val('industry'), revenue: val('revenue'), employees: num('employees'), cgl_limit: val('cgl_limit'), need_eo: val('advice') ? 'yes' : 'no', province: val('province') };
      window.__calcResult = Object.assign({ calculator: 'business' }, inputs);
      R('cta').href = '/quote/business-insurance/?industry=' + inputs.industry + '&province=' + inputs.province;
      UI.estimate('business-insurance', inputs).then(function (e) { R('premium').textContent = money(e.low) + '–' + money(e.high) + e.periodLabel; R('example').textContent = 'Example: ' + e.example; }).catch(function () {});
    },
  };

  function chart(pts, P, years) {
    var el = R('chart'); if (!el) return;
    var W = 600, H = 200, pad = 28;
    var x = function (y) { return pad + (y / years) * (W - pad * 2); };
    var yv = function (v) { return H - pad - (v / P) * (H - pad * 2); };
    var bankPath = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(p.y).toFixed(1) + ',' + yv(p.bank).toFixed(1); }).join(' ');
    var termPath = 'M' + x(0) + ',' + yv(P) + ' L' + x(years) + ',' + yv(P);
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="w-full h-auto" aria-hidden="true">' +
      '<line x1="' + pad + '" y1="' + (H - pad) + '" x2="' + (W - pad) + '" y2="' + (H - pad) + '" stroke="#c4c6cd"/>' +
      '<path d="' + termPath + '" stroke="#006c46" stroke-width="3" fill="none"/>' +
      '<path d="' + bankPath + '" stroke="#e05a47" stroke-width="3" fill="none"/>' +
      '<text x="' + pad + '" y="' + (H - 8) + '" font-size="11" fill="#44474d">Year 0</text>' +
      '<text x="' + (W - pad - 40) + '" y="' + (H - 8) + '" font-size="11" fill="#44474d">Year ' + years + '</text>' +
      '<text x="' + (pad + 4) + '" y="' + (yv(P) - 6) + '" font-size="11" fill="#006c46">' + money(P) + '</text></svg>';
  }

  var run = UI.debounce(function () { used(); calcs[kind](); }, 150);
  form.addEventListener('input', run);
  form.addEventListener('change', run);
  calcs[kind]();
});
