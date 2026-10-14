# Competitive SEO Research: Ratehub.ca and Rates.ca (Insurance)

Prepared for: instasure.ca (Canadian insurance lead-gen)
Date: 2026-10-03
Method: About 56 WebSearch queries (`site:` operators, `allowed_domains` filters, city/product keyword queries). Direct fetching of competitor pages and web.archive.org was blocked by the proxy. The session's shared web-search budget ran out after about 56 queries, so some planned checks were not run. See "Coverage limits" at the end.

**Rules used in this file**
- Every URL listed was **seen in search results**, and the title shown is the one the search engine displayed.
- Anything not directly seen is marked **(inferred)** or **(not seen)**.
- Dollar figures come from search-result snippets and summaries of the competitor pages. Treat them as "what the competitor publishes", not as verified market data.

---

## 0. TL;DR: key patterns

| | **Ratehub.ca** | **Rates.ca** |
|---|---|---|
| Insurance root | `/insurance` | `/insurance-quotes` |
| Car city pattern | `/insurance/car/{city}` | `/insurance-quotes/auto/{city}` |
| Car province pattern | `/insurance/car/{province}` (same folder as cities) | `/insurance-quotes/auto/{province}` (same folder as cities) |
| Home | `/insurance/home/{city-or-province}` | `/insurance-quotes/home/{city-or-province}` |
| Tenant | `/insurance/renters-insurance/{city}` | `/insurance-quotes/tenant/{city}` |
| Condo | `/insurance/condo-insurance` (no city pages seen) | `/insurance-quotes/condo/{city}` |
| Life | `/insurance/life/{type}` | `/insurance-quotes/life` (thin) |
| Business | `/insurance/business/{coverage}` | `/insurance-quotes/business/{category}/{profession}` (deep tree) |
| Car niche (persona/vehicle) | Mixed: `/insurance/car/{niche}` and `/insurance/{niche}` | `/insurance-quotes/auto/{coverage-or-persona}` + `/guides/car-insurance/{topic}` |
| Car brand | `/insurance/car/{brand}` + hub `/insurance/car/brand` | (not seen) |
| City hub | `/insurance/car/city` | (not seen) |
| Insurer pages | `/insurance/companies/{insurer}` | `/insurance-companies/{insurer}` |
| Broker-by-city | (not seen) | `/insurance-quotes/auto/{city}-insurance-brokers` |
| Editorial | `/blog/{slug}/` | `/resources/{slug}`, `/guides/{product}/{topic}` |
| Calculators | "car insurance calculator" wording in page copy; no standalone URL seen | `/car-insurance-calculator` (ON), `/car-insurance-calculator/alberta`, `/home-insurance-calculator/alberta` |
| Data/report pages | Blog posts ("How much is car insurance in {City}?") + survey posts | Root-level report pages (`/home-insuramap-report-2025`, `/dangerous-drivers-2025-report`, `/annual-best-auto-insurance-study-2026`) + interactive "Insuramap" (FSA-level) |
| Strength | Wider national city coverage (Atlantic, Prairies, Quebec), brand pages, persona pages | Deep Ontario/GTA coverage (sub-municipalities like Scarborough, Etobicoke, North York), FSA postal-code data, affordability rank "Nth of 181", business-by-profession tree |

---

## 1. RATEHUB.CA: full URL inventory (seen in SERPs)

### 1.1 Insurance hubs and product roots
| URL | SERP title |
|---|---|
| https://www.ratehub.ca/insurance | Compare Cheap Insurance Quotes in Canada |
| https://www.ratehub.ca/insurance/best-car-insurance-quote | Compare Car Insurance Quotes Online & Start Saving (also shown as "Compare car insurance quotes online & start saving today") |
| https://www.ratehub.ca/insurance/best-home-insurance-quote | Compare Home Insurance Quotes Online & Start Saving |
| https://www.ratehub.ca/insurance/home/homeowners-insurance | Compare Home Insurance Quotes Online & Start Saving (duplicate title with the page above) |
| https://www.ratehub.ca/insurance/renters-insurance | Tenant Insurance: Compare Cheap Renters Insurance Quotes |
| https://www.ratehub.ca/insurance/condo-insurance | Compare Condo Insurance Quotes in Canada For Free |
| https://www.ratehub.ca/insurance/rental-income-property-insurance | Landlord Insurance & Rental Property Insurance Quotes |
| https://www.ratehub.ca/insurance/life | Compare Life Insurance Quotes for Free in Canada - Ratehub.ca |
| https://www.ratehub.ca/insurance/travel | How to find the best travel insurance for Canadians |
| https://www.ratehub.ca/insurance/motorcycle-insurance | Compare Motorcycle Insurance Quotes for Free |
| https://www.ratehub.ca/insurance/business | Compare Commercial & Small Business Insurance Quotes |
| https://www.ratehub.ca/insurance/home-and-auto-bundle | Bundle and Save on Car and Home Insurance |
| https://www.ratehub.ca/insurance/home-insurance-basics | How Home Insurance Works in Canada |
| https://www.ratehub.ca/insurance/types-of-car-insurance | Types of car insurance in Canada |
| https://www.ratehub.ca/insurance/how-to-save-on-car-insurance | How to Save on Car Insurance in Canada in Canada - Ratehub.ca *(title bug: "in Canada" twice)* |
| https://www.ratehub.ca/insurance/car/education | Auto Insurance in Canada: Educational Resources |
| https://www.ratehub.ca/insurance/car/city | Compare Auto Insurance Quotes by City *(city hub page)* |
| https://www.ratehub.ca/insurance/car/brand | Compare Auto Insurance Quotes by Car Brand *(brand hub page)* |
| https://www.ratehub.ca/insurance/companies | The Best P&C Insurance Companies in Canada |
| https://pingu.ratehub.ca/insurance/car/toronto | Compare the Best Toronto Car Insurance Quotes for Free *(a staging/test subdomain that is indexed; tech-SEO leak)* |

### 1.2 Car insurance: province pages (`/insurance/car/{province}`)
| URL | SERP title |
|---|---|
| https://www.ratehub.ca/insurance/car/ontario | Compare Ontario Car Insurance Quotes Online |
| https://www.ratehub.ca/insurance/car/alberta | Compare Alberta Car Insurance Quotes For Free |
| https://www.ratehub.ca/insurance/car/quebec | Compare Quebec Car Insurance Quotes & Save Today |
| https://www.ratehub.ca/insurance/car/british-columbia | British Columbia car insurance quotes |
| https://www.ratehub.ca/insurance/car/saskatchewan | Compare Saskatchewan Car Insurance Quotes |
| https://www.ratehub.ca/insurance/car/manitoba | Compare Manitoba car insurance quotes |
| https://www.ratehub.ca/insurance/car/nova-scotia | Compare Nova Scotia Car Insurance Quotes |
| https://www.ratehub.ca/insurance/car/new-brunswick | Compare New Brunswick Car Insurance Quotes |
| https://www.ratehub.ca/insurance/car/newfoundland | Compare Newfoundland Car Insurance Quotes |
| https://www.ratehub.ca/insurance/car/prince-edward-island | Compare PEI Car Insurance Quotes |

All 10 provinces are covered. No territory pages were seen.

