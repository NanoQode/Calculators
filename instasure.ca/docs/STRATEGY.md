# instasure.ca strategy: keywords, gaps, page hierarchy and content plan

October 2026. This document turns the competitor research into the plan that the site build follows. Companion files:

- [`KEYWORDS.md`](KEYWORDS.md): the full keyword lists by city, province and Canada-wide, sorted by volume, with the target page for each keyword (generated from `src/data/keywords.js`, also loaded into **Admin → SEO → Keyword map**).
- [`keywords.csv`](keywords.csv): the same data for spreadsheets.
- [`SITE_REVIEW.md`](SITE_REVIEW.md): the direct crawl of competitor sites (robots.txt, complete sitemaps, llms.txt, on-page metadata of 51 pages) and the adjustments it led to.
- [`CONTENT_REVIEW.md`](CONTENT_REVIEW.md): facts, figures and compliance items to verify before launch.

> **About the numbers.** Coverage for Ratehub, PolicyAdvisor and Sonnet comes from their complete XML sitemaps and a direct crawl of their pages (October 2026, see `SITE_REVIEW.md`). Rates.ca, Sun Life and Manulife block automated requests, so their coverage comes from search results and Rates.ca's llms.txt. City SERPs were captured for Toronto, Brampton, Mississauga, Ottawa and Hamilton. Keyword volumes are **modelled estimates** (see `KEYWORDS.md`); import Keyword Planner data in the admin before using them for forecasts.

---

## 1. Best use of the brand

**instasure.ca: instant answers, instant estimates, a licensed advisor, then instant policies where the law and the product allow.**

The name promises speed, and speed is what the strongest competitors under-deliver:

- Aggregators (Rates.ca, Ratehub) are fast but stop at a quote list and hand you to an insurer or broker.
- PolicyAdvisor is advice-led but licensed in only four provinces (ON, BC, AB, MB).
- Carriers (Sun Life, Manulife) have instant products (Sun Life Go, Manulife CoverMe) but sell only their own.
- Sonnet sells instantly online but only its own P&C products, in five provinces for auto.

No one combines all three: instant information for every product in every province, an instant estimate, and a licensed advisor who compares insurers. That is the position for instasure.ca:

| Promise | What it means on the site | Honest limit |
|---|---|---|
| **Instant information** | Every product, province and city page answers the main question ("how much", "is it mandatory", "what changed") in its first two sentences, with a dated figure and a source. | Figures are dated estimates, never promises. |
| **Instant estimate** | A 60-second estimate on every product page and in `/quote/`, showing a low–high range for a stated example profile. | An estimate is not a quote; insurers price after underwriting. |
| **Dedicated licensed advisor** | Each request is routed to an advisor licensed in the visitor's province, for that product line and in their language. | Only in provinces where a licensed advisor is on the roster; Quebec and the territories get a waitlist. |
| **Instant policy (roadmap)** | Online binding for products that can legally be bought online in that province: travel/super visa, tenant, simplified-issue and guaranteed-issue life. | Needs carrier or MGA integrations and, in Quebec, AMF registration under the Alternative Distribution Methods regulation. |

**Brand rules in copy:**
- Use "instant estimate" until a product truly binds online.
- Say "licensed advisor", not "broker", unless the operating entity is a registered brokerage.
- Make no "cheapest", "best" or "lowest price" claims without a published methodology (Competition Act; RIBO and FSRA advertising rules).

---

## 2. Competitor landscape

| Competitor | Model | What wins for them | Weak spots we can use |
|---|---|---|---|
| **Rates.ca** | P&C and mortgage marketplace. Its llms.txt says it does **not** offer life, health or travel insurance | 34+ Ontario car city pages, plus quarterly Ontario and Alberta rate-change trackers by insurer (from FSRA and AIRB filings). A strong data formula on each city page: "average $X/yr, Y% vs provincial average, Nth of 181 Ontario communities", plus postal-code (FSA) tables. The deepest business tree (15+ trades). Data reports (Insuramap, Dangerous Drivers, Best Auto Insurance Study). | City pages are Ontario-only outside Calgary, Edmonton and Vancouver; car province pages only for ON, AB, BC and QC. Pages block automated access, so their metadata comes from search results. Generic titles ("Cheap Car Insurance" with no city on Hamilton and North York), an indexed `?cta=` URL, stale "2024" titles, inconsistent driver profiles between pages. |
| **Ratehub** | Multi-product aggregator (mortgage-led) | From its sitemap: car pages for all 13 provinces and territories and 40 cities, home for 18 cities, life for 10 provinces and 6 cities, plus CI, DI, mortgage life, super visa and French life pages. Two pages per city (blog "How much is car insurance in X?" plus a product page). "Recent quotes" tables. Article and FAQ markup on every money page. | No Vaughan, Richmond Hill, Milton, Pickering, Ajax, Whitby or Toronto sub-area pages. No condo city pages; tenant for 3 cities. One author on every page and no reviewer. 31% of money pages have sitemap dates from 2023–2024, and several city pages were last modified in May 2025. The car hub's canonical points to another URL. Literal "&amp;" in home titles. Conflicting Brampton figures across pages. |
| **PolicyAdvisor** | Life and health brokerage | The biggest life/CI/DI/health library; cost by age and by amount; "Best X companies in Canada (2026)"; carrier reviews and "Sun Life vs Manulife"; newcomer cluster; LLQP author pages. | Licensed only in ON, BC, AB and MB. Life city pages for 9 cities (its sitemap also lists Calgary, which returns 404), with "(2025)" in titles and no author or date markup. 38% of life pages have sitemap dates from 2019–2023. The super visa cost page canonicalises into another section and has invalid JSON-LD. (It does have standalone life and CI calculators, 15 term-life head-to-heads and "Reviewed by" lines on guides.) |
| **Sun Life** | Carrier | Instant direct products (Go Term, Go Simplified, Go Guaranteed, Express CI); rate pages ("Term Life Insurance Rates in Canada"); life and CI calculators; claims-paid trust statistics. | Own products only. Generic one-phrase titles relying on authority. Legacy CMS duplicates indexed. No province or city pages; local presence is advisor microsites (`advisor.sunlife.ca`). Blocks automated access. |
| **Manulife** | Carrier | Product pages for term (CoverMe, Family Term with Vitality), permanent (Par, UL, guaranteed issue), health and dental, CI and the "Synergy" 3-in-1 product; an InsureRight needs calculator. | Own products only. No province or city pages seen. Duplicate product paths indexed (`/personal/insurance/our-products/…` and `/personal/insurance/…`). Blocks automated access. |
| **Sonnet** | Direct P&C insurer | `/product/province/city/` architecture with French mirrors; first-party city averages ("Toronto $241/mo"); question-title FAQs ("Is home insurance mandatory in Ontario?"); a cancellation calculator. | From its sitemap: 9 auto, 6 home, 10 tenant and 3 condo city pages, plus 464 short FAQ pages. Now also sells landlord and pet insurance. No auto in AB, BC, MB, SK or NL; no life or business. No breadcrumbs or social image on English money pages, repeated template H2s, and a malformed `Sitemap` line in robots.txt. |

