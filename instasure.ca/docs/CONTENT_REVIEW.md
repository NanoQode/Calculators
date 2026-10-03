# Pre-launch content and compliance review

Work through this list before instasure.ca takes real traffic. Each item names the place to change it. The build ships with honest defaults: trust claims stay hidden until real values are entered, and estimates are labelled as estimates. But several facts come from search snippets or secondary sources gathered in October 2026 and must be checked against the primary source by a person.

---

## 1. Company, licensing and advisors (blocking)

| # | Item | Where | Why |
|---|---|---|---|
| 1.1 | Confirm the operating entity and its licences per province and line (life/accident & sickness, general insurance). | Legal | Unlicensed people and sites may not advise. Ontario (FSRA, RIBO) and BC restrict referral fees to unlicensed parties, and FSRA has fined insurers for paying unlicensed people. |
| 1.2 | Set **serviceable provinces** to the provinces where a licensed advisor can actually take the lead. The default lists every province except QC and the territories. | Admin → Site settings | Leads from other provinces go to the waitlist. |
| 1.3 | Fill legal name, mailing address, phone and **privacy officer**. | Admin → Site settings | CASL sender identification; Quebec Law 25 requires a named privacy officer. |
| 1.4 | Review the `/licensing/` page against the real licences, with regulator register links. | Admin → Site → Pages | Trust and regulatory disclosure. |
| 1.5 | Replace the four **sample advisors** (`sample-*`, flagged as demo and noindexed) with real advisors, their licence numbers by province, languages and designations. Then deactivate or delete the samples. | Admin → Advisors | Leads are routed only to active advisors; profiles carry the "reviewed by" credential on guides. **Production (October 3, 2026): the samples are inactive and no real advisors are loaded yet, so leads are saved unassigned and alert help@instasure.ca.** |
| 1.6 | Keep Quebec on the waitlist until an AMF-registered firm operates a compliant digital space (Alternative Distribution Methods regulation) with French pages. | Admin → Site settings | AMF rules for online distribution. |
| 1.7 | Have counsel review the compensation model (per-lead fees vs commissions) for each province. | Legal | See the referral-fee rules above. |
| 1.8 | Replace the customer service placeholder **1-800-000-0000** with a real, staffed number and set the hours. It shows in the header, menus, footer, services hub, every service page and every desk panel. It stays out of JSON-LD until replaced; the dashboard launch checklist flags it. | Admin → Site settings → Customer service number | A number that cannot connect on a live site breaks trust and wastes the call intent. **Done in production October 3, 2026: +1 877 610 6554.** |
| 1.9 | Staff each of the 16 **specialist desks** with real advisors (Advisor → *Specialist desks*). The sample advisors' desk tags are demo data. Each desk pitch promises specific expertise (for example, anonymous pre-underwriting enquiries, CVOR trucks, Facility Association placements, reading condo declarations): only keep a desk live if a licensed advisor really does that work, or edit the pitch in `src/data/services.js` / `src/data/products.js`. Language lines say "matched where available"; keep them only if at least one advisor speaks those languages. | Admin → Advisors | Leads from a desk page route to a desk specialist first, then to a licensed generalist (logged on the lead). An unstaffed desk still works, but the pitch overpromises. |
| 1.11 | **Author credentials (Michael Le Chi).** His profile and every guide byline state CFP, more than a decade in financial planning, a former Sun Life advisor recognized as a Top 3 Consultant three years in a row, and his ventures (supplied by the site owner, October 3, 2026). Keep each claim provable: CFP listed on FP Canada's public register; written confirmation of the Sun Life recognition. If Michael gives insurance recommendations himself (rather than general commentary), he needs an insurance licence in each province where he does so (e.g. LLQP/FSRA in Ontario); add it to his profile so it appears in the Person markup. | `src/data/authors.js`, Admin → Advisors | Author credentials are an E-E-A-T and advertising claim; regulators and Google both expect them to be true and verifiable. **Owner confirmed the credentials on October 3, 2026 and approved publishing under Michael's byline.** |
| 1.10 | Decide whether each line the service pages cover (pet, boat, RV, motorcycle, ATV, umbrella, long-term care, D&O, cyber, commercial auto, trades) is one your advisors are licensed and appointed to place. Disable any that are not. | Admin → Site → Products (service pages follow their parent product) or remove from `src/data/services.js` | Don't invite leads you can't serve. |

## 2. Trust claims the mockups contained (removed or gated)

The design mockups included claims that could not be verified. The build does not show them unless real values are entered:

