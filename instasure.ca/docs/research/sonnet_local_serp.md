# Sonnet.ca teardown + Canadian local insurance SERPs (for instasure.ca)

Research date: 2026-10-03. Method: WebSearch only (fetching competitor pages directly is blocked). Every URL below appeared in a search result. Anything inferred is marked **(inferred)**. Facts I did not check in this session are marked **(background, unverified)**.

## 0. Read this first: coverage and limits

| Item | Status |
|---|---|
| Part A: Sonnet | **Done.** About 22 `site:` and brand queries, roughly 110 Sonnet URLs and titles recorded. |
| Part B: local SERPs | **Partial.** I covered car and home for 5 cities: Toronto, Brampton, Mississauga, Ottawa and Hamilton. The session hit its **WebSearch cap of 200 calls** (shared by all agents in the session) at the Vaughan query. I could not search Vaughan through St. John's, and I ran no life, business or tenant city SERPs. |
| Life insurance local SERP | There is indirect evidence from a sibling agent's log (`research/_raw_log.md`, PolicyAdvisor crawl). I did not re-check it. See section 2.5. |
| Canadian keyword-volume references | **Not collected.** The search cap was hit first. No volume numbers appear in this file. |
| SERP fidelity | The WebSearch tool is US-located, not google.ca with a Canadian IP. The order shown is the order the tool returned, so treat it as a proxy for rank, not true local rank. |

To finish Part B, raise `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION` and re-run the query list in section 5.

---

## PART A: SONNET.CA (Definity/Economical direct-to-consumer)

### A1. Product and geographic footprint (from SERP snippets)
- **Auto:** Ontario, Québec, New Brunswick, Nova Scotia, PEI only. There is **no auto in AB, BC, MB, SK or NL.**
- **Home, condo, tenant:** the same provinces **plus Alberta and BC**. Per a snippet: "In B.C. and Alberta, Sonnet offers home insurance only."
- Personal lines only. Rideshare (Uber/Lyft) use is not covered. There is no life or business insurance (only one blog post on home-business coverage).
- Head office FAQ: 111 Westmount Rd S, Waterloo, ON (`/faqs/other-inquiries/where-is-your-office`).

### A2. URL architecture (observed)

| Layer | Pattern | Examples seen |
|---|---|---|
| Product hub | `/{product}-insurance` | `/auto-insurance`, `/home-insurance`, `/condo-insurance`, `/tenant-insurance` |
| Province | `/{product}-insurance/{province}` (full province name, hyphenated) | `/auto-insurance/ontario`, `/auto-insurance/quebec`, `/auto-insurance/nova-scotia`, `/home-insurance/alberta`, `/home-insurance/british-columbia`, `/home-insurance/ontario`, `/home-insurance/quebec`, `/home-insurance/new-brunswick`, `/condo-insurance/ontario`, `/condo-insurance/british-columbia`, `/tenant-insurance/british-columbia`, `/tenant-insurance/quebec`, `en.sonnet.ca/tenant-insurance/ontario` |
| City | `/{product}-insurance/{province}/{city}` | Auto: `/auto-insurance/ontario/toronto`, `/ottawa`, `/hamilton`, `/mississauga`, `/scarborough`, `/barrie`. Home: `/home-insurance/alberta/calgary`, `/home-insurance/alberta/edmonton` |
| French product/city | `/fr/assurance-{auto\|habitation}/{province}/{ville}`, `/fr/assurance-locataires` | `/fr/assurance-auto/quebec/ville-quebec`, `/fr/assurance-auto/quebec/laval`, `/fr/assurance-auto/ontario/scarborough` (FR mirror of ON city pages), `/fr/assurance-habitation/quebec/montreal`, `/fr/assurance-habitation/quebec/laval`, `/fr/assurance-habitation/nouveau-brunswick` |
| Blog (EN) | `/blog/{auto\|home\|finance\|general}/{insurance\|general\|alumni}/{slug}` (some older posts skip the middle level) | `/blog/auto/insurance/saaq-car-insurance`, `/blog/home/insurance/fire-insurance`, `/blog/finance/general/getting-started-online-investing`, `/blog/general/alumni/university-alumni-discounts`, `/blog/auto/accident-forgiveness` |
| Blog (FR) | `/fr/blogue/{auto\|habitation}/{assurance\|general}/{slug}` | `/fr/blogue/habitation/assurance/prix-assurance-habitation`, `/fr/blogue/auto/general/vol-de-vehicule` |
| FAQ | `/faqs/{category}/{slug}`. Categories seen: `quoting`, `policy-coverages`, `renewal-cancellation`, `other-inquiries`, `account`, `payments`, `purchasing` | `/faqs/quoting/home-insurance-mandatory-ontario`, `/faqs/quoting/how-do-you-get-car-insurance-quebec`, `/faqs/purchasing/buy-car-insurance-ontario` |
| Affinity/group landing | `/{partner}` (root-level vanity) | `/tangerine`, `/nhlpa`, `/bcpa`, `/cityofwindsor`, `/alberta-teachers`, `/fr/ccilaval`, `/group-insurance` |
| Campaign | `/campaign/{name}` | `/campaign/switch-save` "Switch and Save Car Insurance and Home Insurance" |
| Product program | `/shift` | "Sonnet Shift: Drive Safe and Get Cheaper Car Insurance" |
| Tool | `/cancellation-calculator` | "Insurance Cancellation Calculator: Home and Auto" |
| Other | `/claims/home`, `/news/{slug}`, `/site-map`, `/about-us`, `/contact-us`, `/privacy`, `/compliments-and-complaints` | |

