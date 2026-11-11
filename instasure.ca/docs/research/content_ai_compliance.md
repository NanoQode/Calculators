# Instasure.ca: content, AI-citation and compliance research (Canada, October 2026)

Prepared 2026-10-03 for instasure.ca, a Canadian insurance lead-generation site with licensed advisors. Products covered: life, CI, DI, health and dental, travel, mortgage protection, auto, home, condo, tenant and business.

**How the research was done:** WebSearch only, using a US-located index, so the results are not a true google.ca SERP. The proxy blocked direct fetching of every domain tried, including competitor sites, developers.google.com, ibc.ca and canada.ca. The session-wide search budget (200 calls, shared with sibling agents) ran out partway through. Facts below are cited to URLs that came back in search results. Where a claim comes from a search snippet and was not read on the page, or the year is unclear, it is marked **[verify]**. Items from general background knowledge that were not confirmed this session are marked **[unverified]**. Some competitor URLs and titles come from sibling agents' raw logs in this folder (`_raw_log.md`, `serp_raw.md`, `notes_raw.md`), which hold search-result URLs and titles from the same session.

---

## 0. Executive summary

1. **The keyword formulas that win in Canadian insurance are few and stable:**
   - "Average cost of [product] in [city/province] (2026)"
   - "Cheapest / best [product] companies in [province/Canada] (2026)"
   - "[Insurer] [product] review (2026)"
   - "[A] vs [B]"
   - "How much [life/CI/DI] insurance do I need / does it cost at age N"
   - "Does [home/auto] insurance cover [peril]?"
   - "[Product] for [audience]", e.g. newcomers, work-permit holders, super visa parents, seniors, smokers, gig drivers
   - Regulation explainers: "[Province] auto insurance changes 2026"

   Aggregators (rates.ca, ratehub.ca, lowestrates.ca, mychoice.ca, thinkinsure.ca, surex.com, insurancehotline.com, squareone.ca, sonnet.ca) hold the P&C city pages. PolicyAdvisor and PolicyMe hold life, CI and DI, with Ratehub as a strong second.
2. **The biggest new keyword demand in 2026 comes from regulation:**
   - **Ontario's July 1, 2026 accident-benefits reform.** Most benefits became optional, with savings of about 5% of the premium.
   - **Alberta's Care-First model**, starting Jan 1, 2027, with a new adjustable rate cap. In 2026 the cap is 7.5% for eligible good drivers. Alberta auto premiums rose **22.6% YoY in Q2 2026** (Applied Rating Index).
   - **BC's ICBC basic-rate freeze through 2027.**
   - **CDCP open to all eligible ages in 2026.**
   - **Federal flood-insurance program delayed** past its April 2026 target.
   - **About 1.15M mortgage renewals in 2026** (CMHC via MPA).
   - **Auto theft down 18% nationally in 2025** (Équité). It is still a $900M annual cost.
3. **Data assets that earn citations** are recurring, branded indexes:
   - Applied Rating Index (quarterly, more than 30M quotes)
   - Rates.ca city and provincial averages, including a 180-city Ontario ranking
   - LowestRates.ca "15 most expensive cities"
   - Kanetix surveys and city rankings on newswire
   - HelloSafe "barometer"
   - IBC/CatIQ catastrophe losses
   - Équité Association theft reports

   Instasure should publish its own quarterly "Instasure Price Index" from its quote data.
4. **AI answer engines:** Google's May 15, 2026 guidance says AI Overviews and AI Mode run on the core Search index and ranking. It also says llms.txt, chunking, AI-specific rewrites and special schema are **not needed**. **FAQ rich results ended May 7, 2026**, and HowTo rich results were already gone. ChatGPT leans on Wikipedia and authoritative media, while Perplexity and Google AI lean more on community sources (Reddit). Only about 11% of domains are cited by both ChatGPT and Perplexity. What wins citations: original numbers, licensed bylines, a reviewed-by line, regulator licence numbers on author and company pages, visible "last updated" dates, and presence on Reddit and in the press.
5. **Compliance must-haves:**
   - CASL: express consent through an unchecked box; implied consent lasts 6 months after an inquiry; honour unsubscribes within 10 business days; sender ID valid for 60 days.
   - DNCL: the 6-month inquiry exemption plus an internal do-not-call list honoured within 14 days.
   - PIPEDA: meaningful, purpose-specific consent to share leads with named categories of insurers and advisors.
   - Quebec Law 25: opt-in for non-essential cookies, a named privacy officer, and fines up to $25M or 4% of turnover.
   - Licensing: unlicensed staff and pages may not advise. In BC, referral payees must not discuss product merits or needs and the referral fee must be disclosed. In Ontario, RIBO limits referral fees to listed licensed intermediaries, and FSRA has fined insurers for paying unlicensed people.
   - Quebec: online distribution requires a registered firm under the AMF Alternative Distribution Methods regulation, with a representative reachable at all times.
   - Advertising: no unsubstantiated "lowest price" or "from $X/month" claims (Competition Act, drip pricing, RIBO, FSRA UDAP); no fake, gated or AI-generated testimonials.
   - Google Ads financial-services verification through G2. Check whether Canada is in scope.

---

## 1. Content that works: formats, headline formulas and who owns them

### 1.1 Auto (P&C), the highest-volume cluster

| Formula (observed titles) | Domains seen owning it | Notes / data points |
|---|---|---|
| **"Compare [Province] Car Insurance Quotes Online"** / "[Province] Car Insurance: Cheap Rates, Instant Quotes, Online" | rates.ca, ratehub.ca, lowestrates.ca, thinkinsure.ca | Rates.ca: Ontario average **$2,653/yr ($221/mo) as of March 2026**, down 4.5% from $2,779 in 2025 [verify]. ThinkInsure: $2,461/yr (May 2026 quote data) [verify]. Sources: https://rates.ca/insurance-quotes/auto/ontario, https://www.ratehub.ca/insurance/car/ontario, https://www.thinkinsure.ca/car-insurance/ontario-quote.php, https://www.lowestrates.ca/insurance/auto/ontario |
| **"How much is car insurance in [City]?"** (blog) plus **"Compare [City] Car Insurance Quotes & Save Today"** (product page) | ratehub.ca | Ratehub runs two pages per city: an informational blog post and a transactional page. https://www.ratehub.ca/blog/how-much-is-car-insurance-in-brampton/ ; Brampton, Toronto, Mississauga and Ottawa variants in `serp_raw.md` |
| **"Cheap Car Insurance [City]"** | rates.ca | Brampton **$3,802/yr ($317/mo), March 2026, last of 180 Ontario cities** [verify]. https://rates.ca/insurance-quotes/auto/brampton |
| **"Cheap Car Insurance in [City]: Get a Quote in Minutes"** / "Affordable … from $X/month" | mychoice.ca | Puts a price in the title (see the compliance note in section 5.7) |
| **"Car Insurance in [City]: Quote and Buy Online"** | sonnet.ca | Direct writer with a page per city and FR mirrors. City pages show averages (Toronto $241/mo, Mississauga $308/mo, Scarborough $330/mo) per `notes_raw.md` |
| **"Cheapest Car Insurance Quotes in [City]: Quote Online & Save"** | insurancehotline.com | `serp_raw.md` (Hamilton, Ottawa) |
| **"[Province]'s N most expensive cities for car insurance"** / "Which cities have the cheapest insurance in Ontario?" | lowestrates.ca, rates.ca, ratehub.ca, kanetix (press release) | Linkable list posts that the press picks up. https://www.lowestrates.ca/resource-centre/auto-insurance/ontarios-15-most-expensive-cities-car-insurance ; https://rates.ca/resources/these-10-cities-have-highest-car-insurance-rates-ontario ; https://rates.ca/resources/which-cities-have-cheapest-auto-insurance-Ontario ; https://www.ratehub.ca/blog/most-expensive-ontario-cities-for-auto-insurance/ ; https://www.newswire.ca/news-releases/kanetix-ca-reveals-ontario-s-most-expensive-cities-for-auto-insurance-819924015.html ; picked up by https://canadianunderwriter.ca/news/claims/ontarios-most-expensive-cities-for-car-insurance/ |
| **"Cheapest Car Insurance in Ontario and Best Companies"** / "Top 15 Car Insurance Providers in Ontario in 2026" / "Cheapest Car Insurance In Ontario, CA: From $40/mo (2026 Rates)" | moneygeek.com (US publisher), mychoice.ca, wealthnorth.ca, insuranceopedia.com, nerdwallet.com | Names Belairdirect, Sonnet, TD, Intact, Aviva, Co-operators, Economical and CAA. https://www.moneygeek.com/insurance/auto/best-cheap-car-insurance-ontario-ca/ ; https://www.mychoice.ca/insurance/car/top-companies/ ; https://wealthnorth.ca/insurance/cheap-car-insurance-ontario/ ; https://www.insuranceopedia.com/auto-insurance/best-cheap-car-insurance-ontario-ca |
| **"[Province] car insurance calculator"** | lowestrates.ca | https://www.lowestrates.ca/insurance/auto/calculator/ontario |
| **"Canada car insurance premiums barometer for 2026"** | hellosafe.ca | https://hellosafe.ca/en/car-insurance/barometer |
| **"2026 Car Insurance Rates Rising in Canada: Trends & Tips"** | onlia.ca | https://www.onlia.ca/magazine/blogs/2026-car-insurance-rates-rising-in-canada-trends-tips |
| **"Most Stolen Cars in Canada: Vehicle Theft Statistics"** / "Vehicle Theft in Quebec in 2026" | sonnet.ca | Built on the annual Équité list (`notes_raw.md`) |
| **"[Insurer] car insurance review"** | rates.ca/insurance-companies/sonnet, ratehub.ca/insurance/companies/sonnet, lowestrates.ca/insurance/auto/sonnet, policyme.com | Brand-plus-review queries (`notes_raw.md`) |