| Mockup claim | What the build does | To enable |
|---|---|---|
| Regulator licence numbers in the footer | Shows the generic licence disclosure only | Enter real numbers on the `/licensing/` page and advisor profiles |
| "4.9/5 from 40,000+ reviews" | Hidden | Set rating value, count **and** source (e.g. Google) in Site settings; all three are required |
| Carrier and MGA logos and "partners" | Names and logos hidden while `carriers_confirmed` is off (Admin → Insurers & MGAs) | Confirm a written appointment or contract with each insurer and MGA shown and written permission to use each logo, upload the logos, then tick the confirmation |
| Salaried, non-commissioned advisors; price match; "84% approved with no exam" | Removed | Only add back with evidence and legal sign-off |
| Named-carrier prices on the results page | Replaced by product-type tiers with estimate ranges and disclaimers | Real quotes come from the advisor |

Also check: no "best", "cheapest" or "lowest price" wording anywhere without a published methodology (Competition Act; RIBO advertising rules; FSRA's unfair or deceptive acts rule). No testimonials until they are real, unpaid or disclosed, and not gated.

## 3. Estimates and modelled data

| # | Item | Where |
|---|---|---|
| 3.1 | The estimate engine's base rates and factors are modelled priors, calibrated loosely to public figures seen in October 2026. Have a licensed advisor sanity-check each product's example range. | `src/lib/quote-engine.js` |
| 3.1a | After that review, set **Estimates and local data last reviewed**. It drives the "as of" month on every estimate, the example tables, the "Updated" date on product, province and city pages, `dateModified` and sitemap `lastmod`. Don't move it forward without a real review. | Admin → Site settings |
| 3.2 | Province benchmarks (average auto and home premiums, rules, regulators, minimum liability) and the city auto factors. | `src/data/geo.js` |
| 3.3 | Keyword volumes are modelled. Import a Keyword Planner export before forecasting. | Admin → SEO → Keyword map → Import |
| 3.4 | The Rate Index shows a product × province cell only once it has 25 quote requests. Confirm that minimum and the methodology wording before the first press release. | `/insights/rate-index/` |

## 4. Facts in the launch guides to verify

Each guide lists its sources at the bottom. These are the claims most likely to change or to have come from a secondary source:

| Guide | Claim to check | Primary source to check against |
|---|---|---|
| Ontario auto insurance changes (July 2026) | Which accident benefits became optional on July 1, 2026; that existing coverage continues unless changed; the ~5% / ~$10 a month saving estimate | FSRA, Ontario regulation text, IBC |
| Gig driver insurance (Ontario) | OPCF 6A details; rideshare platform coverage while logged in; delivery coverage differences | FSRA endorsement list; platform terms |
| Alberta car insurance 2026 / Care-First | 7.5% good-driver cap for 2026 and its eligibility; Care-First start on January 1, 2027; 2027 rate-limit rules; projected savings | alberta.ca automobile insurance reform pages |
| Why is my car insurance going up (2026) | Applied Rating Index Q2 2026 figures (national +21.8%, Alberta +22.6%); Équité 2025 theft figures | Applied Systems release; Équité Association report |
| ICBC optional insurance | Basic-rate freeze through 2027; low-kilometre discount size and threshold; Enhanced Care since May 2021 | BC government and ICBC |
| Calgary hail guide | August 5, 2024 storm: about $3.29B insured damage and 130,000+ claims (CatIQ re-estimate) | CatIQ, IBC |
| Water damage / flood | 2025 severe-weather losses above $2.4B; national flood program timing (April 2026 target missed) | IBC; Public Safety Canada |
| Mortgage life vs term life | About 1.15 million renewals in 2026 (CMHC figure reported by MPA) | CMHC |
| CDCP vs private dental | $90,000 income limit; co-payment bands (0% / 40% / 60%); all eligible ages can apply in 2026 | canada.ca CDCP pages |
| Super visa insurance | $100,000 minimum emergency coverage valid at least one year; approved foreign insurers allowed since January 2025 | IRCC |
| Newcomer life insurance | Example coverage limits for work-permit holders and students (from broker and media guides) | Carrier underwriting guidelines |
| Condo deductible assessment | Condominium Act, 1998 (Ontario) references; example $25,000 water deductible | Ontario e-Laws |
| Life cost, CI vs DI, term vs whole | Example-profile price ranges "as of October 2026" from the Instasure model | Real carrier quotes for the same profile |

After checking, update each guide's **Last reviewed** date and reviewer in **Admin → Content**, which also refreshes `dateModified` and the "Reviewed by" line.

## 4a. Facts on the service pages to verify

The 46 service pages (`src/data/services.js`) are written in general terms, but these statements are specific enough to check against the primary source:

| Page | Claim to check | Primary source |
|---|---|---|
| High-risk drivers | The Facility Association guarantees mandatory coverage for licensed drivers in provinces with private auto insurance | Facility Association |
| Rideshare & delivery | OPCF 6A covers ridesharing in Ontario; which accident benefits became optional on July 1, 2026 | FSRA endorsement list; Ontario regulation |
| Accident benefits review | Applies at renewals from July 2026; Ontario only | FSRA |
| Senior drivers | Ontario drivers 80 and older renew their licence every two years with a vision test and screening | ServiceOntario |
| Visitors to Canada | Super Visa insurance must provide at least $100,000 of coverage valid for at least a year | IRCC |
| Funeral expense | H1 "from $1 a day": Instasure example estimate for a 50-year-old female non-smoker, $10,000 simplified-issue policy (≈ $29.50/mo, October 2026); CPP death benefit $2,500 plus a possible $2,500 top-up since January 1, 2025, and the top-up conditions; guaranteed-issue plans usually limit the benefit for the first two years; issue ages about 40 to 85 | Real carrier quotes for the same profile (have a licensed advisor confirm the funeral model in `src/lib/quote-engine.js`); canada.ca CPP death benefit page; carrier product guides |
| Snowbirds | Provincial time-away rules (days outside the province before OHIP and other plans lapse) | Each provincial health plan |
| International students | Which provinces cover international students and after what wait; UHIP in Ontario | Provincial health plans; UHIP |
| Commercial auto | Ontario commercial motor vehicles over 4,500 kg generally need a CVOR certificate | Ontario Ministry of Transportation |
| Cyber | PIPEDA requires reporting breaches that create a real risk of significant harm | Office of the Privacy Commissioner |
| Boat | Insurance is not federally required for pleasure craft; operators of motorized pleasure craft need proof of competency such as a Pleasure Craft Operator Card | Transport Canada |
| Medical conditions | Anonymous pre-underwriting enquiries do not leave a decline on the applicant's record | Carrier and MIB practice; have the desk advisor confirm |
| Final expense, children, joint, universal life | Example coverage amounts and policy features described | Carrier product guides |
| Long-term care | That few Canadian insurers still sell individual LTC policies | Carrier product lists |
| Example estimates (high risk, new drivers, newcomer car, senior drivers, seniors life, self-employed DI, snowbirds, student tenants) | Example-profile ranges from the Instasure model | Real carrier quotes for the same profile |

## 5. Email, consent and privacy

| # | Item | Where |
|---|---|---|
| 5.1 | Connect SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`). Without it, emails are logged but not sent. **Pending in production: the owner will supply the details.** | `/etc/instasure/instasure.env` on the server (`.env` locally) |
| 5.2 | Keep CASL mode on **express consent only** unless counsel approves using the 6-month implied consent from an inquiry. Consent boxes are unchecked by default. | Admin → Site settings |
| 5.3 | Review consent wording so it names who will contact the person (Instasure and the licensed advisor), by email and by phone. Telemarketing rules also apply after 6 months. | Admin → Site settings |
| 5.4 | The email footer adds the sender name, mailing address (from Site settings) and a one-click unsubscribe automatically. Review each drip campaign's copy for advice that only a licensed person may give. | Admin → Campaigns |
| 5.5 | Review the privacy policy against PIPEDA, Quebec Law 25 and AB/BC private-sector privacy law, including who receives lead data. | `/privacy/` |
| 5.6 | Keep the cookie banner on: analytics are first-party, and non-essential tracking needs opt-in for Quebec. | Admin → Site settings |

## 6. Search and analytics

| # | Item |
|---|---|
| 6.1 | Set `SITE_URL` to the production origin so canonicals, sitemaps and JSON-LD use it. |
| 6.2 | Verify the site in Google Search Console and Bing Webmaster Tools (verification codes in Site settings) and submit `/sitemap.xml`. |
| 6.3 | Choose the AI crawler policy (allow all, search engines only, or block) in Site settings. The default allows all. |
| 6.4 | A default 1200×630 social image ships at `/img/og-default.png`. Add page-specific images for the main guides and the Rate Index when available. |
| 6.5 | Enrich the priority 1 pages in `KEYWORDS.md` with a local intro of 300+ characters (Admin → SEO → Page overrides). Tier 3 city pages stay noindex until enriched. |
| 6.6 | If Google Ads will be used, check whether financial-services advertiser verification applies in Canada and prepare the licence details. |
