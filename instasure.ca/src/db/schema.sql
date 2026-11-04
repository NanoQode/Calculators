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
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin','editor','agent_manager','advisor','viewer')),
  advisor_id INTEGER REFERENCES advisors(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,
  daily_report INTEGER NOT NULL DEFAULT 0,   -- receives the daily lead analytics email
  note_due_lead_id INTEGER,                  -- agents: the new lead they opened and must add a note to
  note_due_since TEXT,
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
  -- Agent portal: self-registered agents start 'pending' and get leads only once approved.
  first_name TEXT, last_name TEXT,
  licence_number TEXT,
  status TEXT NOT NULL DEFAULT 'approved',   -- pending | approved | rejected | suspended
  monthly_lead_cap INTEGER,                  -- max leads auto-assigned per calendar month (NULL = no limit)
  show_on_site INTEGER NOT NULL DEFAULT 1,   -- public profile on /advisors/ (portal agents default to 0)
  registered_at TEXT, approved_at TEXT, approved_by INTEGER,
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
  products TEXT DEFAULT '[]',          -- every product this person has asked about (primary first)
  inquiry_count INTEGER NOT NULL DEFAULT 1,
  assigned_at TEXT,                    -- when the current agent got the lead (monthly caps count this)
  phone_verified_at TEXT,              -- SMS code confirmed
  score_adjustment INTEGER NOT NULL DEFAULT 0,  -- manual points on top of the rules
  disposition TEXT,                    -- last contact outcome
  stage_changed_at TEXT, last_activity_at TEXT,
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

-- Every request a person makes (first one included). Repeat submissions update the lead and add a row here.
CREATE TABLE IF NOT EXISTS lead_inquiries (
  id INTEGER PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  ref TEXT,                          -- reference of the record it came from when merged
  origin TEXT NOT NULL DEFAULT 'submission',   -- submission | repeat | merge
  lead_type TEXT, product TEXT, product_category TEXT, service TEXT,
  is_new_product INTEGER NOT NULL DEFAULT 0,
  quote_inputs TEXT DEFAULT '{}', estimate TEXT DEFAULT '{}',
  timeframe TEXT, message TEXT,
  source TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, landing_page TEXT, page_path TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inquiries_lead ON lead_inquiries(lead_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON lead_inquiries(created_at);

-- References of records merged into another lead, so old links (results, unsubscribe) keep working.
CREATE TABLE IF NOT EXISTS lead_refs (
  ref TEXT PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Follow-up tasks with reminders (pop-up in the admin, email when due).
CREATE TABLE IF NOT EXISTS lead_tasks (
  id INTEGER PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  due_at TEXT NOT NULL,              -- UTC
  assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER,
  done_at TEXT, done_by INTEGER,
  snoozed_until TEXT, reminded_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON lead_tasks(assigned_user_id, done_at, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_lead ON lead_tasks(lead_id);

-- SMS one-time codes: a submission waits here until its phone number is confirmed.
CREATE TABLE IF NOT EXISTS otp_requests (
  id INTEGER PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL DEFAULT 'lead',
  phone TEXT,
  code_hash TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  ctx TEXT NOT NULL DEFAULT '{}',
  send_count INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_sent_at TEXT,
  expires_at TEXT,
  verified_at TEXT,
  lead_id INTEGER,
  ip_hash TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_otp_created ON otp_requests(created_at);

CREATE TABLE IF NOT EXISTS sms_messages (
  id INTEGER PRIMARY KEY,
  to_phone TEXT NOT NULL,
  body TEXT NOT NULL,                -- one-time codes are stored masked
  kind TEXT NOT NULL DEFAULT 'otp',  -- otp | test | notification
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'queued',   -- queued | sent | logged | failed
  provider_id TEXT, error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sms_to ON sms_messages(to_phone, created_at);

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

-- ───────────────────────── Agent billing: plans, subscriptions, invoices, lead credits ─────────────────────────
-- Self-registered agents (advisors.billing = 'metered') get a one-time grant of free lead credits when
-- approved, then buy a monthly plan. Every lead delivered to a metered agent uses one credit; a lead
-- moved away from them or accepted as a bad lead gives the credit back. In-house agents are 'exempt'.
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  leads_per_month INTEGER NOT NULL,
  price_per_lead_cents INTEGER NOT NULL,     -- monthly price = leads_per_month × price_per_lead_cents
  badge TEXT,                                -- e.g. "Most popular"
  features TEXT DEFAULT '[]',                -- extra bullet points for this plan
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  stripe_product_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billing_profiles (
  advisor_id INTEGER PRIMARY KEY REFERENCES advisors(id) ON DELETE CASCADE,
  name TEXT, company TEXT, email TEXT,
  address TEXT, city TEXT, province TEXT, postal_code TEXT,
  tax_number TEXT,                           -- the agent's own GST/HST number, shown on their invoices (optional)
  stripe_customer_id TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY,
  advisor_id INTEGER NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  next_plan_id INTEGER,                      -- plan change that takes effect at the next renewal
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | active | past_due | canceled
  leads_per_month INTEGER NOT NULL DEFAULT 0,
  price_per_lead_cents INTEGER NOT NULL DEFAULT 0,
  provider TEXT NOT NULL DEFAULT 'manual',   -- stripe | manual (Interac e-Transfer, cheque, admin)
  provider_sub_id TEXT,
  current_period_start TEXT, current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  canceled_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_subs_advisor ON subscriptions(advisor_id, status);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  advisor_id INTEGER NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'new',          -- new | renewal | manual
  status TEXT NOT NULL DEFAULT 'open',       -- open | paid | void | refunded
  currency TEXT NOT NULL DEFAULT 'CAD',
  lines TEXT NOT NULL DEFAULT '[]',          -- [{ description, quantity, unit_cents, amount_cents }]
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_label TEXT, tax_rate REAL NOT NULL DEFAULT 0, tax_province TEXT,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,          -- lead credits this invoice buys
  credits_granted INTEGER NOT NULL DEFAULT 0,
  period_start TEXT, period_end TEXT,
  bill_to TEXT NOT NULL DEFAULT '{}',        -- snapshot of the agent's billing details
  seller TEXT NOT NULL DEFAULT '{}',         -- snapshot of the issuer (legal name, address, GST/HST number)
  provider TEXT, provider_ref TEXT,          -- e.g. Stripe Checkout Session or invoice id
  notes TEXT,
  issued_at TEXT DEFAULT CURRENT_TIMESTAMP,
  due_at TEXT, paid_at TEXT, voided_at TEXT, refunded_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_invoices_advisor ON invoices(advisor_id, issued_at);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  advisor_id INTEGER REFERENCES advisors(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,             -- negative for a refund
  method TEXT NOT NULL,                      -- card | etransfer | cheque | comp | test
  status TEXT NOT NULL DEFAULT 'succeeded',  -- succeeded | refunded
  provider_ref TEXT,
  note TEXT,
  recorded_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);

CREATE TABLE IF NOT EXISTS lead_credits (
  id INTEGER PRIMARY KEY,
  advisor_id INTEGER NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,                    -- +grant, -use
  kind TEXT NOT NULL,                        -- free_grant | plan | lead | returned | bad_lead | adjust
  pool TEXT NOT NULL DEFAULT 'paid',         -- free | paid | comp (a lead delivered without a credit)
  lead_id INTEGER, invoice_id INTEGER, claim_id INTEGER,
  reversed_at TEXT,                          -- on a 'lead' row: when its credit was given back
  note TEXT,
  user_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_credits_advisor ON lead_credits(advisor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_credits_lead ON lead_credits(lead_id, advisor_id);

CREATE TABLE IF NOT EXISTS lead_claims (
  id INTEGER PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  advisor_id INTEGER NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',       -- open | approved | rejected
  decided_by INTEGER, decided_at TEXT, decision_note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_claims_status ON lead_claims(status, created_at);