### 1.3 Car insurance: city pages (`/insurance/car/{city}`), 34 seen
| City | Prov | URL | SERP title |
|---|---|---|---|
| Toronto | ON | https://www.ratehub.ca/insurance/car/toronto | Compare Cheap Toronto Auto Insurance Quotes Online |
| Ottawa | ON | https://www.ratehub.ca/insurance/car/ottawa | Compare Ottawa Car Insurance Quotes & Save Today |
| Mississauga | ON | https://www.ratehub.ca/insurance/car/mississauga | Compare Mississauga Car Insurance Quotes & Save Today |
| Brampton | ON | https://www.ratehub.ca/insurance/car/brampton | Compare Brampton Car Insurance Quotes & Save Today |
| Hamilton | ON | https://www.ratehub.ca/insurance/car/hamilton | Compare Hamilton Car Insurance Quotes & Save Today |
| London | ON | https://www.ratehub.ca/insurance/car/london | Compare London Car Insurance Quotes & Save Today |
| Kitchener | ON | https://www.ratehub.ca/insurance/car/kitchener | Compare Kitchener Car Insurance Quotes & Save Today |
| Waterloo | ON | https://www.ratehub.ca/insurance/car/waterloo | Compare Waterloo Car Insurance Quotes & Save Today |
| Guelph | ON | https://www.ratehub.ca/insurance/car/guelph | Compare Guelph Car Insurance Quotes & Save Today |
| Windsor | ON | https://www.ratehub.ca/insurance/car/windsor | Compare Windsor Car Insurance Quotes & Save Today |
| Oakville | ON | https://www.ratehub.ca/insurance/car/oakville | Compare Oakville Car Insurance Quotes & Save Today |
| Burlington | ON | https://www.ratehub.ca/insurance/car/burlington | Compare Burlington Car Insurance Quotes |
| Markham | ON | https://www.ratehub.ca/insurance/car/markham | Compare Markham Car Insurance Quotes & Save Today |
| Oshawa | ON | https://www.ratehub.ca/insurance/car/oshawa | Compare Oshawa Car Insurance Quotes & Save Today |
| Barrie | ON | https://www.ratehub.ca/insurance/car/barrie | Compare Barrie Car Insurance Quotes & Save Today |
| Brantford | ON | https://www.ratehub.ca/insurance/car/brantford | Compare Brantford Car Insurance Quotes & Save Today |
| Kingston | ON | https://www.ratehub.ca/insurance/car/kingston | Compare Kingston Car Insurance Quotes & Save Today |
| Peterborough | ON | https://www.ratehub.ca/insurance/car/peterborough | Compare Peterborough Car Insurance Quotes & Save Today |
| Sudbury | ON | https://www.ratehub.ca/insurance/car/sudbury | Compare Sudbury Car Insurance Quotes & Save Today |
| Thunder Bay | ON | https://www.ratehub.ca/insurance/car/thunder-bay | Compare Thunder Bay Car Insurance Quotes & Save Today |
| Calgary | AB | https://www.ratehub.ca/insurance/car/calgary | Compare Calgary Car Insurance Quotes & Save Today |
| Edmonton | AB | https://www.ratehub.ca/insurance/car/edmonton | Compare Edmonton Car Insurance Quotes & Save Today |
| Red Deer | AB | https://www.ratehub.ca/insurance/car/red-deer | Compare Red Deer Car Insurance Quotes & Save Today |
| Lethbridge | AB | https://www.ratehub.ca/insurance/car/lethbridge | Compare Lethbridge Car Insurance Quotes & Save Today |
| Vancouver | BC | https://www.ratehub.ca/insurance/car/vancouver | Compare Vancouver Car Insurance Quotes |
| Montreal | QC | https://www.ratehub.ca/insurance/car/montreal | Compare Montreal Car Insurance Quotes & Save Today |
| Winnipeg | MB | https://www.ratehub.ca/insurance/car/winnipeg | Compare Winnipeg Car Insurance Quotes |
| Regina | SK | https://www.ratehub.ca/insurance/car/regina | Compare Regina Car Insurance Quotes |
| Saskatoon | SK | https://www.ratehub.ca/insurance/car/saskatoon | Compare Saskatoon Car Insurance Quotes |
| Halifax | NS | https://www.ratehub.ca/insurance/car/halifax | Compare Halifax Car Insurance Quotes |
| Fredericton | NB | https://www.ratehub.ca/insurance/car/fredericton | Compare Fredericton Car Insurance Quotes |
| Moncton | NB | https://www.ratehub.ca/insurance/car/moncton | Compare Moncton Car Insurance Quotes |
| Saint John | NB | https://www.ratehub.ca/insurance/car/saint-john | Compare Saint John Car Insurance Quotes |
| St. John's | NL | https://www.ratehub.ca/insurance/car/st-johns | Compare St. John's Car Insurance Quotes |

**Not seen for Ratehub** (queried by name, no Ratehub URL came back): Vaughan, Richmond Hill, Scarborough, Etobicoke, North York, Pickering, Ajax, Whitby, Milton, St. Catharines, Niagara Falls, Cambridge, Laval, Gatineau, Quebec City, Sherbrooke, Longueuil, Surrey, Victoria, Burnaby, Airdrie, Sherwood Park, Charlottetown. Ratehub cites Vaughan, Airdrie and Sherwood Park figures only inside a blog ranking post.

### 1.4 Car insurance: persona, vehicle and coverage niche pages
| URL | SERP title |
|---|---|
| https://www.ratehub.ca/insurance/car-insurance-high-risk | Compare high-risk auto insurance quotes in Canada |
| https://www.ratehub.ca/insurance/car-insurance-student | Compare Cheaper Student Car Insurance Quotes |
| https://www.ratehub.ca/insurance/car/young-drivers-car-insurance | Compare Young Driver's Car Insurance Quotes |
| https://www.ratehub.ca/insurance/car/senior-car-insurance | The Best Car Insurance for Seniors in Canada |
| https://www.ratehub.ca/insurance/car/newcomer-car-insurance | Car Insurance for Immigrants & Newcomers to Canada |
| https://www.ratehub.ca/insurance/car/electric-car-insurance | Get Electric Car Insurance Quotes in Canada |
| https://www.ratehub.ca/insurance/car/hybrid-car-insurance | Compare Hybrid Car Insurance Quotes in Canada |
| https://www.ratehub.ca/insurance/car/gap-insurance | Gap Insurance: Get Vehicle Replacement Coverage Quotes |
| https://www.ratehub.ca/insurance/car/low-rate-car-insurance | Compare Low Rate Car Insurance Quotes |
| https://www.ratehub.ca/insurance/classic-car-insurance | Compare Classic Car Insurance Quotes |
| https://www.ratehub.ca/insurance/sports-car-insurance | Compare Sports Car Insurance Quotes |

Note the inconsistent folder use: some niches are under `/insurance/car/` and others directly under `/insurance/`.

### 1.5 Car insurance: brand pages (`/insurance/car/{brand}`)
| URL | SERP title |
|---|---|
| https://www.ratehub.ca/insurance/car/toyota | Compare Toyota Car Insurance Quotes for Free |
| https://www.ratehub.ca/insurance/car/honda | Compare Honda Car Insurance Quotes for Free |
| https://www.ratehub.ca/insurance/car/nissan | Compare Nissan Car Insurance Quotes for Free |
| https://www.ratehub.ca/insurance/car/hyundai | Compare Hyundai Car Insurance Quotes for Free |
| https://www.ratehub.ca/insurance/car/ford | Compare Ford Car Insurance Quotes For Free |

The hub at `/insurance/car/brand` probably links to more brands (inferred), but only these 5 were seen. **No model-level pages** (e.g. `/honda/civic`) were seen. Model data appears only as tables on the brand pages.

### 1.6 Motorcycle
| URL | SERP title |
|---|---|
| https://www.ratehub.ca/insurance/motorcycle-insurance/ontario | Compare Cheap Motorcycle Insurance Quotes in Ontario |
| https://www.ratehub.ca/insurance/motorcycle-insurance/alberta | Compare Cheap Motorcycle Insurance Quotes in Alberta |

### 1.7 Home insurance (`/insurance/home/{geo}`)
| URL | SERP title |
|---|---|
| https://www.ratehub.ca/insurance/home/ontario | Compare Cheap Ontario Home Insurance Quotes & Save |
| https://www.ratehub.ca/insurance/home/alberta | Compare Cheap Alberta Home Insurance Quotes & Save |
| https://www.ratehub.ca/insurance/home/nova-scotia | Compare Nova Scotia Home Insurance Quotes & Save Today |
| https://www.ratehub.ca/insurance/home/calgary | Compare Calgary Home Insurance Quotes & Save Today |
| https://www.ratehub.ca/insurance/home/edmonton | Compare Edmonton Home Insurance Quotes & Save Today |
| https://www.ratehub.ca/insurance/home/vancouver | Compare Vancouver Home Insurance Quotes & Save Today |
| https://www.ratehub.ca/insurance/home/winnipeg | Compare Winnipeg Home Insurance Quotes & Save Today |
| https://www.ratehub.ca/insurance/home/mississauga | Compare Mississauga Home Insurance Quotes & Save Today |
| https://www.ratehub.ca/insurance/home/hamilton | Compare Hamilton Home Insurance Quotes & Save Today |
| https://www.ratehub.ca/insurance/home/windsor | Compare Windsor Home Insurance Quotes & Save Today |
| https://www.ratehub.ca/insurance/home/builders-risk-insurance | Builder's Risk: Course of Construction Insurance for Canadians |

A Toronto or Ottawa home page probably exists (inferred) but was not seen in results.

### 1.8 Tenant / renters (`/insurance/renters-insurance/{geo}`)
| URL | SERP title |
|---|---|
| https://www.ratehub.ca/insurance/renters-insurance/ontario | Get Cheap Tenant Insurance Quotes in Ontario |
| https://www.ratehub.ca/insurance/renters-insurance/toronto | Get Cheap Tenant Insurance in Toronto |
| https://www.ratehub.ca/insurance/renters-insurance/calgary | Get Cheap Tenant Insurance in Calgary |
| https://www.ratehub.ca/insurance/renters-insurance/edmonton | Get Cheap Tenant Insurance in Edmonton |

