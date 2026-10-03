# lmcmic.ca — article writing brief

Every article on lmcmic.ca is written to this brief. It condenses Tab 3 of the
SEO roadmap workbook (`content/data/seo-content-roadmap.xlsx`) and the verified
facts gathered on 3 October 2026. The build (`build/build.py`) checks many of
these rules automatically and writes the results to the QA report.

---

## 1. File format

One Markdown file per article: `content/articles/<id>.md` (for example
`content/articles/15.md`). YAML front matter, then the body.

```markdown
---
id: 15
title: "What Is a Mortgage Investment Corporation (MIC)?"
meta_title: "What Is a Mortgage Investment Corporation (MIC)?"
meta_description: "A mortgage investment corporation (MIC) is a Canadian company that pools investor money into mortgages and pays out its income. How MICs work, tax and risks."
answer: >-
  A mortgage investment corporation (MIC) is a Canadian corporation whose only
  business is investing in mortgages and which distributes its taxable income to
  shareholders instead of paying corporate tax on it. ...
takeaways:
  - "A MIC is defined by subsection 130.1(6) of the Income Tax Act ..."
  - "..."
faq:
  - q: "Is a MIC guaranteed?"
    a: "No. ..."
sources:
  - title: "Income Tax Act, section 130.1 — Mortgage investment corporations"
    publisher: "Justice Laws Website, Government of Canada"
    url: "https://laws-lois.justice.gc.ca/eng/acts/I-3.3/section-130.1.html"
---

Body in Markdown...
```

Field rules:

| Field | Rule |
|---|---|
| `id` | The article number from the plan (1–90). |
| `title` | The H1. One per page. Contains the primary keyword, reads as a human sentence. Use the plan title unless it is clearly improvable. |
| `meta_title` | 30–58 characters, primary keyword near the front, no brand (the template appends it when it fits). |
| `meta_description` | 135–158 characters. Answers the query and gives a reason to click. Primary keyword included naturally. No superlatives, no promises. |
| `answer` | **40–90 words.** The direct answer to the primary question, written so it can be lifted out whole (featured snippet / AI answer). Begins with a one-sentence definition of the page's core entity where there is one. This renders first on the page, so it satisfies "answer within the first 120 words". |
| `takeaways` | 3–5 sentences. Each must stand alone if quoted. |
| `faq` | 3–6 Q&As (the FAQ hub, id 90, has ~60). Questions use real investor phrasing — take them from the plan's question keyword and from Tab 1 conversational keywords given in your batch. Answers are self-contained, 2–4 sentences. The template renders them on the page AND as FAQPage schema, so never put an FAQ in the body as well. |
| `sources` | 2–6 authoritative sources (list in §6). Every URL you give must be from §6. You may cite a source by name without a URL if it is not in §6. |

Special files:

* **id 7 — Glossary**: also add `terms:` — a list of `{term, definition, see}` items (aim for 120; definition 1–2 sentences; `see` optional site URL from §7). The body is a short introduction only.
* **id 90 — FAQ hub**: `faq:` holds ~60 Q&As grouped by adding a `group:` key to each item (groups: "Basics", "MICs", "Returns and income", "Tax and registered plans", "Risk and security", "Liquidity", "Eligibility and process", "Regulation"). The body is a short introduction only.
* **id 25 / id 28 — calculators**: the page renders an interactive calculator above your text. Put the literal line `[[calculator]]` on its own line where the calculator should appear (after the first section is best). Write the explanation, method and a worked example around it.
* **id 53 / id 54 — checklists**: write checklist items as Markdown task lists (`- [ ] Item — where to find it`). The template turns them into a printable, tickable checklist.
* **id 74 — How to invest**: this becomes the long-form section of the `/how-to-invest/` page. Write it like any other article.

## 2. Body structure