**What the local SERPs look like (Toronto, Brampton, Mississauga, Ottawa and Hamilton, car and home):** every result is a city-specific commercial page. Besides the six competitors, MyChoice, Square One, ThinkInsure, LowestRates, Onlia, InsuranceHotline and Surex hold positions. **Home SERPs are softer than car SERPs**: local brokers hold #1 for Toronto, Brampton and Ottawa home insurance. The best car opening seen is Hamilton, where the #2 result has a generic title and small brokers fill #3, #8 and #9.

---

## 3. What to target, by level (top 15 by volume)

Full lists: [`KEYWORDS.md`](KEYWORDS.md). Volumes are modelled monthly Google searches in Canada.

### 3.1 Local (city)

| # | Keyword | Est. volume | Target page | Priority |
|---:|---|---:|---|---|
| 1 | car insurance toronto | 6,600 | `/car-insurance/ontario/toronto/` | P1 |
| 2 | car insurance brampton | 2,900 | `/car-insurance/ontario/brampton/` | P1 |
| 3 | car insurance calgary | 2,800 | `/car-insurance/alberta/calgary/` | P1 |
| 4 | car insurance mississauga | 2,400 | `/car-insurance/ontario/mississauga/` | P1 |
| 5 | cheap car insurance toronto | 2,300 | `/car-insurance/ontario/toronto/` | P1 |
| 6 | car insurance edmonton | 2,100 | `/car-insurance/alberta/edmonton/` | P1 |
| 7 | home insurance toronto | 1,900 | `/home-insurance/ontario/toronto/` | P1 |
| 8 | car insurance ottawa | 1,600 | `/car-insurance/ontario/ottawa/` | P1 |
| 9 | car insurance scarborough | 1,600 | *planned Toronto sub-area page* | P1 |
| 10 | assurance auto montréal | 1,600 | *planned `/fr/`* | P3 |
| 11 | car insurance hamilton | 1,500 | `/car-insurance/ontario/hamilton/` | P1 |
| 12 | how much is car insurance in toronto | 1,300 | `/car-insurance/ontario/toronto/` | P2 |
| 13 | tenant insurance toronto | 1,300 | `/tenant-insurance/ontario/toronto/` | P3 |
| 14 | car insurance vaughan | 1,300 | `/car-insurance/ontario/vaughan/` | P2 |
| 15 | car insurance markham | 1,200 | `/car-insurance/ontario/markham/` | P2 |

### 3.2 Provincial

| # | Keyword | Est. volume | Target page | Priority |
|---:|---|---:|---|---|
| 1 | assurance auto (QC) | 33,000 | *planned `/fr/assurance-auto/`* | P3 |
| 2 | assurance habitation (QC) | 22,000 | *planned `/fr/assurance-habitation/`* | P3 |
| 3 | car insurance ontario | 12,000 | `/car-insurance/ontario/` | P1 |
| 4 | assurance vie (QC) | 9,900 | *planned `/fr/assurance-vie/`* | P3 |
| 5 | soumission assurance auto (QC) | 6,600 | *planned `/fr/soumission/`* | P3 |
| 6 | car insurance alberta | 4,500 | `/car-insurance/alberta/` | P1 |
| 7 | ontario auto insurance changes 2026 | 4,400 | `/guides/ontario-auto-insurance-changes-july-2026/` | P1 |
| 8 | assurance locataire (QC) | 4,400 | *planned `/fr/assurance-locataire/`* | P3 |
| 9 | home insurance ontario | 3,000 | `/home-insurance/ontario/` | P1 |
| 10 | car insurance quebec | 2,200 | `/car-insurance/quebec/` | P3 |
| 11 | car insurance bc | 2,200 | `/car-insurance/british-columbia/` | P2 |
| 12 | alberta car insurance increase 2026 | 1,900 | `/guides/alberta-car-insurance-2026-care-first/` | P1 |
| 13 | tenant insurance ontario | 1,600 | `/tenant-insurance/ontario/` | P3 |
| 14 | care first auto insurance alberta | 1,600 | `/guides/alberta-car-insurance-2026-care-first/` | P1 |
| 15 | health insurance ontario | 1,300 | `/health-dental-insurance/ontario/` | P1 |

