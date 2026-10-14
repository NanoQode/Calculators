-- Instasure.ca schema (SQLite). Idempotent: safe to run on every boot.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ───────────────────────── Users & auth ─────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin','editor','advisor','viewer')),
  advisor_id INTEGER REFERENCES advisors(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip TEXT,
  ua TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY,
  email TEXT,
  ip TEXT,
  ok INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ───────────────────────── Advisors (E-E-A-T authors + lead routing) ─────────────────────────
CREATE TABLE IF NOT EXISTS advisors (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  title TEXT,
  designations TEXT,                 -- e.g. "LLQP, CFP, CIP"
  photo TEXT,
  bio_md TEXT,
  email TEXT,
  phone TEXT,
  booking_url TEXT,                  -- Calendly / Cal.com / MS Bookings link
  languages TEXT DEFAULT '["en"]',   -- JSON array of ISO codes
  provinces TEXT DEFAULT '[]',       -- JSON array of province codes the advisor is licensed in
  licences TEXT DEFAULT '[]',        -- JSON [{province, regulator, type, number, expires}]
  categories TEXT DEFAULT '[]',      -- JSON array of product categories: life, health, auto, property, business, travel
  specialties TEXT DEFAULT '[]',     -- JSON array of specialist desks (niche service or product slugs) this advisor staffs
  years_experience INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  accepting_leads INTEGER NOT NULL DEFAULT 1,
  weight INTEGER NOT NULL DEFAULT 1, -- routing weight
  max_open_leads INTEGER DEFAULT 150,
  last_assigned_at TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Code-defined product catalog can be toggled/overridden from the admin.
CREATE TABLE IF NOT EXISTS product_overrides (
  slug TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  lead_value REAL,
  data TEXT DEFAULT '{}',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Province / city fact overrides (risk notes, benchmarks, verification state).
CREATE TABLE IF NOT EXISTS geo_overrides (
  key TEXT PRIMARY KEY,              -- 'on' or 'on/toronto'
  data TEXT NOT NULL DEFAULT '{}',
  verified_at TEXT,
  verified_by INTEGER,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ───────────────────────── Leads ─────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'new',
  lead_type TEXT NOT NULL DEFAULT 'quote',   -- quote | consult | calculator | guide | newsletter | partial
  first_name TEXT, last_name TEXT, email TEXT COLLATE NOCASE, phone TEXT,
  province TEXT, city TEXT, postal_code TEXT, language TEXT DEFAULT 'en',
  product TEXT, product_category TEXT,
  service TEXT,                      -- specialty service or specialist desk slug (src/data/services.js), if any
  quote_inputs TEXT DEFAULT '{}',
  estimate TEXT DEFAULT '{}',
  timeframe TEXT, best_time TEXT, message TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  grade TEXT,
  score_breakdown TEXT DEFAULT '[]',
  value_estimate REAL DEFAULT 0,
  advisor_id INTEGER REFERENCES advisors(id) ON DELETE SET NULL,
  source TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_term TEXT, utm_content TEXT,
  landing_page TEXT, referrer TEXT, page_path TEXT,
  visitor_id TEXT, session_id TEXT, ip_hash TEXT, user_agent TEXT,
  consent_marketing INTEGER NOT NULL DEFAULT 0,
  consent_text TEXT, consent_at TEXT,
  unsubscribed_at TEXT,
  duplicate_of INTEGER,
  is_test INTEGER NOT NULL DEFAULT 0,
  contacted_at TEXT, won_at TEXT, lost_reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_advisor ON leads(advisor_id);

CREATE TABLE IF NOT EXISTS lead_events (
  id INTEGER PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data TEXT DEFAULT '{}',
  user_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_events(lead_id);

CREATE TABLE IF NOT EXISTS scoring_rules (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'fit',   -- fit | intent | quality | engagement
  field TEXT NOT NULL,
  operator TEXT NOT NULL,                 -- eq neq in nin gte lte between exists missing contains regex
  value TEXT,
  points INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

-- ───────────────────────── Drip campaigns ─────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  trigger TEXT NOT NULL DEFAULT 'lead_created',   -- lead_created | quote_abandoned | status_changed | manual
  filters TEXT DEFAULT '{}',
  stop_on_statuses TEXT DEFAULT '["won","lost","junk"]',
  require_express_consent INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaign_steps (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  delay_hours REAL NOT NULL DEFAULT 24,
  subject TEXT NOT NULL,
  preheader TEXT,
  body_md TEXT NOT NULL,
  cta_label TEXT, cta_url TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',   -- active | completed | stopped | unsubscribed | failed
  current_position INTEGER NOT NULL DEFAULT 0,
  next_run_at TEXT,
  stop_reason TEXT,
  enrolled_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  UNIQUE (campaign_id, lead_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_due ON enrollments(status, next_run_at);

CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  enrollment_id INTEGER, step_id INTEGER,
  kind TEXT NOT NULL DEFAULT 'drip',       -- drip | transactional | notification
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT, text TEXT,
  status TEXT NOT NULL DEFAULT 'queued',   -- queued | sent | logged | failed | suppressed
  provider_id TEXT, error TEXT,
  open_count INTEGER NOT NULL DEFAULT 0, opened_at TEXT,
  click_count INTEGER NOT NULL DEFAULT 0, clicked_at TEXT,
  sent_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_emails_lead ON emails(lead_id);

CREATE TABLE IF NOT EXISTS suppressions (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ───────────────────────── CMS: guides / blog ─────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  hub TEXT,                 -- personal | residential | auto | commercial | claims
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  body_md TEXT NOT NULL DEFAULT '',
  body_html TEXT,
  toc TEXT DEFAULT '[]',
  content_type TEXT NOT NULL DEFAULT 'guide',   -- guide | comparison | data | news | checklist
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  tags TEXT DEFAULT '[]',
  author_id INTEGER REFERENCES advisors(id) ON DELETE SET NULL,
  reviewer_id INTEGER REFERENCES advisors(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',          -- draft | scheduled | published | archived
  published_at TEXT, scheduled_at TEXT, last_reviewed_at TEXT,
  featured_image TEXT, image_alt TEXT,
  seo_title TEXT, meta_description TEXT, canonical TEXT, robots TEXT,
  focus_keyword TEXT,
  keywords TEXT DEFAULT '[]',
  faq TEXT DEFAULT '[]',          -- [{q,a}]
  takeaways TEXT DEFAULT '[]',    -- ["…"] answer-first bullets for AI/featured snippets
  sources TEXT DEFAULT '[]',      -- [{title,url,publisher}]
  products TEXT DEFAULT '[]',     -- related product slugs (internal linking + CTAs)
  provinces TEXT DEFAULT '[]',
  reading_minutes INTEGER, word_count INTEGER, seo_score INTEGER,
  views INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status, published_at);

CREATE TABLE IF NOT EXISTS post_revisions (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  title TEXT, body_md TEXT, meta TEXT,
  user_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  original_name TEXT,
  mime TEXT, size INTEGER,
  alt TEXT,
  user_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ───────────────────────── SEO ─────────────────────────
CREATE TABLE IF NOT EXISTS seo_overrides (
  path TEXT PRIMARY KEY,
  title TEXT, description TEXT, canonical TEXT, robots TEXT, og_image TEXT,
  h1 TEXT, intro_md TEXT,
  faq TEXT,                -- JSON [{q,a}] appended to page FAQ
  schema_json TEXT,        -- extra JSON-LD node(s)
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS redirects (
  id INTEGER PRIMARY KEY,
  from_path TEXT NOT NULL UNIQUE,
  to_path TEXT NOT NULL,
  code INTEGER NOT NULL DEFAULT 301,
  hits INTEGER NOT NULL DEFAULT 0,
  last_hit_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS not_found (
  path TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 1,
  referrer TEXT,
  last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS keywords (
  id INTEGER PRIMARY KEY,
  keyword TEXT NOT NULL UNIQUE COLLATE NOCASE,
  level TEXT NOT NULL,             -- national | provincial | local
  product TEXT, province TEXT, city TEXT,
  volume INTEGER,                  -- est. monthly searches (Canada)
  volume_source TEXT DEFAULT 'model',
  difficulty INTEGER,              -- 0-100
  intent TEXT,                     -- transactional | commercial | informational | local | navigational
  cluster TEXT,
  competitors TEXT,                -- who ranks today
  target_path TEXT,
  priority INTEGER DEFAULT 3,      -- 1 (highest) .. 5
  rank INTEGER,
  notes TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS indexnow_log (
  id INTEGER PRIMARY KEY,
  urls TEXT, status INTEGER, response TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ───────────────────────── Analytics (first-party, cookie-light) ─────────────────────────
CREATE TABLE IF NOT EXISTS pageviews (
  id INTEGER PRIMARY KEY,
  ts TEXT DEFAULT CURRENT_TIMESTAMP,
  path TEXT, title TEXT,
  referrer_host TEXT, source TEXT,
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
  visitor_id TEXT, session_id TEXT,
  device TEXT, is_entry INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pv_ts ON pageviews(ts);
CREATE INDEX IF NOT EXISTS idx_pv_session ON pageviews(session_id);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  ts TEXT DEFAULT CURRENT_TIMESTAMP,
  name TEXT NOT NULL, path TEXT,
  visitor_id TEXT, session_id TEXT,
  data TEXT DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts, name);

CREATE TABLE IF NOT EXISTS crawler_hits (
  id INTEGER PRIMARY KEY,
  ts TEXT DEFAULT CURRENT_TIMESTAMP,
  bot TEXT NOT NULL, kind TEXT, path TEXT, status INTEGER
);
CREATE INDEX IF NOT EXISTS idx_crawler_ts ON crawler_hits(ts, bot);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER, action TEXT, entity TEXT, entity_id TEXT, data TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