* **No H1 in the body** — the template prints `title` as the H1. Start with one or two context paragraphs (who is asking, why it matters), then H2 sections.
* H2s are phrased as the investor's actual question where it reads naturally ("How is a MIC taxed?"), otherwise as a descriptive statement. Never "Overview", "Introduction", "Key considerations", "Final thoughts", "Conclusion". No heading-level jumps (H2 → H3 only).
* The first two sentences under each H2 answer that heading.
* Define every technical term at first use in one clause; link the glossary (`/glossary/`) for the term the first time it matters.
* Canadian register: "first mortgage" / "first position", "registered charge", "power of sale", "lender fee". Not UK "first charge" as a product name.
* Cover who, what, where, when, why and how.
* Include, where the topic allows:
  * **A worked example** — `### Worked example (illustrative)` with a realistic Canadian scenario (property type, city or province, position, LTV, term), round numbers, every step shown, including fees and then tax. Label it illustrative. Arithmetic must be exactly right — recompute it.
  * **A comparison table** with labelled columns, a stated basis of comparison and no empty cells, fair to both sides.
  * **A due-diligence list** naming the document where each item is found (offering memorandum, audited financial statements, mortgage commitment, appraisal, title search, etc.).
  * **Common mistakes** grounded in real investor questions or regulator warnings, not invented for symmetry.
  * **Province-specific** notes — name the province, its regulator and its rule. Never state one province's rule as national.
* Benefits and risks get comparable space, in the same voice, side by side — not risks quarantined at the end.
* 3–8 contextual internal links with descriptive anchors, using URLs from §7 only. Prefer the article's "links to" list in your batch. Use relative URLs exactly as listed (e.g. `[how loan-to-value protects capital](/learn/loan-to-value-for-mortgage-investors/)`).
* External links: cite regulators/statutes in-sentence ("Subsection 130.1(6) of the *Income Tax Act* sets out ...") and list them in `sources`. Do not link competitors.
* Finish with an H2 that summarises (e.g. `## What this means for a mortgage investor`), 3–5 sentences, resolving the reader's question **and naming the seven axes on which mortgage investments vary: borrower, property, loan-to-value, security position, term, jurisdiction and investment structure.** No new claims in the summary.
* **Do not write a call to action, contact details or a disclaimer footer** — the template adds the approved CTA, disclosures, author and dates.
* Length: aim for the plan's target words (±20%). Never pad. Every section must earn its place.

## 3. Compliance — non-negotiable

These come from Tab 3 sections D, H and I. The build scans for them and fails the article if they appear.

**Never use, about returns, income or principal:** guaranteed, guarantee, assured, risk-free, no risk, safe investment, secure investment, principal protected, set and forget, hands-off and safe, "like a GIC", "as safe as a deposit", "GIC alternative with no downside".
You may write "secured by real property" (a fact about collateral), and you may write "not guaranteed" / "are not guaranteed" / "no guarantee". If you must discuss the word (e.g. "Are mortgage investments guaranteed? No."), negate it in the same sentence.

**Never:** superlatives about any lender or fund ("best", "top", "safest", "leading", "highest-returning"); second-person suitability ("you should invest", "ideal for you", "perfect for your portfolio") — say "investors who ... might consider", never "should"; urgency or scarcity; naming or implying wrongdoing by an identifiable firm (discuss categories of failure and cite regulator findings instead); invented quotations, testimonials, statistics or returns.

**Every statistic** carries its source and period beside it ("as at Q3 2025, according to ..."). If you do not have a verified figure from §5, do not state one — describe the mechanism, or say where the data is published, instead. An invented plausible number is worse than no number.

**Disclosures in the body, in context** (the codes in your batch expand here):
* H1 No guarantee — wherever return is discussed: "Mortgage investments are not guaranteed. Returns are targets, not promises, and principal can be lost."
* H2 No deposit insurance — wherever a GIC, savings account or deposit product is named: mortgage investments and MIC shares carry no CDIC (or provincial) deposit insurance.
* H3 Loss of principal — wherever security or capital preservation is discussed.
* H4 Liquidity — redemption terms, notice periods, and the possibility of delay, gating or suspension.
* H5 Not advice — "This is general education, not investment, tax or legal advice."
* H6 No suitability — who might consider, never who should invest.
* H7 Past performance — any historical figure carries its period and "past performance does not indicate future results".
* H8 Tax — tax content is dated "as at October 2026" and directs readers to a Canadian tax professional.
* H9 Regulatory currency — regulatory pages say "current as of October 2026".
* H10 Higher return, higher risk — stated next to any yield discussion.