**Ontario reform 2026 explainers** ("Here are the changes coming to Ontario auto insurance in 2026"; "Ontario Auto Insurance Reform July 2026"; "2026 Ontario Auto Insurance Reform Changes"; "Will Auto Insurance Be Cheaper After Ontario Reform?"; "Ontario SABS 2026: Income Replacement Benefits — Do You Still Have Coverage?"). Owners:
- Aggregators: https://rates.ca/resources/ontario-2026-auto-insurance-changes-explained and https://www.ratelab.ca/ontario-auto-insurance-reform-july-2026/
- Brokers: https://www.thinkinsure.ca/insurance-help-centre/accident-benefits-changes-guide-2026.html, https://www.mcdougallinsurance.com/2026/07/08/will-auto-insurance-be-cheaper-after-ontario-reform/, https://www.thebig.ca/blog/title/ontario-sabs-2026-income-replacement-benefits-do-you-still-have-coverage and https://surnet.net/ontario-car-insurance-changes-2026-renewal/
- Insurers: https://www.intact.ca/en/personal-insurance/vehicle/ontario-auto-reform, https://www.northbridgeinsurance.ca/ontario-auto-reform/ and https://www.optimum-general.com/en/ontario/ontario-auto-insurance-reform
- Industry body: https://www.ibc.ca/issues-and-advocacy/auto-insurance/ontario-auto-insurance-changes
- Regulator-adjacent: https://www.ribo.com/licensee-resources/sabs-changes/
- Media: https://www.cp24.com/local/toronto/2026/06/13/major-changes-are-coming-to-auto-insurance-benefits-on-july-1-here-is-what-you-need-to-know/ and Neo Financial https://www.neofinancial.com/the-get/car-insurance-reform-in-ontario

**Alberta explainers** ("What Is Care-First Auto Insurance?"; "Alberta to replace Good Driver Rate Cap with new rate limits"). Owners are mostly news sites and brokers (Western Financial), plus the government page https://www.alberta.ca/automobile-insurance-reform. Aggregators are weaker here, which leaves a gap. Sources: https://westernfinancialgroup.ca/Care-First-Auto-Insurance-in-Alberta-What-Drivers-Need-to-Know-Before-2027 ; https://globalnews.ca/news/11850466/alberta-auto-insurance-adjustable-rate-cap/ ; https://dailyhive.com/calgary/alberta-care-first-auto-insurance-model-new-rate-cap

**Gig drivers** ("Compare Uber Insurance & Ridesharing Insurance Quotes"; "Rideshare Insurance Ontario (2026)"; "Rideshare Insurance for Uber & Lyft in Canada"). Owners: ratehub.ca, mychoice.ca, thinkinsure.ca, roughleyinsurance.com and everlance.com.

Facts from these pages:
- Ontario's rideshare endorsement is **OPCF 6A** (Permission to Carry Passengers for Compensation).
- It costs about **$15–$30/month** [verify].
- Uber's coverage while drivers are logged in is $1M third-party liability, standard accident benefits, and collision/comprehensive with a $1,000 deductible [verify].
- Delivery work (Uber Eats, Skip, DoorDash) is treated differently. DoorDash provides contingent liability only [verify].

Sources: https://www.ratehub.ca/insurance/car/uber-insurance ; https://www.mychoice.ca/insurance/car/rideshare/ ; https://roughleyinsurance.com/blog/ride-share-insurance ; https://www.thinkinsure.ca/car-insurance/uber-drivers.php ; https://www.everlance.com/blog/cheapest-car-insurance-for-uber-and-doordash-drivers

**Gap to exploit:** delivery-driver coverage combined with the July 2026 optional income-replacement decision. Gig and self-employed drivers are the group most exposed when they opt out (thebig.ca, above).

### 1.2 Home, condo and tenant

| Formula | Owners | Sources |
|---|---|---|
| **"Does home insurance cover flooding?"** / "What is Overland Water Coverage?" / "Water Damage: What Am I Covered For?" / "Ontario Basement Flood Insurance: What's Covered and What's Not?" | westlandinsurance.ca, CAA SCO, ratehub.ca, RBC Insurance, isure.ca, mcdougallinsurance.com, homeowner.ca | https://www.westlandinsurance.ca/news/does-home-insurance-cover-flooding/ ; https://www.caasco.com/insurance/home/homeowners/water-coverage ; https://www.ratehub.ca/blog/overland-water-coverage-an-overview/ ; https://www.rbcinsurance.com/en-ca/advice-learning/home-insurance/water-damage-what-am-i-covered-for/ ; https://www.mcdougallinsurance.com/2026/06/03/ontario-basement-flood-insurance-whats-covered-and-whats-not/ ; https://www.homeowner.ca/a/does-home-insurance-cover-flooding-in-canada-overland-water-sewer-backup-and-overland-vs-coastal-explained |
| **"Home Insurance In [City] From $15/Month"** | squareone.ca | `serp_raw.md` (Toronto, Brampton, Ottawa, Mississauga) |
| **"Compare [City] Home Insurance Quotes & Save Today"** / "Get the Best [City] Home Insurance Quotes" | ratehub.ca, rates.ca | Toronto home average $2,296/yr in Q2 2026 [verify, from snippet] (`serp_raw.md`) |
| **"Can a landlord require tenant insurance (in Ontario)?"** | tenantrights.ca, marathoninsurance.ca, insurely.ca, ddpropertymanagement.ca, realtor blogs | Landlords may require liability coverage as a lease condition, and the Ontario standard lease has an insurance section. Failing to carry required insurance can ground a termination notice [verify]. https://tenantrights.ca/ontario/can-landlords-require-tenant-insurance-ontario ; https://www.marathoninsurance.ca/blog/can-a-landlord-require-tenant-insurance/ ; https://insurely.ca/blog/can-landlords-require-tenant-insurance-canada ; https://ddpropertymanagement.ca/blog/tenant-insurance-requirement-ontario |
| **"Is tenant/home insurance mandatory in [province]?"** and **"Condo insurance vs building insurance"** | sonnet.ca FAQ and blog | e.g. /faqs/quoting/home-insurance-mandatory-ontario; FR "L'assurance locataire est-elle obligatoire au Québec?" (`notes_raw.md`) |
| **"Overland Water and Flood Insurance in Canada 2026: What exactly is covered"** | lifetimescanada.com, mychoice.ca (national flood program) | https://lifetimescanada.com/blog/home-insurance/overland-water-and-flood-insurance-in-canada-2026-what-exactly-is-covered ; https://www.mychoice.ca/blog/national-flood-insurance-program-canada/ |

### 1.3 Life, CI, DI, health and mortgage protection