Notes:
- **Tracking-parameter duplicate indexed:** `/home-insurance?msclkid=%7Bmsclkid%7D` shows up in results. **The `en.sonnet.ca` subdomain is also indexed** (`en.sonnet.ca/tenant-insurance/ontario`, titled "Renters Insurance in Ontario"). Both point to technical-SEO sloppiness.
- One URL `sonnet.ca/blog/auto/insurance/installing-roof-rack?language_id=` is indexed with a query string. The **EN and FR titles are swapped on some URLs**: `/blog/auto/auto-insurance-by-province` appears as both "Average Car Insurance Rates By Province Explained" and "Assurance auto : Québec vs autres provinces". `/auto-insurance` appears under the FR title "Assurance auto : soumission gratuite et 100% en ligne" (inferred: bilingual pages share one URL and are toggled by language rather than given separate hreflang URLs).

### A3. City pages: coverage map

| City | Auto page seen | Home page seen | Notes |
|---|---|---|---|
| Toronto | `/auto-insurance/ontario/toronto` | Home stats appear on the ON province page (~$106/mo) | Ranks #3 for "car insurance Toronto" |
| Scarborough | `/auto-insurance/ontario/scarborough` + FR mirror | | Sub-city (former borough) page |
| Mississauga | `/auto-insurance/ontario/mississauga` | | Ranks #1 for "car insurance Mississauga" |
| Ottawa | `/auto-insurance/ontario/ottawa` | | Did not surface in the "car insurance Ottawa" SERP |
| Hamilton | `/auto-insurance/ontario/hamilton` | | Did not surface in the "car insurance Hamilton Ontario" SERP |
| Barrie | `/auto-insurance/ontario/barrie` | | |
| Brampton | Not surfaced | | A snippet says "Brampton Auto Insurance" is listed among Sonnet's "popular product offerings by location". Likely a footer link **(inferred)**. |
| Vaughan, Markham, London, Kitchener-Waterloo, Windsor, Oshawa | Not surfaced | | Windsor only has the affinity page `/cityofwindsor`. Waterloo appears only as a stat line ("bundle… less than… dining out"). |
| Calgary, Edmonton | n/a (no auto in AB) | `/home-insurance/alberta/calgary`, `/home-insurance/alberta/edmonton` | |
| Vancouver/Surrey/Delta | n/a (no auto in BC) | Only the BC province page | The BC tenant page mentions "condos in Vancouver, apartments in Surrey, houses in Delta". Vancouver home ~$122/mo. |
| Québec City, Laval | `/fr/assurance-auto/quebec/ville-quebec`, `/fr/assurance-auto/quebec/laval` | `/fr/assurance-habitation/quebec/laval` | |
| Montréal | Not surfaced (auto) | `/fr/assurance-habitation/quebec/montreal` | |
| Halifax, Moncton | Mentioned in province-page copy only | | No Atlantic city URLs surfaced |

**Takeaway:** Sonnet's city layer is **thin and selective**: roughly 6 ON auto cities, 2 AB home cities and 2–3 QC cities. It has **no** pages for many high-volume ON auto cities (Brampton, Vaughan, Markham, London, Kitchener, Windsor, Oshawa), no Atlantic city pages, and no city pages for tenant or condo.

### A4. Title formulas

| Page type | Formula (observed) |
|---|---|
| Product hub | "Car Insurance: Quick Online Auto Insurance Quotes", "Home Insurance: Get a Home Insurance Quote Online", "Condo Insurance: Get a Quote and Buy Online", "Tenant Insurance: Renters Insurance Online" (the tenant title targets both *tenant* and *renters*) |
| Province | "Car Insurance in {Province}: Quote & Buy Online", "Home Insurance in {Province}: Quote & Buy Online", "Condo Insurance in Ontario: Quote and Buy Online", "Tenant Insurance in BC Quote & Buy Online". Abbreviation in use: "Home Insurance in BC" / "Condo Insurance in BC" |
| City (auto), main form | "Car Insurance in {City}: Quote and Buy Online" (Toronto). Variant: "Car Insurance in Ottawa: Get Online Auto Insurance Quotes" |
| City (auto), thin form | "Car Insurance in Hamilton", "Car Insurance in Mississauga", "Car Insurance in Scarborough", "Car Insurance in Barrie" (no modifier) |
| City (home) | "{City} Home Insurance: Quote and Buy Online" (Calgary, Edmonton). City comes first. |
| FR city | "Assurance auto {Ville} : Soumission 100% en ligne", "Assurance habitation Laval : Soumission 100% en ligne", "Assurance habitation à Montréal - Sonnet", "Assurance auto à Scarborough" |
| FR hub | "Assurance auto : soumission gratuite et 100% en ligne", "Assurance locataire : soumission gratuite et 100 % en ligne" |
| FAQ | Question titles that mirror PAA queries: "Is home insurance mandatory in Ontario?", "Is home insurance mandatory in B.C.?", "Is tenant insurance mandatory in Alberta?", "How do you get tenant insurance in B.C.?", "How do you get car insurance in Québec?", "How do you buy car insurance in Ontario?", "L'assurance habitation est-elle obligatoire au Québec?" |
| Cost posts (year-stamped) | "What's the average price of car insurance in Quebec? (2026)", "Prix de l'assurance habitation au Québec (2026) - Sonnet", "What is the cost of tenant insurance in Quebec in 2025?" (stale year), "Vehicle Theft in Quebec in 2026", "Vol de véhicule au Canada en 2026 : Guide et prévention — Sonnet" |