### 3.3 Canada-wide

| # | Keyword | Est. volume | Target page | Priority |
|---:|---|---:|---|---|
| 1 | car insurance | 74,000 | `/car-insurance/` | P2 |
| 2 | travel insurance | 40,000 | `/travel-insurance/` | P3 |
| 3 | auto insurance | 33,000 | `/car-insurance/` | P3 |
| 4 | life insurance | 33,000 | `/life-insurance/` | P1 |
| 5 | home insurance | 27,000 | `/home-insurance/` | P1 |
| 6 | tenant insurance | 15,000 | `/tenant-insurance/` | P1 |
| 7 | car insurance quotes | 14,000 | `/quote/car-insurance/` | P1 |
| 8 | cheap car insurance | 9,900 | `/car-insurance/` | P2 |
| 9 | super visa insurance | 9,900 | `/super-visa-insurance/` | P1 |
| 10 | renters insurance | 9,900 | `/tenant-insurance/` | P2 |
| 11 | dental insurance | 8,100 | `/health-dental-insurance/` | P2 |
| 12 | house insurance | 8,100 | `/home-insurance/` | P2 |
| 13 | business insurance | 8,100 | `/business-insurance/` | P1 |
| 14 | term life insurance | 6,600 | `/term-life-insurance/` | P1 |
| 15 | critical illness insurance | 6,600 | `/critical-illness-insurance/` | P1 |

**How to read this:** head terms (car, life, home insurance) are where the volume is, but they are won by building depth underneath them. The first rankings and leads will come from the P1 city, province, regulation and audience pages, where competitors are thin, stale or absent.

---

## 4. Correlation map: keyword clusters × competitors × gaps

Coverage: ● dedicated pages at depth · ◐ partial (few pages, blog only, thin or stale) · ○ none · ? not researched. Ratehub, PolicyAdvisor and Sonnet are scored from their complete sitemaps and a direct crawl; Rates.ca, Sun Life and Manulife from search results and Rates.ca's llms.txt. "Gap" rates the opening for a new site.

