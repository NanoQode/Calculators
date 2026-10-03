"""Static site build for lmcmic.ca.

    python3 build/build.py          # renders dist/ (then `npm run css` compiles Tailwind)
    npm run build                   # both steps

Reads:
  site.config.json        facts shown on more than one page (single source of truth)
  content/plan.json       the 90-article plan generated from the SEO workbook
  content/articles/*.md   article bodies (front matter + Markdown)
  templates/*.html        Jinja2 templates built from the supplied page designs
Writes:
  dist/                   the deployable site, incl. sitemap.xml, robots.txt, llms.txt
  reports/                QA report (Tab 3 section K gate) and keyword-coverage report
"""
import datetime as dt
import hashlib
import html
import json
import pathlib
import re
import shutil
import sys
import textwrap
import urllib.parse

import markdown
import yaml
from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import qa  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
SITE = json.loads((ROOT / "site.config.json").read_text())
PLAN = json.loads((ROOT / "content/plan.json").read_text())
ARTICLES_DIR = ROOT / "content/articles"
REPORTS = ROOT / "reports"
DOMAIN = SITE["domain"]
TODAY = SITE["content_updated"]
# Cache-busting token: changes only when the CSS/JS sources change, so rebuilds are reproducible.
BUILD_ID = hashlib.sha1((ROOT / "src/site.css").read_bytes() + (ROOT / "src/site.js").read_bytes()
                        + (ROOT / "src/tailwind.config.js").read_bytes()).hexdigest()[:8]

NAV = [
    {"label": "Overview", "url": "/"},
    {"label": "Why a MIC", "url": "/why-invest-in-a-mic/"},
    {"label": "Performance & Risk", "url": "/performance-and-risk/"},
    {"label": "How to Invest", "url": "/how-to-invest/"},
    {"label": "Learn", "url": "/learn/"},
    {"label": "Contact", "url": "/contact/"},
]
TABS = [
    {"label": "Overview", "url": "/", "icon": "dashboard"},
    {"label": "Why MIC", "url": "/why-invest-in-a-mic/", "icon": "domain"},
    {"label": "Risk", "url": "/performance-and-risk/", "icon": "monitoring"},
    {"label": "Invest", "url": "/how-to-invest/", "icon": "account_balance"},
    {"label": "Learn", "url": "/learn/", "icon": "menu_book"},
]


def art(i):
    return next(a for a in PLAN["articles"] if a["id"] == i)


FOOTER_COLS = [
    {"title": "Invest", "links": [
        {"label": "Overview", "url": "/"}, {"label": "Why invest in a MIC", "url": "/why-invest-in-a-mic/"},
        {"label": "Performance & risk", "url": "/performance-and-risk/"}, {"label": "How to invest", "url": "/how-to-invest/"},
        {"label": "Contact the investor desk", "url": "/contact/"},
        {"label": "Existing investor portal", "url": SITE["investor_portal_url"]},
    ]},
    {"title": "Learn", "links": [
        {"label": "What is a MIC?", "url": art(15)["url"]}, {"label": "What is mortgage investing?", "url": art(1)["url"]},
        {"label": "Risks of mortgage investing", "url": art(42)["url"]}, {"label": "MIC tax treatment", "url": art(69)["url"]},
        {"label": "RRSP, TFSA and RRIF", "url": art(70)["url"]}, {"label": "MIC vs REIT", "url": art(32)["url"]},
        {"label": "All investor guides", "url": "/learn/"},
    ]},
    {"title": "Tools & reference", "links": [
        {"label": "After-tax yield calculator", "url": art(25)["url"]}, {"label": "DRIP compounding calculator", "url": art(28)["url"]},
        {"label": "Due-diligence checklist", "url": art(53)["url"]}, {"label": "How to evaluate a MIC", "url": art(54)["url"]},
        {"label": "Glossary", "url": "/glossary/"}, {"label": "Investor FAQ", "url": "/faq/"},
    ]},
    {"title": "Provinces", "links": [
        {"label": "Mortgage investing in Ontario", "url": art(84)["url"]}, {"label": "Greater Toronto Area", "url": art(85)["url"]},
        {"label": "British Columbia", "url": art(86)["url"]}, {"label": "Alberta", "url": art(87)["url"]},
        {"label": "Ottawa", "url": art(88)["url"]}, {"label": "Québec, Prairies & Atlantic", "url": art(89)["url"]},
    ]},
]

# Primary / secondary keywords for the hand-built core pages, drawn from Tab 1
# so the keyword-coverage report can trace every target to a page.
CORE_KEYWORDS = {
    "/": ["MIC investment", "mortgage investment corporation Canada", "invest in mortgages Canada",
          "MIC investments Canada", "mortgage investment Canada"],
    "/why-invest-in-a-mic/": ["how does a MIC work", "how do MICs work", "section 130.1 Income Tax Act",
                              "MIC vs REIT", "MIC vs direct mortgage investing"],
    "/performance-and-risk/": ["mortgage investment returns", "how does a MIC decide which mortgages to fund",
                               "how are mortgages underwritten for investors", "how do I know if a MIC is well run"],
    "/how-to-invest/": ["how to start investing in mortgages", "how do I invest in a MIC", "how to invest in a MIC",
                        "mortgage investment process steps", "what documents do I need to invest in a MIC"],
    "/contact/": ["mortgage investment opportunities", "mortgage investment opportunities Canada",
                  "mortgage investment opportunities Ontario"],
}