PolicyAdvisor runs the largest programmatic life and health library seen. Full URL list in `_raw_log.md`. Its title formulas:
- **"Best [Life/Term/Whole/CI/Health] Insurance Companies in Canada (2026)"** – https://www.policyadvisor.com/life-insurance/best-life-insurance-companies-in-canada/ ; https://www.policyadvisor.com/life-insurance/best-whole-life-insurance-companies-in-canada/ ; https://www.policyadvisor.com/critical-illness-insurance/best-critical-illness-insurance-in-canada/
- **"Biggest Life Insurance Companies in Canada (2026)"** – https://www.policyadvisor.com/insurance-companies/biggest-insurance-companies-canada/
- **"Cost of life insurance in Canada in 2026"**, **"How much does life insurance cost for a [20/40/50]-year-old?"**, **"Average Cost of $500,000 Life Insurance Policy"**, **"How much does a million-dollar life insurance policy cost?"** (cost by age and by amount)
- **"[Insurer] [product] Review (2026)"** (dozens: Sun Life, Manulife, RBC, BMO, Desjardins, iA, Equitable, Humania, Co-operators, CoverMe…)
- **"Sun Life vs. Manulife term life insurance: which is better in 2026?"** (X vs Y)
- **"Best Life Insurance in [City] (year)"** and **"Life Insurance in [Province]"** advisor pages. PolicyAdvisor runs two provincial hubs and is licensed only in ON, BC, AB and MB (`_raw_log.md`).
- Audience pages: **"Life Insurance for Newcomers to Canada"**, **"Life insurance in Canada for work permit holders"**, **"Life insurance for permanent residents"**, **"Life insurance for visitors to Canada"**, seniors, smokers, diabetics, overweight people, doctors, couples, new parents, business owners.
- Learning centres per product (/disability-insurance/learning-center/ and so on).

