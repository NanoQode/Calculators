'use strict';
/**
 * The ONE media store (guide images, advisor photos, OG images all use it).
 *  - Type is decided by magic bytes, never by filename or Content-Type.
 *  - SVG is refused outright (it's a document that can carry script, served same-origin).
 *  - Stored filenames are generated; caller-supplied names are only kept as metadata.
 *  - No "add by URL" (avoids a server-side fetch / SSRF surface entirely).
 *  - Deletion reports where an asset is still referenced before allowing a forced delete.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('../config');
const db = require('../db');

const MAX_BYTES = 5 * 1024 * 1024;
const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const NAME_RE = /^[a-f0-9]{24}\.(png|jpg|webp|gif)$/;

function sniff(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  const g = buf.toString('latin1', 0, 6);
  if (g === 'GIF87a' || g === 'GIF89a') return 'gif';
  return null;
}

/** Pixel size from the image header (for width/height attributes that prevent layout shift). Null when unknown. */
function dimensions(buf) {
  try {
    const ext = sniff(buf);
    if (ext === 'png') return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (ext === 'gif') return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
    if (ext === 'webp') {
      const kind = buf.toString('latin1', 12, 16);
      if (kind === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
      if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
      if (kind === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    }
    if (ext === 'jpg') {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1];
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch { /* truncated header */ }
  return null;
}

class MediaError extends Error { constructor(m) { super(m); this.status = 422; } }

function save(buffer, { originalName, alt, userId } = {}) {
  if (!buffer || !buffer.length) throw new MediaError('The file is empty.');
  if (buffer.length > MAX_BYTES) throw new MediaError(`That file is ${(buffer.length / 1048576).toFixed(1)} MB — the limit is 5 MB.`);
  const ext = sniff(buffer);
  if (!ext) throw new MediaError('Only PNG, JPEG, WebP or GIF images are accepted (SVG is not allowed).');
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  const filename = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(config.uploadsDir, filename), buffer, { flag: 'wx' });
  const id = db.insert('media', { filename, original_name: String(originalName || '').slice(0, 200), mime: MIME[ext], size: buffer.length, alt: String(alt || '').slice(0, 300), user_id: userId || null });
  return { id, filename, url: `/uploads/${filename}` };
}

/** Where is this asset referenced? Best-effort per table. */
function references(filename) {
  const url = `/uploads/${filename}`;
  const like = `%${url}%`;
  const count = (sql, params) => { try { return db.value(sql, params) || 0; } catch { return 0; } };
  return {
    posts_featured: count('SELECT COUNT(*) FROM posts WHERE featured_image = ?', [url]),
    posts_body: count('SELECT COUNT(*) FROM posts WHERE body_md LIKE ?', [like]),
    advisors: count('SELECT COUNT(*) FROM advisors WHERE photo = ?', [url]),
    seo_overrides: count('SELECT COUNT(*) FROM seo_overrides WHERE og_image = ? OR intro_md LIKE ?', [url, like]),
    settings: count('SELECT COUNT(*) FROM settings WHERE value LIKE ?', [like]),
    campaign_steps: count('SELECT COUNT(*) FROM campaign_steps WHERE body_md LIKE ?', [like]),
  };
}

function remove(id, { force = false } = {}) {
  const m = db.get('SELECT * FROM media WHERE id = ?', [id]);
  if (!m) return { ok: false, error: 'Not found' };
  const refs = references(m.filename);
  const total = Object.values(refs).reduce((a, b) => a + b, 0);
  if (total && !force) return { ok: false, inUse: true, refs, total };
  if (NAME_RE.test(m.filename)) { try { fs.unlinkSync(path.join(config.uploadsDir, m.filename)); } catch { /* already gone */ } }
  db.run('DELETE FROM media WHERE id = ?', [id]);
  return { ok: true };
}

/** Register image files that exist in the uploads dir but have no DB row. */
function adoptOrphans() {
  if (!fs.existsSync(config.uploadsDir)) return 0;
  const known = new Set(db.all('SELECT filename FROM media').map((r) => r.filename));
  let n = 0;
  for (const f of fs.readdirSync(config.uploadsDir)) {
    if (known.has(f) || f.startsWith('.')) continue;
    const p = path.join(config.uploadsDir, f);
    try {
      const st = fs.statSync(p);
      if (!st.isFile() || st.size > MAX_BYTES) continue;
      const fd = fs.openSync(p, 'r'); const head = Buffer.alloc(16); fs.readSync(fd, head, 0, 16, 0); fs.closeSync(fd);
      const ext = sniff(head);
      if (!ext) continue;
      db.insert('media', { filename: f, original_name: f, mime: MIME[ext], size: st.size });
      n++;
    } catch { /* skip unreadable */ }
  }
  return n;
}

module.exports = { sniff, dimensions, save, remove, references, adoptOrphans, MediaError, MAX_BYTES, NAME_RE };