## 4. About Lendmax Capital MIC (verified, client-published)

Use these facts only, sparingly (one or two mentions per article at most, where genuinely relevant), in plain factual language. Articles are educational first.

* **Lendmax Capital Mortgage Investment Corporation** ("Lendmax Capital MIC", "LMC"), structured under s.130.1 of the *Income Tax Act*. Lends residential first and second mortgages in **Ontario, British Columbia and Alberta**, through licensed mortgage brokers. Residential property, 1–4 units, owner-occupied and rental.
* Mortgage administration by **Lendmax Inc., FSRA Mortgage Administrator Licence 13002** (Ontario). Payments collected into trust, monthly trust reconciliation.
* Shares distributed to qualified investors under prospectus exemptions in NI 45-106, through a **registered exempt market dealer**, with know-your-client and suitability review before any subscription. Offering memorandum (OM) with audited financial statements and risk factors; risk acknowledgement form where the exemption requires it.
* Annual audit by a licensed public accounting firm.
* Registered plans (RRSP, RRIF, TFSA, RESP, RDSP, FHSA) through a self-directed plan trustee (Olympia Trust Company or Western Pacific Trust Company).
* Distributions **quarterly**, cash or reinvested (DRIP). Redemption under the articles and the OM, with notice periods and the board's right to defer or suspend. No secondary market — an illiquid holding.
* Underwriting: three layers — asset (saleable property, conservative LTV against appraised value), borrower (ability to carry the loan), exit (every loan names its repayment source and a fallback). Terms **3 to 12 months**, staggered maturities, concentration limits by region, position and borrower.
* **Published net rate of return paid to investors, by fiscal year** (source: Lendmax Capital MIC, "Past performance", lendmaxcapital.ca/investors/past-performance, updated 19 September 2026): FY2020 0.00%, FY2021 6.00%, FY2022 7.83%, FY2023 8.15%, FY2024 10.15%, FY2025 13.57%; FY2025 target annual return 9%. Always with: "Past performance does not indicate future results. Distributions are not guaranteed and may be reduced or suspended."
* Head office: 6 Indell Lane, Brampton, Ontario L6T 3Y3. Phone 416-837-1414.

## 5. Verified regulatory and tax facts (checked 3 October 2026)

**Income Tax Act s.130.1** (verbatim checked at laws-lois.justice.gc.ca):
* 130.1(2): a taxable dividend from a MIC (other than a capital gains dividend) is deemed received by the shareholder as **interest payable on a bond** issued by the corporation. Practical effect: taxed as interest income at the marginal rate, no dividend gross-up or tax credit, reported on a T5.
* 130.1(6) — a corporation is a MIC throughout a taxation year if, throughout the year: (a) Canadian corporation; (b) only undertaking was investing its funds, and it did not manage or develop real property; (c) no debts secured on real property outside Canada, no debts of non-residents unless secured on Canadian real property, no shares of non-resident corporations, no real property outside Canada; (d) **20 or more shareholders** and no one (with related persons) holds **more than 25% of the issued shares of any class**; (e) preferred shareholders participate pari passu with common after preferred dividends; (f) at least **50% of the cost amount** of its property is residential mortgages (on "houses" or housing projects as defined in the *National Housing Act*) plus insured deposits/credit-union deposits and money; (g) real property held directly ≤ **25%** of cost amount of all property, **excluding** property acquired by foreclosure or after default; (h) liabilities ≤ **3×** equity where residential mortgages + deposits + money are less than two-thirds of assets; (i) otherwise liabilities ≤ **5×** equity.
* Say "nine conditions" for 130.1(6)(a)–(i).
* MIC shares are generally a **qualified investment** for registered plans (Income Tax Regulations s.4900). They can become a **prohibited investment** if the plan holder, with non-arm's-length persons, has a **significant interest (10% or more of any class)**, or if the MIC holds debt of the plan holder / non-arm's-length persons. Phrase: "under the prohibited-investment rules in section 207.01 of the Income Tax Act". Do NOT quote Regulation 4900 wording (not verified verbatim — register item L10).