### 1.9 Condo
Only the root `/insurance/condo-insurance` was seen. **No condo city pages were seen.**

### 1.10 Life (`/insurance/life/{type}`)
| URL | SERP title |
|---|---|
| https://www.ratehub.ca/insurance/life/term-life-insurance | Compare Term Life Insurance Quotes in Canada |
| https://www.ratehub.ca/insurance/life/whole-life-insurance | Compare Whole Life Insurance Quotes in Canada |
| https://www.ratehub.ca/insurance/life/universal-life-insurance | Get Universal Life Insurance Quotes in Canada |
| https://www.ratehub.ca/insurance/life/types-of-life-insurance | Types of Life Insurance in Canada |
| https://www.ratehub.ca/insurance/life/what-is-life-insurance | How life insurance works in Canada |

Not seen: mortgage life, critical illness, disability, or life by age, smoker status or city. Ratehub's site copy mentions health and dental insurance, but no URLs were seen.

### 1.11 Travel
| URL | SERP title |
|---|---|
| https://www.ratehub.ca/insurance/travel/visitors-to-canada | Travel Insurance for Visitors to Canada |

Partner: SoNomad. Not seen: super visa, snowbird, or student travel pages.

### 1.12 Business (`/insurance/business/{coverage}`)
| URL | SERP title |
|---|---|
| https://www.ratehub.ca/insurance/business/coverage | Compare Business Insurance Quotes by Coverage Type |
| https://www.ratehub.ca/insurance/business/commercial-general-liability | Get Commercial General Liability Insurance Coverage (CGL) |
| https://www.ratehub.ca/insurance/business/professional-liability-insurance | Get the Best Professional Liability Insurance in Canada |
| https://www.ratehub.ca/insurance/business/product-liability-insurance | Compare Product Liability Insurance Quotes in Canada in Canada - Ratehub.ca *(title bug)* |
| https://www.ratehub.ca/insurance/business/cyber-insurance | Get Cyber Liability Insurance Quotes in Canada |
| https://www.ratehub.ca/insurance/business/business-interruption-insurance | Compare Business Interruption Insurance Quotes in Canada |
| https://www.ratehub.ca/insurance/business/directors-and-officers-liability-insurance | D&O Insurance: Get Directors and Officers Liability Quotes |
| https://www.ratehub.ca/insurance/business/contractor-insurance | Contractor Insurance: Liability Insurance for Contractors |
| https://www.ratehub.ca/insurance/business/non-profit-insurance | Compare Non-Profit Insurance Quotes in Canada |
| https://www.ratehub.ca/insurance/business/fitness-insurance | Compare Personal Trainer & Fitness Insurance Quotes |

### 1.13 Insurer profile pages (`/insurance/companies/{insurer}`)
| URL | SERP title |
|---|---|
| https://www.ratehub.ca/insurance/companies/intact | Intact Insurance Quotes: All You Need to Know |
| https://www.ratehub.ca/insurance/companies/td-insurance | What is TD Insurance: Auto & Home Insurance |
| https://www.ratehub.ca/insurance/companies/rbc-insurance | RBC Insurance: Auto & Home Insurance in Canada |
| https://www.ratehub.ca/insurance/companies/allstate-insurance | Allstate Insurance: Auto & Home Insurance in Canada |
| https://www.ratehub.ca/insurance/companies/sonnet | What is Sonnet Insurance? |
| https://www.ratehub.ca/insurance/companies/travelers | Compare Travelers Insurance Quotes - Auto & Home - Auto & Home - Ratehub.ca *(title bug)* |
| https://www.ratehub.ca/insurance/companies/max | MAX Insurance: Get a Home Insurance Quote |
| https://www.ratehub.ca/insurance/companies/wawanesa | Compare Wawanesa Insurance Quotes - Auto & Home |
| https://www.ratehub.ca/insurance/companies/sgi | Compare SGI Insurance Quotes - Auto & Home |
| https://www.ratehub.ca/insurance/companies/facility-association | Facility Association: High-Risk Auto Insurance in Canada |

### 1.14 Ratehub blog posts seen (`/blog/{slug}/`)
**City cost pages** (these mirror the money pages and are a major ranking asset):
- /blog/average-car-insurance-toronto/: "How much is car insurance in Toronto?"
- /blog/why-is-car-insurance-in-toronto-so-expensive/: "Why is car insurance in Toronto so expensive?"
- /blog/how-much-is-car-insurance-in-brampton/
- /blog/how-much-is-car-insurance-in-mississauga/
- /blog/how-much-is-car-insurance-in-ottawa/
- /blog/how-much-is-car-insurance-in-calgary/
- /blog/how-much-is-car-insurance-in-edmonton/
- /blog/most-expensive-ontario-cities-for-auto-insurance/: "Which Ontario cities have the most expensive auto insurance?"
- /blog/average-home-insurance-cost-calgary/: "The average cost of home insurance in Calgary"
- /blog/average-home-insurance-cost-edmonton/
- /blog/average-home-insurance-cost-alberta/
- /blog/average-cost-of-condo-insurance-ontario/

**Driver persona and licensing:**
- /blog/average-car-insurance-cost-ontario-by-age/: "The Average Cost of Car Insurance in Ontario by Age"
- /blog/how-much-is-insurance-for-a-new-driver-in-ontario/
- /blog/ontario-drivers-license-g1-g2-g/: "An Ontario Driver's Guide to Becoming Fully Licensed"
- /blog/i-got-my-g1-license-what-now/: "Ontario Graduated Licensing Restrictions"

**Vehicle:**
- /blog/top-10-cheapest-cars-to-insure/: "10 cheapest used cars to insure in Canada"
- /blog/the-best-selling-cars-in-canada/
- /blog/why-insurance-matters-when-buying-a-car/
- /blog/get-car-insurance-quote-befre-buying-new-car/ *(typo in slug)*
- /blog/buy-new-or-used-car-insurance/
- /blog/lease-vs-finance-car/
- /blog/how-does-replacement-car-insurance-work/

**Savings and company guides:**
- /blog/how-to-get-cheap-car-insurance/: "15 ways to get cheap car insurance in Canada"
- /blog/best-car-insurance-companies-in-canada/: "The Best Car Insurance Companies in Canada"
- /blog/best-condo-insurance-companies-canada/
- /blog/car-insurance-renewal/: "The Hidden Costs of Car Insurance Renewals"
- /blog/inflation-car-insurance-rates-canada/
- /blog/how-albertas-new-auto-insurance-reforms-aim-for-change/

**Survey and data posts (link magnets):**
- /blog/over-half-of-canadians-are-switching-auto-insurance-providers-due-to-rising-premiums/
- /blog/canadians-missing-car-insurance-discounts-survey/: "57% of Canadians may have missed out on car insurance discounts (survey)"
- /blog/ubi-saves-money-but-87-per-cent-not-trying-survey-data/: "UBI Can Save on Insurance, but 81% of Canadians Have Yet to Try It" *(slug says 87, title says 81)*
- /blog/survey-results-travel-insurance-plans-for-canadians/

**Tenant and condo:**
- /blog/tenant-insurance-what-it-covers-and-why-renters-need-it/
- /blog/student-renters-insurance/
- /blog/tenant-insurance-university-students/: "A Guide to Student Insurance in Canada"
- /blog/how-tenant-insurance-helps-landlords-lower-their-risk/
- /blog/claim-home-tenant-insurance-landlords-renters/: "Can I claim home or tenant insurance on my taxes?"
- /blog/what-is-condo-insurance/9223372036854775807/ *(odd int64-max suffix; tech-SEO bug)*
- /blog/insurance-for-condo-vs-house/
- /blog/how-much-condo-insurance-do-you-actually-need/
- /blog/condo-insurance-what-it-does-and-doesnt-cover/

**Life:**
- /blog/life-insurance-for-tax-and-estate-planning/
- /blog/participating-life-insurance-pros-and-cons/
- /blog/what-is-joint-life-insurance-and-why-do-couples-need-it/

**Travel (news-jacking posts):**
- /blog/annual-multi-trip-travel-insurance-travel-more-often/
- /blog/travel-insurance-global-fuel-shortages/
- /blog/top-credit-cards-for-travel-insurance/
- /blog/cheap-travel-insurance-canada/
- /blog/stop-overpaying-for-travel-insurance-5-expert-tips-to-cut-costs/
- /blog/travel-insurance-world-cup-2026/

**Motorcycle:**
- /blog/cheap-motorcycle-insurance-ontario/
- /blog/motorcycle-insurance-lessons-ive-learned/
- /blog/can-i-cancel-motorcycle-insurance-in-winter/