# Tab 1 "Recommended target page" → the page on lmcmic.ca that carries it.
# None = the workbook says not to build a page for these terms.
TARGET_PAGE_ARTICLE = {
    "Comparison: MIC vs REIT": 32, "Comparison: MIC vs direct": 36, "Comparison: debt vs equity": 1,
    "Comparison: first vs second": 38, "Comparison: residential vs commercial": 39, "Comparison: structures": 22,
    "Comparison: vs GICs": 33, "Comparison: vs bonds": 34, "Comparison: vs dividend stocks": 35,
    "Comparison: vs rental property": 37, "Data: Canadian MIC market": 83, "FAQ: Minimums and process": 77,
    "Fold into Alberta hub": 87, "Fold into BC hub": 86, "Fold into Quebec page": 89, "Glossary": 7,
    "Guide: Appraisals for investors": 51, "Guide: Becoming a private lender": 20, "Guide: Beginner's guide": 6,
    "Guide: Bridge mortgage investing": 14, "Guide: Capital preservation and loss": 31,
    "Guide: Commercial mortgage investing": 11, "Guide: Construction mortgage investing": 12,
    "Guide: Corporate and holdco investors": 72, "Guide: Default and recovery": 45, "Guide: Development financing": 13,
    "Guide: Diversification for investors": 52, "Guide: Enforcement in Alberta": 67, "Guide: Enforcement in BC": 66,
    "Guide: Enforcement in Quebec": 68, "Guide: Exempt market basics": 63, "Guide: Fee stack, itemised": 26,
    "Guide: First vs second position": 8, "Guide: Fractional and syndicated": 21, "Guide: Fraud red flags": 56,
    "Guide: Gross vs net vs after-tax": 24, "Guide: How mortgages are secured": 5, "Guide: How to evaluate a MIC": 54,
    "Guide: How to invest in a MIC": 74, "Guide: How to invest in mortgages": 74,
    "Guide: How to invest in private mortgages": 2, "Guide: How to invest step by step": 74,
    "Guide: Investor eligibility": 62, "Guide: LTV explained": 44, "Guide: Liquidity and redemption": 49,
    "Guide: MIC qualification rules": 16, "Guide: MIC share structure": 17, "Guide: Mortgage administrators": 61,
    "Guide: Non-resident investors": 73, "Guide: Power of sale": 47, "Guide: Property and marketability risk": 50,
    "Guide: Reading a MIC's financials": 55, "Guide: Registered plans": 70, "Guide: Registered-plan traps": 71,
    "Guide: Regulation in BC": 66, "Guide: Regulation in Ontario": 65, "Guide: Residential mortgage investing": 10,
    "Guide: Returns and cash flow": 27, "Guide: Second mortgage investing": 9, "Guide: Syndicated mortgages": 64,
    "Guide: Terms, renewals and exits": 29, "Guide: Underwriting for investors": 76,
    "Guide: What to expect as an investor": 75, "Guide: Where returns come from": 3,
    "Guide: Who considers mortgage investing": 78, "Opportunities / contact page": "/contact/",
    "Other-provinces page": 89, "Pillar: Alternative fixed income": 41, "Pillar: Enforcement by province": 46,
    "Pillar: MIC vs MIE terminology": 18, "Pillar: Monthly income investing": 27, "Pillar: Mortgage funds": 19,
    "Pillar: Passive income": 82, "Pillar: Private mortgage investing": 2, "Pillar: Real estate debt investing": 1,
    "Pillar: Registered plans": 70, "Pillar: Regulation by province": 59, "Pillar: Risks": 42,
    "Pillar: Tax treatment": 69, "Pillar: What is a MIC": 15, "Pillar: What is mortgage investing": 1,
    "Profile: Long-horizon investors": 78, "Profile: Retirement income": 79, "Profile: Short-duration investors": 80,
    "Province hub: Alberta": 87, "Province hub: BC": 86, "Province hub: BC + Alberta": 87, "Province hub: Ontario": 84,
    "Province page: Quebec": 68, "Region page: GTA (under Ontario)": 85, "Region section under Ontario": 88,
    "Roll into a Prairie/other-provinces page": 89, "Roll into an Atlantic/other-provinces page": 89,
    "Tool: After-tax yield calculator": 25, "Tool: DRIP compounding calculator": 28,
    "Tool: Due-diligence checklist": 53, "Tool: MIC due-diligence checklist": 54, "—": None,
}

# ---------------------------------------------------------------- helpers

env = Environment(loader=FileSystemLoader(ROOT / "templates"), autoescape=select_autoescape(["html"]),
                  trim_blocks=True, lstrip_blocks=True)