| Keyword cluster | Est. vol/mo | Rates.ca | Ratehub | PolicyAdvisor | Sun Life | Manulife | Sonnet | Gap | instasure.ca play |
|---|---:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Car, Ontario GTA cities | ~27,000 | ● | ◐ (no Vaughan, Richmond Hill, Milton, Durham) | ○ | ○ | ○ | ◐ | Low–medium | Dated example tables plus an instant estimate on every city page. Vaughan, Richmond Hill, Milton, Pickering, Ajax and Whitby have only Rates.ca. Hamilton is the weakest big-city SERP. |
| Car, GTA sub-areas (Scarborough, North York, Etobicoke) | ~3,500 | ● | ○ | ○ | ○ | ○ | ◐ | **High** | Toronto sub-area pages; Rates.ca's North York title has no city name. |
| Car, cities outside Ontario | ~19,000 | ◐ | ● (40 cities, thin, many last updated May 2025) | ○ | ○ | ○ | ◐ (Montréal) | Medium | Beat Ratehub's round-number pages on freshness and data: dated tables by driver profile, province rules, local risks. Airdrie, St. Albert, Spruce Grove, Surrey, Burnaby, Laval and Gatineau have no Ratehub car page. |
| Car regulation (ON reform, AB Care-First, ICBC) | ~15,000 | ◐ | ◐ | ○ | ○ | ○ | ◐ | **High** | Built: 3 guides. Next: an opt-out savings calculator and an Alberta countdown with city figures. |
| Rate-change trackers by insurer | ~1,000 | ● (ON, AB) | ○ | ○ | ○ | ○ | ○ | **High** outside ON/AB | Don't duplicate Rates.ca. Build an Atlantic rate-decision tracker (NS, NB, NL, PEI boards; verify each publishes decisions). |
| Car personas (new drivers, newcomers, high risk, gig) | ~10,000 | ◐ | ● | ○ | ○ | ○ | ○ | Medium | Built: new drivers, seniors, EV, classic and bundle pages, plus high-risk, newcomer and gig-driver pages each with a specialist desk. Next: licence-stage sections (G1/G2/G, Class 7, L/N) and high-risk sub-guides. |
| Car data (theft, cost by province) | ~6,300 | ● | ◐ | ○ | ○ | ○ | ◐ | Medium | The Rate Index plus theft pages refreshed with each Équité report. |
| Home, city pages | ~17,000 | ● | ● (18 cities) | ○ | ○ | ○ | ◐ (6) | Medium | Home SERPs are softer than car (local brokers at #1). Brampton, Ottawa and Hamilton first; coverage-level tables on every page. |
| Home perils (water, flood, hail, earthquake) | ~6,800 | ◐ | ◐ | ○ | ○ | ○ | ◐ | **High** | Built: water damage and Calgary hail guides. Next: national flood program tracker, BC earthquake. |
| Tenant and condo, city pages | ~17,000 | ◐ | ◐ (tenant 3, condo 0) | ○ | ○ | ○ | ◐ (tenant 10, condo 3) | **High** for condo | Condo city pages are the most open. Student towns (Waterloo, Kingston, London, Guelph) for tenant. |
| Condo deductible / strata | ~900 | ○ | ◐ | ○ | ○ | ○ | ◐ | **High** | Built: deductible assessment guide plus coverage calculator. |
| Life, core and types | ~51,000 | ○ (no life) | ● | ● | ● | ● | ○ | Low | Compete through depth below the head terms. |
| Life cost tables (by age and amount) | ~4,100 | ○ | ◐ | ● | ● | ? | ○ | Medium | Built: cost guide plus age × sex tables on every life province and city page. Next: one page per age band fed by Rate Index data. |
| Life by province | ~2,500 | ○ | ● (10, thin, no rate tables) | ◐ (4 prov.) | ○ | ○ | ○ | Medium | Built: all 10 provinces with dated age × sex tables and licensed-advisor matching. PolicyAdvisor can't sell outside ON, BC, AB and MB. |
| Life by city | ~7,800 | ○ | ◐ (6, thin) | ◐ (9, "(2025)" titles, no dates) | ○ | ○ | ○ | **High** | Built: tier-1 city pages with current dates, tables and FAQs. |
| Life audiences (newcomers, seniors, conditions) | ~5,400 | ○ | ◐ | ● | ◐ | ? | ○ | Medium | Built: newcomer guide plus seniors, final expense, joint, children and universal life pages; medical conditions and newcomers each have a specialist desk. Next: per-condition pages, translations. |
| Funeral expense (funeral, burial, CPP death benefit) | ~10,600 | ○ | ◐ | ◐ (final expense) | ◐ (own funeral page) | ? | ○ | **High** | Built: `/life-insurance/funeral-expense/` with the Funeral expense desk, H1 "from $1 a day" backed by a labelled example estimate, and a small-policy quote flow. Next: 12 planned guides (CPP death benefit, how funeral insurance works, pre-arranged vs insurance, waiting periods…). |
| Instant / no-medical life | ~2,500 | ○ | ◐ | ◐ | ● (Go) | ● (CoverMe) | ○ | Medium | A neutral comparison of instant products: issue age, maximum cover, health questions, time to coverage. |
| Mortgage protection | ~5,000 | ○ | ◐ | ● (9 pages) | ? | ● | ○ | Medium | Built: comparison guide plus calculator (no competitor tool of this kind). Tie to the 2026 renewal wave. |
| CI and DI | ~17,000 | ○ | ◐ | ● | ● | ● | ○ | Medium | Built: CI vs DI guide, age tables on province pages, and a self-employed DI page with its own desk (Ontario opt-out tie-in). |
| Health and dental / CDCP | ~15,000 | ○ | ◐ | ● (4 prov., CDCP page) | ● | ● | ○ | Medium | Built: CDCP vs private guide and plan-type tables. Differentiate on provinces PolicyAdvisor doesn't serve. |
| Super visa and visitors | ~21,000 | ○ | ◐ | ● (38 pages) | ◐ | ? | ○ | Medium | Built: super visa product with its desk, city pages with visitor-age tables, a guide, and visitors-to-Canada, snowbird (desk) and international-student pages. Community targeting (Brampton, Surrey, Mississauga). |
| Business by coverage | ~26,000 | ● | ● | ○ | ○ | ○ | ○ | Low–medium | Built: business, contractor and professional liability pages, business-type tables and a coverage checker. |
| Business by trade | ~4,300 | ● | ◐ | ○ | ○ | ○ | ○ | Medium | Built: 6 trade pages (plumber, electrician, HVAC, landscaping, cleaning, roofing) plus restaurant, cyber, D&O, key person, home-based and commercial auto (desk). More trades use the same template. |
| Specialty personal lines (pet, boat, RV, motorcycle, ATV, umbrella, landlord, mobile home) | ~30,000 | ◐ | ● | ○ | ○ | ○ | ◐ (landlord, pet) | Low–medium | Built: one page each, advisor-quoted. Completeness pages that keep the visitor on site and feed cross-sell (umbrella for landlords, boat with cottage). |
| Hard-to-place risks (declined homes, high-risk drivers, medical underwriting, fleets, short-term rentals, cottages) | ~7,400 | ◐ | ◐ | ◐ | ○ | ○ | ○ | **High** | Built: a page plus a staffed specialist desk for each. Competitors publish one generic page and a quote form; none offers a person who handles these cases. |
| Group benefits | ~2,800 | ○ | ◐ | ● | ? | ● | ○ | Medium | Highest lead value on the site; province pages with team-size tables built. |
| Insurer reviews | ~5,000 | ● | ● (23 P&C) | ● (47 life/CI) | ○ | ○ | ○ | Medium (soft SERPs) | Planned `/reviews/{insurer}/` with a published method. |
| Insurer head-to-heads ("A vs B") | ~1,000 | ○ | ○ | ● (15, life only) | ○ | ○ | ○ | **High** for P&C | Start with P&C pairs (Intact vs Aviva, TD vs Intact…). No competitor has them. |
| Calculators | ~9,600 | ◐ | ○ | ● (life, CI) | ● | ● | ◐ | Medium | Built: 4 calculators plus instant estimates on every product. Differentiators: mortgage protection, condo deductible, business coverage, Ontario opt-out. |
| French Quebec | ~83,000 | ◐ | ◐ (about 30 FR pages) | ○ | ● | ● | ● | **Blocked** | Plan only. Needs AMF registration and French pages before any page goes live. |
| Advisors near me | ~12,000 | ◐ | ○ | ◐ ("-advisor" pages) | ● (microsites) | ? | ○ | Medium | Advisor profiles with licence numbers per province; Google Business Profiles where advisors really work. |

**Strongest niche gaps** (high value, weak or missing competitor coverage):
1. **GTA sub-areas and second-tier GTA cities:** Scarborough, North York, Etobicoke, Vaughan, Richmond Hill, Milton, Pickering, Ajax and Whitby have the highest premiums in Canada, and only Rates.ca serves them (Ratehub's sitemap has none).
2. **Fresh, data-led city pages everywhere:** outside Ontario only Ratehub has P&C city pages, and many were last updated in May 2025 with round-number averages. Competitor life city pages are thin (Ratehub) or carry "(2025)" titles with no dates (PolicyAdvisor). Dated tables and a visible "Updated" date beat both.
3. **Life and living benefits outside ON, BC, AB and MB:** PolicyAdvisor can't sell there; Ratehub's province pages are thin and carry no rate tables; carriers have no geo pages.
4. **Regulation explainers with calculators:** the Ontario opt-out, Alberta Care-First and ICBC optional coverage.
5. **Condo city pages, then tenant and student-renter pages.**
6. **P&C insurer head-to-heads** and an **Atlantic rate-decision tracker**: nobody covers them.
7. **Mortgage protection at renewal** and **super visa by community**.
8. **Calculators that no competitor offers:** mortgage protection vs term, condo deductible assessment, business coverage checker, Ontario opt-out savings.
9. **A person for the hard cases:** every competitor treats high-risk drivers, declined homes, medical conditions, newcomers and fleets as a page with a quote form. instasure.ca routes them to a staffed specialist desk (section 5.1).

---

## 5. Page hierarchy for lead generation (site skeleton)

Built pages are in plain text; *planned* pages are in italics. 828 URLs exist today (October 3, 2026), 659 of them indexable, and the guides grow by 3 a day. Thin programmatic pages are kept out of the index until an editor enriches them.

```
/                                    Home: instant-quote portal (product picker, 60-second estimate, advisor promise)
├── /quote/                          Quote hub: choose a product
│   ├── /quote/{product}/            Quote flow per product (18), instant estimate
│   ├── /quote/results/{ref}/        Results: estimate tiers, advisor match, next steps (noindex)
│   └── /thank-you/                  Confirmation (noindex)
├── /{product}/                      18 product pillars: life, term, whole, no-medical, mortgage life, CI, DI,
│   │                                health & dental, travel, super visa, car, home, condo, tenant, business,
│   │                                contractor, professional liability, group benefits
│   ├── /{product}/{province}/       Product × province (234; 231 indexable): rules, regulator, cost drivers, estimate
│   │   └── /{product}/{province}/{city}/   Product × city (406; 255 indexable): local cost, risks, nearby cities, advisors
│   ├── /{product}/{service}/        Service pages (46, all indexable), e.g. /car-insurance/high-risk-drivers/,
│   │                                /life-insurance/medical-conditions/, /contractor-insurance/plumber/; 16 carry a specialist desk
│   ├── *best companies sub-pages*   e.g. /car-insurance/best-companies/ (after a published methodology)
├── /{service}/                      Stand-alone service pages: /pet-insurance/, /motorcycle-insurance/, /boat-insurance/,
│                                    /rv-insurance/, /atv-snowmobile-insurance/, /landlord-insurance/, /umbrella-insurance/,
│                                    /long-term-care-insurance/
├── /insurance-services/             All services hub: every product, service and specialist desk
├── /insurance/                      Insurance by place
│   ├── /insurance/{province}/       Province hub (13): auto system, regulator, all products
│   └── /insurance/{province}/{city}/   City hub (58): every product for that city, local advisors
├── /guides/                         Knowledge & risk centre
│   ├── /guides/category/{slug}/     7 categories
│   └── /guides/{slug}/              Guides by Michael Le Chi, CFP: 18 at launch + 3 a day from the Blog Content Plan (+ .md twins for AI tools, noindex)
├── /calculators/                    4 calculators: life needs, mortgage protection, tenant/condo coverage, business coverage
├── /compare/                        Product-type comparisons (term vs whole, mortgage vs term…)
│   └── */compare/{a}-vs-{b}/*       *Insurer head-to-heads*
├── */reviews/{insurer}/*            *Insurer reviews with a published method*
├── /advisors/                       Licensed advisor directory
│   └── /advisors/{slug}/            Profile: licences by province, languages, designations
├── /insights/rate-index/            Instasure Rate Index (quarterly, from anonymised quote requests)
├── /glossary/                       Plain-language definitions (DefinedTermSet)
├── Trust: /about/  /how-we-make-money/  /editorial-guidelines/  /licensing/  /privacy/  /terms/  /accessibility/  /contact/  /site-map/
├── Machine-readable: /sitemap.xml (core, services, provinces, cities, places, guides, advisors)  /robots.txt  /llms.txt  /llms-full.txt
└── */fr/…*                          *French Quebec and New Brunswick mirror (after AMF registration)*
```

**How each level generates leads**

| Level | Search intent | Conversion device | Lead value |
|---|---|---|---|
| Quote flow | Transactional ("car insurance quotes") | 60-second estimate, then contact details and consent, then advisor match | Highest |
| Product × city | Local commercial ("car insurance brampton") | Inline estimate widget with the city pre-filled, local cost figures, nearby-city links | High |
| Product × province | Commercial with rules ("home insurance alberta") | Estimate widget, province rules, licensed-advisor block | High |
| Product pillar | Head terms | Product explainer, estimate widget, links to every province and service | Medium–high |
| Service page | Persona and specialty ("high risk car insurance", "landlord insurance") | Example estimate where the model supports it, otherwise an advisor quote; a specialist call-back form on desk pages | High (desk pages highest) |
| Guides | Informational ("does home insurance cover water damage") | Contextual estimate CTA, calculator links, nurture opt-in | Medium (nurture) |
| Calculators | Tool ("how much life insurance do I need") | Result first, then optional "send me this and match me with an advisor" | High |
| Rate Index and data | Research, press, AI answers | Citations and links that raise every other page | Indirect |
| Advisor profiles | Trust and local | Book a review with that advisor | High |

Every lead runs through the backend pipeline: validation, postal code to province, estimate, duplicate check, scoring (A–D), routing to an advisor licensed in that province and product line (a specialist on the desk first, when the lead came from a desk page), drip campaign enrolment (with express consent), confirmation email and team alert. Non-serviceable provinces get a waitlist instead of a quote.

### 5.1 Services and specialist desks

The service catalogue (`src/data/services.js`) covers what the six competitors sell beyond the 18 core products: 46 pages across auto, property, life, health, travel and business. Where the research found a niche gap, the page gets a **specialist desk**: a call-back form that sends the lead to an advisor who handles these cases, a desk phone line (the customer service number until desks get their own), and routing that prefers advisors tagged with that desk.

| Desk | Page | Why it is a gap |
|---|---|---|
| High-risk auto | /car-insurance/high-risk-drivers/ | Competitors publish one generic high-risk page; nothing for a lapse, cancellation or impaired-driving record. |
| Newcomer driver | /car-insurance/newcomers/ | No multilingual help or country-by-country proof-of-experience guidance. High intent in Brampton, Mississauga and Surrey. |
| Gig driver | /car-insurance/rideshare-and-delivery/ | Nobody connects rideshare coverage with the July 2026 Ontario accident-benefits opt-out and disability cover. |
| Accident benefits review (Ontario only) | /car-insurance/accident-benefits-review/ | Everyone explains the reform; nobody offers a personal review with a licensed advisor. |
| Short-term rental | /home-insurance/short-term-rental/ | One thin competitor page; no condo-host or frequency guidance. |
| Cottage & rural property | /home-insurance/cottage-and-seasonal/ | No specialist help for remote, water-access and rented cottages. |
| Hard-to-insure property | /home-insurance/hard-to-insure/ | No aggregator helps with declined or non-renewed homes; demand rises with flood and wildfire losses. |
| Medical underwriting | /life-insurance/medical-conditions/ | Competitors cover a handful of conditions and offer no anonymous pre-underwriting. |
| Funeral expense | /life-insurance/funeral-expense/ | Competitors fold funeral cover into a generic final-expense page; none sizes it to the funeral or sets the CPP death benefit and pre-arranged contracts side by side. H1 "from $1 a day" backed by a labelled example estimate. |
| Newcomer life | /life-insurance/newcomers/ | PolicyAdvisor is licensed in four provinces and offers no multilingual help. |
| Self-employed income protection | /disability-insurance/self-employed/ | Nobody links disability cover to the Ontario income-replacement opt-out or covers gig workers. |
| Snowbird travel | /travel-insurance/snowbirds/ | Medical questionnaire and stability-period mistakes are where snowbird claims fail; no one offers help as a service. |
| Commercial auto & trucking | /business-insurance/commercial-auto/ | No competitor handles fleets, trucking or mixed driver records as a service. |
| Mortgage renewal protection | /mortgage-life-insurance/ | Renewal-wave timing plus a side-by-side of lender and personal cover. |
| Super Visa | /super-visa-insurance/ | Policies checked against IRCC rules, with community-language advisors. |
| Condo | /condo-insurance/ | Reading the corporation's declaration and sizing improvements and the deductible assessment. |

**How a desk works in the backend.** Admin → Advisors → *Specialist desks* tags each advisor with the desks they staff. A lead from a desk page carries `service`; routing first picks among advisors on that desk who are licensed for the province and product line, then falls back to any licensed advisor and logs "No specialist on this desk is licensed for the province" on the lead timeline. Lead lists show the service and desk. The launch checklist counts how many desks have a real advisor.

**Customer service number.** Production uses **+1 877 610 6554** (set October 3, 2026 in Site settings → Customer service number). It shows in the header, footer, menus, hub, service pages and desk panels, and in the JSON-LD (`telephone`, `contactPoint`). A fresh install ships with the `1-800-000-0000` placeholder, which cannot connect, stays out of the JSON-LD and is flagged by the launch checklist until replaced. Lead alerts go to help@instasure.ca (Site settings → notify emails).

---

## 6. Title tags and meta descriptions

Templates in use on this build. `{Year}` updates automatically; the brand suffix " | Instasure.ca" is added when the title stays within 65 characters. Every template can be overridden per URL in **Admin → SEO → Page overrides**.

| Page type | Title template | Example | Meta description template |
|---|---|---|---|
| Home | Instasure.ca — Compare Insurance Quotes in Canada \| Instant Estimates | (fixed) | Instant insurance estimates for life, critical illness, home, tenant, car, travel and business coverage in every province — then a licensed advisor compares insurers for you. |
| Product pillar | {Product H1 before the colon} ({Year}) | Car Insurance Quotes (2026) | {Tagline} Instant {product} estimates for every province, plain-language guidance and licensed advisors. |
| Product × province | {Product} in {Province}: Costs, Rules & Quotes ({Year}) | Home Insurance in Alberta: Costs, Rules & Quotes (2026) | {Product} in {Province}: how it works under {regulator}, what drives price, instant estimates and advisors licensed in {Province}. |
| Product × city | {Product} {City}, {PR}: Compare Quotes & Costs ({Year}) | Car Insurance Brampton, ON: Compare Quotes & Costs (2026) | Compare {product} in {City}, {Province}: instant estimate ({low}–{high}/mo example), local risk factors and advisors licensed in {Province}. |
| Quote flow | {Product} Quote — Instant Estimate in 60 Seconds | Life Insurance Quote — Instant Estimate in 60 Seconds | Get an instant {product} estimate for your province in about a minute, then compare real insurer quotes with a licensed advisor. No obligation. |
| Province hub | Insurance in {Province}: Life, Home, Car & Business Coverage | Insurance in Nova Scotia: Life, Home, Car & Business Coverage | How insurance works in {Province}: {auto system}, regulator ({regulator}), local risks and licensed advisors. |
| City hub | Insurance in {City}, {PR}: Compare Quotes & Licensed Advisors | Insurance in Halifax, NS: Compare Quotes & Licensed Advisors | Insurance in {City}: instant estimates for car, home, tenant, life and business coverage, local risk factors, and advisors licensed in {Province}. |
| Guide | Editor's SEO title (question or "X vs Y" form, year where relevant) | Does Home Insurance Cover Water Damage in Canada? | Editor's description; the SEO audit checks length, keyword and answer-first opening. |
| Calculator | {Tool} (Canada) | Life Insurance Needs Calculator (Canada) | What it calculates plus "instant results, no email required". |
| Rate Index | Instasure Rate Index — Canadian Insurance Estimates ({Month Year}) | | Quarterly index of Canadian insurance estimate ranges by product and province, built from anonymised Instasure quote requests. |
| Advisor | {Name}, {Designations} — {Title} | | First 160 characters of the advisor bio. |

**Title formulas competitors use, and what we do instead** (Ratehub, PolicyAdvisor and Sonnet titles verified in the October 2026 crawl; full verbatim table in `SITE_REVIEW.md`):

| Their formula | Who | Our version | Why |
|---|---|---|---|
| "Cheap Car Insurance {City}" | Rates.ca | "Car Insurance {City}, ON: Compare Quotes & Costs (2026)" | "Cheap" invites a price promise we can't make; the year and "costs" match the "how much" intent too. |
| "Compare {City} Car Insurance Quotes & Save Today \| Ratehub.ca" (H1: "Compare the best {City} car insurance quotes & save today") | Ratehub | Same "compare" verb, plus a dated cost range in the description and a dated table on the page | Answers both intents on one page instead of a blog post plus a product page. |
| "Affordable Car Insurance in {City} from $220/month" | MyChoice | Estimate range in the description, tied to a stated example profile | "From $X" needs a dated, representative profile (Competition Act, RIBO). |
| "Best Life Insurance in {City} (2025) \| PolicyAdvisor"; province: "Best Life Insurance in Ontario (2026)" with "starts at $22/month" in the description | PolicyAdvisor | "Life Insurance {City}, ON: Compare Quotes & Costs (2026)", with an example range and profile in the description | Current year and a visible updated date; no "best" without a methodology. |
| "Car Insurance in {City}: Quote and Buy Online \| Sonnet Insurance" (some run to 82 characters) | Sonnet | "Instant estimate" wording until a product truly binds online; titles kept under 65 characters | Honest version of the instant promise; no truncation in results. |
| "Is home insurance mandatory in {Province}?" | Sonnet FAQ | FAQ blocks on each province page (FAQPage markup) | Captures the People Also Ask questions on the money page. |

**Rules:** keep titles to 60–65 characters with the keyword first; add the province abbreviation to city titles (no competitor does, and it settles London, Richmond, Windsor and Kingston); one H1 per page that matches the title's topic; the description answers the question and ends with the action; "(Year)" only on pages that are actually refreshed each year, with the visible "Updated" date to back it up.

---

## 7. Value, knowledge and data to publish

### 7.1 Content that works for competitors (and our version)

| Pattern | Who it works for | Built on instasure.ca | Next |
|---|---|---|---|
| City cost pages with a dated average, % vs province, rank and FSA table | Rates.ca, Ratehub, Sonnet | City and province pages show a modelled estimate range, a dated example-estimates table (age × sex for life, driver profiles for car, coverage levels for property, visitor age for super visa), local risk factors, nearby cities and a visible "Updated" date | Replace modelled ranges with Rate Index medians and FSA tables once quote volume allows (minimum sample per cell). |
| "How much does X cost (by age / amount)" | PolicyAdvisor, Sun Life | Life cost guide | Age-band and amount pages. |
| "X vs Y" | PolicyAdvisor (incl. 15 term-life insurer pairs), Sun Life, Ratehub | Term vs whole, CI vs DI, mortgage vs term, CDCP vs private | P&C insurer head-to-heads first (nobody has them). |
| "Best X companies in Canada (Year)" | PolicyAdvisor, wealthnorth, HelloSafe | Not built | Only after publishing a ranking methodology. |
| Insurer reviews | All aggregators | Not built | `/reviews/{insurer}/`; brand-review SERPs looked soft. |
| Regulation explainers within days | Rates.ca, brokers, insurers | Ontario July 2026, Alberta Care-First, ICBC optional, "why is my car insurance going up" | Opt-out calculator; refresh each quarter. |
| Audience pages | PolicyAdvisor (newcomers), Ratehub (personas) | Newcomer life, gig drivers, super visa | Newcomer car, seniors, conditions hub, translations. |
| Question FAQs ("is X mandatory in Y") | Sonnet | Tenant/landlord guide; FAQ blocks on product and geo pages | One FAQ set per product × province. |
| Data reports and surveys | Rates.ca, Ratehub, Kanetix, Applied | Rate Index page | Quarterly release with a press note. |
| Calculators | Sun Life, PolicyAdvisor (life, CI), Manulife, Rates.ca, Sonnet | 4 calculators plus 18 instant estimate flows | Ontario opt-out savings and car cost by province (CI calculators are already common). |

### 7.2 Data assets to own

1. **Instasure Rate Index (quarterly):** median estimate by product and province, and later by city, from anonymised quote requests, with a methodology section and a downloadable CSV. The page and Dataset markup are built; it fills as quote data accumulates.
2. **Ontario opt-out tracker:** the share of Ontario quotes that drop optional accident benefits and the average saving. No one owns this.
3. **Atlantic rate-decision tracker:** approved auto rate changes by insurer in Nova Scotia, New Brunswick, Newfoundland and Labrador and PEI. Rates.ca already tracks Ontario and Alberta filings quarterly, so don't duplicate those; link to FSRA and the Alberta Insurance Rate Board instead. Verify each Atlantic board publishes its decisions before committing.
4. **Alberta Care-First countdown:** premiums before and after January 1, 2027, by city.
5. **Life price tables:** ages 20–70 × $250K/$500K/$1M × smoker status, refreshed monthly. The age × sex version is now built into every life province and city page; extend it with amounts and smoker status.
6. **Postal-code (FSA) risk pages:** hail (Calgary, Red Deer), overland flood and theft, combining IBC, CatIQ and Équité figures with our own medians.
7. **Mortgage renewal and protection:** term life vs lender insurance at the 2026 renewal.

### 7.3 Trust (E-E-A-T) on every advice page

- A named author plus a **"Reviewed by {licensed advisor}, licence #{…}, {province}"** line, with `reviewedBy` in the JSON-LD. PolicyAdvisor does this on its guides (reviewer: its LLQP-licensed CEO) but not on its city and province pages; Ratehub uses one author on every page and no reviewer. Advisor profiles list licences per province with links to the regulator registers.
- Visible "Last updated" and "Rates as of {month year}" lines, and sources at the bottom of each guide. Built on product, province and city pages too: the date comes from the "Estimates and local data last reviewed" setting or the latest editor change, and the same date feeds `dateModified` and sitemap `lastmod`. Competitors' city pages show no reliable date.
- Methodology for every number we publish; "How we make money" and licensing pages linked from the footer.
- No invented ratings, review counts, carrier partnerships or licence numbers. The mockups contained several; the build replaces them with settings that stay blank until real values are entered (see `CONTENT_REVIEW.md`).

### 7.4 Search engines and AI answer engines

- Google's May 2026 guidance says AI Overviews and AI Mode use the core Search index; llms.txt and special schema are not needed. So the priority is ordinary SEO: server-rendered pages, fast templates, clean canonicals, dated facts in the first sentences, and original numbers.
- FAQ rich results ended in May 2026. FAQPage markup is kept because it is harmless and other engines may read it.
- Built for crawlers: server-side rendering, JSON-LD (InsuranceAgency, FinancialProduct, Article with author and reviewedBy, BreadcrumbList, Dataset, DefinedTermSet), split sitemaps that list indexable pages only, IndexNow pings on publish, a robots.txt AI-bot policy switch, llms.txt and Markdown twins of guides (low cost, not a ranking lever), and a crawler log that shows which AI bots visit.
- Ratehub, Sonnet and Rates.ca publish llms.txt; PolicyAdvisor doesn't. Rates.ca's is the best model: it states what it does not offer and links its research and "How we make money". Ours now has the same kind of scope section (what we do and don't do, provinces with advisor service, the data review date).
- ChatGPT leans on authoritative media and Perplexity on Reddit. Rate Index press releases and disclosed advisor answers in communities earn citations that on-page work cannot.

---

## 8. Roadmap

| Phase | When | Work |
|---|---|---|
| **0. Before launch** | Now | Confirm the licensed operating entity (agency or brokerage) per province and per line (life/A&S, general). Load real advisors with licence numbers, tag the desks each one staffs, and remove the four sample advisors (their desk assignments are demo data; they are already inactive in production). ~~Replace the 1-800-000-0000 placeholder~~ (done: +1 877 610 6554). Fill company settings (legal name, address, privacy officer). Work through `CONTENT_REVIEW.md`. Import real keyword volumes. Have a licensed advisor review the estimate model, then set **Estimates and local data last reviewed** in Site settings. Connect SMTP (pending: the owner will supply the details). Submit sitemaps to Google Search Console and Bing Webmaster Tools. |
| **1. First 90 days** | Launch to month 3 | Enrich the P1 pages in `KEYWORDS.md`: a 300+ character local intro, verified local facts and FAQ for each (Admin → SEO → Page overrides). Tables and dates are already on every page, so enrichment is about local facts competitors don't have. Publish the first Rate Index. Build the Ontario opt-out calculator. Start Google Business Profiles where advisors work. |
| **2. Months 3–6** | | Build the content backlog by priority: Toronto sub-area pages, P&C insurer head-to-heads, the Atlantic rate-decision tracker, high-risk sub-guides, per-condition life pages, best-companies pages with methodology, insurer reviews, more trade pages, age-band life cost pages. Give busy desks their own phone lines. Turn noindexed tier-3 city pages on as they are enriched. |
| **3. Months 6–12** | | Instant policy pilots where online binding is allowed (travel and super visa, tenant, simplified-issue life) through carrier or MGA integrations. French Quebec site after AMF registration. Quarterly Rate Index press releases. |

**Operating loop in the backend:** Admin → SEO shows unmapped keywords (the backlog), indexation status, 404s and crawler visits. Analytics shows leads by landing page, source (including AI referrers) and grade. Content edits publish instantly, purge the page cache, update sitemaps and ping IndexNow.
