/* lmcmic.ca — site behaviour. No dependencies. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var money = function (n) { return "$" + Math.round(n).toLocaleString("en-CA"); };
  var pct = function (n, d) { return (isFinite(n) ? n : 0).toFixed(d == null ? 2 : d) + "%"; };
  var num = function (el) { var v = parseFloat(el && el.value); return isFinite(v) ? v : 0; };
  var store = {
    get: function (k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };

  /* ---------- Google Analytics 4 (only when a measurement ID is configured).
     Initialised here rather than inline so the CSP can forbid inline script. */
  var ga = document.documentElement.getAttribute("data-ga");
  if (ga) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", ga);
  }

  /* ---------- mobile menu */
  var toggle = $("[data-menu-toggle]"), menu = $("#mobile-menu");
  if (toggle && menu) toggle.addEventListener("click", function () {
    var open = menu.classList.toggle("hidden") === false;
    toggle.setAttribute("aria-expanded", String(open));
  });

  /* ---------- tabs: [data-tabs] buttons with data-tab="<panel id>" */
  $$("[data-tabs]").forEach(function (group) {
    var btns = $$("[data-tab]", group);
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        btns.forEach(function (x) {
          var on = x === b;
          x.setAttribute("aria-selected", String(on));
          var p = document.getElementById(x.getAttribute("data-tab"));
          if (p) p.classList.toggle("hidden", !on);
        });
      });
    });
  });

  /* ---------- chart / table toggle */
  $$("[data-chart]").forEach(function (fig) {
    var btns = $$("[data-view]", fig);
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        btns.forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
        $$("[data-pane]", fig).forEach(function (p) { p.classList.toggle("hidden", p.getAttribute("data-pane") !== b.getAttribute("data-view")); });
      });
    });
  });

  /* ---------- home: illustrative income simulation */
  var sim = $("[data-income-sim]");
  if (sim) {
    var cap = $("[data-sim-capital]", sim), rate = $("[data-sim-rate]", sim);
    var run = function () {
      var c = num(cap), r = num(rate) / 100;
      $("[data-sim-capital-out]", sim).textContent = money(c);
      $("[data-sim-rate-out]", sim).textContent = (r * 100).toFixed(2).replace(/\.?0+$/, "") + "%";
      $("[data-sim-q]", sim).textContent = money(c * r / 4);
      $("[data-sim-a]", sim).textContent = money(c * r);
    };
    cap.addEventListener("input", run); rate.addEventListener("input", run); run();
  }

  /* ---------- performance page: 5-year growth simulation */
  var gs = $("[data-growth-sim]");
  if (gs) {
    var amount = 50000;
    var calc = function () {
      var a = num($("[data-rate-a]", gs)) / 100, b = num($("[data-rate-b]", gs)) / 100;
      var va = amount * Math.pow(1 + a / 4, 20), vb = amount * Math.pow(1 + b, 5);
      $("[data-total-a]", gs).textContent = money(va) + " (+" + money(va - amount) + ")";
      $("[data-total-b]", gs).textContent = money(vb) + " (+" + money(vb - amount) + ")";
      var max = Math.max(va, vb) || 1;
      $("[data-bar-a]", gs).style.width = (va / max * 100) + "%";
      $("[data-bar-b]", gs).style.width = (vb / max * 100) + "%";
    };
    $$("[data-amount]", gs).forEach(function (b) {
      b.addEventListener("click", function () {
        amount = parseFloat(b.getAttribute("data-amount"));
        $$("[data-amount]", gs).forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
        calc();
      });
    });
    $$("input", gs).forEach(function (i) { i.addEventListener("input", calc); });
    calc();
  }

  /* ---------- tool: after-tax yield */
  $$('[data-calc="after-tax"]').forEach(function (box) {
    var get = function (k) { return $('[data-in="' + k + '"]', box); };
    var out = function (k, v) { var el = $('[data-out="' + k + '"]', box); if (el) el.textContent = v; };
    var run = function () {
      var amt = num(get("amount")), g = num(get("gross")) / 100, f = num(get("fees")) / 100, t = num(get("tax")) / 100, acct = get("account").value;
      var gross = amt * g, fee = amt * f, net = gross - fee;
      var tax = acct === "open" ? Math.max(net, 0) * t : 0;
      var after = net - tax;
      out("grossAmt", money(gross)); out("grossPct", pct(g * 100));
      out("feeAmt", "−" + money(fee)); out("feePct", "−" + pct(f * 100));
      out("netAmt", money(net)); out("netPct", pct(amt ? net / amt * 100 : 0));
      out("taxAmt", "−" + money(tax)); out("taxPct", "−" + pct(amt ? tax / amt * 100 : 0));
      out("afterAmt", money(after)); out("afterPct", pct(amt ? after / amt * 100 : 0));
      out("note", acct === "open" ? "Non-registered: the full net distribution is taxed as interest income in the year received."
        : acct === "rrsp" ? "RRSP / RRIF: no tax this year; withdrawals are taxed as income when they come out of the plan."
        : "TFSA: income earned inside the plan is not taxed, provided the shares remain a qualified, non-prohibited investment.");
    };
    $$("input,select", box).forEach(function (i) { i.addEventListener("input", run); });
    run();
  });

  /* ---------- tool: DRIP compounding */
  $$('[data-calc="drip"]').forEach(function (box) {
    var get = function (k) { return $('[data-in="' + k + '"]', box); };
    var out = function (k, v) { var el = $('[data-out="' + k + '"]', box); if (el) el.textContent = v; };
    var run = function () {
      var amt = num(get("amount")), r = num(get("rate")) / 100, yrs = Math.min(40, Math.max(1, Math.round(num(get("years")) || 1)));
      var n = parseInt(get("freq").value, 10) || 4, cmpRaw = get("cmp").value, c = num(get("cmp")) / 100;
      var rows = "", drip = amt, cash = 0, cmp = amt;
      for (var y = 1; y <= yrs; y++) {
        drip = amt * Math.pow(1 + r / n, n * y);
        cash = amt * r * y;
        cmp = amt * Math.pow(1 + c, y);
        rows += "<tr class=\"border-t border-border-hairline\"><td class=\"py-1.5\">" + y + "</td><td class=\"py-1.5 text-right tabular-nums\">" + money(drip) +
          "</td><td class=\"py-1.5 text-right tabular-nums\">" + money(cash) + "</td><td class=\"py-1.5 text-right tabular-nums\">" + (cmpRaw ? money(cmp) : "—") + "</td></tr>";
      }
      out("drip", money(drip)); out("cash", money(amt + cash)); out("cmpv", cmpRaw ? money(cmp) : "—");
      var tb = $('[data-out="rows"]', box); if (tb) tb.innerHTML = rows;
    };
    $$("input,select", box).forEach(function (i) { i.addEventListener("input", run); });
    run();
  });

  $$("[data-print]").forEach(function (b) { b.addEventListener("click", function () { window.print(); }); });

  /* ---------- checklists: remember ticks on this device */
  var key = "lmc-check:" + location.pathname;
  var saved = (function () { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; } })();
  $$(".task-item input[type=checkbox]").forEach(function (cb, i) {
    if (saved[i]) cb.checked = true;
    cb.addEventListener("change", function () {
      saved[i] = cb.checked;
      try { localStorage.setItem(key, JSON.stringify(saved)); } catch (e) { /* ignore */ }
    });
  });

  /* ---------- YouTube facade: load the player only on request */
  $$("[data-yt]").forEach(function (el) {
    var play = function () {
      var id = el.getAttribute("data-yt");
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&modestbranding=1";
      f.title = el.getAttribute("data-title") || "Video";
      f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      f.setAttribute("allowfullscreen", "");
      el.innerHTML = ""; el.appendChild(f); el.removeAttribute("role"); el.removeAttribute("tabindex");
    };
    el.addEventListener("click", play);
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); play(); } });
  });

  /* ---------- attribution: remember first-touch campaign data for the session */
  var qs = new URLSearchParams(location.search), touch = store.get("lmc-touch");
  var keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "msclkid"];
  if (!touch) {
    touch = { landing_page: location.href, referrer: document.referrer || "" };
    keys.forEach(function (k) { touch[k] = qs.get(k) || ""; });
    store.set("lmc-touch", touch);
  } else {
    keys.forEach(function (k) { if (qs.get(k)) touch[k] = qs.get(k); });
    store.set("lmc-touch", touch);
  }

  /* ---------- lead forms */
  var tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { /* old browser */ }
  $$("[data-lead-form]").forEach(function (form) {
    var started = new Date().toISOString();
    var set = function (n, v) { var el = form.elements[n]; if (el) el.value = v || ""; };
    set("page_url", location.href); set("page_title", document.title); set("timezone", tz); set("started_at", started);
    set("referrer", touch.referrer); set("landing_page", touch.landing_page);
    keys.forEach(function (k) { set(k, touch[k]); });
    var note = $("[data-tz-note]", form);
    if (note && tz) note.textContent = "Times are in your local time zone (" + tz.replace(/_/g, " ") + ").";

    var errBox = $("[data-form-error]", form), btn = $("[data-submit]", form), label = $("[data-submit-label]", form);
    var showErr = function (msg) { errBox.textContent = msg; errBox.classList.remove("hidden"); errBox.scrollIntoView({ block: "center", behavior: "smooth" }); };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      errBox.classList.add("hidden");
      if (!form.checkValidity()) {
        var bad = form.querySelector(":invalid");
        var name = bad && (bad.labels && bad.labels[0] ? bad.labels[0].textContent : bad.name);
        showErr("Please complete: " + (name || "the required fields").replace(/\*\s*$/, "").trim() + ".");
        if (bad) bad.focus();
        return;
      }
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      btn.disabled = true; btn.classList.add("opacity-70");
      label.textContent = "Sending to the investor desk…";
      fetch(form.action, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.body.ok) throw new Error((res.body && res.body.error) || "We could not send your enquiry.");
          label.textContent = "Received — opening the secure investor application…";
          if (window.gtag) window.gtag("event", "generate_lead", { form_id: data.form_id });
          window.location.assign(res.body.redirect);
        })
        .catch(function (err) {
          btn.disabled = false; btn.classList.remove("opacity-70");
          label.textContent = "Submit and continue to the investor application";
          showErr(err.message + " Please try again, or call 416-837-1414.");
        });
    });
  });
})();