### A5. On-page conversion and data hooks (from snippets)
- City pages open with a **first-party average premium**:

| Metric (Sonnet data) | Value |
|---|---|
| Auto, Toronto | $241/mo |
| Auto, Ottawa | ~$204/mo |
| Auto, Hamilton | $249/mo |
| Auto, Mississauga | $308/mo |
| Auto, Scarborough | $330/mo |
| Auto, Canada median | $2,006/yr |
| Auto, Quebec average (2025) | ~$96/mo |
| Home, Toronto | ~$106/mo |
| Home, Mississauga | ~$100/mo |
| Home, Ottawa | ~$96/mo |
| Home, Vancouver | ~$122/mo |
| Condo, Canada median | $520/yr |

- Prices are framed against everyday spending: "less than what most Vancouverites spend on an average date night", "less than the average household spends monthly on dining out" (Waterloo).
- **Sonnet Shift** (telematics/UBI): "save up to 35%" plus "10% more for driving less", re-scored every 3 months.
- First-time accident forgiveness is included automatically for eligible drivers. Ticket forgiveness is an add-on (requires 3 ticket-free years). Roadside assistance and vehicle replacement are add-ons.
- Discounts named on the QC city pages: Shift, multi-vehicle, recent graduates, bundling.
- Province-specific notes: hail coverage is optional in Alberta; sewer backup, overland water and earthquake are optional in BC; Brampton copy recommends anti-theft devices.
- Trust: "24/7 claims", "600 Claims team members". The quote is the final price if answers are accurate (`/faqs/quoting/is-quote-final-price`).

### A6. Tools
1. **Online quote-and-buy flow.** All quoting and purchasing is online; there is also a phone-quote FAQ.
2. **Cancellation Calculator** (`/cancellation-calculator`). It estimates the penalty for leaving a current home or auto policy, which removes a switching objection. It is cross-linked from province and product pages. This is the **only calculator found**.
3. **Sonnet Shift app** (UBI).
4. **No premium estimator, coverage-needs calculator or cost-by-city tool surfaced (inferred gap).** This matters for instasure, since the repo is "Calculators".

### A7. Content clusters (blog / FAQ)
- **Auto insurance basics:** how-auto-insurance-works, types-of-car-insurance-fit-your-needs, things-to-know-about-auto-insurance, car-insurance-deductible, 5-car-characteristics-impact-car-insurance, when-to-update-car-insurance, dealership-car-insurance ("When to Get Insurance For a New Car: Before or After?"), 4-steps-best-used-car-insurance, auto-insurance-cancellation-penalties, compare-car-insurance-quotes, 6-ways-to-save-when-insuring-your-ride, how-usage-based-insurance-tracks-driving, accident-forgiveness, installing-roof-rack.
- **Auto lifestyle:** most-stolen-cars-canada, vehicle-theft (QC 2026), fuel-saving-driving-tips, important-tips-for-buying-car, montreal-area-road-trip-destinations, our-great-canadian-road-trip-families.
- **Quebec/SAAQ cluster:** quebec-auto-insurance-101, saaq-car-insurance ("A complete guide to SAAQ car insurance in Quebec"), What-you-need-to-know-about-the-SAAQ, info-auto-insurance ("Car insurance in Quebec: Everything you need to know"), car-insurance-price, auto-insurance-by-province.
- **Home:** fire-insurance, home-business-insurance, what-isnt-covered-by-the-typical-home-insurance, keep-home-insurance-from-increasing, student-home-insurance, switching-home-insurance, natural-disaster-insurance, what-types-of-water-damage-does-home-insurance-cover, home-insurance-101-whats-overland-water-coverage, home-insurance-and-your-backyard, home-insurance-coverage-you-didnt-know-you-had, compare-home-insurance-quotes, property-and-casualty-insurance, how-does-condo-insurance-work ("Condo insurance vs. building insurance"), buying-condo-pros-cons, five-moves-that-can-affect-your-insurance-rate, renting-make-sure-youre-covered, tenant-insurance-price.
- **FR home:** prix-assurance-habitation, assurance-habitation-fonctionnement, assurance-habitation-moins-chere, assurance-locataire-obligatoire-quebec.
- **Finance/general (off-topic, supports affinity marketing):** online investing, financial appreciation, digital info safety, alumni discounts, benefits of alumni associations.
- **FAQ programmatic pattern:** `{product}-mandatory-{province}` and `how-to-get-{product}-{province}`, plus coverage FAQs such as condo-appliances, mobile-home, extra-auto-coverages, how-does-accident-forgiveness-work, new-pink-slip, digital-or-electronic-wallet, what-auto-coverage-do-i-need, and step-by-step-home ("How to get a home insurance quote online: A step-by-step guide").

