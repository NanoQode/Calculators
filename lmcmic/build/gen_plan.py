"""Turn the SEO roadmap workbook into content/plan.json.

Tab 2 (Article & Content Topics) becomes one record per article with a fixed
URL, its Tab 1 keywords, its link plan resolved to URLs in both directions,
the featured-image spec and the disclosure / verification notes. Tab 1 is
attached per page so every page's keyword set traces back to the workbook.

Run: python3 build/gen_plan.py   (from the lmcmic/ directory)
"""
import json
import pathlib
import re

import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
XLSX = ROOT / "content/data/seo-content-roadmap.xlsx"
OUT = ROOT / "content/plan.json"

# Article id -> URL path. Fixed here so links never drift when titles change.
URLS = {
    1: "/learn/what-is-mortgage-investing/",
    2: "/learn/how-private-mortgage-investing-works/",
    3: "/learn/how-mortgage-investors-make-money/",
    4: "/learn/how-interest-is-paid-to-mortgage-investors/",
    5: "/learn/how-mortgage-investments-are-secured/",
    6: "/learn/mortgage-investing-for-beginners/",
    7: "/glossary/",
    8: "/learn/first-mortgage-investments/",
    9: "/learn/second-mortgage-investments/",
    10: "/learn/residential-mortgage-investing/",
    11: "/learn/commercial-mortgage-investing/",
    12: "/learn/construction-mortgage-investments/",
    13: "/learn/development-financing-investment/",
    14: "/learn/bridge-mortgage-investing/",
    15: "/learn/what-is-a-mortgage-investment-corporation/",
    16: "/learn/mic-qualification-requirements/",
    17: "/learn/mic-share-structure/",
    18: "/learn/mic-vs-mie/",
    19: "/learn/mortgage-funds-canada/",
    20: "/learn/direct-mortgage-investing/",
    21: "/learn/fractional-and-syndicated-mortgage-investing/",
    22: "/learn/mortgage-investment-structures-compared/",
    23: "/learn/mortgage-investment-returns/",
    24: "/learn/gross-vs-net-vs-after-tax-yield/",
    25: "/tools/after-tax-yield-calculator/",
    26: "/learn/mortgage-investment-fees/",
    27: "/learn/monthly-income-from-mortgage-investments/",
    28: "/tools/drip-compounding-calculator/",
    29: "/learn/mortgage-investment-terms-renewals-and-exits/",
    30: "/learn/reinvestment-risk-mortgage-investing/",
    31: "/learn/capital-preservation-and-loss-of-principal/",
    32: "/learn/mic-vs-reit/",
    33: "/learn/mortgage-investing-vs-gics/",
    34: "/learn/mortgage-investing-vs-bonds/",
    35: "/learn/mortgage-investing-vs-dividend-stocks/",
    36: "/learn/mic-vs-direct-mortgage-investing/",
    37: "/learn/mortgage-investing-vs-rental-property/",
    38: "/learn/first-vs-second-mortgage-investments/",
    39: "/learn/residential-vs-commercial-mortgage-investing/",
    40: "/learn/fixed-vs-variable-rate-mortgage-investments/",
    41: "/learn/alternative-fixed-income-canada/",
    42: "/learn/mortgage-investment-risks/",
    43: "/learn/are-mortgage-investments-guaranteed/",
    44: "/learn/loan-to-value-for-mortgage-investors/",
    45: "/learn/borrower-default-mortgage-investment/",
    46: "/learn/mortgage-enforcement-across-canada/",
    47: "/learn/power-of-sale-for-mortgage-investors/",
    48: "/learn/cost-of-mortgage-enforcement/",
    49: "/learn/liquidity-and-redemption/",
    50: "/learn/property-marketability-risk/",
    51: "/learn/appraisals-for-mortgage-investors/",
    52: "/learn/mortgage-investment-diversification/",
    53: "/learn/mortgage-investor-due-diligence-checklist/",
    54: "/learn/how-to-evaluate-a-mic/",
    55: "/learn/reading-mic-financial-statements/",
    56: "/learn/mortgage-investment-red-flags/",
    57: "/learn/title-insurance-and-legal-file/",
    58: "/learn/interest-rate-risk-mortgage-investing/",
    59: "/learn/mortgage-investment-regulation-canada/",
    60: "/learn/mortgage-investment-rules-by-province/",
    61: "/learn/mortgage-administrators/",
    62: "/learn/accredited-investor-canada/",
    63: "/learn/exempt-market-and-offering-memorandums/",
    64: "/learn/syndicated-mortgage-rules/",
    65: "/learn/mortgage-investment-regulation-ontario/",
    66: "/learn/mortgage-investment-regulation-british-columbia/",
    67: "/learn/mortgage-investment-regulation-alberta/",
    68: "/learn/mortgage-investing-quebec/",
    69: "/learn/mortgage-investment-tax-treatment/",
    70: "/learn/rrsp-tfsa-rrif-mortgage-investments/",
    71: "/learn/prohibited-investment-rrsp-mic/",
    72: "/learn/corporate-and-holdco-mortgage-investing/",
    73: "/learn/non-resident-mortgage-investing/",
    74: "/how-to-invest/",
    75: "/learn/what-to-expect-as-a-mortgage-investor/",
    76: "/learn/how-mortgages-are-underwritten/",
    77: "/learn/mic-minimum-investment/",
    78: "/learn/who-might-consider-mortgage-investing/",
    79: "/learn/mortgage-investing-for-retirement-income/",
    80: "/learn/short-term-mortgage-investments/",
    81: "/learn/real-estate-exposure-without-being-a-landlord/",
    82: "/learn/mortgage-investing-passive-income/",
    83: "/learn/canadian-mic-market-data/",
    84: "/learn/mortgage-investing-ontario/",
    85: "/learn/mortgage-investing-ontario/greater-toronto-area/",
    86: "/learn/mortgage-investing-british-columbia/",
    87: "/learn/mortgage-investing-alberta/",
    88: "/learn/mortgage-investing-ontario/ottawa/",
    89: "/learn/mortgage-investing-quebec-prairies-atlantic/",
    90: "/faq/",
}

