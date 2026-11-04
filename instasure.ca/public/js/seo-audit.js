/*
 * Instasure SEO/AEO content audit — shared by the server (publish gate, stored seo_score)
 * and the admin editor (live scoring as you type). UMD: works with require() and <script>.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InstasureSeoAudit = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function strip(md) {
    return String(md || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
      .replace(/[#>*_`|~]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function words(s) { var t = strip(s); return t ? t.split(/\s+/) : []; }
  function count(hay, needle) {
    if (!needle) return 0;
    var esc = needle.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var m = hay.toLowerCase().match(new RegExp('\\b' + esc + '\\b', 'g'));
    return m ? m.length : 0;
  }
  function has(hay, needle) { return !!needle && String(hay || '').toLowerCase().indexOf(needle.toLowerCase()) !== -1; }

  /**
   * @param {object} p {title, seoTitle, metaDescription, slug, bodyMd, focusKeyword, excerpt,
   *                    faq:[{q,a}], takeaways:[], sources:[], featuredImage, imageAlt, products:[], contentType, siteHost}
   */
  function audit(p) {
    p = p || {};
    var body = String(p.bodyMd || '');
    var kw = String(p.focusKeyword || '').trim();
    var title = String(p.seoTitle || p.title || '');
    var meta = String(p.metaDescription || '');
    var slug = String(p.slug || '');
    var w = words(body);
    var wc = w.length;
    var first100 = w.slice(0, 100).join(' ');
    var h2 = (body.match(/^##\s+.+$/gm) || []);
    var questionH2 = h2.filter(function (h) { return /\?\s*$/.test(h) || /^##\s+(how|what|why|when|which|is|are|can|do|does|should|who)\b/i.test(h); });
    var links = body.match(/\]\(([^)\s]+)/g) || [];
    var internal = 0, external = 0;
    links.forEach(function (l) {
      var href = l.slice(2);
      if (href.charAt(0) === '/' || (p.siteHost && href.indexOf(p.siteHost) !== -1)) internal++;
      else if (/^https?:/.test(href)) external++;
    });
    var imgs = body.match(/!\[([^\]]*)]\(/g) || [];
    var imgsNoAlt = imgs.filter(function (m) { return /!\[\s*]\(/.test(m); }).length;
    var sentences = strip(body).split(/[.!?]+\s/).filter(function (s) { return s.trim().length > 0; });
    var avgSentence = sentences.length ? wc / sentences.length : 0;
    var density = kw && wc ? (count(strip(body), kw) * kw.split(/\s+/).length * 100) / wc : 0;
    var yearInTitle = (title.match(/\b(20\d\d)\b/) || [])[1];
    var thisYear = new Date().getFullYear();
    var faq = p.faq || [];
    var takeaways = (p.takeaways || []).filter(function (t) { return String(t).trim(); });
    var sources = (p.sources || []).filter(function (s) { return s && s.url; });
    var minWords = p.contentType === 'news' ? 400 : 900;

    var checks = [
      { id: 'title_len', w: 8, label: 'SEO title is 30–60 characters', ok: title.length >= 30 && title.length <= 60, detail: title.length + ' chars' },
      { id: 'meta_len', w: 8, label: 'Meta description is 120–160 characters', ok: meta.length >= 120 && meta.length <= 160, detail: meta.length + ' chars' },
      { id: 'kw_set', w: 4, label: 'Focus keyword is set', ok: !!kw },
      { id: 'kw_title', w: 8, label: 'Focus keyword appears in the SEO title', ok: has(title, kw) },
      { id: 'kw_slug', w: 4, label: 'Focus keyword appears in the URL slug', ok: !!kw && slug.indexOf(kw.toLowerCase().replace(/[^a-z0-9]+/g, '-')) !== -1 },
      { id: 'kw_intro', w: 6, label: 'Focus keyword appears in the first 100 words', ok: has(first100, kw) },
      { id: 'kw_meta', w: 4, label: 'Focus keyword appears in the meta description', ok: has(meta, kw) },
      { id: 'kw_density', w: 3, label: 'Keyword density is natural (0.4–2.5%)', ok: density >= 0.4 && density <= 2.5, detail: density.toFixed(1) + '%' },
      { id: 'length', w: 8, label: 'Comprehensive length (' + minWords + '+ words)', ok: wc >= minWords, detail: wc + ' words' },
      { id: 'h2', w: 5, label: 'At least 3 H2 sections', ok: h2.length >= 3, detail: h2.length + ' H2s' },
      { id: 'q_h2', w: 5, label: 'At least one question-style H2 (People Also Ask / AI answers)', ok: questionH2.length >= 1, detail: questionH2.length + ' found' },
      { id: 'internal', w: 7, label: 'At least 3 internal links (products, calculators, guides)', ok: internal >= 3, detail: internal + ' internal' },
      { id: 'citations', w: 7, label: 'Cites authoritative sources (regulator, government, insurer data)', ok: external >= 1 || sources.length >= 1, detail: (external + sources.length) + ' citations' },
      { id: 'takeaways', w: 6, label: '3+ key takeaways (answer-first summary for AI Overviews)', ok: takeaways.length >= 3, detail: takeaways.length + ' takeaways' },
      { id: 'faq', w: 5, label: '3+ FAQs with concise answers', ok: faq.length >= 3, detail: faq.length + ' FAQs' },
      { id: 'img_alt', w: 3, label: 'All images have alt text', ok: imgsNoAlt === 0 && (!p.featuredImage || !!p.imageAlt) },
      { id: 'readability', w: 4, label: 'Readable sentences (avg ≤ 22 words)', ok: avgSentence > 0 && avgSentence <= 22, detail: avgSentence.toFixed(0) + ' words/sentence' },
      { id: 'fresh_year', w: 3, label: 'Any year in the title is the current year', ok: !yearInTitle || Number(yearInTitle) === thisYear, detail: yearInTitle || 'no year' },
      { id: 'slug_len', w: 2, label: 'Short, readable slug (≤ 60 chars)', ok: slug.length > 0 && slug.length <= 60 },
      { id: 'cta', w: 3, label: 'Linked to at least one product (quote CTA)', ok: (p.products || []).length > 0 },
    ];
    var total = 0, got = 0;
    checks.forEach(function (c) { total += c.w; if (c.ok) got += c.w; });
    var score = Math.round((got / total) * 100);
    return { score: score, grade: score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D', words: wc, checks: checks };
  }

  return { audit: audit };
});
