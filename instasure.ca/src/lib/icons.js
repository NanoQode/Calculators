'use strict';
/**
 * Builds a subset Material Symbols font URL (Google Fonts `icon_names=`) containing only the
 * glyphs this site uses — ~20–40 KB instead of the multi-hundred-KB full variable font (LCP/CLS win).
 * Icon names are discovered from views, data files and client scripts at boot.
 */
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

const EXTRA = ['arrow_forward', 'check', 'check_circle', 'close', 'menu', 'expand_more', 'chevron_right', 'search', 'bolt', 'lock', 'verified', 'verified_user', 'info', 'warning', 'progress_activity', 'mail', 'call', 'chat', 'calendar_month', 'star', 'radio_button_unchecked', 'logout', 'dashboard', 'person', 'settings', 'edit', 'delete', 'add', 'download', 'visibility', 'open_in_new', 'content_copy', 'sync', 'travel_explore', 'smart_toy', 'trending_up', 'trending_down', 'filter_list', 'insights', 'campaign', 'article', 'manage_search', 'tune', 'map', 'group', 'shield', 'layers', 'menu_book', 'home', 'calculate', 'support_agent', 'location_on', 'schedule', 'apartment', 'storefront', 'favorite', 'health_and_safety', 'directions_car', 'flight_takeoff', 'key', 'savings', 'policy', 'gavel', 'quiz', 'help', 'thumb_up', 'bookmark_add', 'pin_drop', 'speed', 'groups', 'query_stats', 'location_city', 'public', 'translate', 'workspace_premium', 'balance', 'compare_arrows', 'water_drop', 'local_fire_department', 'thunderstorm', 'event_available', 'all_inclusive', 'house', 'monitor_heart', 'accessible', 'medical_services', 'family_restroom', 'construction', 'flash_on', 'account_balance', 'payments', 'timer', 'history', 'military_tech', 'vital_signs', 'published_with_changes', 'attach_money', 'forum', 'smoke_free', 'smoking_rooms', 'female', 'male', 'bookmark_border', 'domain_verification', 'fact_check', 'arrow_back', 'arrow_upward', 'arrow_downward', 'link', 'east', 'north_east', 'notifications', 'person_add', 'block', 'send', 'pause', 'play_arrow', 'refresh', 'upload', 'image', 'hub', 'route', 'rule', 'task_alt', 'cancel', 'flag', 'mark_email_read', 'ads_click', 'edit_note', 'emergency', 'contract', 'receipt_long', 'view_kanban', 'phone_in_talk', 'unsubscribe', 'person_remove', 'science', 'visibility_off', 'drag_indicator', 'schedule_send', 'draft', 'public_off', 'check_box', 'chevron_left', 'more_horiz'];

let url = null;

function collect() {
  const names = new Set(EXTRA);
  const re1 = /material-symbols-outlined[^>]*>\s*([a-z0-9_]+)\s*</g;
  const re2 = /icon:\s*'([a-z0-9_]+)'/g;
  const re3 = /data-icon="([a-z0-9_]+)"/g;
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.(ejs|js)$/.test(f.name)) {
        const src = fs.readFileSync(p, 'utf8');
        for (const re of [re1, re2, re3]) { re.lastIndex = 0; let m; while ((m = re.exec(src))) names.add(m[1]); }
      }
    }
  };
  walk(path.join(config.ROOT, 'views'));
  walk(path.join(config.ROOT, 'src', 'data'));
  walk(path.join(config.ROOT, 'public', 'js'));
  return [...names].filter((n) => /^[a-z0-9_]+$/.test(n)).sort();
}

function fontUrl() {
  if (url) return url;
  const names = collect();
  url = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&icon_names=${names.join(',')}&display=block`;
  return url;
}

module.exports = { fontUrl, collect };
