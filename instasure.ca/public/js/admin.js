/* Instasure admin — small progressive enhancements (no framework). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var csrf = ($('meta[name=csrf-token]') || {}).content || '';

  // Mobile nav
  var mt = $('[data-admin-menu]');
  if (mt) mt.addEventListener('click', function () { $$('[data-admin-nav]').forEach(function (n) { n.classList.toggle('hidden'); }); });

  // Confirm dangerous actions (forms with data-confirm, including formaction buttons inside them)
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-confirm]');
    if (f && !window.confirm(f.getAttribute('data-confirm'))) e.preventDefault();
  }, true);

  // Select-all on tables
  $$('[data-check-all]').forEach(function (c) {
    c.addEventListener('change', function () { $$('input[name=ids]', c.closest('form')).forEach(function (i) { i.checked = c.checked; }); });
  });

  // Character counters for SEO fields
  function counter(name, lo, hi) {
    var input = $('[name="' + name + '"]'), out = $('[data-count="' + name + '"]');
    if (!input || !out) return;
    var paint = function () { var n = input.value.length; out.textContent = n + ' chars'; out.style.color = n === 0 ? '' : (n >= lo && n <= hi ? '#006c46' : '#ba1a1a'); };
    input.addEventListener('input', paint); paint();
  }
  counter('seo_title', 30, 60); counter('meta_description', 120, 160); counter('title', 30, 60); counter('description', 120, 160);

  // ───── Guide editor: live SEO/AEO audit, SERP preview, markdown preview ─────
  var ed = $('[data-post-editor]');
  if (ed) {
    var siteHost = ed.getAttribute('data-site-host');
    var val = function (n) { var el = ed.elements[n]; return el ? el.value : ''; };
    var lines = function (n) { return val(n).split('\n').map(function (s) { return s.trim(); }).filter(Boolean); };
    function faq() {
      var out = [], cur = null;
      val('faq').split('\n').forEach(function (l) {
        var t = l.trim();
        if (/^q:/i.test(t)) { if (cur && cur.a) out.push(cur); cur = { q: t.slice(2).trim(), a: '' }; }
        else if (/^a:/i.test(t) && cur) cur.a = t.slice(2).trim();
      });
      if (cur && cur.a) out.push(cur);
      return out;
    }
    function runAudit() {
      if (!window.InstasureSeoAudit) return;
      var r = window.InstasureSeoAudit.audit({
        title: val('title'), seoTitle: val('seo_title'), metaDescription: val('meta_description'), slug: val('slug'), bodyMd: val('body_md'),
        focusKeyword: val('focus_keyword'), excerpt: val('excerpt'), faq: faq(), takeaways: lines('takeaways'),
        sources: lines('sources').map(function (l) { var p = l.split('|'); return { title: (p[0] || '').trim(), url: (p[1] || '').trim() }; }),
        featuredImage: val('featured_image'), imageAlt: val('image_alt'), contentType: val('content_type'),
        products: $$('input[name=products]:checked', ed).map(function (i) { return i.value; }), siteHost: siteHost,
      });
      $('[data-score]').textContent = r.score;
      $('[data-score-bar]').style.width = r.score + '%';
      var ul = $('[data-checks]'); ul.innerHTML = '';
      r.checks.forEach(function (c) {
        var li = document.createElement('li');
        li.className = 'flex items-start gap-2 text-[12px] leading-4';
        li.innerHTML = '<span class="material-symbols-outlined text-[16px]"></span><span></span>';
        li.children[0].textContent = c.ok ? 'check_circle' : 'cancel';
        li.children[0].style.color = c.ok ? '#006c46' : '#ba1a1a';
        li.children[1].textContent = c.label + (c.detail ? ' — ' + c.detail : '');
        ul.appendChild(li);
      });
      $('[data-serp-url]').textContent = siteHost + ' › guides › ' + (val('slug') || '…');
      $('[data-serp-title]').textContent = (val('seo_title') || val('title') || 'Title') + ' | Instasure.ca';
      $('[data-serp-desc]').textContent = val('meta_description') || val('excerpt') || 'Meta description…';
    }
    var t;
    ed.addEventListener('input', function () { clearTimeout(t); t = setTimeout(runAudit, 250); });
    ed.addEventListener('change', runAudit);
    window.addEventListener('load', runAudit);

    var body = $('[data-body]'), preview = $('[data-preview]');
    $$('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () {
        var showPreview = b.getAttribute('data-tab') === 'preview';
        $$('[data-tab]').forEach(function (x) { var on = x === b; x.classList.toggle('bg-primary-container', on); x.classList.toggle('text-on-primary', on); x.classList.toggle('bg-surface-container', !on); });
        body.classList.toggle('hidden', showPreview); preview.classList.toggle('hidden', !showPreview);
        if (showPreview) {
          preview.textContent = 'Rendering…';
          fetch('/admin/posts/preview', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ body_md: body.value }) })
            .then(function (r) { return r.text(); })
            .then(function (txt) { var j; try { j = JSON.parse(txt); } catch (e) { throw new Error(txt.slice(0, 200)); } preview.innerHTML = j.html; })
            .catch(function (e) { preview.textContent = 'Preview failed: ' + e.message; });
        }
      });
    });
    $$('[data-pick]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = $('[data-image-field]'); f.value = b.getAttribute('data-pick'); f.dispatchEvent(new Event('input', { bubbles: true }));
        var alt = ed.elements.image_alt; if (alt && !alt.value) alt.value = b.getAttribute('data-alt') || '';
      });
    });
  }

  // ───── Media library: drop zone, copy URL, dimensions ─────
  var dz = $('[data-dropzone]');
  if (dz) {
    var target = $('[data-drop-target]', dz), file = $('[data-file]', dz), name = $('[data-file-name]', dz), err = $('[data-upload-error]', dz);
    var depth = 0;
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });
    target.addEventListener('dragenter', function (e) { e.preventDefault(); depth++; target.classList.add('border-secondary', 'bg-secondary-container/20'); });
    target.addEventListener('dragleave', function () { depth = Math.max(0, depth - 1); if (!depth) target.classList.remove('border-secondary', 'bg-secondary-container/20'); });
    target.addEventListener('drop', function (e) {
      e.preventDefault(); e.stopPropagation(); depth = 0; target.classList.remove('border-secondary', 'bg-secondary-container/20');
      if (e.dataTransfer.files.length) { file.files = e.dataTransfer.files; name.textContent = e.dataTransfer.files[0].name; }
    });
    file.addEventListener('change', function () { name.textContent = file.files[0] ? file.files[0].name : ''; });
    dz.addEventListener('submit', function (e) {
      var f = file.files[0];
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) { e.preventDefault(); err.textContent = 'That file is over the 5 MB limit.'; err.classList.remove('hidden'); }
      else if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) { e.preventDefault(); err.textContent = 'Only PNG, JPEG, WebP or GIF images are accepted.'; err.classList.remove('hidden'); }
    });
  }
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = location.origin + b.getAttribute('data-copy');
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { b.textContent = 'Copied!'; setTimeout(function () { b.textContent = 'Copy URL'; }, 1500); }).catch(function () { window.prompt('Copy this URL', text); });
    });
  });
  $$('img[data-dim]').forEach(function (img) {
    var paint = function () { var out = img.closest('.card').querySelector('[data-dim-out]'); if (out) out.textContent = img.naturalWidth + '×' + img.naturalHeight; };
    if (img.complete) paint(); else img.addEventListener('load', paint);
  });
})();