**Business:**
- /blog/how-much-is-business-insurance-in-canada/
- /blog/types-of-business-insurance/
- /blog/what-does-general-liability-insurance-cover/
- /blog/is-it-illegal-to-not-have-business-insurance/
- /blog/home-based-business-insurance-in-canada/
- /blog/landscaping-insurance/
- /blog/dog-walking-pet-sitting-insurance/ *(the only "pet" content seen; no pet health insurance product)*

---

## 2. RATES.CA: full URL inventory (seen in SERPs)

### 2.1 Hubs and product roots
| URL | SERP title |
|---|---|
| https://rates.ca/ | Compare Insurance, Mortgage Rates & Credit Cards |
| https://rates.ca/insurance-quotes/auto | Compare Car Insurance Quotes - Fast, Easy & Free |
| https://rates.ca/insurance-quotes/home | Compare Home Insurance Quotes in Canada |
| https://rates.ca/insurance-quotes/tenant | Compare Tenant Insurance Quotes: Find the Cheapest Rate |
| https://rates.ca/insurance-quotes/condo | Condo Insurance Quotes |
| https://rates.ca/insurance-quotes/life | Life Insurance |
| https://rates.ca/insurance-quotes/business | Compare Business Insurance Quotes |
| https://rates.ca/insurance-quotes/home-auto-insurance-bundle | Ontario Home & Auto Insurance Quotes 2026 |
| https://rates.ca/insurance-quotes/travel/visitors-to-canada | Travel Insurance for Visitors to Canada |
| https://rates.ca/credit-cards/travel-insurance | The Best Travel Insurance Credit Cards for Canadians in 2024 *(stale year)* |
| https://rates.ca/insurance-companies | Insurance companies / "The Insurance Providers We Work With" |
| https://rates.ca/guides/car-insurance | Car Insurance Guides |
| https://rates.ca/media | Rates.ca in the News |
| https://rates.ca/insurance-quotes/auto?cta=RgkVWM | Car Insurance Quotes *(a parameter URL that is indexed; tech-SEO leak)* |

### 2.2 Calculators
| URL | SERP title |
|---|---|
| https://rates.ca/car-insurance-calculator | Ontario Car Insurance Calculator |
| https://rates.ca/car-insurance-calculator/alberta | Alberta Car Insurance Calculator: Estimate Your Costs |
| https://rates.ca/home-insurance-calculator/alberta | Alberta Home Insurance Calculator: Estimate Your Costs |

Pattern: `/{product}-insurance-calculator/{province}`, with Ontario as the unsuffixed default. An Ontario home calculator was not seen.

### 2.3 Auto: province pages
| URL | SERP title |
|---|---|
| https://rates.ca/insurance-quotes/auto/ontario | Compare Ontario Car Insurance Quotes Online (also shown as "Cheap Ontario Car Insurance Quotes") |
| https://rates.ca/insurance-quotes/auto/alberta | Alberta Car Insurance Quotes: Compare Rates Online |
| https://rates.ca/insurance-quotes/auto/quebec | Compare Quebec Car Insurance Quotes |

No BC, MB, SK, NS, NB, NL or PEI auto pages were seen. Rates.ca covers other provinces only through `/resources/` articles.

### 2.4 Auto: city pages (`/insurance-quotes/auto/{city}`), 34 seen
| City | URL | SERP title |
|---|---|---|
| Toronto | https://rates.ca/insurance-quotes/auto/toronto | Cheap Car Insurance Toronto |
| North York | https://rates.ca/insurance-quotes/auto/north-york | Cheap Car Insurance *(generic title, city name missing)* |
| Scarborough | https://rates.ca/insurance-quotes/auto/scarborough | Cheap Car Insurance Scarborough\| Compare Auto Insurance Quotes Online |
| Etobicoke | https://rates.ca/insurance-quotes/auto/etobicoke | Cheap Car Insurance Etobicoke |
| Mississauga | https://rates.ca/insurance-quotes/auto/mississauga | Compare Mississauga Car Insurance Quotes |
| Brampton | https://rates.ca/insurance-quotes/auto/brampton | Cheap Car Insurance Brampton |
| Vaughan | https://rates.ca/insurance-quotes/auto/vaughan | Cheap Car Insurance in Vaughan |
| Markham | https://rates.ca/insurance-quotes/auto/markham | Cheap Car Insurance in Markham |
| Richmond Hill | https://rates.ca/insurance-quotes/auto/richmond-hill | Compare Richmond Hill Car Insurance Quotes |
| Oakville | https://rates.ca/insurance-quotes/auto/oakville | Compare Car Insurance Quotes in Oakville |
| Burlington | https://rates.ca/insurance-quotes/auto/burlington | Cheap Car Insurance Burlington |
| Milton | https://rates.ca/insurance-quotes/auto/milton | Cheap Car Insurance Milton |
| Pickering | https://rates.ca/insurance-quotes/auto/pickering | Cheap Car Insurance Pickering |
| Ajax | https://rates.ca/insurance-quotes/auto/ajax | Cheap Car Insurance Ajax |
| Whitby | https://rates.ca/insurance-quotes/auto/whitby | Compare Car Insurance Quotes in Whitby |
| Oshawa | https://rates.ca/insurance-quotes/auto/oshawa | Cheap Oshawa Car Insurance |
| Orangeville | https://rates.ca/insurance-quotes/auto/orangeville | Cheap Car Insurance Orangeville |
| Hamilton | https://rates.ca/insurance-quotes/auto/hamilton | Cheap Car Insurance *(generic title)* |
| St. Catharines | https://rates.ca/insurance-quotes/auto/st-catharines | Cheap Car Insurance St. Catharines |
| Niagara Falls | https://rates.ca/insurance-quotes/auto/niagara-falls | Cheap Car Insurance in Niagara Falls |
| Kitchener | https://rates.ca/insurance-quotes/auto/kitchener | Cheap Kitchener Car Insurance |
| Cambridge | https://rates.ca/insurance-quotes/auto/cambridge | Cheap Car Insurance Cambridge |
| Guelph | https://rates.ca/insurance-quotes/auto/guelph | Cheap Car Insurance Guelph |
| London | https://rates.ca/insurance-quotes/auto/london | Cheap London Car Insurance |
| Windsor | https://rates.ca/insurance-quotes/auto/windsor | Compare Windsor Car Insurance Quotes |
| Barrie | https://rates.ca/insurance-quotes/auto/barrie | Cheap Car Insurance in Barrie |
| Kingston | https://rates.ca/insurance-quotes/auto/kingston | Car Insurance ON Kingston |
| Peterborough | https://rates.ca/insurance-quotes/auto/peterborough | Compare Peterborough Car Insurance Quotes |
| Sudbury | https://rates.ca/insurance-quotes/auto/sudbury | Sudbury Car Insurance: Compare Cheap Quotes Today |
| Thunder Bay | https://rates.ca/insurance-quotes/auto/thunder-bay | Cheap Car Insurance Thunder Bay |
| Ottawa | https://rates.ca/insurance-quotes/auto/ottawa | Car Insurance Ottawa |
| Calgary | https://rates.ca/insurance-quotes/auto/calgary | Car Insurance Calgary |
| Edmonton | https://rates.ca/insurance-quotes/auto/edmonton | Compare Edmonton Car Insurance Quotes |
| Vancouver | https://rates.ca/insurance-quotes/auto/vancouver | Vancouver Auto Insurance Page *(weak title)* |

Search summaries included figures for Sault Ste. Marie and Belleville, but **no URL was seen** for either (a page probably exists: inferred).

### 2.5 Auto: "insurance brokers in {city}" pages (`/insurance-quotes/auto/{city}-insurance-brokers`)
| URL | SERP title |
|---|---|
| https://rates.ca/insurance-quotes/auto/toronto-insurance-brokers | Auto Insurance Brokers in Toronto |
| https://rates.ca/insurance-quotes/auto/mississauga-insurance-brokers | Auto Insurance Brokers in Mississauga |
| https://rates.ca/insurance-quotes/auto/ottawa-insurance-brokers | Auto Insurance Brokers in Ottawa |
| https://rates.ca/insurance-quotes/auto/kitchener-insurance-brokers | Auto Insurance Brokers in Kitchener |
| https://rates.ca/insurance-quotes/auto/calgary-insurance-brokers | Auto Insurance Brokers in Calgary |
| https://rates.ca/insurance-quotes/auto/edmonton-insurance-brokers | Auto Insurance Brokers in Edmonton |

These pages list local brokerages with addresses, which targets "insurance broker {city}" local intent.