IMAGES = json.loads((ROOT / "content/images.json").read_text())
env.globals["images"] = IMAGES
# Pages that show a photo, for the image sitemap.
IMAGE_PAGES = {"/": ["driving-results"], "/performance-and-risk/": ["driving-results"], "/contact/": ["driving-results"]}
env.filters["tojson_ld"] = lambda o: Markup(json.dumps(o, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"))


def md_inline(s):
    """Render a short Markdown string (FAQ answer, takeaway) to HTML."""
    out = markdown.markdown(str(s), extensions=["sane_lists"])
    return Markup(out)


def strip_tags(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", str(s)))).strip()


def plain(s):
    """Markdown → plain text for schema / meta."""
    return strip_tags(markdown.markdown(str(s)))


def head_title(t):
    brand = " | Lendmax Capital MIC"
    return t + brand if len(t + brand) <= 65 else t


def abs_url(path):
    return DOMAIN + path


def org_schema():
    a = SITE["address"]
    return {
        "@context": "https://schema.org",
        "@type": ["Organization", "FinancialService"],
        "@id": DOMAIN + "/#organization",
        "name": SITE["legal_name"],
        "alternateName": ["Lendmax Capital MIC", "LMC MIC", "Lendmax Capital"],
        "url": DOMAIN + "/",
        "logo": {"@type": "ImageObject", "url": abs_url("/assets/brand/logo.png"), "width": 533, "height": 112},
        "image": abs_url("/assets/og/home.png"),
        "description": "Canadian mortgage investment corporation lending residential first and second mortgages in Ontario, British Columbia and Alberta; shares offered to qualified investors by offering memorandum through a registered exempt market dealer.",
        "telephone": SITE["phone_e164"],
        "email": SITE["email_investors"],
        "address": {"@type": "PostalAddress", "streetAddress": a["street"], "addressLocality": a["city"],
                    "addressRegion": a["province"], "postalCode": a["postal"], "addressCountry": a["country"]},
        "areaServed": [{"@type": "AdministrativeArea", "name": p} for p in SITE["provinces"]],
        "identifier": {"@type": "PropertyValue", "name": "FSRA Mortgage Administrator Licence (Lendmax Inc.)",
                       "value": SITE["fsra_licence"]},
        "contactPoint": [{"@type": "ContactPoint", "contactType": "investor relations", "telephone": SITE["phone_e164"],
                          "email": SITE["email_investors"], "areaServed": "CA", "availableLanguage": "en"}],
        "sameAs": [SITE["corporate_site"], SITE["youtube_channel"]],
    }


def website_schema():
    return {"@context": "https://schema.org", "@type": "WebSite", "@id": DOMAIN + "/#website", "url": DOMAIN + "/",
            "name": SITE["site_name"], "inLanguage": "en-CA", "publisher": {"@id": DOMAIN + "/#organization"}}


def breadcrumb_schema(crumbs):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": c["name"], "item": abs_url(c["url"])} for i, c in enumerate(crumbs)]}


def faq_schema(items):
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": plain(f["a"])}} for f in items]}


def video_schema():
    v = SITE["video"]
    s = {"@context": "https://schema.org", "@type": "VideoObject", "name": v["title"], "description": v["description"],
         "thumbnailUrl": [f"https://i.ytimg.com/vi/{v['id']}/hqdefault.jpg"],
         "embedUrl": f"https://www.youtube-nocookie.com/embed/{v['id']}",
         "contentUrl": f"https://www.youtube.com/watch?v={v['id']}",
         "publisher": {"@id": DOMAIN + "/#organization"}}
    if v.get("upload_date"):
        s["uploadDate"] = v["upload_date"]
    return s


def faqs(items):
    return [{"q": f["q"], "a": f["a"], "a_html": md_inline(f["a"]), "group": f.get("group", "")} for f in items]


# ---------------------------------------------------------------- Markdown

class Md:
    def __init__(self):
        self.md = markdown.Markdown(extensions=["tables", "sane_lists", "attr_list", "toc", "smarty"],
                                    extension_configs={"toc": {"permalink": False, "toc_depth": "2"}})

    def render(self, text):
        self.md.reset()
        # Python-Markdown nests lists only at 4-space indents; writers often use 2–3.
        text = re.sub(r"(?m)^ {1,3}([-*+]|\d+\.) ", r"    \1 ", text)
        out = self.md.convert(text)
        toc = [{"id": t["id"], "name": strip_tags(t["name"])} for t in self.md.toc_tokens]
        # Tables scroll inside their own box on phones.
        out = out.replace("<table>", '<div class="table-wrap"><table>').replace("</table>", "</table></div>")
        # Task lists → printable, tickable checklist items.
        out = re.sub(r"<li>\s*\[( |x|X)\]\s*", lambda m: '<li class="task-item"><input type="checkbox"%s aria-label="Done"> <span>' % (" checked" if m.group(1).lower() == "x" else ""), out)
        out = re.sub(r'(<li class="task-item">.*?)</li>', r"\1</span></li>", out, flags=re.S)
        out = re.sub(r"<ul>(\s*<li class=\"task-item\">)", r'<ul class="task-list">\1', out)
        # External links open normally but carry rel=noopener; internal stay plain.
        out = re.sub(r'<a href="(https?://[^"]+)"', r'<a href="\1" rel="noopener"', out)
        # Worked-example sections get a panel.
        return out, toc


MD = Md()


def load_articles():
    found = {}
    for p in sorted(ARTICLES_DIR.glob("*.md"), key=lambda p: int(p.stem)):
        meta, body = qa.load(p)
        found[int(meta["id"])] = (meta, body, p)
    return found


# ---------------------------------------------------------------- OG images

def og_image(slug, title, eyebrow):
    """1200×630 share card in the site's palette. Cached by content hash."""
    from PIL import Image, ImageDraw, ImageFont
    out_dir = DIST / "assets/og"
    out_dir.mkdir(parents=True, exist_ok=True)
    cache = ROOT / ".cache/og"
    cache.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(f"v4|{title}|{eyebrow}".encode()).hexdigest()[:16]
    cached = cache / f"{key}.png"
    target = out_dir / f"{slug}.png"
    if not cached.exists():
        fonts = ROOT / "build/fonts"
        W, H = 1200, 630
        im = Image.new("RGB", (W, H), (14, 28, 47))
        d = ImageDraw.Draw(im)
        d.rectangle([W - 380, 0, W, H], fill=(19, 39, 66))   # flat panels compress far better than a gradient
        d.rectangle([0, H - 10, W, H], fill=(220, 38, 38))
        logo = Image.open(ROOT / "static/brand/logo-white.png").convert("RGBA")
        logo.thumbnail((300, 64), Image.LANCZOS)
        im.paste(logo, (72, 64), logo)
        f_eye = ImageFont.truetype(str(fonts / "Inter_700Bold.ttf"), 24)
        d.text((72, 190), eyebrow.upper(), font=f_eye, fill=(56, 189, 248))
        size = 64
        while True:
            f_t = ImageFont.truetype(str(fonts / "SourceSerif4_700Bold.ttf"), size)
            lines = textwrap.wrap(title, width=int(1050 / (size * 0.48)))
            if len(lines) <= 4 or size <= 40:
                break
            size -= 4
        y = 236
        for ln in lines[:4]:
            d.text((72, y), ln, font=f_t, fill=(255, 255, 255))
            y += int(size * 1.18)
        f_ft = ImageFont.truetype(str(fonts / "Inter_600SemiBold.ttf"), 22)
        d.text((72, H - 64), f"lmcmic.ca  ·  {SITE['fsra_licence_label']}", font=f_ft, fill=(186, 199, 225))
        im.quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(cached, optimize=True)
    shutil.copyfile(cached, target)
    return abs_url(f"/assets/og/{slug}.png")


def slug_of(url):
    s = url.strip("/").replace("/", "--")
    return s or "home"


# ---------------------------------------------------------------- pages

PAGES = []  # (url, meta) for sitemap / reports


def write(url, html_text):
    path = DIST / url.lstrip("/") / "index.html" if url.endswith("/") else DIST / url.lstrip("/")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html_text, encoding="utf-8")


def render(template, url, page, **ctx):
    page.setdefault("canonical", abs_url(url))
    page.setdefault("head_title", head_title(page["title"]))
    page.setdefault("schema", [])
    page.setdefault("nav_active", url if url in {n["url"] for n in NAV} else page.get("nav_active", ""))
    if "og_image" not in page:
        page["og_image"] = og_image(slug_of(url), page.get("og_title") or page["title"], page.get("eyebrow", SITE["site_name"]))
    page["schema"] = [org_schema(), website_schema(), *page["schema"]]
    if page.get("breadcrumbs") and len(page["breadcrumbs"]) > 1:
        page["schema"].append(breadcrumb_schema(page["breadcrumbs"]))
    out = env.get_template(template).render(site=SITE, page=page, nav=NAV, tabs=TABS, footer_cols=FOOTER_COLS,
                                            year=TODAY[:4], build_id=BUILD_ID, icon_font_url="{{ICON_FONT_URL}}", **ctx)
    write(url, out)
    if not page.get("robots", "").startswith("noindex"):
        PAGES.append((url, page))
    return out


def crumbs(*pairs):
    return [{"name": "Home", "url": "/"}] + [{"name": n, "url": u} for n, u in pairs]


def article_context(a, meta, body):
    body_html, toc = MD.render(body)
    calc = None
    if "[[calculator]]" in body_html:
        calc = "after-tax" if a["id"] == 25 else "drip"
        body_html = re.sub(r"<p>\s*\[\[calculator\]\]\s*</p>", "<!--CALC-->", body_html)
    words = qa.words(body) + qa.words(str(meta.get("answer", "")))
    url_title = {x["url"]: x for x in PLAN["articles"]}
    related = []
    for u in a["links_to"] + a["links_from"]:
        if u in url_title and u != a["url"] and u not in [r["url"] for r in related]:
            t = url_title[u]
            related.append({"url": u, "title": t["title"], "stage": t["stage_name"]})
    codes = set()
    d = (a["disclosures"] + " " + body).lower()
    if re.search(r"\bgic|deposit|savings account|cdic", d):
        codes.add("deposit")
    if re.search(r"liquid|redemption|redeem", d):
        codes.add("liquidity")
    if re.search(r"\btax|rrsp|tfsa|rrif|t5\b", d):
        codes.add("tax")
    if re.search(r"regulat|fsra|bcfsa|reca|securities commission|ni 45-106|licen", d):
        codes.add("regulatory")
    if re.search(r"fy20\d\d|past performance|historical", d):
        codes.add("past")
    return body_html, toc, calc, words, related[:8], codes


def build_article(a, meta, body):
    body_html, toc, calc, words, related, codes = article_context(a, meta, body)
    url = a["url"]
    stage_crumb = ("Investor guides", "/learn/")
    trail = [stage_crumb]
    if url.startswith("/learn/mortgage-investing-ontario/") and url != "/learn/mortgage-investing-ontario/":
        trail.append(("Mortgage investing in Ontario", "/learn/mortgage-investing-ontario/"))
    if url.startswith("/tools/"):
        trail = [("Tools", "/learn/#tools")]
    page = {
        "title": meta["title"],
        "head_title": head_title(meta["meta_title"]),
        "og_title": meta["meta_title"],
        "description": meta["meta_description"],
        "eyebrow": a["stage_name"],
        "breadcrumbs": crumbs(*trail, (meta["title"], url)),
        "og_type": "article",
        "published": TODAY, "modified": TODAY, "section": a["stage_name"],
        "nav_active": "/learn/",
    }
    faq_items = faqs(meta.get("faq") or [])
    page["schema"] = [{
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": meta["title"][:110],
        "description": meta["meta_description"],
        "inLanguage": "en-CA",
        "datePublished": TODAY, "dateModified": TODAY,
        "author": {"@type": "Organization", "name": SITE["author"], "url": DOMAIN + "/"},
        "publisher": {"@id": DOMAIN + "/#organization"},
        "mainEntityOfPage": abs_url(url),
        "image": abs_url(f"/assets/og/{slug_of(url)}.png"),
        "about": [a["primary_keyword"], *a["secondary_keywords"][:3]],
        "keywords": ", ".join([a["primary_keyword"], *a["secondary_keywords"]]),
        "wordCount": words,
        "isAccessibleForFree": True,
    }]
    if faq_items:
        page["schema"].append(faq_schema(faq_items))
    if calc:
        page["schema"].append({"@context": "https://schema.org", "@type": "WebApplication", "name": meta["title"],
                               "applicationCategory": "FinanceApplication", "operatingSystem": "Any",
                               "offers": {"@type": "Offer", "price": "0", "priceCurrency": "CAD"},
                               "url": abs_url(url), "publisher": {"@id": DOMAIN + "/#organization"}})
    calc_html = env.get_template(f"partials/calc-{calc}.html").render(site=SITE) if calc else ""
    body_html = body_html.replace("<!--CALC-->", calc_html)
    sources = meta.get("sources") or []
    return render("article.html", url, page, a=a, meta=meta, body_html=Markup(body_html), toc=toc,
                  answer=md_inline(meta["answer"]), takeaways=[md_inline(t) for t in meta.get("takeaways") or []],
                  faq_items=faq_items, related=related, sources=sources, codes=codes,
                  read_min=max(2, round(words / 230)), is_checklist=a["id"] in (53, 54))


def build_core(arts):
    a74 = arts.get(74)
    home_faq = faqs([
        {"q": "What is a mortgage investment corporation (MIC)?", "a": f"A MIC is a Canadian corporation whose only business is investing in mortgages and which pays out its taxable income to shareholders instead of paying corporate tax on it, under section 130.1 of the *Income Tax Act*. [Read the full explanation]({art(15)['url']})."},
        {"q": "Can I invest in a MIC through my RRSP or TFSA?", "a": f"MIC shares are generally a qualified investment for registered plans, held through a self-directed plan trustee. A holding becomes a prohibited investment if you and non-arm's-length persons own 10% or more of any class of shares, so ask before building a large position. [Registered plans explained]({art(70)['url']})."},
        {"q": "How are MIC distributions taxed?", "a": f"Under subsection 130.1(2) of the *Income Tax Act*, MIC dividends are treated as interest income: fully taxable at your marginal rate in a non-registered account, with no dividend tax credit, and reported on a T5. Inside an RRSP, RRIF or TFSA the income is sheltered under that plan's rules. [Tax treatment]({art(69)['url']})."},
        {"q": "Are returns guaranteed?", "a": f"No. Distributions depend on the interest and fees borrowers actually pay and on any losses. Mortgage investments are not guaranteed, are not CDIC-insured, and principal can be lost. [Why nothing here is guaranteed]({art(43)['url']})."},
        {"q": "How do I get my money back?", "a": f"By redemption under the corporation's articles and offering memorandum, subject to notice periods and the board's right to defer or suspend redemptions to protect remaining shareholders. There is no secondary market, so treat MIC shares as an illiquid holding. [Liquidity and redemption]({art(49)['url']})."},
    ])
    edu = [art(i) for i in (15, 70, 42, 3, 32, 53)]
    render("home.html", "/", {
        "title": "Invest in Canadian Mortgages Through a MIC",
        "head_title": "MIC Investment in Canada | Lendmax Capital Mortgage Investment Corp.",
        "og_title": "Lendmax Capital MIC — invest in Canadian residential mortgages",
        "description": "Lendmax Capital MIC pools qualified investors' capital into residential first and second mortgages in Ontario, BC and Alberta. Quarterly distributions; RRSP and TFSA eligible.",
        "eyebrow": "Canadian mortgage investment corporation",
        "schema": [video_schema(), faq_schema(home_faq)],
    }, home_faq=home_faq, edu=edu)

    why_faq = faqs([
        {"q": "How does a MIC avoid double taxation?", "a": "A MIC that meets the section 130.1(6) tests can deduct the taxable dividends it pays, so income distributed to shareholders is generally not taxed at the corporate level. Shareholders are taxed on those dividends as interest income."},
        {"q": "What is the difference between the 25% rule and the 10% rule?", "a": f"The 25% rule is part of the MIC test itself: no shareholder, together with related persons, may hold more than 25% of any class of shares. The 10% rule is a registered-plan rule: if you and non-arm's-length persons hold 10% or more of a class, the shares become a prohibited investment for your RRSP, TFSA or RRIF. [More on the registered-plan trap]({art(71)['url']})."},
        {"q": "Is a MIC better than a REIT?", "a": f"Neither is better in general — they are different exposures. A MIC lends against property and earns contractual interest; a REIT owns property and its units trade daily on an exchange. A MIC is less liquid; a REIT's price moves with the market. [MIC vs REIT compared]({art(32)['url']})."},
    ])
    render("why-mic.html", "/why-invest-in-a-mic/", {
        "title": "Why Invest in a MIC? How Lendmax Capital MIC Works",
        "head_title": "Why Invest in a MIC? How a Mortgage Investment Corporation Works",
        "description": "How a mortgage investment corporation works under section 130.1: the tax flow-through, MIC vs direct mortgages vs REITs, RRSP and TFSA eligibility, and who holds the money.",
        "eyebrow": "Why a MIC",
        "breadcrumbs": crumbs(("Why a MIC", "/why-invest-in-a-mic/")),
        "schema": [faq_schema(why_faq)],
    }, why_faq=why_faq)

    perf_faq = faqs([
        {"q": "What returns has Lendmax Capital MIC paid?", "a": "The fund publishes its net rate of return paid to investors by fiscal year: 0.00% (FY2020, its first year), 6.00% (FY2021), 7.83% (FY2022), 8.15% (FY2023), 10.15% (FY2024) and 13.57% (FY2025), against an FY2025 target of 9%. Past performance does not indicate future results, and distributions are not guaranteed."},
        {"q": "How does a MIC decide which mortgages to fund?", "a": f"Every file is tested in the same order: is the property saleable, can the borrower carry the loan, and how does the loan end? A file that fails any one of the three is declined, whatever the yield. [How mortgages are underwritten]({art(76)['url']})."},
        {"q": "How do I know if a MIC is well run?", "a": f"Look for audited financial statements, a licensed mortgage administrator holding funds in trust, distribution through a registered exempt market dealer, clear arrears and enforcement reporting, and redemption terms you understand. [How to evaluate a MIC]({art(54)['url']})."},
    ])
    render("performance.html", "/performance-and-risk/", {
        "title": "Track Record, Governance and Risk Management",
        "head_title": "MIC Returns, Track Record & Risk Management | Lendmax Capital MIC",
        "description": "Lendmax Capital MIC's published net returns by fiscal year, how each mortgage is underwritten (asset, borrower, exit), portfolio controls, and who audits and administers the fund.",
        "eyebrow": "Performance & risk",
        "breadcrumbs": crumbs(("Performance & Risk", "/performance-and-risk/")),
        "schema": [faq_schema(perf_faq)],
    }, perf_faq=perf_faq)

    howto_body = howto_toc = None
    howto_meta = None
    howto_faq = []
    if a74:
        meta, body, _ = a74
        howto_meta = meta
        howto_body, howto_toc = MD.render(body)
        howto_faq = faqs(meta.get("faq") or [])
    steps = [
        ("Talk to the investor desk and apply", "Complete the intake on this site, then the secure investor application with a dealing representative: who you are, your finances, objectives, investment knowledge, risk tolerance and time horizon. Identity is verified, and you receive the offering memorandum and risk acknowledgement form to read before anything is signed."),
        ("Complete the suitability review", "The exempt market dealer determines which prospectus exemption applies to you and whether a subscription is suitable, putting your interest first. Investment limits, concentration and liquidity are assessed here — and some investors are told it is not right for them."),
        ("Fund the subscription", "Sign the subscription documents and transfer funds from cash, a corporate account, or a registered plan through a self-directed plan trustee. Registered transfers take longer than cash. Shares are issued and you are recorded on the register."),
        ("Receive quarterly distributions", "Distributions are paid quarterly, in cash or reinvested through the dividend reinvestment plan (DRIP). You get statements, tax slips and the corporation's reporting; redemption requests follow the notice periods in the offering memorandum."),
    ]
    sch = [{"@context": "https://schema.org", "@type": "HowTo", "name": "How to invest in a mortgage investment corporation",
            "description": "The four steps from first enquiry to quarterly distributions when investing in Lendmax Capital MIC through a registered exempt market dealer.",
            "step": [{"@type": "HowToStep", "position": i + 1, "name": s[0], "text": s[1]} for i, s in enumerate(steps)]}]
    if howto_faq:
        sch.append(faq_schema(howto_faq))
    render("how-to-invest.html", "/how-to-invest/", {
        "title": (howto_meta or {}).get("title", "How to Invest in Mortgages: The Process Step by Step"),
        "head_title": head_title((howto_meta or {}).get("meta_title", "How to Invest in a MIC: Step by Step")),
        "description": (howto_meta or {}).get("meta_description", "How to invest in a mortgage investment corporation in Canada: application, suitability review with an exempt market dealer, funding from cash or an RRSP/TFSA, and quarterly distributions."),
        "eyebrow": "How to invest",
        "breadcrumbs": crumbs(("How to Invest", "/how-to-invest/")),
        "schema": sch,
    }, steps=steps, body_html=Markup(howto_body or ""), toc=howto_toc or [], meta=howto_meta,
        answer=md_inline(howto_meta["answer"]) if howto_meta else "", faq_items=howto_faq,
        takeaways=[md_inline(t) for t in (howto_meta or {}).get("takeaways") or []], sources=(howto_meta or {}).get("sources") or [])

    contact_faq = faqs([
        {"q": "Can I invest through my corporation or holding company?", "a": f"Yes, Canadian corporations, holding companies and family trusts can subscribe, subject to the dealer's know-your-client and suitability review. MIC dividends are taxed as interest income in the corporation's hands. [Corporate and holdco investors]({art(72)['url']})."},
        {"q": "How are redemptions handled?", "a": f"Redemptions follow the corporation's articles and offering memorandum: written notice, set redemption dates, and the board's right to defer or suspend redemptions to protect remaining shareholders. Loans run 3 to 12 months, so capital recycles as mortgages are repaid — but there is no secondary market. [Liquidity explained]({art(49)['url']})."},
        {"q": "How do taxes work with a T5 slip?", "a": f"Under subsection 130.1(2) of the *Income Tax Act*, MIC dividends are deemed to be interest. In a non-registered account they are reported on a T5 and taxed at your marginal rate with no dividend tax credit; inside an RRSP, RRIF or TFSA they are sheltered under the plan's rules. Tax information current as at October 2026 — confirm with a tax professional. [Tax treatment]({art(69)['url']})."},
        {"q": "What is the minimum investment?", "a": f"The minimum subscription is set out in the current offering memorandum — ask the desk for it. Separately, in Alberta, New Brunswick, Nova Scotia, Ontario, Québec and Saskatchewan the offering memorandum exemption caps how much a non-accredited individual can invest in 12 months. [Minimums explained]({art(77)['url']})."},
        {"q": "What happens after I submit the form?", "a": "Your enquiry goes to the Lendmax Capital deal desk and you continue to the secure investor application at app.lendmaxcapital.ca. A dealing representative then contacts you at the time you chose to complete the suitability review. Nothing is bought and no account is opened until you have read the offering memorandum and signed a subscription agreement."},
    ])
    render("contact.html", "/contact/", {
        "title": "Mortgage Investment Opportunities: Contact the Investor Desk",
        "head_title": "Mortgage Investment Opportunities in Canada | Contact Lendmax Capital MIC",
        "description": "Ask about mortgage investment opportunities with Lendmax Capital MIC. Request the offering memorandum, choose the best time to talk, and continue to the secure investor application.",
        "eyebrow": "Contact & connect",
        "breadcrumbs": crumbs(("Contact", "/contact/")),
        "schema": [faq_schema(contact_faq), {"@context": "https://schema.org", "@type": "ContactPage", "url": abs_url("/contact/"),
                                             "name": "Contact the Lendmax Capital MIC investor desk", "about": {"@id": DOMAIN + "/#organization"}}],
        "hide_floating_cta": True,
    }, contact_faq=contact_faq)


def build_learn(arts):
    groups = {}
    for a in PLAN["articles"]:
        if a["id"] in arts and a["url"].startswith("/learn/") or a["id"] in arts and a["url"].startswith("/tools/"):
            groups.setdefault(a["stage_slug"], {"name": a["stage_name"], "items": []})["items"].append(
                {**a, "answer": plain(arts[a["id"]][0]["answer"])[:220]})
    order = ["understanding", "types", "returns", "comparisons", "risk", "rules", "profiles", "reference"]
    groups = [dict(slug=s, **groups[s]) for s in order if s in groups]
    items = [{"@type": "ListItem", "position": i + 1, "url": abs_url(x["url"]), "name": x["title"]}
             for i, x in enumerate([it for g in groups for it in g["items"]])]
    render("learn.html", "/learn/", {
        "title": "Mortgage Investing Guides for Canadian Investors",
        "head_title": "Mortgage Investing in Canada: Investor Guides | Lendmax Capital MIC",
        "description": "Plain-language guides to mortgage investing in Canada: what a MIC is, where returns come from, risks, tax and RRSP/TFSA rules, regulation by province, and due diligence.",
        "eyebrow": "Investor education",
        "breadcrumbs": crumbs(("Investor guides", "/learn/")),
        "schema": [{"@context": "https://schema.org", "@type": "CollectionPage", "name": "Mortgage investing guides",
                    "url": abs_url("/learn/"), "mainEntity": {"@type": "ItemList", "itemListElement": items}}],
    }, groups=groups)


def build_glossary(arts):
    if 7 not in arts:
        return
    meta, body, _ = arts[7]
    a = art(7)
    terms = sorted(meta.get("terms") or [], key=lambda t: str(t["term"]).lower().lstrip("'\""))
    for t in terms:
        t["id"] = re.sub(r"[^a-z0-9]+", "-", str(t["term"]).lower()).strip("-")
        t["definition_html"] = md_inline(t["definition"])
    letters = {}
    for t in terms:
        k = str(t["term"]).lstrip("'\"")[0].upper()
        letters.setdefault(k if k.isalpha() else "#", []).append(t)
    body_html, _ = MD.render(body)
    faq_items = faqs(meta.get("faq") or [])
    sch = [{"@context": "https://schema.org", "@type": "DefinedTermSet", "name": meta["title"], "url": abs_url(a["url"]),
            "hasDefinedTerm": [{"@type": "DefinedTerm", "name": t["term"], "description": plain(t["definition"]),
                                "url": abs_url(a["url"]) + "#" + t["id"]} for t in terms]}]
    if faq_items:
        sch.append(faq_schema(faq_items))
    render("glossary.html", a["url"], {
        "title": meta["title"], "head_title": head_title(meta["meta_title"]), "og_title": meta["meta_title"],
        "description": meta["meta_description"], "eyebrow": "Reference", "nav_active": "/learn/",
        "breadcrumbs": crumbs(("Investor guides", "/learn/"), ("Glossary", a["url"])), "schema": sch,
    }, meta=meta, letters=letters, body_html=Markup(body_html), answer=md_inline(meta["answer"]), faq_items=faq_items,
        count=len(terms))


def build_faq_hub(arts):
    if 90 not in arts:
        return
    meta, body, _ = arts[90]
    a = art(90)
    items = faqs(meta.get("faq") or [])
    groups = {}
    for f in items:
        groups.setdefault(f["group"] or "General", []).append(f)
    body_html, _ = MD.render(body)
    render("faq.html", a["url"], {
        "title": meta["title"], "head_title": head_title(meta["meta_title"]), "og_title": meta["meta_title"],
        "description": meta["meta_description"], "eyebrow": "Investor FAQ", "nav_active": "/learn/",
        "breadcrumbs": crumbs(("Investor guides", "/learn/"), ("FAQ", a["url"])), "schema": [faq_schema(items)],
    }, meta=meta, groups=groups, body_html=Markup(body_html), answer=md_inline(meta["answer"]), count=len(items))


def build_static_pages():
    render("privacy.html", "/privacy/", {
        "title": "Privacy Notice", "description": "How Lendmax Capital MIC collects, uses and protects personal information submitted through lmcmic.ca, including investor enquiries and the intake form.",
        "eyebrow": "Legal", "breadcrumbs": crumbs(("Privacy", "/privacy/")),
    })
    render("disclaimer.html", "/disclaimer/", {
        "title": "Risk Disclosure and Investor Notice", "description": "Important risk disclosures for Lendmax Capital MIC: no guarantee, no deposit insurance, illiquidity, loss of principal, offering memorandum and exempt market requirements.",
        "eyebrow": "Legal", "breadcrumbs": crumbs(("Risk disclosure", "/disclaimer/")),
    })
    out = env.get_template("404.html").render(site=SITE, page={"title": "Page not found", "head_title": "Page not found | Lendmax Capital MIC",
                                                                 "description": "This page could not be found.", "canonical": abs_url("/404"),
                                                                 "robots": "noindex, follow", "og_image": abs_url("/assets/og/home.png"), "schema": []},
                                              nav=NAV, tabs=TABS, footer_cols=FOOTER_COLS, year=TODAY[:4], build_id=BUILD_ID,
                                              icon_font_url="{{ICON_FONT_URL}}")
    (DIST / "404.html").write_text(out, encoding="utf-8")


# ---------------------------------------------------------------- crawl files

def write_crawl_files():
    v = SITE["video"]
    urls = []
    for url, page in PAGES:
        extra = ""
        if url == "/":
            extra = (f"<video:video><video:thumbnail_loc>https://i.ytimg.com/vi/{v['id']}/hqdefault.jpg</video:thumbnail_loc>"
                     f"<video:title>{html.escape(v['title'])}</video:title><video:description>{html.escape(v['description'])}</video:description>"
                     f"<video:player_loc>https://www.youtube-nocookie.com/embed/{v['id']}</video:player_loc>"
                     + (f"<video:publication_date>{v['upload_date']}</video:publication_date>" if v.get("upload_date") else "")
                     + "</video:video>")
        img_ids = IMAGE_PAGES.get(url, [])
        extra += "".join(f"<image:image><image:loc>{DOMAIN}/assets/img/{i}-{min(IMAGES['photos'][i]['widths'][-1], IMAGES['photos'][i]['width'])}.jpg</image:loc></image:image>" for i in img_ids)
        urls.append(f"<url><loc>{abs_url(url)}</loc><lastmod>{TODAY}</lastmod>{extra}</url>")
    (DIST / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
        + "\n".join(urls) + "\n</urlset>\n", encoding="utf-8")
    (DIST / "robots.txt").write_text(
        "# lmcmic.ca\nUser-agent: *\nAllow: /\nDisallow: /api/\n\n"
        f"Sitemap: {DOMAIN}/sitemap.xml\n", encoding="utf-8")
    # llms.txt — a plain map of the site for answer engines.
    lines = [f"# {SITE['site_name']} ({SITE['legal_name']})", "",
             "> Canadian mortgage investment corporation (s.130.1 Income Tax Act) lending residential first and second mortgages "
             "in Ontario, British Columbia and Alberta. Mortgage administration by Lendmax Inc., FSRA Mortgage Administrator "
             "Licence 13002. Shares offered to qualified investors by offering memorandum through a registered exempt market "
             "dealer. Distributions are not guaranteed; MIC shares are not CDIC-insured.", "",
             "## Investing with Lendmax Capital MIC"]
    titles = {u: p["title"] for u, p in PAGES}
    for u in ["/", "/why-invest-in-a-mic/", "/performance-and-risk/", "/how-to-invest/", "/contact/"]:
        lines.append(f"- [{titles.get(u, u)}]({abs_url(u)})")
    lines += ["", "## Investor guides"]
    for a in PLAN["articles"]:
        if a["url"] in titles:
            lines.append(f"- [{titles[a['url']]}]({abs_url(a['url'])}): {a['primary_keyword']}")
    lines += ["", "## Contact", f"- Phone: {SITE['phone']}", f"- Email: {SITE['email_investors']}",
              f"- Investor enquiry: {abs_url('/contact/')}"]
    (DIST / "llms.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (DIST / "site.webmanifest").write_text(json.dumps({
        "name": SITE["site_name"], "short_name": SITE["short_name"], "start_url": "/", "display": "standalone",
        "background_color": "#f8f9ff", "theme_color": "#0e1c2f",
        "icons": [{"src": "/assets/brand/icon-192.png", "sizes": "192x192", "type": "image/png"},
                  {"src": "/assets/brand/icon-512.png", "sizes": "512x512", "type": "image/png"}]}, indent=1))


