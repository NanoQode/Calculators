'use strict';
/**
 * Markdown → sanitized HTML with heading ids + TOC, external-link hardening,
 * lazy images, responsive tables, and "callout" blockquotes (> **Tip:** …).
 */
const { Marked } = require('marked');
const sanitizeHtml = require('sanitize-html');
const { slugify, wordCount, escapeHtml } = require('./util');
const config = require('../config');

const siteHost = new URL(config.siteUrl).host;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(t) {
  return t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function render(md) {
  const toc = [];
  const used = new Map();
  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        // Plain heading text for the TOC and the id: tags stripped and entities decoded (the template escapes it once).
        const plain = decodeEntities(text.replace(/<[^>]+>/g, ''));
        let id = slugify(plain) || 'section';
        const n = used.get(id) || 0;
        used.set(id, n + 1);
        if (n) id = `${id}-${n}`;
        if (depth === 2 || depth === 3) toc.push({ id, text: plain, depth });
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        let external = false;
        try { const u = new URL(href, config.siteUrl); external = u.host !== siteHost; } catch { /* relative */ }
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        return external
          ? `<a href="${href}"${t} rel="noopener" target="_blank">${text}</a>`
          : `<a href="${href}"${t}>${text}</a>`;
      },
      image({ href, title, text }) {
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text || '')}"${t} loading="lazy" decoding="async">`;
      },
    },
  });
  const raw = marked.parse(String(md || ''));
  const html = sanitizeHtml(raw, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'div', 'h1', 'h2', 'h3', 'h4', 'details', 'summary', 'figure', 'figcaption', 'mark', 'sup', 'sub']),
    allowedAttributes: {
      '*': ['id', 'class'],
      a: ['href', 'title', 'rel', 'target'],
      img: ['src', 'alt', 'title', 'loading', 'decoding', 'width', 'height'],
      th: ['align', 'colspan', 'rowspan'], td: ['align', 'colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      blockquote: (tagName, attribs) => ({ tagName, attribs: { ...attribs, class: 'callout' } }),
    },
  });
  const wrapped = html.replace(/<table>/g, '<div class="overflow-x-auto"><table>').replace(/<\/table>/g, '</table></div>');
  const words = wordCount(md);
  return { html: wrapped, toc, words, readingMinutes: Math.max(1, Math.round(words / 225)) };
}

/** Render inline-only markdown (FAQ answers, short blurbs). */
function inline(md) {
  const marked = new Marked({ gfm: true });
  return sanitizeHtml(marked.parseInline(String(md || '')), {
    allowedTags: ['a', 'strong', 'em', 'b', 'i', 'code', 'br'],
    allowedAttributes: { a: ['href', 'rel', 'target'] },
  });
}

module.exports = { render, inline };