### 2.6 Auto: coverage and persona pages
| URL | SERP title |
|---|---|
| https://rates.ca/insurance-quotes/auto/comprehensive | Comprehensive Car Insurance Quotes |
| https://rates.ca/insurance-quotes/auto/collision | Get Collision Insurance for Your Car |
| https://rates.ca/insurance-quotes/auto/third-party-liability | Get Third-Party Liability Car Insurance Quotes |
| https://rates.ca/insurance-quotes/auto/g2-drivers | Cheap Car Insurance Quotes for G2 Drivers in Ontario |

### 2.7 Car insurance guides (`/guides/car-insurance/{topic}`)
| URL | SERP title |
|---|---|
| https://rates.ca/guides/car-insurance/high-risk-drivers | Car Insurance For High Risk Drivers |
| https://rates.ca/guides/car-insurance/seniors | Guide: Seniors Auto Insurance |
| https://rates.ca/guides/car-insurance/first-time-car-insurance | Guide to First Time Car Insurance |
| https://rates.ca/guides/car-insurance/newcomers | Guide: Auto Insurance for Newcomers to Canada |
| https://rates.ca/guides/car-insurance/gap-insurance | Gap insurance |
| https://rates.ca/guides/car-insurance/how-to-save | Guide: How to Save on Car Insurance |
| https://rates.ca/guides/car-insurance/how-it-works | How does car insurance work in Canada? |
| https://rates.ca/guides/car-insurance/glossary | Canadian Car Insurance Glossary |
| https://rates.ca/guides/car-insurance/getting-your-drivers-licence-ontario | Guide to getting your driver's licence in Ontario |
| https://rates.ca/guides/home-insurance/roof-replacement | How to Tackle Roof Replacement Home Insurance Claims |

The `/guides/car-insurance` hub snippet also lists these topics, but **their URLs were not seen**: applications, companies, FAQ, young drivers, myths, renewals, cheapest cars to insure, classic car, commercial car, exotic car, how to cancel, hybrid, leased car, new drivers.

### 2.8 Home (`/insurance-quotes/home/{geo}`)
| URL | SERP title |
|---|---|
| https://rates.ca/insurance-quotes/home/ontario | Compare Ontario Home Insurance Quotes |
| https://rates.ca/insurance-quotes/home/toronto | Get the Best Toronto Home Insurance Quotes |
| https://rates.ca/insurance-quotes/home/mississauga | Find the Best Home Insurance Quotes in Mississauga |
| https://rates.ca/insurance-quotes/home/oshawa | Get the Best Oshawa Home Insurance Quotes |
| https://rates.ca/insurance-quotes/home/st-catharines | Get the Best St. Catharines Home Insurance Quotes |
| https://rates.ca/insurance-quotes/home/cambridge | Compare Cambridge Home Insurance Quotes |
| https://rates.ca/insurance-quotes/home/waterloo | Get the Best Waterloo Home Insurance Rates |
| https://rates.ca/insurance-quotes/home/windsor | Get the Best Windsor Home Insurance Rates |
| https://rates.ca/insurance-quotes/home/calgary | Compare Calgary Home Insurance Quotes |
| https://rates.ca/insurance-quotes/home/edmonton | Edmonton Home Insurance Quotes |

### 2.9 Condo (`/insurance-quotes/condo/{city}`)
| URL | SERP title |
|---|---|
| https://rates.ca/insurance-quotes/condo/toronto | The Best Condo Insurance Quotes in Toronto |
| https://rates.ca/insurance-quotes/condo/ottawa | Ottawa condo insurance |
| https://rates.ca/insurance-quotes/condo/vancouver | Vancouver, B.C. Condo Insurance: Find the Cheapest Rates |
| https://rates.ca/insurance-quotes/condo/calgary | Compare Quotes for the Best Condo Insurance in Calgary |
| https://rates.ca/insurance-quotes/condo/edmonton | Edmonton condo insurance |

### 2.10 Tenant (`/insurance-quotes/tenant/{geo}`)
| URL | SERP title |
|---|---|
| https://rates.ca/insurance-quotes/tenant/ontario | Compare Ontario Tenant Insurance Quotes |
| https://rates.ca/insurance-quotes/tenant/toronto | Compare Tenant Insurance Quotes in Toronto\| Renter's Insurance Toronto |
| https://rates.ca/insurance-quotes/tenant/mississauga | Mississauga Tenant Insurance Quotes: Find the Cheapest Rates |
| https://rates.ca/insurance-quotes/tenant/vancouver | Vancouver, BC Tenant Insurance Quotes: Find the Cheapest Rates |
| https://rates.ca/insurance-quotes/tenant/calgary | Best Tenant Insurance Quotes in Calgary |
| https://rates.ca/insurance-quotes/tenant/edmonton | Compare Edmonton Tenant Insurance Quotes |

### 2.11 Business (`/insurance-quotes/business/{category}/{profession}`): the deepest tree on either site
| URL | SERP title |
|---|---|
| https://rates.ca/insurance-quotes/business/small-business | Compare Small Business Insurance Quotes |
| https://rates.ca/insurance-quotes/business/general-liability | Compare Commercial General Liability Insurance Quotes |
| https://rates.ca/insurance-quotes/business/professional-liability | Compare Professional Liability Insurance Quotes |
| https://rates.ca/insurance-quotes/business/errors-and-omissions | Compare Errors and Omissions Insurance Quotes |
| https://rates.ca/insurance-quotes/business/tools-and-equipment | Compare Tools and Equipment Insurance Quotes |
| https://rates.ca/insurance-quotes/business/freelancer | Get a Freelancer Insurance Quote Online |
| https://rates.ca/insurance-quotes/business/healthcare-services | Get Cheap Healthcare Services Insurance Quotes Today |
| https://rates.ca/insurance-quotes/business/beauty-services | Get a cheap beauty services insurance quote today |
| https://rates.ca/insurance-quotes/business/personal-services | Get the best personal insurance quote for free |
| https://rates.ca/insurance-quotes/business/personal-services/cleaning | Get a free insurance quote for your cleaning business |
| https://rates.ca/insurance-quotes/business/food-beverage | Get a cheap food and beverage service insurance quote today |
| https://rates.ca/insurance-quotes/business/food-beverage/food-truck | Protect Your Food Truck |
| https://rates.ca/insurance-quotes/business/commercial-property | Compare Commercial Property Insurance Quotes |
| https://rates.ca/insurance-quotes/business/commercial-property/landlord | Affordable Landlord Insurance |
| https://rates.ca/insurance-quotes/business/commercial-property/student-rental-house | Student Rental House Insurance |
| https://rates.ca/insurance-quotes/business/commercial-property/cottage-rental | Cottage Rental Insurance |
| https://rates.ca/insurance-quotes/business/commercial-property/tenant-legal-liability | Tenant Legal Liability Insurance in Ontario |
| https://rates.ca/insurance-quotes/business/contractor | Get a cheap general contractor insurance quote today |
| https://rates.ca/insurance-quotes/business/contractor/plumber | Get a cheap plumber insurance quote today |
| https://rates.ca/insurance-quotes/business/contractor/hvac | HVAC business insurance - get a free quote today |
| https://rates.ca/insurance-quotes/business/contractor/painter | Get a cheap painter insurance quote today |
| https://rates.ca/insurance-quotes/business/contractor/concrete | Get a cheap concrete contractor insurance quote today |
| https://rates.ca/insurance-quotes/business/contractor/welding | Find the best rate for welding insurance |
| https://rates.ca/insurance-quotes/business/contractor/moving-company | Get a cheap moving company insurance quote today |
| https://rates.ca/insurance-quotes/business/contractor/tree-removal | Tree Removal Business Insurance in Ontario |
| https://rates.ca/insurance-quotes/business/contractor/window-cleaning | Get a cheap window cleaning insurance quote today |

### 2.12 Insurer pages (`/insurance-companies/{insurer}`)
caa, aviva, tdinsurance ("TD Car Insurance"), rbc ("RBC Auto Insurance"), wawanesa ("Wawanesa Auto Insurance"), sonnet, pembridge, echelon, coachman (high-risk ON), facility-association, sgi, algoma-mutual, the-guarantee-company, scoop-insurance, geico ("Geico Car Insurance": a US brand, odd), sunlife, canada-life-assurance, equitable-life. All URLs follow the form `https://rates.ca/insurance-companies/{slug}`, and every one listed here was seen.

### 2.13 Root-level data reports (link and PR magnets)
| URL | SERP title |
|---|---|
| https://rates.ca/home-insuramap-report-2025 | Home Insuramap Report 2025 |
| https://rates.ca/dangerous-drivers-2025-report | Dangerous Drivers Report 2025 |
| https://rates.ca/annual-best-auto-insurance-study-2026 | Annual Best Auto Insurance Study 2026 |
| https://rates.ca/annual-best-auto-insurance-study | Annual Best Auto Insurance Study 2025 |