### A8. Who ranks for Sonnet's brand terms (opportunity: "{brand} review" and "vs" pages)
For "sonnet car insurance ontario", "sonnet tenant insurance" and "sonnet.ca car insurance brampton", these third parties ranked: `youset.ca/en/blog/sonnet-car-insurance-vs-youset/`, `youset.ca/en/blog/sonnet-home-insurance-vs-youset/`, `policyme.com/car-insurance/sonnet-car-insurance` ("Sonnet Car Insurance Review (2026)"), `lowestrates.ca/insurance/auto/sonnet`, `rates.ca/insurance-companies/sonnet`, `ratehub.ca/insurance/companies/sonnet`, `moneygenius.ca/insurance/tenant-insurance/sonnet-tenant-insurance`, `comparewise.ca/reviews/sonnet-insurance-review/` ("Sonnet Insurance Review (September, 2026)"), `hellosafe.ca/en/car-insurance/sonnet`, `mitchinsurance.com/insurance-companies/sonnet/`. One scraped or spam page (`my.sancarlo.co.uk/...sonnet-insurance-ontario-reviews...`) also ranked, which suggests **brand-review SERPs are soft (inferred)**.

### A9. What instasure should copy or beat
1. Copy the 3-level `/product/province/city` architecture, but **go wider**: every ON city Sonnet skips (Brampton, Vaughan, Markham, London, Kitchener-Waterloo, Windsor, Oshawa/Durham) and every Atlantic city.
2. Put **tenant and condo city pages** in Alberta and BC, where Sonnet has only province pages.
3. Lead every city page with a **specific cost number** plus a **postal-code (FSA) breakdown**. Competitors' snippets already show FSA-level data (see 2.3), so Sonnet's single number is now table stakes.
4. Build the **calculator layer Sonnet lacks**: cost-by-city estimator, coverage-needs calculator, cancellation-penalty estimator (matching Sonnet), UBI savings estimator, and bundle-savings calculator.
5. Use **question-title FAQ pages** for "is X mandatory in {province}" and "how to get X in {province}", across all 10 provinces and all products.
6. Publish **bilingual Québec pages** with "soumission" in the title ("Assurance auto {Ville} : soumission en ligne").

---

## PART B: Local SERP landscape

### 2.1 SERPs captured (order as returned; top 5 in bold)