**Securities (NI 45-106 Prospectus Exemptions)** — MIC shares are usually sold under the **offering memorandum exemption** or the **accredited investor exemption**, through a registered **exempt market dealer (EMD)**.
* Accredited investor (individual), in summary: financial assets > $1,000,000 (alone or with spouse) net of related liabilities; or net income before tax > $200,000 (or > $300,000 combined with spouse) in each of the two most recent years with a reasonable expectation of the same this year; or net assets ≥ $5,000,000.
* Eligible investor (individual), in summary: net assets (alone or with spouse) > $400,000; or net income before tax > $75,000 (or > $125,000 combined with spouse) in each of the two most recent years with the same expectation this year; or advised by an eligibility adviser (rules vary).
* OM exemption investment limits for individuals apply in **Alberta, New Brunswick, Nova Scotia, Ontario, Québec and Saskatchewan**: up to $10,000 in 12 months for non-eligible investors; up to $30,000 for eligible investors; up to $100,000 for eligible investors who receive suitability advice from a portfolio manager, investment dealer or exempt market dealer. Accredited investors have no OM limit. Other provinces differ — say so, do not generalise.
* Always add "thresholds summarised; confirm current definitions with a registered dealer".

**Deposit insurance:** CDIC insures eligible deposits at member institutions up to **$100,000 per insured category**. MIC shares and mortgage investments are not deposits and are not CDIC-insured.

**Ontario:** mortgage brokerages, agents and **mortgage administrators** are licensed by **FSRA** under the *Mortgage Brokerages, Lenders and Administrators Act, 2006*. Enforcement is usually **power of sale** under the *Mortgages Act* (R.S.O. 1990, c. M.40). Syndicated mortgage oversight has been split between FSRA and the OSC since 1 July 2021 (do not cite form numbers).

**British Columbia:** regulator **BCFSA**. The **Mortgage Services Act** received Royal Assent on 3 November 2022 and **comes into force on 13 October 2026**, repealing and replacing the *Mortgage Brokers Act*; regulations and rules approved 14 July 2025, followed by a 15-month transition. It makes mortgage lending and mortgage administration licensed activities (register item L1 — write "is scheduled to come into force on 13 October 2026" and tell readers to check BCFSA for licensing categories). Enforcement in BC is **judicial foreclosure / court-ordered sale** (order nisi, redemption period), not power of sale.

**Alberta:** mortgage brokers regulated by **RECA** (Real Estate Council of Alberta) under the *Real Estate Act*; securities by the **Alberta Securities Commission**. Enforcement is court-supervised (judicial sale / foreclosure). Do not assert presence or absence of an Alberta investor-disclosure form (L11).

**Québec:** mortgage brokerage has been regulated by the **AMF** since 1 May 2020 (never call OACIQ the current regulator). Civil-law system: "hypothec", "hypothecary recourses" (e.g. taking in payment, sale by judicial authority, sale by the creditor, taking possession for administration). Securities: AMF.

**Power of sale** applies in Ontario, New Brunswick, Newfoundland and Labrador and PEI. Judicial processes in BC, Alberta, Saskatchewan, Nova Scotia; Québec uses hypothecary recourses. **Manitoba**: describe the mechanics (administrative process through the Land Titles Office leading to an order for sale) but do not label it power of sale or judicial (L7).