The "Auto Insuramap" and "Home Insuramap" are interactive FSA (postal-code prefix) maps. Their exact URL was not seen.

### 2.14 Rates.ca resource articles seen (`/resources/{slug}`)
**Rankings and data (link magnets):**
- /resources/these-10-cities-have-highest-car-insurance-rates-ontario
- /resources/which-toronto-neighbourhoods-have-most-expensive-car-insurance-rates
- /resources/10-toronto-neighbourhoods-most-expensive-car-insurance-rates
- /resources/heres-how-much-car-insurance-costs-your-province
- /resources/province-expensive-auto-insurance: "Which Province Has the Most Expensive Auto Insurance?"
- /resources/ontario-car-insurance-rates-jump-12-percent-2023
- /resources/ontario-car-insurance-rate-decisions-december-2020-report *(FSRA rate-filing tracker)*
- /resources/33-percent-of-canadians-file-travel-health-claims-study
- /resources/nearly-half-canadians-planning-leave-country-year-will-not-buy-travel-insurance-survey
- /resources/frustrated-rising-home-insurance-premiums-blame-climate-change
- /resources/severe-weather-adaptations-boost-home-market-value-canada
- /resources/holiday-cheer-and-financial-fear-64-canadians-set-spending-limits
- /resources/survey-over-half-of-canadians-not-confident-well-avoid-a-recession-in-2025
- /resources/ratesdotca-launches-best-home-auto-insurance-awards
- /resources/ratesupermarket-ca-featured-on-ctv-news-consumer-alerts

**Driver persona:**
- /resources/car-insurance-young-drivers
- /resources/how-insure-your-teenage-driver
- /resources/safe-driving-tips-young-drivers
- /resources/best-new-and-used-cars-teen-drivers
- /resources/buying-a-car-for-your-teen-heres-what-to-know
- /resources/a-seniors-guide-to-car-insurance
- /resources/requirements-and-restrictions-getting-your-g1-licence-ontario
- /resources/new-canada-heres-how-get-car-insurance
- /resources/why-drivers-licence-history-matters-car-insurance

**Coverage explainers:**
- /resources/what-mandatory-minimum-car-insurance-you-need-have-canada
- /resources/does-your-car-insurance-policy-include-collision-and-comprehensive-coverages
- /resources/dc-pd-what-direct-compensation-property-damage-insurance
- /resources/protecting-yourself-uninsured-drivers
- /resources/how-will-car-insurance-policy-respond-hit-and-run
- /resources/why-you-should-add-family-protection-coverage-your-auto-insurance-policy
- /resources/does-your-car-insurance-cover-travel-out-province
- /resources/how-much-can-good-drivers-save-auto-insurance *(UBI)*
- /resources/20-ways-get-cheaper-auto-insurance

**Home, tenant and condo:**
- /resources/10-ways-reduce-your-home-insurance-premium
- /resources/do-you-need-condominium-insurance-coverage
- /resources/does-renters-insurance-cover-damage-landlords-property
- /resources/tenant-insurance-its-not-just-about-protecting-your-stuff
- /resources/free-rent-tenants-have-options-landlords-offer-incentives
- /resources/best-way-insure-belongings-assisted-living-facility
- /resources/why-absentee-landlord-insurance-helps-manage-rental-properties-long-distance

**Life:**
- /resources/do-i-need-life-insurance-canadian
- /resources/planning-a-legacy-with-life-insurance: "Should You Take A Life Insurance Policy Out On Your Parents?"

**Travel:**
- /resources/travel-insurance-cheaper-all-these-things
- /resources/global-tensions-travel-insurance
- /resources/can-you-buy-travel-insurance-after-leaving-canada
- /resources/in-the-ring-amex-aeroplan-card-vs-rbc-avion-visa-infinite-card

**Business:**
- /resources/how-get-insurance-your-company-vehicle
- /resources/home-based-business-insurance-add-on-vs-commercial-property
- /resources/types-of-insurance-for-general-contractors
- /resources/professional-vs-general-liability-insurance-what-coverage-does-your-business-need

---

## 3. City and province coverage matrix

Key: Y = URL seen; blank = not seen. "Not seen" does not prove a page is absent, because the search budget limited checks.

### 3.1 Car insurance
| City | Ratehub | Rates.ca |
|---|---|---|
| Toronto | Y | Y (+ brokers page) |
| North York | | Y |
| Scarborough | | Y |
| Etobicoke | | Y |
| Mississauga | Y | Y (+ brokers) |
| Brampton | Y | Y |
| Vaughan | (blog data only) | Y |
| Markham | Y | Y |
| Richmond Hill | | Y |
| Oakville | Y | Y |
| Burlington | Y | Y |
| Milton | | Y |
| Pickering | | Y |
| Ajax | | Y |
| Whitby | | Y |
| Oshawa | Y | Y |
| Orangeville | | Y |
| Hamilton | Y | Y |
| St. Catharines | | Y |
| Niagara Falls | | Y |
| Kitchener | Y | Y (+ brokers) |
| Waterloo | Y | |
| Cambridge | | Y |
| Guelph | Y | Y |
| Brantford | Y | |
| London | Y | Y |
| Windsor | Y | Y |
| Barrie | Y | Y |
| Kingston | Y | Y |
| Peterborough | Y | Y |
| Sudbury | Y | Y |
| Thunder Bay | Y | Y |
| Sault Ste. Marie | | (data in SERP, URL not seen) |
| Belleville | | (data in SERP, URL not seen) |
| Ottawa | Y | Y (+ brokers) |
| Calgary | Y | Y (+ brokers) |
| Edmonton | Y | Y (+ brokers) |
| Red Deer | Y | |
| Lethbridge | Y | |
| Vancouver | Y | Y |
| Montreal | Y | |
| Winnipeg | Y | |
| Regina | Y | |
| Saskatoon | Y | |
| Halifax | Y | |
| Fredericton | Y | |
| Moncton | Y | |
| Saint John | Y | |
| St. John's | Y | |

**Provinces (car):** Ratehub covers all 10 (ON, AB, QC, BC, SK, MB, NS, NB, NL, PEI). Rates.ca covers ON, AB and QC only.

### 3.2 Home, condo and tenant
| City | RH Home | Rates Home | Rates Condo | RH Tenant | Rates Tenant |
|---|---|---|---|---|---|
| Ontario (prov) | Y | Y | | Y | Y |
| Alberta (prov) | Y | | | | |
| Nova Scotia (prov) | Y | | | | |
| Toronto | | Y | Y | Y | Y |
| Mississauga | Y | Y | | | Y |
| Hamilton | Y | | | | |
| Windsor | Y | Y | | | |
| Oshawa | | Y | | | |
| St. Catharines | | Y | | | |
| Cambridge | | Y | | | |
| Waterloo | | Y | | | |
| Ottawa | | | Y | | |
| Calgary | Y | Y | Y | Y | Y |
| Edmonton | Y | Y | Y | Y | Y |
| Vancouver | Y | | Y | | Y |
| Winnipeg | Y | | | | |

Ratehub had no condo city pages in results. Neither site showed a life-insurance city page.

---

## 4. Product and niche page inventory (both sites)