**Toronto, "car insurance Toronto"**
1. **westernfinancialgroup.ca/car-insurance/ontario/toronto**: "Car Insurance Toronto"
2. **ratehub.ca/blog/average-car-insurance-toronto/**: "How much is car insurance in Toronto?"
3. **sonnet.ca/auto-insurance/ontario/toronto**: "Car Insurance in Toronto: Quote and Buy Online"
4. **mychoice.ca/insurance/car/toronto/**: "Cheap Car Insurance for Toronto Drivers"
5. **onlia.ca/car-insurance/ontario/toronto**: "Save more on car insurance in Toronto — Onlia Insurance"
6. wealthnorth.ca/insurance/car-insurance-toronto/: "Car Insurance Toronto: Average Rates, Best Companies & How to Save (2026)"
7. hellosafe.ca/en/car-insurance/ontario/toronto: "Car Insurance Toronto: Compare free quotes for 2026"
8. sharpinsurance.ca/toronto/auto-insurance/: "Car Insurance Toronto"
9. thinkinsure.ca/car-insurance/toronto-quote.php: "Cheap Toronto Car Insurance Quotes"
- Snippet data: averages quoted from $2,044 to $2,952/yr; neighbourhood ranges from The Beaches ($1,900–2,400) to Jane & Finch ($3,000–4,200+); first-time driver ~$354/mo, with G2/G step-downs.

**Toronto, "home insurance Toronto"**
1. **westlandinsurance.ca/home-insurance-toronto/**: "Home Insurance Toronto"
2. **intact.ca/en/personal-insurance/home/house-insurance/ontario/toronto**: "Home Insurance in Toronto"
3. **youset.ca/en/home-insurance/location/ontario/toronto/**: "Toronto homeowners insurance"
4. **squareone.ca/home/ontario/toronto**: "Home Insurance In Toronto From $15/Month"
5. **ratehub.ca/insurance/home/toronto**: "Compare Toronto Home Insurance Quotes & Save Today"
6. rates.ca/insurance-quotes/home/toronto: "Get the Best Toronto Home Insurance Quotes"
7. policyme.com/home-insurance/home-insurance-toronto: "The Best Home Insurance in Toronto"
8. thinkinsure.ca/home-insurance/toronto-quotes.php: "Compare Toronto's Best Home Insurance Quotes - ThinkInsure"
9. insureye.com/home-insurance-toronto/: "Home Insurance Toronto"
- Snippet data: $2,296/yr (Q2 2026), ~$191/mo.

**Brampton, "car insurance Brampton"**
1. **mychoice.ca/insurance/car/brampton/**: "Affordable Car Insurance in Brampton from $220/month"
2. **ratehub.ca/insurance/car/brampton**: "Compare Brampton Car Insurance Quotes & Save Today"
3. **ratehub.ca/blog/how-much-is-car-insurance-in-brampton/**: "How much is car insurance in Brampton?"
4. **rates.ca/insurance-quotes/auto/brampton**: "Cheap Car Insurance Brampton"
5. **lowestrates.ca/insurance/auto/brampton**: "Brampton Car Insurance: Cheap Rates, Instant Quotes, Online"
6. thinkinsure.ca/car-insurance/brampton-quote.php: "Cheap Brampton Car Insurance Quotess" (typo in live title)
7. surex.com/insurance/auto-car/brampton: "Brampton Car Insurance - Start Your Online Quotepton, ON" (garbled title)
8. dulibaninsurance.com/brampton-car-insurance/: "Cheap Brampton Car Insurance"
9. insurdinary.ca/insurance/car/brampton-auto-insurance/: "Brampton Auto Insurance - Insurdinary"
- Snippet data: $3,802/yr (Mar 2026), the most expensive city in the GTA, ~$317/mo, 31% above the ON average of $221/mo. FSA L6P is cheapest at $3,620.

**Brampton, "home insurance Brampton"**
1. **acera.ca/coverage/brampton-home-insurance/**: "Home Insurance Brampton"
2. **lowestrates.ca/insurance/home/brampton**: "Brampton Home Insurance: Cheap Rates, Instant Quotes, Online"
3. **squareone.ca/home/ontario/brampton**: "Home Insurance In Brampton From $15/Month"
4. **ratehub.ca/insurance/home/brampton**: "Compare Brampton Home Insurance Quotes & Save Today"
5. **rates.ca/insurance-quotes/home/brampton**: "Get the Best Brampton Home Insurance Quotes"
6. thinkinsure.ca/home-insurance/brampton-quotes.php: "Brampton Home Insurance"
7. thinkinsure.ca/insurance-broker/brampton.php: "Brampton Insurance Broker"
8. htwilsoninsurance.ca/home-insurance: "Condo Apartment Brampton"
9. htwilsoninsurance.ca/: "Home Auto Brampton| Home"
- Snippet data: $1,619/yr (Q1 2026) vs an ON average of $1,796.

**Mississauga, "car insurance Mississauga"**
1. **sonnet.ca/auto-insurance/ontario/mississauga**: "Car Insurance in Mississauga"
2. **rates.ca/insurance-quotes/auto/mississauga**: "Compare Mississauga Car Insurance Quotes"
3. **ratehub.ca/blog/how-much-is-car-insurance-in-mississauga/**: "How much is car insurance in Mississauga?"
4. **onlia.ca/car-insurance/mississauga**: "Save more on car insurance in Mississauga — Onlia Insurance"
5. **thinkinsure.ca/car-insurance/mississauga-quote.php**: "Mississauga Car Insurance Quotes"
6. surex.com/insurance/auto/mississauga: "Car Insurance in Mississauga - Discounts and Coverage"
7. dulibaninsurance.com/mississauga-car-insurance/: "Cheap Mississauga Car Insurance"
8. acumeninsurance.com/mississauga/car-insurance/: "Car Insurance in Mississauga, Ontario"
9. insureye.com/car-insurance-mississauga/: "Car Insurance Mississauga"
- Snippet data: $3,078/yr (2026), "16.02% higher than the provincial average of $2,653", "173rd out of 181 Ontario communities"; FSA L5K $2,737 vs L4T $3,937; $200k minimum liability.

**Mississauga, "home insurance Mississauga"**
1. **mychoice.ca/insurance/home/mississauga/**: "Affordable Home Insurance in Mississauga from $104/month"
2. **westlandinsurance.ca/mississauga-home-insurance/**: "Mississauga Home Insurance"
3. **squareone.ca/home/ontario/mississauga**: "Home Insurance In Mississauga From $15/Month"
4. **rates.ca/insurance-quotes/home/mississauga**: "Find the Best Home Insurance Quotes in Mississauga"
5. **onlia.ca/home-insurance/mississauga**: "Save more on home insurance in Mississauga — Onlia Insurance"
6. ratehub.ca/insurance/home/mississauga · 7. morisoninsurance.ca/areas-we-serve/mississauga/home-insurance/ · 8. thinkinsure.ca/home-insurance/mississauga-quotes.php · 9. insureye.com/home-insurance-mississauga/
- Snippet data: $1,250/yr (one source) vs $2,064/yr (Q2 2026, another source).

**Ottawa, "car insurance Ottawa"**
1. **ratehub.ca/blog/how-much-is-car-insurance-in-ottawa/**: "How much is car insurance in Ottawa?"
2. **westlandinsurance.ca/ottawa-auto-insurance/**: "Auto Insurance Ottawa"
3. **squareone.ca/auto/ontario/ottawa**: "Auto Insurance In Ottawa From $120/Month"
4. **rates.ca/insurance-quotes/auto/ottawa**: "Car Insurance Ottawa"
5. **mychoice.ca/insurance/car/ottawa/**: "Cheap Car Insurance in Ottawa: Get a Quote in Minutes"
6. sharpinsurance.ca/ottawa/car-insurance/ · 7. surex.com/insurance/auto-car/ottawa: "Car Insurance in Ottawa - What Affects Your Rates" · 8. insurancehotline.com/car-insurance-quotes-ottawa: "Car Insurance Ottawa: Compare & Get Your Cheapest Quote" · 9. thinkinsure.ca/car-insurance/ottawa-quote.php: "Compare Ottawa Car Insurance Quotes & Save - ThinkInsure"
- Snippet data: rolling 12-month average $1,886/yr, +7.5% from 2024 to 2025. By age: ≤25 $1,967, 25–50 $1,935, 50+ $1,581. Sonnet's Ottawa page is **absent**.

**Ottawa, "home insurance Ottawa"**
1. **brokerlink.ca/insurance/home/ottawa**: "Home Insurance in Ottawa"
2. **squareone.ca/home/ontario/ottawa**: "Home Insurance In Ottawa From $15/Month"
3. **rates.ca/insurance-quotes/home/ottawa**: "Get the Best Ottawa Home Insurance Quotes"
4. **insurancehotline.com/home-insurance-quotes-ottawa**: "Ottawa Home Insurance Quotes: Compare & Get the Cheapest Quote"
5. **sharpinsurance.ca/ottawa/home-insurance/**: "Home Insurance Ottawa"
6. thinkinsure.ca/home-insurance/ottawa-quotes.php · 7. insurely.ca/home-insurance-ottawa · 8. surex.com/insurance/home/ottawa: "Home Insurance in Ottawa ON - Fast Quotes and Savings" · 9. mcdougallinsurance.com/ottawa/home-insurance/: "Best Home Insurance in Ottawa"
- Snippet data: $2,163/yr (Q2 2026) or $1,757/yr. FSA K1S $1,691 vs K1K $2,973. Rideau River flood plain and overland water are the local angle.

**Hamilton, "car insurance Hamilton Ontario"**
1. **westernfinancialgroup.ca/car-insurance/ontario/hamilton**: "Car Insurance in Hamilton, Ontario"
2. **rates.ca/insurance-quotes/auto/hamilton**: "Cheap Car Insurance" (**no city in the title**)
3. **isure.ca/ontario-car-insurance/hamilton/**: "Car Insurance Broker Hamilton - Get a FREE Quote - isure"
4. **onlia.ca/car-insurance/ontario/hamilton**: "Save more on car insurance in Hamilton — Onlia Insurance"
5. **mychoice.ca/insurance/car/hamilton/**: "Cheap Car Insurance in Hamilton: Get a Quote in Minutes"
6. insurancehotline.com/car-insurance-quotes-hamilton: "Cheapest Car Insurance Quotes in Hamilton: Quote Online & Save" · 7. surex.com/insurance/auto-car/hamilton: "Hamilton Car Insurance - Pricing and Coverage" · 8. dulibaninsurance.com/hamilton-car-insurance/ · 9. acumeninsurance.com/hamilton/car-insurance/
- Snippet data: $2,457/yr (2026), 7.4% below the ON average of $2,653, 161st of 181. FSA L9H $2,046 vs L8K $2,594. Sonnet's Hamilton page is **absent**.

**Hamilton, "home insurance Hamilton Ontario"**
1. **mychoice.ca/insurance/home/hamilton/**: "Affordable Home Insurance in Hamilton from $103/month"
2. **rates.ca/insurance-quotes/home/hamilton**: "Compare Hamilton Home Insurance Quotes"
3. **ratehub.ca/insurance/home/hamilton**: "Compare Hamilton Home Insurance Quotes & Save Today"
4. **morisoninsurance.ca/hamilton/home-insurance/**: "Home Insurance in Hamilton"
5. **thinkinsure.ca/home-insurance/hamilton-quotes.php**: "Hamilton Home Insurance"
6. surex.com/insurance/home/hamilton: "Home Insurance in Hamilton ON - Local Rates and Quotes" · 7. acumeninsurance.com/hamilton/home-insurance/ · 8. lawriegroup.com/home-insurance-hamilton/: "Home Insurance Broker Hamilton" · 9. insureye.com/home-insurance-hamilton/
- Snippet data: $2,161/yr (Q2 2026), $1,378 or $1,235 in other sources. FSA L9K $1,922 vs L8V $2,307. ON average $2,235. Discounts: multi-line 11.4%, claims-free 16.5%.

### 2.2 Domain frequency across the 10 captured SERPs

| Domain | Appearances (of 10) | Top-5 hits | City URL pattern seen |
|---|---|---|---|
| thinkinsure.ca | 9 | 2 | `/car-insurance/{city}-quote.php`, `/home-insurance/{city}-quotes.php`, `/insurance-broker/{city}.php` |
| rates.ca | 9 | 8 | `/insurance-quotes/{auto\|home}/{city}` |
| ratehub.ca | 8 | 7 | `/insurance/{car\|home}/{city}` + `/blog/how-much-is-car-insurance-in-{city}/` |
| mychoice.ca | 6 | 6 | `/insurance/{car\|home}/{city}/` |
| surex.com | 6 | 0 | `/insurance/{auto-car\|auto\|home}/{city}` |
| squareone.ca | 5 | 5 | `/{home\|auto}/{province}/{city}` |
| onlia.ca | 4 | 4 | `/car-insurance/ontario/{city}` and `/car-insurance/{city}` (inconsistent) |
| insureye.com | 4 | 0 | `/{product}-insurance-{city}/` |
| westlandinsurance.ca | 3 | 3 | `/home-insurance-{city}/`, `/{city}-auto-insurance/` |
| sharpinsurance.ca | 3 | 1 | `/{city}/{product}-insurance/` |
| insurancehotline.com | 3 | 1 | `/{car\|home}-insurance-quotes-{city}` |
| dulibaninsurance.com, acumeninsurance.com | 3 each | 0 | |
| westernfinancialgroup.ca | 2 | 2 | `/car-insurance/ontario/{city}` |
| sonnet.ca | 2 | 2 | `/auto-insurance/ontario/{city}` |
| lowestrates.ca | 2 | 2 | `/insurance/{auto\|home}/{city}` |
| morisoninsurance.ca | 2 | 1 | |
| Once each | intact.ca, youset.ca, policyme.com, brokerlink.ca, acera.ca, isure.ca (all top 5); wealthnorth.ca, hellosafe.ca, insurdinary.ca, htwilsoninsurance.ca, insurely.ca, mcdougallinsurance.com, lawriegroup.com | | |

**Pattern:** the 5 big-city ON car and home SERPs are **saturated by aggregators** (rates.ca, ratehub, mychoice, squareone, thinkinsure, lowestrates) plus Sonnet and Onlia as direct carriers. I saw **no forums, directories or generic national pages** in any of the 10. Every result was a city-specific commercial page. The weakness is in quality signals, not missing pages.

### 2.3 Title-formula families in local SERPs

| Family | Examples |
|---|---|
| Price anchor ("from $X/month") | mychoice "Affordable Car Insurance in Brampton from $220/month", squareone "Home Insurance In {City} From $15/Month", "Auto Insurance In Ottawa From $120/Month" |
| Compare & save | ratehub "Compare {City} Home Insurance Quotes & Save Today", rates.ca "Compare {City} Car Insurance Quotes", "Get the Best {City} Home Insurance Quotes" |
| Cheap / cheapest | rates.ca "Cheap Car Insurance {City}", thinkinsure "Cheap {City} Car Insurance Quotes", insurancehotline "Cheapest Car Insurance Quotes in {City}: Quote Online & Save" |
| Cost question (informational, ranking for a commercial head term) | ratehub blog "How much is car insurance in {City}?", **#1 in Ottawa**, #2–3 in Toronto, Brampton and Mississauga |
| Quote & buy (direct carrier) | Sonnet "Car Insurance in {City}: Quote and Buy Online", Onlia "Save more on car insurance in {City} — Onlia Insurance" |
| Year-stamped guide | wealthnorth "Car Insurance Toronto: Average Rates, Best Companies & How to Save (2026)", hellosafe "…Compare free quotes for 2026" |
| Broker / local | "Car Insurance Broker Hamilton - Get a FREE Quote", "Home Insurance Broker Hamilton", "Brampton Insurance Broker" |
| Angle suffix | surex "{Product} in {City} - Discounts and Coverage / What Affects Your Rates / Pricing and Coverage / Local Rates and Quotes / Fast Quotes and Savings" |

**Data bar set by snippets:** FSA-level premiums (L6P, L5K/L4T, K1S/K1K, L9H/L8K, L9K/L8V), community rank ("173rd out of 181 Ontario communities"), percent vs the provincial average, quarter-dated averages ("Q2 2026"), neighbourhood ranges, age bands, and discount percentages. A new site's city page needs **at least this depth**. The snippets did not say which domain each figure came from.

### 2.4 Weak spots and niche gaps (captured SERPs)

| SERP | Weakness evidence | Gap rating |
|---|---|---|
| Hamilton car | #2 rates.ca has the generic title "Cheap Car Insurance"; #3 isure, #8 duliban and #9 acumen are small brokers; Sonnet's page does not rank | **Medium (best car opening seen)** |
| Brampton home | #1 is a regional broker (acera); #7 is a duplicate thinkinsure broker page; #8–9 are htwilson pages with malformed titles ("Condo Apartment Brampton", "Home Auto Brampton\| Home") | **Medium** |
| Ottawa home | No ratehub or mychoice in the results; 5 of 9 are local brokers (brokerlink, sharp, insurely, mcdougall, thinkinsure) | **Medium** |
| Hamilton home | 4 of 9 are local brokers (morison, acumen, lawriegroup, insureye) | Medium |
| Brampton car | Title defects at #6 ("Quotess") and #7 ("Quotepton, ON"); ratehub holds 2 slots (cannibalization). Top 5 still strong. | Low–medium |
| Toronto car / home, Mississauga car / home, Ottawa car | Strong aggregators and carriers in the top 5 | Low (hard) |

General observations:
- **Home SERPs are softer than car SERPs.** Local brokers hold #1 in Toronto home (westland), Brampton home (acera) and Ottawa home (brokerlink).
- **Intent mismatch:** informational "how much" posts rank #1–3 for commercial city terms. A page that combines a **cost calculator, FSA cost table and quote CTA** should satisfy both intents (inferred).
- **Legacy `.php` URLs** (thinkinsure) and inconsistent paths (onlia) point to older templates.

### 2.5 Life insurance city SERPs (indirect evidence only)
I ran no life-insurance city SERPs. A sibling agent's log (`research/_raw_log.md`) lists PolicyAdvisor URLs from search results:
- City pages: `policyadvisor.com/life-insurance/ontario/{toronto,brampton,ottawa,mississauga,hamilton,scarborough}/`, titled "Best Life Insurance in {City} (2025)"; `/life-insurance/british-columbia/vancouver/`, titled "Best Life Insurance in Vancouver (**2024**)".
- Province hubs: `/life-insurance/{ontario,alberta,british-columbia,manitoba}/` plus `-advisor/` variants.
- The log notes PolicyAdvisor is licensed **only in ON, BC, AB and MB**, with **no QC, Atlantic or SK pages**.
- **Implications (inferred):** life city pages from the main life lead-gen competitor carry **stale year stamps** (2024/2025 in Oct 2026), and **Calgary, Edmonton, Winnipeg (city page), Saskatoon, Regina, Halifax, Moncton, St. John's and Montréal ("assurance vie")** have no PolicyAdvisor city page. These are likely gaps; verify with searches.

### 2.6 Cities and products NOT searched (search cap reached)
- **Car and home:** Vaughan, Markham, London ON, Kitchener-Waterloo, Windsor, Oshawa/Durham, Barrie, Calgary, Edmonton, Vancouver, Surrey, Burnaby, Winnipeg, Saskatoon, Regina, Montréal, Québec City, Laval, Halifax, Moncton, St. John's.
- **Life and business:** all of the top 8.
- **Tenant:** all cities.

Hypotheses to test next (all **inferred**, none observed):
- The aggregator city templates seen above probably extend to other ON cities. Sonnet does **not** have Vaughan, Markham, London, Kitchener, Windsor or Oshawa auto pages.
- Calgary and Edmonton car SERPs should have no Sonnet (no AB auto).
- BC, MB and SK car SERPs should be dominated by ICBC, MPI and SGI and their brokers.
- Atlantic city SERPs (Moncton, St. John's) are likely thinner, with fewer aggregator city pages.
- Business-insurance city SERPs are likely broker-heavy and the least templated.

---

## 3. Province facts that shape the keyword landscape

| Province | Auto system | Implication for an instasure keyword plan | Source in this run |
|---|---|---|---|
| **Ontario** | Private, mandatory. Snippets: $200k minimum liability; mandatory TPL, accident benefits, uninsured motorist and DCPD; rates regulated by FSRA (snippet spelled it "FRSA"). Ontario has the highest premiums (Brampton ~$3,802/yr). | Highest-value auto city keywords and the most competition. FSA and neighbourhood-level content is expected. | Snippets from the Brampton, Mississauga, Hamilton and Ottawa SERPs |
| **Alberta** | Private auto **(background, unverified:** the province has announced a move to a "care-first" no-fault model**)**. Sonnet does no auto here. Hail coverage is optional and "highly recommended". | Car city pages compete without Sonnet. Home keywords about hail are a local angle. | Sonnet AB page snippet; reform is background |
| **British Columbia** | **ICBC** public basic Autoplan; private insurers mainly sell optional coverage **(background, unverified)**. | "Car insurance Vancouver/Surrey/Burnaby" has low lead-gen value. Prioritise home, condo/strata, tenant and **earthquake** (Sonnet lists earthquake as optional in BC). | Earthquake: Sonnet BC snippet. ICBC: background |
| **Manitoba** | **MPI** Autopac, public basic **(background, unverified)** | Deprioritise car in Winnipeg; focus on home, tenant, life and business. | Background |
| **Saskatchewan** | **SGI** Auto Fund, public basic **(background, unverified)** | Deprioritise car in Saskatoon and Regina; focus on home, tenant, life and business. | Background |
| **Québec** | **Hybrid**: SAAQ covers bodily injury; private insurers cover civil liability and property damage. | Separate FR keyword set: "assurance auto", "assurance habitation", "assurance locataire", "assurance vie", and **"soumission"** (= quote, used in Sonnet's FR titles). "SAAQ" itself is a content keyword (Sonnet has 3+ SAAQ posts). | Sonnet QC results |
| **NS, NB, PEI, NL** | Private auto **(background for NL; Sonnet confirms NS, NB and PEI)**. Sonnet sells auto in NS, NB and PEI, but **not NL**. | Halifax and Moncton are open (Sonnet has province pages only). **St. John's has no Sonnet presence at all.** NB has a bilingual angle ("assurance habitation Nouveau-Brunswick", which Sonnet has). | Sonnet results; NL is background |

Home insurance is not legally required anywhere (snippets). Lenders require it, and landlords commonly require tenant insurance (Sonnet FAQ snippets for AB and QC). Both are "is it mandatory in {province}" FAQ keywords.

---

## 4. Canadian keyword-volume references
**None collected.** The search cap was reached before I ran volume queries. I have **not** listed any volume figures or source URLs, to avoid inventing data.

---

## 5. Query list to finish Part B (once the search budget is raised)
- `car insurance {City}` and `home insurance {City}` for Vaughan, Markham, "London Ontario", Kitchener, Waterloo, Windsor, Oshawa, Durham, Barrie, Calgary, Edmonton, Vancouver, Surrey, Burnaby, Winnipeg, Saskatoon, Regina, Halifax, Moncton, "St. John's Newfoundland"
- FR: `assurance auto Montréal`, `assurance habitation Montréal`, `assurance auto Québec`, `assurance habitation Laval`, `assurance vie Montréal`
- Life (top 8): `life insurance Toronto|Brampton|Mississauga|Ottawa|Calgary|Edmonton|Vancouver|Montreal`
- Business (top 8): `business insurance Toronto|…`, `small business insurance Calgary`, `assurance entreprise Montréal`
- Tenant: `tenant insurance Toronto|Calgary|Vancouver|Halifax`
- Volumes: `"car insurance" monthly search volume Canada`, `insurance keywords Canada search volume`, `most searched insurance keywords Canada`, `"assurance auto" volume de recherche`

---

## 6. Raw notes
- `research/notes_raw.md`: every Sonnet URL and title seen
- `research/serp_raw.md`: raw SERP captures