Other owners:
- **"How much life insurance do I need?"** plus calculators: PolicyMe (https://www.policyme.com/blog/how-much-life-insurance-do-i-need ; https://www.policyme.com/life-insurance-calculator), Ratehub (https://www.ratehub.ca/blog/how-much-life-insurance-do-i-need/), Hardbacon (https://hardbacon.ca/en/calculator/life-insurance-calculator/) and PolicyAdvisor. The DIME method (debt, income, mortgage, education) is the standard framework cited.
- **"Best Life Insurance Companies in Canada 2026"**: also wealthnorth.ca, hellosafe.ca, apluswealth.com, unitylife.ca and lowestrateshub.com ("Top 10 … AM Best Ranked"). https://wealthnorth.ca/insurance/life-insurance/best-life-insurance-companies-canada/ ; https://hellosafe.ca/en/life-insurance/companies ; https://lowestrateshub.com/blog/top-10-life-insurance-companies-in-canada
- **Mortgage protection vs term life**:
  - Ratehub "Mortgage Insurance vs Life Insurance" and "Is mortgage life insurance mandatory in Canada?"
  - PolicyAdvisor "Mortgage Insurance vs Life Insurance: Which To Choose?" and "Top Mortgage Protection Insurance Companies in Canada (2026)"
  - PolicyMe "Best Life Insurance for Mortgage Protection (2026 Guide)"
  - money.ca "The bank's safety net, paid by you"

  The claim these pages share is that term life costs much less than lender mortgage life insurance and keeps a level payout [verify]. https://www.ratehub.ca/blog/mortgage-insurance-vs-life-insurance/ ; https://www.ratehub.ca/blog/mortgage-life-insurance-mandatory-canada/ ; https://www.policyadvisor.com/mortgage-insurance/need-life-insurance-for-mortgage/ ; https://www.policyme.com/life-insurance/life-insurance-for-mortgage-protection-page ; https://money.ca/mortgages/homebuying/mortgage-life-insurance-vs-term-life-canada
- **Newcomers** (beyond PolicyAdvisor): MyChoice "How to Get Life Insurance as a Newcomer to Canada", iA's /newcomers, and Yahoo Finance "Canadian life insurance for newcomers: Work permit options and the $1M policy many miss".

  Claims made [verify]:
  - Work-permit holders can often get up to $500K, sometimes after 3 or more months in Canada.
  - International students can get about $250K (undergraduate) or $500K (postgraduate).
  - PGWP holders with a job offer may qualify for up to $1M.

  https://www.mychoice.ca/blog/life-insurance-for-newcomers-canada/ ; https://ia.ca/newcomers ; https://ca.finance.yahoo.com/news/canadian-life-insurance-newcomers-permit-105500144.html ; https://www.policyadvisor.com/life-insurance/life-insurance-for-newcomers-to-canada/
- **CI cost** ("Cost of critical illness insurance in Canada", "Best Critical Illness Insurance in Canada (2026)"). Owners are PolicyAdvisor, PolicyMe and Ratehub. Example figure: about $35/month for $100K of coverage at age 30 [verify]. https://www.policyadvisor.com/critical-illness-insurance/cost-of-critical-illness-insurance/ ; https://www.policyme.com/blog/best-critical-illness-insurance-canada ; https://www.ratehub.ca/insurance/life/critical-illness
- **Super visa** ("Super Visa Insurance for Canada 2026", "Super Visa Insurance Cost & Cheapest Rates 2026 - Compare 14 Insurers"). Owners: PolicyAdvisor, bestquotetravelinsurance.ca, HelloSafe, CoverMe (Manulife) and RBC Insurance.

  Facts [verify]:
  - Minimum $100K emergency coverage, valid at least 1 year.
  - Since Jan 28, 2025, approved foreign insurers are allowed.
  - Indicative prices: about $1,800–$2,500/yr at ages 65–69, rising to $3,500–$5,500 at 80 and over.

  https://www.policyadvisor.com/visitor-insurance-canada/what-is-super-visa-insurance/ ; https://bestquotetravelinsurance.ca/parent-and-grandparent-super-visa-health-insurance ; https://hellosafe.ca/en/travel-insurance/super-visa ; https://www.coverme.com/blog/travel/supervisa-for-parents-and-grandparents.html ; https://www.rbcinsurance.com/en-ca/advice-learning/travel-insurance/super-visa-travel-medical-insurance-parents-grandparents-canada/
- **Health and dental**: PolicyAdvisor has "Average cost of personal health insurance in Canada", "Cheapest Health Insurance in Canada" and insurer reviews (Blue Cross, Sun Life, Manulife, Canada Life) (`_raw_log.md`). CDCP-versus-private content is mostly owned by dental clinics, so it is open (see section 4).

**Sunlife.ca and manulife.ca:** these searches did not surface their editorial pages for the queries tested. Manulife appears through CoverMe (travel and CI pages) and through third-party reviews. Their advice-centre rankings could not be assessed [gap].

### 1.4 Patterns worth copying

1. **A year in the title**, "(2026)", appears on nearly every ranking page, and is updated each January.
2. **Two pages per city:** an informational "How much is X in [City]?" page plus a transactional "Compare [City] X quotes" page (Ratehub). Sonnet adds **FR mirrors** of Ontario city pages.
3. **City and postal-code statistics on the page**, e.g. rates.ca's "180th of 180 Ontario cities" and FSA-level ranges ("L6P $3,620"). These pages attract both links and AI citations.
4. **Insurer review hubs** cover brand-plus-"review" and brand-plus-"vs" queries.
5. **Audience pages** (newcomers, gig drivers, seniors, smokers) carry high intent and convert well.
6. **Regulation explainers within days of an announcement.** Ontario's reform drew content from aggregators, brokers, insurers, IBC and RIBO.

---

## 2. Data assets that earn links and AI citations

| Asset | Publisher | Cadence | Why it is cited | Source |
|---|---|---|---|---|
| **Applied Rating Index** | Applied Systems | Quarterly | Covers more than 30M quotes per quarter. **Q2 2026: personal auto +21.8% YoY** (AB +22.6%, ON +7.0%, QC +0.9%, Atlantic +9.4%). **Personal property +5.8% YoY** (AB +11.9%, BC +1.9%, ON +4.2%, QC +0.7%, Atlantic +8.9%, SK/MB +10.8%). The trade press reprints it the same day. | https://www.globenewswire.com/news-release/2026/07/22/3331426/0/en/applied-rating-index-q2-2026-results-released.html ; https://www1.appliedsystems.com/globalassets/all-documents/resources/white-papers-research/applied-rating-index_en-ca.pdf ; https://canadianunderwriter.ca/2026/07/22/guess-whos-paying-the-steepest-increases-in-canada-for-home-and-auto-insurance/ ; https://www.insurancebusinessmag.com/ca/news/auto-motor/albertas-rate-pain-continues-as-auto-insurance-overhaul-looms-583399.aspx |
| **Rates.ca city and provincial averages** | Rates.ca | Updated monthly or quarterly on product pages | Ranks 180 Ontario cities and gives GTA averages. Media cite the Brampton and Mississauga figures. | https://rates.ca/insurance-quotes/auto/brampton ; https://rates.ca/insurance-quotes/auto/ontario |
| **"Ontario's 15 most expensive cities"** plus a quarterly rate-change line (Q1 2026 +0.33%) [verify] | LowestRates.ca | Periodic | Linkable list format | https://www.lowestrates.ca/resource-centre/auto-insurance/ontarios-15-most-expensive-cities-car-insurance |
| **Kanetix surveys and city rankings** | Kanetix (newswire) | Several per year | Press-release distribution, e.g. "56 per cent of Canadians would switch … for $150" | https://www.newswire.ca/news/kanetix/ ; https://www.newswire.ca/news-releases/56-per-cent-of-canadians-would-switch-insurance-providers-for-a-savings-of-150-or-more-kanetix-ca-survey-finds-809155822.html |
| **Car insurance premiums "barometer"** | HelloSafe | Annual | A branded index | https://hellosafe.ca/en/car-insurance/barometer |
| **Severe-weather insured losses** | IBC with CatIQ | Annual (January) and per event | **2025: more than $2.4B, a top-10 year.** Notable 2025 events: ON/QC ice storm about $490M, Flin Flon/La Ronge wildfires about $300M, Calgary hail (July 2025) about $160M. **2016–2025 total $37B vs $14B in 2006–2015.** | https://www.ibc.ca/news-insights/news/severe-weather-related-insured-losses-in-canada-exceed-2-4-billion-in-2025 ; https://globalnews.ca/news/11621139/ibc-insured-damage-severe-weather-2025/ ; https://public.catiq.com/category/catiq-announcements/ |
| **Calgary hail, Aug 5, 2024** | CatIQ | Re-estimates | **$3.29B, more than 130,000 claims**, the second-costliest disaster in Canadian history | https://www.insurancebusinessmag.com/ca/news/catastrophe/catiq-adjusts-loss-estimate-from-calgary-hailstorm-to-3-29b-545381.aspx ; https://www.ibc.ca/news-insights/news/august-hailstorm-in-calgary-results-in-nearly-2-8-billion-in-insured-damage |
| **Auto Theft Trend Report** | Équité Association | Semi-annual | **2025: national thefts −18% (46,999 private passenger vehicles); ON −22%, QC −25%; recovery rates ON 51%, QC 48%; costs still about $900M a year.** Vehicle finance fraud at QC and NS ports +72% (H1 2025). | https://www.equiteassociation.com/press-releases/equite-associations-2025-auto-theft-trend-report-shows-that-despite-the-ongoing-decline-in-theft-rates-canadians-continue-to-bear-900-million-in-costs-annually ; https://www.smithsfalls.ca/media/qdjj0jj3/2026-02-11-%C3%A9quit%C3%A9-associations-2025-auto-theft-trend-report-final.pdf ; https://www.cbc.ca/news/canada/toronto/auto-theft-trends-down-equite-report-1.7595080 |
| **Flood-insurance availability** | IBC | Ad hoc | **94% of Canadian homes can access overland flood coverage** [verify]. About 1.5M highest-risk households lack affordable cover. | https://www.insurancebusinessmag.com/ca/news/catastrophe/94-of-canadian-homes-can-now-access-overland-flood-insurance-ibc-finds-583572.aspx ; https://money.ca/news/canada-national-flood-insurance-program-delay-homeowners |
| **Mortgage renewal counts** | CMHC (via trade press) | Annual | **About 1.15M renewals in 2026 and about 940K in 2027** [verify]. About 60% of 2025–26 renewers face higher payments. | https://www.mpamag.com/ca/mortgage-industry/industry-trends/what-to-expect-from-canadas-2026-mortgage-renewal-wave/558668 |
| FSRA auto rate-filing approvals, GISA statistics | FSRA, GISA | Quarterly / annual | Commonly cited in Ontario rate stories | **[unverified this session: search budget ran out]** |
| J.D. Power Canada insurance studies | J.D. Power | Annual | No 2026 Canadian insurance study surfaced. The 2026 Canada CSI-LT study covers vehicle service, not insurance. | https://www.jdpower.com/business/press-releases/2026-canada-customer-service-index-long-term-csi-lt-study/ |

### Data assets Instasure should build (recommended)

1. **Instasure Canadian Insurance Price Index (quarterly).** Median quoted premium by province and city for auto and home, and by age and amount for term life and CI, taken from anonymized quote flows. Publish a methodology page and a downloadable CSV. Issue a press release with each edition, matching Applied, Kanetix and Rates.ca. Google Dataset markup now feeds only Google Dataset Search, not general Search (https://ppc.land/google-phases-out-practice-problem-and-dataset-structured-data/). It is still useful for discovery, but the press release is what drives links.
2. **Ontario reform opt-out tracker**: the share of quotes and renewals that drop income replacement or other optional benefits, and the average saving. Nobody owns this yet.
3. **Alberta Care-First countdown**: premiums before and after Jan 1, 2027, by city.
4. **Renewal-shock calculator for mortgage protection**: 2026 renewal payment plus the cost of term life against lender mortgage insurance.
5. **Postal-code (FSA) risk maps** for hail (Calgary/Red Deer), overland flood and theft, combining public IBC, Équité and CatIQ figures with Instasure's own quote medians.
6. **Life insurance price tables by age (20–70) × amount ($250K / $500K / $1M) × smoker status**, refreshed monthly. PolicyAdvisor's cost-by-age pages show the demand.

---

## 3. AI answer engines (ChatGPT, Perplexity, Google AI Overviews/AI Mode)

### 3.1 What Google officially said in 2026
- **May 15, 2026:** Google published "Optimizing your website for generative AI features on Google Search" under a new "Generative AI fundamentals" docs section.
  - It says SEO best practices still apply because AI Overviews and AI Mode are "rooted in our core Search ranking and quality systems" and use RAG and query fan-out over the Search index.
  - It states that **llms.txt, content chunking, AI-specific rewriting and special schema are not needed**.
  - It stresses **valuable, unique, non-commodity content**.

  Sources: https://developers.google.com/search/blog/2026/05/a-new-resource-for-optimizing ; https://www.searchenginejournal.com/googles-new-ai-search-guide-calls-aeo-and-geo-still-seo/575026/ ; https://www.semrush.com/blog/google-publishes-generative-ai-search-guide/
- **Search Console** now has a Generative AI performance report for eligible properties, and Google is testing a site-level control for generative-AI appearances [verify]. Same sources.
- **FAQ rich results are deprecated.** They stopped appearing on **May 7, 2026**. The Search Console report and Rich Results Test support were removed in June 2026, and API support ends in August 2026. FAQPage markup can stay on pages because it is harmless and other engines may use it. https://developers.google.com/search/docs/appearance/structured-data/faqpage ; https://searchengineland.com/google-to-no-longer-support-faq-rich-results-476957 ; https://www.searchenginejournal.com/google-drops-faq-rich-results-from-search/574429/
- **HowTo rich results** were deprecated in 2023 (mobile first). In August 2023 FAQ was limited to authoritative government and health sites. https://developers.google.com/search/blog/2023/08/howto-faq-changes
- **Structured-data trimming:** in June 2025 Google phased out Book Actions, Course Info, ClaimReview, Estimated Salary, Learning Video, Special Announcement and Vehicle Listing. In November 2025 it dropped Practice Problem, and Dataset markup now serves Dataset Search only. https://developers.google.com/search/blog/2025/06/simplifying-search-results ; https://developers.google.com/search/blog/2025/11/update-on-our-efforts ; https://ppc.land/google-phases-out-practice-problem-and-dataset-structured-data/ . SEJ notes Google is "not diminishing the use of structured data" overall: https://www.searchenginejournal.com/google-is-not-diminishing-the-use-of-structured-data-in-2026/560516/

### 3.2 llms.txt
- Google says it is not used for AI Overviews or AI Mode, even though Lighthouse added an llms.txt audit on May 5, 2026 [verify].
- Anthropic and OpenAI publish or recommend llms.txt for developer documentation, and Perplexity has reportedly surfaced it. Server logs show AI crawlers rarely request it.
- Sources: https://www.getpassionfruit.com/blog/should-i-create-an-llms.txt-file-google-s-2026-guidance-explained ; https://www.refontelearning.com/blog/implementing-llms-txt ; https://www.wix.com/studio/ai-search-lab/llms-txt-myths
- **Recommendation:** ship a small llms.txt that links canonical guides, methodology pages and the licence-disclosure page. It costs almost nothing, but it is not a ranking lever. Spend the effort on crawlability: allow OAI-SearchBot, PerplexityBot and Googlebot, and keep content server-rendered.

### 3.3 Who gets cited
- From 680M citations across ChatGPT, Claude and Perplexity (5W) and 22.7M citations from Jan–Jun 2026 (Wellows):
  - Wikipedia makes up nearly half of ChatGPT's top-10 source share.
  - Reddit makes up about 46.7% of Perplexity's top-10 share.
  - Google's AI features lean toward community sources.
  - **Only about 11% of domains are cited by both ChatGPT and Perplexity.**
- No insurance-specific citation study surfaced.
- Sources: https://www.5wpr.com/research/state-of-ai-citations-2026/ ; https://wellows.com/blog/ai-citation-overlap-study/ ; https://www.frase.io/blog/which-ai-engines-cite-which-sources
- **What this means for Instasure:**
  1. Rank in Google, because AI Overviews draw on the Search index.
  2. Earn media mentions with data releases. ChatGPT favours authoritative media.
  3. Have licensed advisors post useful, disclosed answers on r/PersonalFinanceCanada-type threads, following platform rules and the RIBO online-conduct guidance.
  4. Publish quotable numbers with dates in the first 1–2 sentences of each section.

### 3.4 E-E-A-T for insurance (YMYL)
Insurance is a YMYL topic. Recommended practices:
- Named author bylines with credentials (for insurance: LLQP, RIBO, CIP/CAIB/FLMI, CFP).
- Factual, non-promotional bios and linked author profile pages.
- A **compliance or "reviewed by" line** on regulated-advice pages.
- Headshots, and keeping titles current.

Sources: https://www.accuracast.com/news/finance/e-e-a-t-financial-services-seo-guide/ ; https://exceptional.marketing/opinion/seo/ymyl-eat-for-financial-content/ . PolicyAdvisor already uses author pages, e.g. "Jiten Puri – CEO and Co-Founder, PolicyAdvisor LLQP" (`_raw_log.md`).

**Instasure E-E-A-T checklist:**
1. A byline and a "Reviewed by [Name], licensed [life / general insurance] agent, [Province] licence #[…]" line on every advice page. Link it to an advisor profile that lists licence numbers per province, with verification links to FSRA/RIBO, Insurance Council of BC, Alberta Insurance Council and the AMF register.
2. Visible **"Last updated [date]"** and **"Rates as of [month year]"** lines, plus a change log on rate pages.
3. A methodology page for every number Instasure publishes (sample size, period, exclusions).
4. A "How we make money" and referral/compensation disclosure page, also required by compliance (section 5).
5. A corporate licence page listing the agency or brokerage entity, licence numbers, provinces covered, the privacy officer (Law 25) and complaint-handling contacts.

### 3.5 Structured data to use (2026)
- **Organization** (or **InsuranceAgency**, a LocalBusiness subtype of FinancialService) on the home and about pages, with `sameAs`, address, `areaServed` and contact details. Use InsuranceAgency or LocalBusiness as the primary entity, not both. https://bigmarketing.com/seo/insurance-brokers/schema-markup/ ; https://salience.co.uk/insight/magazine/schema-for-finance-sites/
- **FinancialProduct** for product pages. schema.org has no "InsuranceProduct" type; HealthInsurancePlan exists for health. https://wolf.financial/blog/financial-product-schema-structured-data-guide-finance ; adoption stats: https://trends.builtwith.com/framework/InsuranceAgency-Schema
- **Article** with `author` (Person with `jobTitle` and credentials), `dateModified` and `reviewedBy` (a WebPage property), plus **BreadcrumbList**. [unverified this session: using `hasCredential` for licence numbers is valid schema.org vocabulary but has no Google rich result.]
- **FAQPage:** optional. It gives no Google rich result after May 2026 but does no harm. **HowTo:** do not invest.
- **Dataset** on index and methodology pages, for Dataset Search only.

---

## 4. 2026 market events creating fresh keyword demand

| Event | Key facts | Keyword angles | Sources |
|---|---|---|---|
| **Ontario auto reform (July 1, 2026)** | Only medical, rehabilitation and attendant care remain mandatory. Income replacement, non-earner, caregiver, housekeeping, visitor expenses, lost educational expenses, damage to personal items, and death and funeral benefits are now optional. Optional benefits cover only the named insured, spouse, dependants and listed drivers. Existing coverage continues unless changed. Opting out saves roughly $10/month, about 5% of the average premium. New policies may default to the minimums [verify; secondary source]. | "Ontario auto insurance changes July 2026", "should I opt out of income replacement benefits", "optional accident benefits Ontario cost", "self-employed / gig driver accident benefits Ontario" | https://www.northbridgeinsurance.ca/ontario-auto-reform/ ; https://www.intact.ca/en/personal-insurance/vehicle/ontario-auto-reform ; https://www.cp24.com/local/toronto/2026/06/13/major-changes-are-coming-to-auto-insurance-benefits-on-july-1-here-is-what-you-need-to-know/ ; https://www.thebig.ca/blog/title/ontario-sabs-2026-income-replacement-benefits-do-you-still-have-coverage ; https://www.ontariolocalguide.ca/blog/ontario-auto-insurance-changes-july-2026/ |
| **Ontario rates** | Rates.ca reports Ontario average −4.5% vs 2025 [verify]. Applied reports ON +7.0% YoY and −0.1% QoQ in Q2 2026. | "why did my car insurance go up Ontario 2026", "average car insurance [city] 2026" | https://rates.ca/insurance-quotes/auto/ontario ; Applied (above) |
| **Alberta: 2026 rate cap → Care-First (Jan 1, 2027)** | The 2026 cap is 7.5% for eligible good drivers, who now also need no minor convictions in 3 years. From 2027, a new adjustable cap limits insurers' average rate increase to 5% and caps average drivers at 10% at renewal. Projected saving under Care-First is about $366 per vehicle per year. Alberta auto was +22.6% YoY in Q2 2026. | "Alberta car insurance increase 2026", "Care-First Alberta explained", "Alberta good driver rate cap 2026 eligibility", "will Alberta car insurance go down 2027" | https://globalnews.ca/news/11850466/alberta-auto-insurance-adjustable-rate-cap/ ; https://www.alberta.ca/automobile-insurance-reform ; https://dailyhive.com/calgary/alberta-care-first-auto-insurance-model-new-rate-cap ; https://pipestoneflyer.ca/2026/05/14/alberta-government-caps-insurance-rates-ahead-of-system-overhaul/ ; https://www.insuranceinstitute.ca/en/Insights-And-Publications/CanadianUnderwriterArticles/items/2026/06/26/Albertas-cap-came-back-the-very-next-day-Thought-it-was-a-goner |
| **BC: ICBC basic rates frozen through 2027** | Seven years without an increase. Optional coverage is still priced by driver. Low-km drivers (under 15,000 km/yr) get 10–15% off select optional coverages. | "ICBC optional insurance cost", "ICBC low kilometre discount", "private optional car insurance BC vs ICBC" | https://news.gov.bc.ca/releases/2025AG0063-001064 ; https://dailyhive.com/vancouver/icbc-car-insurance-freeze ; https://victoriabuzz.com/2025/10/icbc-basic-insurance-rates-to-remain-frozen-through-2027/ |
| **Home insurance inflation and catastrophes** | Property premiums +5.8% YoY nationally in Q2 2026 (AB +11.9%, SK/MB +10.8%, Atlantic +8.9%). 2025 cat losses exceeded $2.4B. A 2026 Prairie storm season of about $923M has been reported [verify year]. Definity flagged a $130M cat hit for July–August [verify year]. | "why is home insurance going up 2026", "hail damage home insurance Calgary/Red Deer", "is hail covered by car insurance (comprehensive)", "home insurance Alberta 2026" | Applied (above) ; https://www.insurancebusinessmag.com/ca/news/catastrophe/prairie-storm-losses-climbed-to-923-million-589268.aspx ; https://www.insurancebusinessmag.com/ca/news/catastrophe/definity-flags-130-million-catastrophe-hit-for-july-august-588956.aspx ; IBC 2025 (above) |
| **Flood: national program delayed** | The $450M program had an April 2026 target date, but as of mid-June there was no timeline. About 1.5M high-risk households are affected. | "can't get flood insurance Canada", "overland flood insurance cost", "national flood insurance program update" | https://money.ca/news/canada-national-flood-insurance-program-delay-homeowners ; https://www.insurancebusinessmag.com/ca/news/catastrophe/a-flood-program-stuck-in-design-a-market-under-strain-ibc-on-the-race-to-stay-insurable-579611.aspx ; https://thenarwhal.ca/national-flood-insurance-program-canada/ |
| **Auto theft trending down, still costly** | 2025 thefts −18% nationally, ON −22%, QC −25%. Recovery is about 50%. Fraud is shifting to finance fraud. FSRA warned (July 23, 2026) about unlicensed GAP insurance sales [verify date]. | "most stolen cars Ontario 2026", "does car insurance cover theft", "anti-theft discount", "GAP insurance Ontario licensed" | Équité (above) ; https://stikeman.com/en-CA/kh/insurance-law/fsra-clarifies-its-licensing-expectations-for-gap-insurance-products-in-ontario-what-auto-manufacturers-dealers-and-finance-companies-need-to-know |
| **Mortgage renewal wave** | About 1.15M renewals in 2026 (CMHC via MPA) [verify]. The Bank of Canada held at 2.25% in April 2026 [verify]. | "mortgage life insurance at renewal", "do I need new mortgage insurance when I switch lenders", "term life vs mortgage protection 2026" | https://www.mpamag.com/ca/mortgage-industry/industry-trends/what-to-expect-from-canadas-2026-mortgage-renewal-wave/558668 |
| **Canadian Dental Care Plan, fully open in 2026** | Adults 18–64 can apply. Eligibility requires no *access* to private dental coverage (including through a spouse's plan) and adjusted family net income under $90K. Applications opened June 2, 2026 [verify, secondary sources]. | "CDCP vs private dental insurance", "will buying private dental insurance disqualify me from CDCP", "health and dental insurance self-employed cost" | https://www.aeva.ca/blog/canadian-dental-care-plan ; https://www.123dentist.com/canadian-dental-care-plan/canada-dental-benefits-eligibility-cdcp-expansion/ ; https://www.tcf-fca.ca/canadian-dental-care-plan-2026-cdcp/ |
| **Consumer belt-tightening** | 2026 reports say Canadians are cutting insurance to save money | "is life insurance worth it", "cheapest way to keep coverage", "reduce premiums" | https://www.insurancebusinessmag.com/ca/news/breaking-news/economic-pressure-reshapes-consumer-insurance-behaviour-in-2026-report-572651.aspx ; https://www.wealthprofessional.ca/investments/life-and-health-insurance/canadians-are-cutting-insurance-to-save-money-survey/393213 |
| **Super visa and newcomer demand** | Foreign insurers allowed since Jan 2025. Ongoing newcomer, work-permit and student demand. | "super visa insurance cost by age", "life insurance work permit Canada" | see section 1.3 |

---

## 5. Regulatory and compliance constraints for insurance lead generation in Canada

### 5.1 CASL (email, SMS and other commercial electronic messages)
- **Consent:**
  - Express consent does not expire until it is withdrawn.
  - Implied consent lasts **2 years after a purchase** and **6 months after an inquiry or application**. A quote request counts as an inquiry, so implied consent lapses after 6 months unless express consent was obtained.
  - Sources: https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en/getting-consent-send-email ; https://hadrilaw.com/canadas-anti-spam-law-key-rules-for-sending-commercial-messages
- **Pre-checked boxes are not valid consent.** Get SMS consent separately from email consent. https://crtc.gc.ca/eng/com500/faq500.htm ; https://www.mogli.com/blog/all-about-canadas-casl-text-messaging-laws-regulations ; https://gowlingwlg.com/en/insights-resources/guides/2023/doing-business-in-canada-casl
- **Every message needs:**
  - Sender identification. If messages are sent on behalf of an advisor or partner, identify both.
  - Contact information valid for **60 days**.
  - A free **unsubscribe** that works by the same channel and is honoured within **10 business days**.
  - Source: https://hadrilaw.com/canadas-anti-spam-law-key-rules-for-sending-commercial-messages
- **Penalties:** AMPs of up to $10M per violation for organizations [unverified this session; well-known CASL figure].

### 5.2 Telemarketing (CRTC Unsolicited Telecommunications Rules / National DNCL)
- Calls are exempt from the DNCL for **6 months after a consumer's inquiry or application** and **18 months after a purchase or contract**.
- Even exempt callers must keep an **internal do-not-call list** and add a requester **within 14 days**.
- Telemarketers must register with the National DNCL.
- Sources: https://web.crtc.gc.ca/eng/phone/telemarketing/exempt.htm ; https://crtc.gc.ca/eng/phone/telemarketing/tobligations/register-inscrire.htm
- **Implication:** a lead can be called for 6 months from form submission. After that, check against the DNCL unless express consent was obtained. Name the specific callers in the consent wording, i.e. Instasure and the licensed advisor or brokerage.

### 5.3 PIPEDA (federal private-sector privacy)
- Consent is valid only if the individual would understand the **nature, purpose and consequences**. **Express consent** is needed for sensitive information (health information on life, CI and DI applications) or uses outside reasonable expectations. Sources: OPC consent principle https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_consent/ ; form-of-consent bulletin https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/pipeda-interpretation-bulletins/interpretations_07_consent/ ; summary https://mcmillan.ca/insights/pipeda-how-to-obtain-meaningful-consent-and-when-consent-is-not-enough/
- **Accountability for third parties** (advisors, insurers, CRMs): Instasure stays responsible for data it transfers and must protect it by contract. The OPC issued new guidance on assessing third-party service providers in September 2026. https://www.bennettjones.com/Insights/Blogs/2026/09/OPC-Issues-New-PIPEDA-Guidance-on-Assessing-Third-Party-Service-Providers
- **Purpose limitation:** do not reuse quote data, for example for selling leads to non-insurance partners, without new consent. An insurer sharing data with a broker with consent at application was upheld in https://www.priv.gc.ca/en/opc-actions-and-decisions/investigations/investigations-into-businesses/2015/pipeda-2015-003/
- Note: AB, BC and QC have their own private-sector privacy laws [unverified this session for AB and BC detail].

### 5.4 Quebec Law 25
- **Opt-in consent for non-essential cookies and trackers.** They must be off by default.
- A **Privacy Officer** is mandatory for every enterprise, with no size threshold. It defaults to the most senior person unless delegated in writing.
- **Data portability** has applied since Sept 22, 2024.
- Fines reach **$25M or 4% of worldwide turnover**.
- Sources: https://www.cookiebot.com/en/law-25/ ; https://www.dpo-consulting.com/blog/what-is-quebec-law-25 ; https://setupanalytics.com/countries/quebec/ ; AMF's page for firms on data protection: https://lautorite.qc.ca/en/professionnels/obligations-et-formalites-administratives/protection-des-donnees-et-des-renseignements-personnels/firms-and-representatives
- [unverified this session] Quebec also has French-language requirements for commercial websites and contracts (Charter of the French Language as amended by Bill 96), and privacy impact assessments are required before transferring data outside Quebec. Check both with counsel.

### 5.5 Licensing and lead-generator / referral rules by province

**General principle:** unlicensed people and websites may collect and route information. They may **not** discuss product merits, assess a person's insurance needs, or recommend coverage. Any referral compensation must go only to permitted parties and must be disclosed.

- **CCIR/CISRO "Conduct of Insurance Business and Fair Treatment of Customers"** applies to insurers and intermediaries across all distribution models, including digital. It lists twelve customer outcomes. https://www.cisro-ocra.com/Documents/View/5 ; https://www.ccir-ccrra.org/Documents/View/3378 . See also the CISRO Principles of Conduct for Intermediaries: https://www.cisro-ocra.com/documents/view/2471
- **Ontario (FSRA; RIBO for P&C brokers):**
  - FSRA warns consumers about unlicensed people selling auto insurance, and such buyers lose Insurance Act protections. https://www.fsrao.ca/announcements/fsra-warns-consumers-about-unlicensed-individuals-offering-automobile-insurance-ontario
  - **Life and health:** FSRA fined an insurer or MGA **$65,000 under s.403(1)** for indirectly paying commissions to an unlicensed person, and **$50,000 under O. Reg. 347/04 s.12(1)** for not keeping a compliance system. https://www.insurancebusinessmag.com/ca/news/life-insurance/fsra-enforces-penalties-on-insurance-entities-and-unlicensed-agent-491337.aspx
  - FSRA reviews **referral relationships** as part of life agent and MGA suitability. https://www.fsrao.ca/industry/life-and-health-insurance/regulatory-framework/guidance-life-and-health-insurance-and-property-and-casualty-and-general-insurance/proposed-guidance-life-insurance-agent-mga-licensing-suitability
  - The planned L&H MGA licensing rule, targeted for June 1, 2026, is paused. https://www.torys.com/en/our-latest-thinking/publications/2025/11/proposed-life-and-health-managing-general-agents-rule
  - **P&C brokers (RIBO / O. Reg. 991):**
    - Referral fees are allowed with listed intermediaries only (life agents, mutual fund, financial planners, investment dealers, mortgage brokers, real estate) under **s.15**.
    - **No finder's fees to unlicensed persons** who are not listed.
    - Referral arrangements need disclosure and the client's written consent.
    - Unlicensed staff may collect expiry dates but must give **no insurance advice**.

    Sources: https://www.ribo.com/wp-content/uploads/2025/01/Marketing-Guidelines-June-2016.pdf ; https://www.ribo.com/advertising-to-the-public/
  - **FSRA UDAP Rule:** misleading information about policy terms or benefits is an unfair or deceptive act. Rebates and inducements tied to unsuitable products are prohibited. https://www.fsrao.ca/engagement-and-consultations/fsras-first-proposed-insurance-rule-released-public-consultation-unfair-or-deceptive-acts-or-practices-udap-rule/unfair-or-deceptive-acts-or-practices-rule-udap-consultation-summary-report ; https://www.torys.com/en/our-latest-thinking/publications/2020/12/fsra-introduces-first-proposed-insurance-rule-for-public-consultation-the-unfair-or-deceptive-acts-or-practices-rule
  - **Implication:** a commission split or per-lead fee from a P&C brokerage or life agent to an unlicensed Instasure entity is risky in Ontario. Structure Instasure as a licensed agency or brokerage (P&C and life), or take only flat marketing or advertising fees not tied to placement, and have counsel review. Instasure's "licensed advisors" model points to a licensed entity.
- **British Columbia (Insurance Council of BC, now under BCFSA's umbrella for some functions):**
  - Licensees may pay referral fees to unlicensed people only if the referrer did **not** engage in insurance activities, including **"discussing the merits of an insurance product or the client's insurance needs"**.
  - The client must receive **written disclosure of the referral compensation before the transaction**.
  - Strata insurance referral fees have been banned since Sept 4, 2020.
  - Sources: https://www.insurancecouncilofbc.com/licensee-resources/licensee-responsibilities/ ; https://www.insurancecouncilofbc.com/Website/media/Shared/Licensee%20Resources/Resources/Insurance-Council-Code-of-Conduct.pdf ; https://www.insurancecouncilofbc.com/getattachment/d0bb8656-b4f9-436f-9500-39802c43d2c5/ICN-20-003-Requirements-for-Strata-Insurance-Busin/
- **Alberta (Alberta Insurance Council, with General, Life and Adjusters councils):** licensing and discipline sit under the Insurance Act and the Insurance Councils Regulation (Alta Reg 126/2001) and the Insurance Agents and Adjusters Regulation (Alta Reg 122/2001). **[unverified: the specific referral-fee section for unlicensed persons was not found this session.]** https://www.canlii.org/en/ab/laws/regu/alta-reg-126-2001/latest/alta-reg-126-2001.html ; https://www.canlii.org/en/ab/laws/regu/alta-reg-122-2001/latest/alta-reg-122-2001.html ; https://www.abcouncil.ab.ca/
- **Quebec (AMF; Act respecting the distribution of financial products and services):**
  - Under the **Regulation respecting Alternative Distribution Methods (RADM, 2019/2020)**, only registered **firms or independent partnerships** may run an online "digital space" offering insurance. Independent representatives may not.
  - The firm must tell the AMF about the products, the hyperlink and the insurers offered.
  - It must keep the means of reaching a representative **visible at all times**, and **suspend the transaction** if the client asks for a representative and none is available.
  - It must keep client data confidential and secure (s.13).
  - Sources: https://lautorite.qc.ca/en/professionals/firms-representatives-and-independent-partnerships/products-and-services-offered-via-the-internet/explanation-regarding-the-regulation-respecting-alternative-distribution-methods ; https://lautorite.qc.ca/fileadmin/lautorite/reglementation/distribution/reglements-distribution/r16.1-modes-alternatif-distribution/2020-05-01/2020mai01-R16.1-modes-alternatif-distribution-vadmin-en.pdf ; https://www.nortonrosefulbright.com/en-ca/knowledge/publications/f2426819/insurtech-and-the-online-sale-of-insurance
  - **AMF communication rules:** representatives use their name as on the AMF register, disclose the firm they act for, and give their business address, phone and email. Disclosures go on the website and in written solicitations for auto and home insurance. AMF guide "Complying with your obligations when communicating with clients": https://lautorite.qc.ca/fileadmin/lautorite/professionnels/obligations/guide-representations-an.pdf
  - **Bill 92 (2025):**
    - The Chamber of Financial Security and the Chamber of Damage Insurance merged into a single Chamber of Insurance (July 2025).
    - Equity-holder disclosure was narrowed.
    - The compensation fund was extended to all distributors.
    - Sources: https://www.fasken.com/en/knowledge/2025/07/loi-92 ; https://www.dlapiper.com/en-ca/insights/publications/2025/06/bill-92-impact-on-the-insurance-sector ; 2026 update: https://www.fasken.com/en/knowledge/2026/06/assurance-et-distribution-au-quebec
  - **Implication:** do not solicit Quebec residents (geo-gate forms or route them elsewhere) until Instasure or a partner firm is AMF-registered with a compliant digital space and French-language pages.
- **Other provinces** (SK, MB, Atlantic, territories): licensing is through their insurance councils or superintendents. [unverified this session: research before launching in those provinces.]

### 5.6 Testimonials and reviews
- **RIBO's online conduct guidance (2026)** says online activity is held to the same professional standards as offline conduct. It warns against **fake or purchased reviews, review gating, and AI-generated testimonials presented as genuine**. https://www.blg.com/en/insights/2026/06/a-closer-look-at-ribos-guidance-on-online-conduct
- **Competition Bureau:**
  - Astroturfing (fake reviews or testimonials) is deceptive.
  - Employees who post reviews must disclose the relationship.
  - Penalties reach the greater of $10M ($15M for repeat violations) or 3× the benefit.
  - Sources: https://competition-bureau.canada.ca/en/deceptive-marketing-practices/types-deceptive-marketing-practices/misleading-representations-and-deceptive-marketing-practices ; https://www.nortonrosefulbright.com/en-ca/knowledge/publications/41049288/fake-reviews-competition-bureau-warns-businesses-of-stiff-penalties-associated-with-online-reviews ; https://competition-bureau.canada.ca/en/deceptive-marketing-practices-digest-volume-1

### 5.7 Price claims ("best price", "lowest rates", "from $X/month")
- The Competition Bureau targets dishonest price claims and **drip pricing**. Example: it sued DoorDash in June 2025 over advertised prices that could not be obtained. https://www.canada.ca/en/competition-bureau/news/2025/06/competition-bureau-sues-doordash-for-allegedly-advertising-misleading-prices-and-discounts.html ; https://www.canada.ca/en/competition-bureau/news/2020/03/competition-bureau-looks-at-three-types-of-online-claims-that-consumers-encounter-every-day.html
- RIBO lists **false claims, bait and switch, scare tactics and disparaging other brokers** as misleading advertising. It recommends **submitting marketing plans to RIBO for review** before launch. https://www.ribo.com/advertising-to-the-public/ ; https://www.ribo.com/wp-content/uploads/2025/01/Marketing-Guidelines-June-2016.pdf
- **Rules for Instasure copy:**
  - No "lowest price guaranteed" or "best rates".
  - "Compare quotes from N insurers" is acceptable if true.
  - Any "from $X/month" figure needs a dated, representative profile footnote ("e.g., 35-year-old non-smoker, $500K 20-yr term, [insurer], quoted [date]").
  - "Instant policy" claims must match what can actually be bound online in each province.
  - No ranking language ("best company") without a published methodology.

### 5.8 Google Ads
- Google's **Financial products and services** policy requires advertisers to meet local legal requirements and, where required, complete **financial services verification** through G2 (First Party or Authorized Advertiser), with regulator licence and registration numbers. https://support.google.com/adspolicy/answer/2464998?hl=en ; https://support.google.com/adspolicy/answer/17127726?hl=en ; https://g2risksolutions.com/financial-services/
- The June 2026 expansion added 24 EU/EEA countries, with enforcement from July 23, 2026. https://blog.google/products/ads-commerce/eu-financial-advertiser-verification/ ; https://searchengineland.com/google-expands-financial-services-ad-verification-across-24-european-markets-480833
- A third-party agency lists **Canada** among markets where verification is "a key requirement" [verify against Google's official country list before launch]. https://keepersdigital.com/en-ca/resources/paid-search/financial-services-ad-compliance/
- **Implication:** a licensed entity with licence numbers makes verification simpler. An unlicensed lead generator may need "Authorized Advertiser" status through a licensed partner.

---

## 6. Ranked content plan (top 25, by expected traffic plus lead value)

The score blends search volume, commercial intent, Instasure's chance to compete on freshness or data, and lead value per visitor. "Owner(s) today" lists who currently ranks.

| # | Page / cluster (working title) | Type | Owner(s) today | Why now |
|---|---|---|---|---|
| 1 | **Average Car Insurance Cost in [City], Ontario (2026)**: programmatic informational page plus a transactional quote page per city and FSA, starting with Brampton, Mississauga, Toronto, Scarborough, Vaughan, Hamilton, Ottawa and London | City cost | rates.ca, ratehub, lowestrates, mychoice, sonnet, insurancehotline, surex | Largest volume and direct quote intent |
| 2 | **Ontario Auto Insurance Changes July 2026: What's Optional Now & Should You Opt Out?**, with an opt-out savings calculator and a renewal checklist | Regulation explainer plus tool | rates.ca, ratelab, thinkinsure, intact, IBC, RIBO | Every Ontario renewal from July 2026 to June 2027 triggers the decision |
| 3 | **Cheapest Car Insurance Companies in Ontario (2026)**, with methodology | Ranking | moneygeek, mychoice, lowestrates, wealthnorth, insuranceopedia | High commercial intent. Needs a substantiated methodology (section 5.7). |
| 4 | **Alberta Car Insurance 2026–2027: Rate Cap, Care-First & What You'll Pay**, plus city pages for Calgary, Edmonton and Red Deer | Regulation plus cost | Mostly news sites and brokers; few aggregators | Alberta auto +22.6% YoY, and the Jan 1, 2027 switch is a gap |
| 5 | **Cost of Life Insurance in Canada (2026) by Age & Coverage Amount**, with tables for ages 20–70 × $250K/$500K/$1M | Cost tables | policyadvisor, policyme, ratehub | High lead value. Instant-quote fit. |
| 6 | **How Much Life Insurance Do I Need? (Calculator)** | Tool | policyme, ratehub, hardbacon, policyadvisor | Evergreen. Strong lead capture. |
| 7 | **Mortgage Life Insurance vs Term Life: What to Do at Your 2026 Renewal** | X vs Y plus event | ratehub, policyadvisor, policyme, money.ca | About 1.15M renewals. Mortgage-protection leads. |
| 8 | **Best Life Insurance Companies in Canada (2026)**, plus "[Insurer] review" and "[A] vs [B]" hubs (Sun Life vs Manulife, Canada Life vs iA…) | Ranking / reviews | policyadvisor, wealthnorth, hellosafe | Brand demand. Needs a methodology. |
| 9 | **Life Insurance for Newcomers, Work-Permit Holders & International Students (2026)** | Audience | policyadvisor, mychoice, iA | Underserved and high-converting; multilingual opportunity |
| 10 | **Super Visa Insurance Cost 2026 (by Age) + Requirements Checklist** | Cost plus checklist | policyadvisor, bestquote, hellosafe, coverme, RBC | Mandatory purchase with high intent |
| 11 | **Does Home Insurance Cover Water Damage, Sewer Backup & Overland Flood?** | Coverage Q&A | ratehub, CAA, RBC, westland, mcdougall | Evergreen. Peaks after storms. Strong AI-citation format. |
| 12 | **Average Home Insurance Cost in [City] (2026)**, with Calgary/Alberta hail and Ontario basement-flood sections | City cost | ratehub, rates.ca, squareone, mychoice | Property +5.8% YoY. AB, SK/MB and Atlantic all above 8%. |
| 13 | **Instasure Canadian Insurance Price Index (Q4 2026)**, with methodology and CSV | Data asset | Applied, rates.ca, Kanetix, HelloSafe | Earns links, press and AI citations for every other page |
| 14 | **Critical Illness Insurance Cost in Canada (2026) by Age** plus best CI companies | Cost / ranking | policyadvisor, policyme, ratehub | High lead value |
| 15 | **Hail Damage & Insurance: Calgary/Red Deer Guide (Home + Car)** | Event explainer | IBC (data), local brokers | Recurring Prairie hail seasons. Calgary 2024 cost $3.29B. |
| 16 | **Can a Landlord Require Tenant Insurance in Ontario?** plus tenant insurance cost by city | Q&A plus cost | tenantrights.ca, marathon, insurely, sonnet | High volume, low-cost product, a gateway to auto bundles |
| 17 | **Uber, Lyft, DoorDash & Skip Driver Insurance in Ontario (OPCF 6A) + Accident Benefits After July 2026** | Audience | ratehub, mychoice, thinkinsure | Gig drivers are most exposed by the reform. Few pages combine both topics. |
| 18 | **Most Stolen Cars in Ontario & Quebec (2026) + Does Insurance Cover Theft?** | Data plus Q&A | sonnet, insurancehotline | Annual Équité release brings news traffic |
| 19 | **Disability Insurance for Self-Employed Canadians: Cost & How It Works** | Audience / cost | policyadvisor | Tie-in with the Ontario income-replacement opt-out |
| 20 | **Health & Dental Insurance vs the Canadian Dental Care Plan (2026): Who Should Buy Private?** | Explainer | dental clinics (weak) | New CDCP rules create confusion, and coverage of this topic is weak |
| 21 | **Can't Get Flood Insurance? National Flood Program Update & Your Options** | Event explainer | money.ca, mychoice, narwhal | The program is delayed and 1.5M households are exposed |
| 22 | **ICBC Optional Insurance in BC: Cost, Low-km Discount & Private Options** | Province explainer | ICBC, BC brokers | Basic rates frozen through 2027 while optional coverage varies |
| 23 | **Condo Insurance: What It Covers vs Your Building's Policy + Cost by City** | Coverage / cost | sonnet, ratehub | High volume in Toronto and Vancouver |
| 24 | **Small Business Insurance Cost in Canada (by Industry)** | Cost | [not researched this session] | High lead value, but the competitive set was not verified |
| 25 | **Why Is My Insurance Going Up in 2026? (Auto & Home, by Province)**, refreshed quarterly from the Applied index and Instasure's own index | Trend explainer | onlia, Applied coverage | Renewal-notice searches |

---

## 7. Known gaps (search budget exhausted)
- sunlife.ca and manulife.ca editorial content; MoneySense, NerdWallet CA, Insurdinary, Apollo Cover, CAA, TD, RBC, Desjardins and Wawanesa content strategies (only partly seen).
- FSRA quarterly auto rate-approval data, GISA statistics, SGI/MPI 2026 rate changes, and Quebec SAAQ changes.
- Alberta and Saskatchewan referral-fee rule text; Atlantic licensing.
- Google's official list of countries in scope for financial services verification (check whether Canada is included).
- Year attribution for some 2025/2026 Prairie hail and storm figures (marked [verify]).