| Niche | Ratehub | Rates.ca |
|---|---|---|
| High-risk drivers | /insurance/car-insurance-high-risk; /insurance/companies/facility-association | /guides/car-insurance/high-risk-drivers; /insurance-companies/coachman; /insurance-companies/facility-association |
| Young drivers | /insurance/car/young-drivers-car-insurance | /resources/car-insurance-young-drivers (article only) |
| Students | /insurance/car-insurance-student | (good-student discount mentioned in guides) |
| New / first-time drivers | blog only (/blog/how-much-is-insurance-for-a-new-driver-in-ontario/) | /guides/car-insurance/first-time-car-insurance |
| G1 | blog only | /resources/requirements-and-restrictions-getting-your-g1-licence-ontario |
| G2 | blog only | **/insurance-quotes/auto/g2-drivers** (money page) |
| Seniors | /insurance/car/senior-car-insurance | /guides/car-insurance/seniors |
| Newcomers / immigrants | /insurance/car/newcomer-car-insurance | /guides/car-insurance/newcomers |
| Electric | /insurance/car/electric-car-insurance | (not seen) |
| Hybrid | /insurance/car/hybrid-car-insurance | guide topic listed, URL not seen |
| Classic | /insurance/classic-car-insurance | guide topic listed, URL not seen |
| Sports car | /insurance/sports-car-insurance | (exotic car guide topic listed) |
| Gap | /insurance/car/gap-insurance | /guides/car-insurance/gap-insurance |
| Low-rate / cheap | /insurance/car/low-rate-car-insurance | city titles all lead with "Cheap" |
| Coverage types (comp/collision/TPL) | /insurance/types-of-car-insurance | /insurance-quotes/auto/comprehensive, /collision, /third-party-liability |
| Car brand | toyota, honda, nissan, hyundai, ford (+ /brand hub) | (not seen) |
| Car model | (none seen) | (none seen) |
| Broker-by-city | (not seen) | 6 cities |
| Bundle | /insurance/home-and-auto-bundle | /insurance-quotes/home-auto-insurance-bundle |
| Motorcycle | root + ON + AB | (not seen as product page) |
| Landlord / rental | /insurance/rental-income-property-insurance | /business/commercial-property/landlord, /student-rental-house, /cottage-rental |
| Builder's risk | /insurance/home/builders-risk-insurance | (not seen) |
| Life: term/whole/universal | Y (5 pages) | /insurance-quotes/life (single page) |
| Mortgage life / critical illness / disability | (not seen) | (not seen) |
| Travel: visitors to Canada | Y | Y |
| Travel: super visa / snowbird | (not seen) | (not seen) |
| Pet insurance | **none** (only a dog-walker business blog) | **none seen** |
| Business by coverage | 10 pages | 6+ pages |
| Business by profession | fitness, non-profit, contractor | 15+ professions (plumber, HVAC, painter, concrete, welding, moving, tree removal, window cleaning, cleaning, food truck, beauty, healthcare, freelancer...) |
| Calculators | (no standalone URL seen) | ON car, AB car, AB home |
| Insurer reviews | 10 seen | 18 seen |

---

## 5. Title-tag and meta-description formulas