# Link-plan names used in Tab 2 columns L and M -> article id, or a fixed URL,
# or None for "every X" instructions that the hub pages satisfy.
HUB = "/learn/"
LINK_NAMES = {
    "Accredited investor": 62, "Investor eligibility": 62,
    "After-tax calculator": 25, "DRIP calculator": 28,
    "Alberta province page": 87, "BC province page": 86, "Ontario province page": 84,
    "Mortgage investing Ontario": 84, "Quebec province page": 89, "GTA region page": 85,
    "Alternative fixed income": 41, "Alternative fixed income pillar": 41,
    "Appraisals": 51, "Appraisals for investors": 51,
    "Beginner's guide": 6, "Bridge investments": 14,
    "Canadian MIC market data": 83, "Market data": 83, "Data hub": 83, "every data citation": None,
    "Capital preservation": 31, "Commercial mortgage investing": 11,
    "Comparison vs GICs": 33, "vs GICs": 33, "vs REIT": 32, "vs bonds": 34,
    "vs dividend stocks": 35, "vs rental property": 37,
    "Concentration": 52, "Concentration risk": 52,
    "Construction mortgage investments": 12, "Development financing": 13,
    "Corporate investors": 72, "Cost of enforcement": 48, "Default and recovery": 45,
    "Direct mortgage investing": 20,
    "Due-diligence checklist": 53, "Due-diligence hub": 53, "MIC due-diligence checklist": 54,
    "Enforcement by province": 46, "Enforcement in Alberta": 67, "Enforcement in BC": 66,
    "Enforcement in Quebec": 68,
    "Exempt market basics": 63, "How to read an OM": 55,
    "Fee stack": 26, "Fee stack itemised": 26,
    "First mortgage investments": 8, "Second mortgage investments": 9,
    "First vs second": 38, "First vs second comparison": 38, "First vs second position": 38,
    "Fixed vs variable": 40, "Fractional and syndicated": 21,
    "Fraud red flags": 56, "Red flags": 56, "Glossary": 7,
    "Gross vs net vs after-tax": 24, "Gross vs net vs after-tax yield": 24,
    "How mortgages are secured": 5, "Title insurance": 57,
    "How private mortgage investing works": 2, "Private mortgage investing hub": 2,
    "How to evaluate a MIC": 54,
    "How to invest": 74, "How to invest in a MIC": 74, "How to invest step by step": 74,
    "Process pillar": 74, "Minimums and process": 77,
    "Interest rate risk": 58, "LTV explained": 44,
    "Liquidity": 49, "Liquidity and redemption": 49,
    "MIC qualification rules": 16, "MIC share structure": 17, "MIC vs MIE": 18,
    "MIC vs direct": 36, "Mortgage funds": 19, "Mortgage administrators": 61,
    "Monthly income": 27, "Returns and cash flow": 27, "Passive income pillar": 82,
    "Power of sale": 47, "Property and marketability risk": 50,
    "Reading a MIC's financials": 55,
    "Registered plans": 70, "Registered plans pillar": 70, "Self-directed plans": 70,
    "Registered-plan traps": 71,
    "Regulation by province": 60, "Regulation by province pillar": 60,
    "Regulation pillar": 59, "Every province regulation page": 60,
    "Regulation in Alberta": 67, "Regulation in BC": 66, "Regulation in Ontario": 65,
    "Regulation in Quebec": 68,
    "Reinvestment risk": 30, "Residential mortgage investing": 10,
    "Residential vs commercial": 39, "Retirement income profile": 79,
    "Returns pillar": 23, "Where returns come from": 3,
    "Risks": 42, "Risks of mortgage investing": 42, "Risks pillar": 42,
    "Short-duration investor profile": 80, "Structures compared": 22,
    "Syndicated mortgage rules": 64, "Syndicated mortgages": 64,
    "Tax pillar": 69, "Tax treatment": 69, "Terms renewals and exits": 29,
    "Underwriting for investors": 76, "What is a MIC": 15,
    "What is mortgage investing": 1, "What to expect as an investor": 75,
    "Homepage": "/", "Investor hub": HUB, "Comparison hub": HUB, "Comparison pages": HUB,
    "Investment types hub": HUB, "Investor profiles hub": HUB, "Province hub": HUB,
    "Existing-investor hub": "/contact/",
    "All articles as a definitional reference": None, "Every S5 article": None,
    "Every pillar page": None, "all guides": None, "every MIC article": None,
    "every S1 article": None, "every S3 article": None, "every S5 article": None,
    "every article": None, "every comparison page": None, "every pillar page": None,
    "every province page": None, "every structure page": None,
}