**Newfoundland and Labrador:** *Mortgage Brokerages and Brokers Act* in force 1 April 2025, replacing the former *Mortgage Brokers Act*. **Nova Scotia:** *Mortgage Regulation Act*, S.N.S. 2012, c.11, in force 1 November 2021 (never "Mortgage Regulation Act, 2021"). **PEI:** "does not appear to have" a mortgage broker licensing regime — phrase it exactly that way, if at all (L8).

**Syndicated mortgages (CSA amendments):** in force 1 March 2021 (1 July 2021 in Ontario and Québec): private issuer and "mortgages" prospectus exemptions withdrawn for syndicated mortgages, appraisal requirements added for OM distributions. Do not state BC's current position (L12).

**Statistics:** we do not have verified market statistics (CMHC MIE market share, Ontario private-lending volumes, MIC counts, delinquency rates). Do not state any. Point readers to the **CMHC Residential Mortgage Industry Report** and the **FSRA** private-lending reports as where such data is published, without quoting figures.

**Rates:** do not state current GIC, bond, prime or mortgage rates. Use clearly illustrative round numbers in worked examples ("assume a 9% gross yield").

## 6. Allowed external sources (use these URLs only)

* Income Tax Act s.130.1 — https://laws-lois.justice.gc.ca/eng/acts/I-3.3/section-130.1.html
* Income Tax Act s.207.01 (registered-plan definitions incl. prohibited investment) — https://laws-lois.justice.gc.ca/eng/acts/I-3.3/section-207.01.html
* Income Tax Regulations s.4900 — https://laws-lois.justice.gc.ca/eng/regulations/C.R.C.,_c._945/section-4900.html
* CRA Income Tax Folio S3-F10-C2, Prohibited Investments — https://www.canada.ca/en/revenue-agency/services/tax/technical-information/income-tax/income-tax-folios-index/series-3-property-investments-savings-plans/folio-10-registered-plans-similar-arrangements/income-tax-folio-s3-f10-c2-prohibited-investments-rrsps-rrifs-rdsps-resps-tfsas-fhsas.html
* CRA (home) — https://www.canada.ca/en/revenue-agency.html
* Canada Deposit Insurance Corporation — https://www.cdic.ca/
* FSRA — https://www.fsrao.ca/
* Mortgage Brokerages, Lenders and Administrators Act, 2006 (Ontario) — https://www.ontario.ca/laws/statute/06m29
* Mortgages Act, R.S.O. 1990, c. M.40 — https://www.ontario.ca/laws/statute/90m40
* Ontario Securities Commission — investors — https://www.osc.ca/en/investors
* NI 45-106 Prospectus Exemptions (OSC) — https://www.osc.ca/en/securities-law/instruments-rules-policies/4/45-106
* Canadian Securities Administrators — https://www.securities-administrators.ca/
* CSA National Registration Search (check a dealer) — https://www.securities-administrators.ca/investor-tools/check-registration-disciplinary-history/
* BCFSA — Mortgage Services Act — https://www.bcfsa.ca/industry-resources/mortgage-broker-resources/mortgage-services-act
* BC Securities Commission — https://www.bcsc.bc.ca/
* Real Estate Council of Alberta — https://www.reca.ca/
* Alberta Securities Commission — https://www.albertasecurities.com/
* Autorité des marchés financiers — https://lautorite.qc.ca/en/general-public
* CMHC Residential Mortgage Industry Report — https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-research/research-reports/housing-finance/residential-mortgage-industry-report
* Mortgage Broker Regulators' Council of Canada — https://www.mbrcc.ca/
* OSC GetSmarterAboutMoney — https://www.getsmarteraboutmoney.ca/
* Lendmax Capital MIC — Past performance — https://lendmaxcapital.ca/investors/past-performance

## 7. Site URL map (internal links — use exactly these)

Core pages: `/` (home), `/why-invest-in-a-mic/`, `/performance-and-risk/`, `/how-to-invest/`, `/contact/`, `/learn/` (all guides), `/glossary/`, `/faq/`, `/tools/after-tax-yield-calculator/`, `/tools/drip-compounding-calculator/`.

Articles: see `content/url-map.md` (id → title → URL) supplied with your batch.