### 5.1 Ratehub
- **Car city (default):** `Compare {City} Car Insurance Quotes & Save Today` (used for most Ontario and Alberta cities, Montreal and Quebec).
- **Car city (secondary markets):** `Compare {City} Car Insurance Quotes` (Halifax, Winnipeg, Vancouver, Regina, Saskatoon, Fredericton, Moncton, Saint John, St. John's, Burlington). These are probably newer or lighter-weight pages (inferred).
- **Toronto exception (highest-volume keyword):** `Compare Cheap Toronto Auto Insurance Quotes Online`. It uses the "cheap" and "auto" synonym plus "online". The staging copy has `Compare the Best Toronto Car Insurance Quotes for Free`.
- **Car province:** `Compare {Province} Car Insurance Quotes Online` / `... For Free` / `... & Save Today`.
- **Home city:** `Compare {City} Home Insurance Quotes & Save Today`. **Home province:** `Compare Cheap {Province} Home Insurance Quotes & Save`.
- **Tenant:** `Get Cheap Tenant Insurance in {City}` / `Get Cheap Tenant Insurance Quotes in {Province}`.
- **Brand:** `Compare {Brand} Car Insurance Quotes for Free`.
- **Persona:** `Compare {Persona} Car Insurance Quotes` / `The Best Car Insurance for {Persona} in Canada` / `Car Insurance for {Persona} to Canada`.
- **Insurer:** `{Insurer} Insurance: Auto & Home Insurance in Canada` / `Compare {Insurer} Insurance Quotes - Auto & Home` / `What is {Insurer}?`
- **Blog city cost:** `How much is car insurance in {City}?` / `The average cost of home insurance in {City}`.
- **Meta-description phrases (from snippets):** "Get free {City} car insurance quotes and compare Canada's top providers to see who gives you the best rate." / "Compare auto insurance quotes from {City}'s top providers in under three minutes to find your cheapest rate." / "In less than five minutes, compare personalized home insurance quotes from {City}'s top providers." / "Ratehub helps Canadians save 15-25% on average." / "affordable coverage for as low as $20/month" (life).
- **Page body template (city):** a 3-step "Share info, Compare quotes, Save" block; an average monthly rate from "users who recently compared"; a % comparison against Toronto; a "Recent quotes" table (age/gender/vehicle/insurer/monthly); and factor explainers (age, gender, location, vehicle, history).

### 5.2 Rates.ca
- **Car city:** a "Cheap"-led formula used in several variants: `Cheap Car Insurance {City}`, `Cheap {City} Car Insurance`, `Cheap Car Insurance in {City}`, `Compare {City} Car Insurance Quotes`, `Compare Car Insurance Quotes in {City}`. It is inconsistent, and some titles are broken (`Cheap Car Insurance` with no city on Hamilton and North York; `Car Insurance ON Kingston`; `Vancouver Auto Insurance Page`).
- **Broker:** `Auto Insurance Brokers in {City}`.
- **Home:** `Get the Best {City} Home Insurance Quotes` / `... Rates`.
- **Condo/Tenant:** `{City}, {Prov} {Product} Insurance: Find the Cheapest Rates` / `The Best Condo Insurance Quotes in {City}` / `Best Tenant Insurance Quotes in {City}`.
- **Business profession:** `Get a cheap {profession} insurance quote today`.
- **Calculator:** `{Province} Car Insurance Calculator: Estimate Your Costs`.
- **Year-stamping:** `Ontario Home & Auto Insurance Quotes 2026`, `... Report 2025`, `... Study 2026`.
- **Meta/intro formula (very consistent and strong for AI citation):** "In 2026, the average car insurance premium in {City} is $X per year (about $Y per month). Premiums in {City} are Z% lower/higher than the provincial average of $2,653. {City} is Nth out of 181 Ontario communities for car insurance affordability." This is followed by an FSA (postal-code) table and a "Recent quotes" table (age/gender/vehicle year-make-model/cheapest vs average/% savings).
- **Claims:** "compare quotes from 50+ car insurance companies"; "drivers who shopped through Rates.ca paid 30% less than the market average".

---

## 6. Data points they publish (link and AI-citation magnets)

### 6.1 Ratehub
- **City averages (blog):** Toronto $2,044/yr; Calgary $2,032; Edmonton $1,893; Brampton $1,957; Markham $1,730; Ottawa $1,027 (cheapest ON, 49.8% less than Toronto); Barrie $1,099; Mississauga about $2,000.
- **City averages (money pages, "users who compared"):** Toronto $428/mo; Brampton $571/mo (+33% vs Toronto); Mississauga $385/mo; Hamilton $284/mo; Ottawa $232/mo (−46%); Edmonton $284/mo ($3,411/yr); Red Deer $287/mo ($3,440); Lethbridge $244/mo ($2,927).
- **Smaller-city round numbers:** Kitchener ~$1,200; Guelph ~$1,200; London ~$1,400; Oakville ~$1,400; Waterloo ~$1,500; Thunder Bay ~$1,500; Kingston ~$1,100; Peterborough ~$1,100; Sudbury ~$1,200; Oshawa ~$1,870; Hamilton ~$1,900; Burlington ~$2,100; Markham ~$2,100; Saskatoon/Saskatchewan ~$1,200; Moncton/Saint John ~$900; Halifax ~$90/mo; Winnipeg ~$1,000.
- **Vehicle-type split:** Vaughan car $2,051, SUV $1,429, truck $1,283.
- **Alberta city ranking:** Airdrie and Red Deer tied most expensive ($2,142); Sherwood Park cheapest ($1,770).
- **Province / national:** Ontario $2,164; GTA $2,810 (Oct 2025); national $1,973 (start of 2026); QC $960 / $1,044 (2024, +16% YoY); MB $1,212; NB $1,269 / $1,132; BC $1,268 / $1,832; NS $1,408; NL $1,168. Auto rates +21.8% YoY (Q2 2026).
- **Brand/model tables (methodology: 35-yo male, Toronto, clean record, $1M liability, $1,000 deductibles):** Honda Civic $178/mo ($2,137), Accord $157, CR-V $140, Fit $144, Ridgeline $141; Toyota Corolla $166 ($1,997), RAV4 $150, Camry $160; Nissan Sentra $141, Altima $155, GT-R $254 ($3,050).
- **Sample-quote rows:** e.g. Brampton, 49F, 2013 Kia Forte, CAA, $134/mo; 38M, 2009 Honda Accord, Onlia, $254/mo; Moncton, 23M, 2020 Ford Fusion SE, $257/mo.
- **Home:** Calgary $2,374 (2024, −4.5%), sample MAX Insurance quotes $96–116/mo; condo $30–50/mo; Ontario condo $300–600/yr; student tenant $15–50/mo.
- **Surveys:** 57% switched provider after an increase (n=1,250+); 64% auto-renew; 67% shop around; 55.2% worried about theft; 81% haven't tried UBI; 57% missed discounts; Alberta: 60% unaware of the good-driver rate cap.
- **Customer satisfaction by region:** Co-operators (ON/Atlantic), AMA (AB, tie), The Personal (QC).

### 6.2 Rates.ca (stronger, more structured, Ontario-heavy)
- **Ontario provincial average:** $2,653/yr (2026).
- **Affordability rank "Nth of 181 Ontario communities"** for every city page: Brampton last (also last of 32 GTA municipalities); Sudbury 37th; Thunder Bay 129th; Niagara Falls 130th; Milton 151st; London 155th; Barrie 157th; Hamilton 161st; Whitby 162nd; Ajax 168th.
- **City averages (2026):** Brampton $3,802 ($317/mo); Etobicoke $3,277; Vaughan $3,259 (+22.85% vs prov); Scarborough $3,180; Markham $2,900; Toronto $2,888 ($241/mo, Mar 2026); Ajax $2,692; Pickering $2,650; Richmond Hill $2,491; Whitby $2,483; Hamilton $2,457; Barrie $2,412; London $2,407; Milton $2,384; Niagara Falls $2,203; Thunder Bay $2,197; Burlington $2,109 (cheapest GTA); Ottawa $2,071; Sault Ste. Marie $2,017; Sudbury $1,971; Belleville $1,886.
- **Intra-GTA deltas vs Toronto:** Burlington −26.97%, Mississauga +6.58%, Scarborough +10.11%.
- **FSA (postal-code) tables** on each city page. Methodology: average of the 3 lowest premiums per FSA. Insuramap profile: 35-yo male, 2018 Honda Civic, clean record. Brampton page profile: 40-yo male, 16 yrs insured, about 5-yr-old Civic. (The profiles differ between pages, which is an inconsistency.)
- **Alberta:** $1,991 average full coverage (2026); Calgary broker page: 35M 2018 Civic $2,230.
- **Province averages:** QC $1,067; NS $1,475; NB $1,325.
- **Home:** Ontario $2,235/yr (Q2 2026); Toronto $2,296 ($191/mo); Calgary $2,484 (most expensive in AB) vs AB $2,339; Calgary lowest-quote average $1,470.
- **Tenant:** Ontario $302/yr (Q1 2026); downtown Toronto $313. **Condo:** Ottawa $703; downtown Toronto $748.
- **Life:** 35-yo non-smoker, Toronto, $750k coverage: 10-yr term $34/mo, 20-yr $53, 30-yr $99.
- **Travel (visitors to Canada):** $50k coverage, 7 days $15.79, 1 month $56.58.
- **Recent-quote rows with % savings:** Calgary detached 1,778 sq ft, cheapest $412/mo vs average $719 (43% saving); semi-detached $232 vs $357 (35%); Kitchener 42F 2026 Mustang $204–251/mo (19%); Bowmanville 32F 2023 Jeep Grand Cherokee $318–458/mo.
- **Business price anchors:** CGL about $450/yr for a $2M limit; E&O about $250/yr for a $100k limit; plumber/HVAC from $750/yr; welding $1,500–2,000; cleaning $700–2,000; beauty salon $500–1,500; student rental house $1,500–3,000; cottage rental $800–2,000.
- **Studies:** Annual Best Auto Insurance Study 2026 (n=14,676 Ontario customers; CAA best overall for 3 years running; claims satisfaction 81%); 2025 study (n=12,600, ON+AB); Leger 2026 (56% of homeowners would pay more for weather-resilient homes); Dangerous Drivers Report 2025; Home Insuramap Report 2025; an FSRA rate-decision tracker post (Dec 2020).

---

## 7. Gaps and opportunities for instasure.ca

1. **GTA sub-municipality pages are missing on Ratehub.** Rates.ca alone owns Vaughan, Richmond Hill, Scarborough, Etobicoke, North York, Milton, Pickering, Ajax, Whitby and Orangeville. These are the highest-premium markets in Canada, and only one competitor out of these two serves them.
2. **Rates.ca is Ontario-only outside Calgary, Edmonton and Vancouver.** It has no auto pages for Atlantic, Prairie or Quebec cities, or for 7 provinces. Ratehub covers them, but with thin "Compare {City} Car Insurance Quotes" pages and round-number averages. That makes them beatable with real data.
3. **Cities neither site showed:** Laval, Gatineau, Quebec City, Longueuil, Sherbrooke; Surrey, Burnaby, Victoria, Kelowna, Abbotsford (BC is public ICBC, so the angle would be optional/extended coverage); Airdrie, St. Albert, Sherwood Park, Spruce Grove, Grande Prairie, Medicine Hat, Fort McMurray (Ratehub cites Airdrie and Sherwood Park in a blog but has no money page); Newmarket, Aurora, Caledon, Bowmanville/Clarington, Stoney Creek, Welland, Sarnia, Cornwall, North Bay, Woodstock, Stratford; Charlottetown, Dartmouth, Sydney NS.
4. **Home, condo and tenant city depth is thin on both sites.** Neither showed home pages for Brampton, Vaughan, Markham, Ottawa (Ratehub), London or Kitchener. Ratehub showed no condo city pages, and tenant pages were seen for only 3–6 cities. Student-renter pages for university towns (Waterloo, Kingston, London, Guelph, Hamilton, Ottawa) are open.
5. **Model-level vehicle pages.** Ratehub has only 5 brand pages and no model URLs; Rates.ca has none. Open targets: Kia, Mazda, Chevrolet, Tesla, Lexus, BMW, Mercedes, VW, Subaru, Jeep, RAM, Dodge and Acura brands, plus model pages (Civic, Corolla, RAV4, CR-V, Tesla Model 3/Y, F-150). Pages on **high-theft vehicles** (Lexus RX, Highlander, CR-V, Dodge RAM, Ford F-150) would also hit theft-driven premium spikes.
6. **Licence-stage money pages.** Rates.ca has only G2; Ratehub covers G1/G2 only in blog posts. Open: G1, G, M1/M2 (motorcycle), Alberta Class 7/5-GDL, BC L/N. Also missing: international-licence or newcomer-by-country pages (India, Philippines, Pakistan, UK), which carry big intent in Brampton and Mississauga.
7. **High-risk sub-niches.** Both have only one generic high-risk page. Open: after an accident, after a speeding ticket, DUI/impaired, suspended licence, lapsed or cancelled insurance, non-payment cancellation, and "Facility Association alternatives".
8. **Rideshare and delivery** (Uber, Lyft, DoorDash, Instacart), **commercial auto by vehicle**, **leased car**, **financed car**, **usage-based / telematics comparison**, and **winter tire discount** pages were not seen on either site.
9. **Products neither covers:** pet insurance; mortgage life / mortgage protection; critical illness; disability; super visa; snowbird; seasonal/cottage (Rates.ca covers only cottage rental); flood/overland water; wildfire (AB/BC); condo-landlord; short-term rental (Airbnb) insurance.
10. **Calculators** are a weak spot on both. Rates.ca has only ON car, AB car and AB home. Open: home calculators for ON, BC, QC and Atlantic; tenant and condo calculators; city-level estimators; a "premium after a ticket" estimator; a "cost of adding a teen driver" estimator; and a "how much life insurance do I need" calculator. Calculators fit the Calculators repo.
11. **Data and AI citation.** Rates.ca's "Nth of 181 / X% vs provincial average / FSA table" formula is the strongest citation pattern seen; replicate it nationally. Neither competitor appeared to publish an FSRA rate-filing tracker for 2025–26 (the Rates.ca post is from Dec 2020), theft-by-FSA data, or a national "cheapest cities" index across all provinces.
12. **Exploitable tech and on-page weaknesses:**
    - Ratehub: an indexed staging subdomain (pingu.ratehub.ca), doubled "in Canada in Canada" titles, a duplicate Travelers title, a `/9223372036854775807/` blog URL, duplicate home-quote titles, and inconsistent niche folders.
    - Rates.ca: generic titles with no city name (Hamilton, North York), "Vancouver Auto Insurance Page", an indexed `?cta=` URL, a stale "2024" title, and inconsistent provincial averages ($221/mo vs $2,653/yr) and driver profiles across pages.

---

## 8. Coverage limits of this research
- About 56 WebSearch queries ran before the session's shared search budget was exhausted. The following planned checks were **not run**: Ratehub tenant/home pages for more cities, Ratehub calculators, Rates.ca auto-guide sub-URLs, Rates.ca "cheapest cars to insure" and theft reports, and the Insuramap URL.
- Direct page fetches and web.archive.org were blocked, so full hub pages (e.g. `/insurance/car/city`, `/insurance/car/brand`) could not be enumerated. Both sites likely have more city and brand pages than listed here (inferred).
