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

  // ───── Dates and times in the viewer's own time zone (server renders Toronto time as a fallback) ─────
  $$('time[data-local]').forEach(function (t) {
    var d = new Date(t.getAttribute('datetime'));
    if (!isNaN(d)) t.textContent = d.toLocaleString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  });
  $$('[data-autosubmit]').forEach(function (s) { s.addEventListener('change', function () { s.form.submit(); }); });

  // ───── Bulk actions: count selected, confirm deletes ─────
  var bulk = $('[data-bulk-form]');
  if (bulk) {
    var countOut = $('[data-bulk-count]', bulk);
    var count = function () { var n = $$('input[name=ids]:checked', bulk).length; if (countOut) countOut.textContent = n ? n + ' selected' : ''; return n; };
    bulk.addEventListener('change', count);
    bulk.addEventListener('submit', function (e) {
      var n = count(), action = ($('[data-bulk-action]', bulk) || {}).value || '';
      if (!n) { e.preventDefault(); window.alert('Select at least one lead first.'); return; }
      if (action === 'delete' && !window.confirm('Permanently delete ' + n + ' lead' + (n > 1 ? 's' : '') + ' with their requests, follow-ups, timeline and emails? This can’t be undone.')) e.preventDefault();
    });
  }

  // ───── Due times: send the instant the viewer meant (their own time zone) as UTC ─────
  function pad(n) { return ('0' + n).slice(-2); }
  function toLocalInput(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function stampDue(form) {
    var local = $('[data-due-local]', form), utc = $('[data-due-utc]', form);
    if (local && utc) { var d = local.value ? new Date(local.value) : null; utc.value = d && !isNaN(d) ? d.toISOString() : ''; }
  }
  $$('[data-task-form]').forEach(function (f) { f.addEventListener('submit', function () { stampDue(f); }); });

  // ───── Stage pop-up: outcome, notes, score and follow-up with every stage change ─────
  var dlg = $('[data-stage-dialog]');
  if (dlg && dlg.showModal) {
    var form = $('[data-stage-form]', dlg), stageSel = $('[data-sd-stage]', dlg), disp = $('[data-sd-disposition]', dlg);
    var adjust = $('[data-sd-adjust]', dlg), taskBox = $('[data-sd-task]', dlg), taskToggle = $('[data-sd-task-toggle]', dlg);
    var taskTitle = $('[data-sd-task-title]', dlg), dueLocal = $('[data-due-local]', dlg), reasonWrap = $('[data-sd-reason-wrap]', dlg);
    var setTask = function (on) { taskToggle.checked = on; taskBox.classList.toggle('hidden', !on); taskBox.classList.toggle('grid', on); if (on && !dueLocal.value) setWhen('tomorrow'); };
    var setWhen = function (w) {
      var d = new Date();
      if (w === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); } else d = new Date(Date.now() + Number(w) * 60000);
      dueLocal.value = toLocalInput(d);
    };
    var showReason = function () { reasonWrap.classList.toggle('hidden', stageSel.value !== 'lost'); };
    var open = function (src, stage) {
      form.action = '/admin/leads/' + src.getAttribute('data-id') + '/update';
      $('[data-sd-name]', dlg).textContent = src.getAttribute('data-name') || '';
      stageSel.value = stage || src.getAttribute('data-stage') || stageSel.value;
      $('[data-sd-score]', dlg).textContent = src.getAttribute('data-score') || '—';
      adjust.value = src.getAttribute('data-adjust') || '0';
      disp.value = ''; $('[data-sd-note]', dlg).value = ''; taskTitle.value = ''; dueLocal.value = '';
      var forAgent = $('[data-sd-for-agent]', dlg); if (forAgent) forAgent.disabled = src.getAttribute('data-agent') !== '1';
      setTask(false); showReason();
      dlg.showModal();
      setTimeout(function () { disp.focus(); }, 30);
    };
    $$('[data-sd-close]', dlg).forEach(function (b) { b.addEventListener('click', function () { dlg.close(); }); });
    stageSel.addEventListener('change', showReason);
    disp.addEventListener('change', function () {
      var o = disp.options[disp.selectedIndex];
      if (o.getAttribute('data-stage')) { stageSel.value = o.getAttribute('data-stage'); showReason(); }
      if (o.getAttribute('data-task')) { setTask(true); if (!taskTitle.value) taskTitle.value = o.getAttribute('data-task'); }
    });
    taskToggle.addEventListener('change', function () { setTask(taskToggle.checked); });
    $$('[data-sd-when]', dlg).forEach(function (b) { b.addEventListener('click', function () { setWhen(b.getAttribute('data-sd-when')); }); });
    $$('[data-sd-bump]', dlg).forEach(function (b) { b.addEventListener('click', function () { adjust.value = Math.max(-50, Math.min(50, (Number(adjust.value) || 0) + Number(b.getAttribute('data-sd-bump')))); }); });
    form.addEventListener('submit', function (e) {
      if (!taskToggle.checked) { taskTitle.value = ''; dueLocal.value = ''; }
      else if (!taskTitle.value || !dueLocal.value) { e.preventDefault(); window.alert('Give the follow-up a title and a due time, or untick “Schedule a follow-up”.'); return; }
      stampDue(form);
    });

    $$('[data-stage-open]').forEach(function (b) { b.addEventListener('click', function () { open(b); }); });
    // Stage menus (lead page, pipeline cards) open the pop-up instead of saving straight away.
    $$('[data-stage-select-form]').forEach(function (f) {
      var sel = $('[data-stage-select]', f);
      f.addEventListener('submit', function (e) { e.preventDefault(); open(f, sel.value); });
      sel.addEventListener('change', function () { open(f, sel.value); });
    });
    // Pipeline drag and drop.
    var dragged = null;
    $$('[data-card]').forEach(function (c) {
      c.addEventListener('dragstart', function (e) { dragged = c; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.getAttribute('data-id')); c.classList.add('opacity-50'); });
      c.addEventListener('dragend', function () { c.classList.remove('opacity-50'); dragged = null; });
    });
    $$('[data-drop-stage]').forEach(function (col) {
      var depth = 0;
      col.addEventListener('dragenter', function (e) { e.preventDefault(); depth++; col.classList.add('bg-secondary-container/40'); });
      col.addEventListener('dragleave', function () { depth = Math.max(0, depth - 1); if (!depth) col.classList.remove('bg-secondary-container/40'); });
      col.addEventListener('dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      col.addEventListener('drop', function (e) {
        e.preventDefault(); depth = 0; col.classList.remove('bg-secondary-container/40');
        var to = col.getAttribute('data-drop-stage');
        if (dragged && dragged.getAttribute('data-stage') !== to) open(dragged, to);
      });
    });
  }

  // ───── Follow-up reminders: pop up due tasks, every minute ─────
  var popups = $('[data-task-popups]'), tpl = $('[data-task-template]');
  if (popups && tpl && 'content' in tpl) {
    var shown = {};
    var post = function (url, body) { return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify(body || {}) }); };
    var dismiss = function (id, el, minutes) { post('/admin/tasks/' + id + '/snooze', { minutes: minutes || 10 }).finally(function () { el.remove(); delete shown[id]; }); };
    var render = function (t) {
      if (shown[t.id]) return;
      var node = tpl.content.firstElementChild.cloneNode(true);
      $('[data-t-title]', node).textContent = t.title;
      $('[data-t-lead]', node).textContent = t.lead + ' · ' + t.ref + (t.phone ? ' · ' + t.phone : '');
      var d = new Date(String(t.due_at).replace(' ', 'T') + 'Z');
      $('[data-t-when]', node).textContent = isNaN(d) ? '' : '· ' + d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
      if (t.notes) { var n = $('[data-t-notes]', node); n.textContent = t.notes; n.classList.remove('hidden'); }
      $('[data-t-open]', node).href = '/admin/leads/' + t.lead_id + '#tasks';
      $('[data-t-close]', node).addEventListener('click', function () { dismiss(t.id, node, 10); });
      $$('[data-t-snooze]', node).forEach(function (b) { b.addEventListener('click', function () { dismiss(t.id, node, Number(b.getAttribute('data-t-snooze'))); }); });
      $('[data-t-done]', node).addEventListener('click', function () { post('/admin/tasks/' + t.id + '/done').finally(function () { node.remove(); delete shown[t.id]; }); });
      shown[t.id] = node;
      popups.appendChild(node);
    };
    var poll = function () {
      if (document.hidden) return;
      fetch('/admin/tasks/due.json', { headers: { Accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.tasks) j.tasks.forEach(render); }).catch(function () {});
    };
    poll();
    setInterval(poll, 60000);
    document.addEventListener('visibilitychange', poll);
  }
})();