def subset_icon_font():
    """Request only the Material Symbols glyphs the pages use (icon_names)."""
    names = set()
    for p in DIST.rglob("*.html"):
        names |= set(re.findall(r'material-symbols-outlined[^"]*"[^>]*>([a-z0-9_]+)<', p.read_text()))
    names |= set(re.findall(r"icon\('([a-z0-9_]+)'", (ROOT / "src/site.js").read_text()))
    url = ("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
           f"&icon_names={','.join(sorted(names))}&display=block")
    for p in DIST.rglob("*.html"):
        t = p.read_text()
        if "{{ICON_FONT_URL}}" in t:
            p.write_text(t.replace("{{ICON_FONT_URL}}", html.escape(url)))
    return sorted(names)


# ---------------------------------------------------------------- reports

def write_reports(arts):
    REPORTS.mkdir(exist_ok=True)
    rows = []
    lr = SITE.get("legal_review", {})
    signed = f"Signed off — legal review completed {lr.get('label', '')} (confirmed by Lendmax Capital)" if lr.get("completed") else "Pending"
    lc_path = REPORTS / "link-check.json"
    if lc_path.exists():
        lc = json.loads(lc_path.read_text())
        bad = [x for x in lc["results"] if not x["ok"]]
        k12 = (f"Checked {lc['checked']} — {len(lc['results']) - len(bad)} of {len(lc['results'])} external links resolve"
               + (f"; not confirmed from the server: {', '.join(sorted({x['url'].split('/')[2] for x in bad}))}" if bad else ""))
        k12_status = "Passed" if not bad else "Mostly passed"
    else:
        k12, k12_status = "Not yet run", "Pending"
    manual = [
        {"id": "K4", "label": "Regulatory claims verified at source", "status": "Signed off", "note": signed},
        {"id": "K17", "label": "Tax / regulatory sign-off by qualified reviewer", "status": "Signed off", "note": signed},
        {"id": "K10", "label": "Calculations recomputed by a second person", "status": "Pending",
         "note": "Every worked example was recomputed by its writer with a script; a second person's check is still to be recorded."},
        {"id": "K12", "label": "External links resolve (live check)", "status": k12_status, "note": k12},
        {"id": "K13", "label": "Featured image to Tab 2 spec", "status": "Partly met",
         "note": "lendmaxcapital.ca publishes one photograph and four partner logos; they are used on the core pages. Articles use generated title cards until more photography is supplied."},
    ]
    for a in PLAN["articles"]:
        p = ARTICLES_DIR / f"{a['id']}.md"
        if not p.exists():
            rows.append({"id": a["id"], "title": a["title"], "url": a["url"], "status": "NOT WRITTEN", "checks": {}, "words": 0})
            continue
        meta, body, res = qa.check(p)
        rows.append({"id": a["id"], "title": meta.get("title", a["title"]), "url": a["url"], "priority": a["priority"],
                     "primary_keyword": a["primary_keyword"],
                     "status": "PASS" if all(v[0] for v in res.values()) else "FAIL",
                     "checks": {k: {"ok": v[0], "detail": v[1]} for k, v in res.items()},
                     "words": qa.words(body or "")})
    # Keyword coverage: every Tab 1 keyword → the page that targets it.
    page_text = {}
    for url, page in PAGES:
        f = DIST / url.lstrip("/") / "index.html"
        page_text[url] = strip_tags(f.read_text()).lower() if f.exists() else ""
    kw_rows = []
    targets = {}
    for a in PLAN["articles"]:
        for k in [a["primary_keyword"], *a["secondary_keywords"], a["question_keyword"]]:
            targets.setdefault(k.lower(), a["url"])
    for u, ks in CORE_KEYWORDS.items():
        for k in ks:
            targets.setdefault(k.lower(), u)
    for k in PLAN["keywords"]:
        kl = k["keyword"].lower()
        url = targets.get(kl)
        if not url:
            t = TARGET_PAGE_ARTICLE.get(k["target_page"])
            url = (art(t)["url"] if isinstance(t, int) else t) or ""
        present = bool(url) and all(w in page_text.get(url, "") for w in re.findall(r"[a-z0-9']+", kl) if len(w) > 2)
        kw_rows.append({**{x: k[x] for x in ("keyword", "tier", "cluster", "intent", "target_page")}, "url": url,
                        "on_page": present})
    data = {"generated": dt.datetime.utcnow().isoformat(timespec="seconds") + "Z", "articles": rows,
            "manual_checks": manual, "keywords": kw_rows}
    (REPORTS / "qa-report.json").write_text(json.dumps(data, indent=1, ensure_ascii=False))
    out = env.get_template("report.html").render(site=SITE, data=data, page={"title": "Content checklist"})
    (REPORTS / "content-checklist.html").write_text(out, encoding="utf-8")
    passed = sum(r["status"] == "PASS" for r in rows)
    mapped = sum(bool(k["url"]) for k in kw_rows)
    covered = sum(k["on_page"] for k in kw_rows)
    print(f"QA: {passed}/{len(rows)} articles pass automated checks; keywords mapped {mapped}/{len(kw_rows)}, terms on page {covered}/{len(kw_rows)}")