STAGE_SLUGS = {
    "1": ("understanding", "Understanding mortgage investing"),
    "2": ("types", "Types of mortgage investment"),
    "3": ("returns", "Returns, income and cash flow"),
    "4": ("comparisons", "Comparisons with other investments"),
    "5": ("risk", "Risk, security and due diligence"),
    "6": ("rules", "Regulation, tax and eligibility"),
    "7": ("profiles", "Investor profiles and process"),
    "8": ("reference", "Tools, data and reference"),
}


def rows(ws):
    for r in ws.iter_rows(values_only=True):
        yield ["" if c is None else str(c).strip() for c in r]


def resolve(name):
    target = LINK_NAMES.get(name.strip())
    if target is None:
        return None
    return URLS[target] if isinstance(target, int) else target


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True)

    # Tab 1: keyword rows grouped by their recommended target page name.
    kw_rows = list(rows(wb["1. Keywords"]))
    hi = next(i for i, r in enumerate(kw_rows) if r[0] == "Keyword")
    keywords = []
    for r in kw_rows[hi + 1:]:
        if len(r) < 15 or not r[1]:
            continue
        keywords.append({
            "keyword": r[0], "type": r[1], "cluster": r[2], "intent": r[3],
            "stage": r[4], "geo": r[5], "opportunity": r[8], "competition": r[9],
            "priority_score": r[10], "tier": r[11], "ai_relevance": r[12],
            "basis": r[13], "target_page": r[14], "geo_guidance": r[15] if len(r) > 15 else "",
        })

    # Tab 2: the article plan.
    art_rows = list(rows(wb["2. Article & Content Topics"]))
    hi = next(i for i, r in enumerate(art_rows) if r[0] == "Article title")
    articles = []
    for n, r in enumerate((r for r in art_rows[hi + 1:] if len(r) > 20 and r[1]), start=1):
        stage_no = r[1].split(" ")[0]
        stage_slug, stage_name = STAGE_SLUGS.get(stage_no, ("reference", r[1]))
        links_to = [x.strip() for x in r[11].split(";") if x.strip()]
        links_from = [x.strip() for x in r[12].split(";") if x.strip()]
        articles.append({
            "id": n,
            "url": URLS[n],
            "title": r[0],
            "stage": r[1],
            "stage_slug": stage_slug,
            "stage_name": stage_name,
            "type": r[2],
            "primary_keyword": r[3],
            "secondary_keywords": [x.strip() for x in r[4].split(";") if x.strip()],
            "question_keyword": r[5],
            "intent": r[6],
            "investor_stage": r[7],
            "geo": r[8],
            "geo_note": r[9],
            "target_words": int(float(r[10])) if r[10] else 1500,
            "links_to_names": links_to,
            "links_from_names": links_from,
            "links_to": sorted({u for u in map(resolve, links_to) if u and u != URLS[n]}),
            "links_from": sorted({u for u in map(resolve, links_from) if u and u != URLS[n]}),
            "priority": int(float(r[13])) if r[13] else 2,
            "image": {
                "concept": r[14], "subject": r[15], "composition": r[16],
                "alt": r[17], "filename": r[18], "rationale": r[19],
            },
            "disclosures": r[20],
            "verify_before_publishing": r[21],
        })

    unresolved = sorted({x for a in articles for x in a["links_to_names"] + a["links_from_names"]
                         if x not in LINK_NAMES})
    if unresolved:
        raise SystemExit(f"Unmapped link names: {unresolved}")

    # Attach Tab 1 keywords to each article by matching primary/secondary terms.
    by_kw = {k["keyword"].lower(): k for k in keywords}
    for a in articles:
        terms = [a["primary_keyword"], *a["secondary_keywords"], a["question_keyword"]]
        a["tab1_keywords"] = [by_kw[t.lower()]["keyword"] for t in terms if t.lower() in by_kw]

    OUT.write_text(json.dumps({"articles": articles, "keywords": keywords}, indent=1, ensure_ascii=False))
    print(f"wrote {OUT} — {len(articles)} articles, {len(keywords)} keywords")


if __name__ == "__main__":
    main()