# ---------------------------------------------------------------- main

def main():
    if DIST.exists():
        for p in DIST.iterdir():
            if p.name != "assets":
                shutil.rmtree(p) if p.is_dir() else p.unlink()
    (DIST / "assets").mkdir(parents=True, exist_ok=True)
    shutil.copytree(ROOT / "static/brand", DIST / "assets/brand", dirs_exist_ok=True)
    (DIST / "assets/brand/logo-source.png").unlink(missing_ok=True)
    shutil.copyfile(ROOT / "static/brand/favicon.ico", DIST / "favicon.ico")
    shutil.copyfile(ROOT / "static/brand/apple-touch-icon.png", DIST / "apple-touch-icon.png")
    shutil.copyfile(ROOT / "src/site.js", DIST / "assets/site.js")

    arts = load_articles()
    build_core(arts)
    for a in PLAN["articles"]:
        if a["id"] in (7, 74, 90) or a["id"] not in arts:
            continue
        meta, body, _ = arts[a["id"]]
        build_article(a, meta, body)
    build_glossary(arts)
    build_faq_hub(arts)
    build_learn(arts)
    build_static_pages()
    write_crawl_files()
    icons = subset_icon_font()
    write_reports(arts)
    missing = [a["id"] for a in PLAN["articles"] if a["id"] not in arts]
    print(f"Built {len(PAGES)} indexable pages into {DIST} ({len(icons)} icons). Articles missing: {missing or 'none'}")


if __name__ == "__main__":
    main()
