"""Automated pre-publication checks (Tab 3, section K) for one or all articles.

Used two ways:
  python3 build/qa.py 15 16 17     # check specific article ids, print issues
  python3 build/qa.py              # check every article file
and imported by build.py, which writes the results into the QA report.

Checks that can be automated are automated here. Checks that need a person
(K4 regulatory verification, K10 second-person recomputation, K12 live link
check, K13 commissioned image, K17 licensed sign-off) are reported as
"manual" by build.py — never as passed.
"""
import json
import pathlib
import re
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
ARTICLES = ROOT / "content/articles"
PLAN = json.loads((ROOT / "content/plan.json").read_text())

CORE_URLS = {"/", "/why-invest-in-a-mic/", "/performance-and-risk/", "/how-to-invest/",
             "/contact/", "/learn/", "/glossary/", "/faq/", "/privacy/", "/disclaimer/",
             "/tools/after-tax-yield-calculator/", "/tools/drip-compounding-calculator/",
             "/learn/mortgage-investor-due-diligence-checklist/"}
SITE_URLS = CORE_URLS | {a["url"] for a in PLAN["articles"]}

ALLOWED_EXTERNAL = (
    "laws-lois.justice.gc.ca", "www.canada.ca", "www.cdic.ca", "www.fsrao.ca", "www.ontario.ca",
    "www.osc.ca", "www.securities-administrators.ca", "www.bcfsa.ca", "www.bcsc.bc.ca",
    "www.reca.ca", "www.albertasecurities.com", "lautorite.qc.ca", "www.cmhc-schl.gc.ca",
    "www.mbrcc.ca", "www.getsmarteraboutmoney.ca", "lendmaxcapital.ca",
)

# Section I prohibited-language scan. Each pattern is matched case-insensitively
# per sentence; a sentence that also contains a negation is allowed through
# ("are not guaranteed", "no guarantee"), because the disclosure library
# requires exactly those words.
PROHIBITED = [
    (r"\bguarantee[ds]?\b", True),
    (r"\bassured\b", True),
    (r"\brisk[- ]free\b", True),
    (r"\bno risk\b", True),
    (r"\bsafe investment\b", True),
    (r"\bsecure investment\b", True),
    (r"\bprincipal[- ]protected\b", True),
    (r"\bset and forget\b", True),
    (r"\bhands[- ]off and safe\b", False),
    (r"\blike a GIC\b", True),
    (r"\bas safe as a deposit\b", False),
    (r"\bGIC alternative with no downside\b", False),
    (r"\b(best|top|safest|leading|highest[- ]returning|#1|number one)\s+(private\s+)?(mortgage\s+)?(lender|MIC|fund|investment corporation)s?\b", False),
    (r"\byou should invest\b", False),
    (r"\bideal for you\b", False),
    (r"\bperfect for your portfolio\b", False),
    (r"\bact now\b|\blimited time\b|\bdon'?t miss\b", False),
]
NEGATION = re.compile(r"\b(not|no|never|nothing|neither|nor|isn'?t|aren'?t|cannot|can'?t|without|unless|non-)\b", re.I)

FIELDS = ["id", "title", "meta_title", "meta_description", "answer", "takeaways", "faq", "sources"]
AXES = ["borrower", "property", "loan-to-value", "position", "term", "jurisdiction", "structure"]


def load(path):
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        raise ValueError("missing YAML front matter")
    meta = yaml.safe_load(m.group(1)) or {}
    return meta, m.group(2)


def words(s):
    return len(re.findall(r"[A-Za-z0-9$%][\w'’%.,$-]*", s))


def sentences(text):
    return re.split(r"(?<=[.!?])\s+|\n+", text)


def scan_prohibited(text):
    hits = []
    for s in sentences(text):
        for pat, negatable in PROHIBITED:
            if re.search(pat, s, re.I):
                # A question ("Are MICs guaranteed?") or a negated statement is
                # how the disclosure gets made, so neither is a violation.
                if negatable and (NEGATION.search(s) or s.strip().endswith("?")):
                    continue
                hits.append(f"prohibited language /{pat}/ in: {s.strip()[:140]}")
    return hits


def check(path):
    """Return (meta, body, results) where results maps check-id -> (ok, detail)."""
    res = {}
    try:
        meta, body = load(path)
    except Exception as e:  # noqa: BLE001
        return None, None, {"FORMAT": (False, str(e))}

    missing = [f for f in FIELDS if not meta.get(f)]
    res["FORMAT"] = (not missing, f"missing fields: {missing}" if missing else "front matter complete")

    plan = next((a for a in PLAN["articles"] if a["id"] == meta.get("id")), None)
    res["PLAN"] = (plan is not None, "matches plan id" if plan else "id not in plan")

    mt = str(meta.get("meta_title", ""))
    md = str(meta.get("meta_description", ""))
    res["META_TITLE"] = (25 <= len(mt) <= 60, f"{len(mt)} chars")
    res["META_DESC"] = (120 <= len(md) <= 160, f"{len(md)} chars")

    ans = str(meta.get("answer", ""))
    aw = words(ans)
    res["K1_ANSWER_FIRST_120_WORDS"] = (25 <= aw <= 120, f"answer box {aw} words")

    h1 = re.findall(r"^# ", body, re.M)
    levels = [len(m) for m in re.findall(r"^(#{2,6}) ", body, re.M)]
    jumps = [f"H{a}->H{b}" for a, b in zip([2] + levels, levels) if b > a + 1]
    generic = re.findall(r"^#{2,3} (Overview|Introduction|Key considerations|Final thoughts|Conclusion)\s*$", body, re.M | re.I)
    res["K2_HEADINGS"] = (not h1 and not jumps and not generic and len(levels) >= 3,
                          f"{len(levels)} subheadings; H1 in body: {len(h1)}; jumps: {jumps}; generic: {generic}")

    full = "\n".join([str(meta.get("title", "")), ans, body,
                      *map(str, meta.get("takeaways") or []),
                      *[f"{x.get('q', '')} {x.get('a', '')}" for x in (meta.get("faq") or [])],
                      *[f"{t.get('term', '')} {t.get('definition', '')}" for t in (meta.get("terms") or [])]])
    hits = scan_prohibited(full)
    res["K7_PROHIBITED_LANGUAGE"] = (not hits, "; ".join(hits[:5]) if hits else "clean")

    internal = re.findall(r"\]\((/[^)\s#]*)(?:#[^)]*)?\)", body + "\n" + "\n".join(
        str(t.get("see", "")) and f"]({t.get('see')})" for t in (meta.get("terms") or [])))
    bad = sorted({u for u in internal if u not in SITE_URLS})
    distinct = {u for u in internal if u in SITE_URLS}
    need = 3 if (meta.get("id") not in (7, 90)) else 0
    res["K11_INTERNAL_LINKS"] = (not bad and len(distinct) >= need,
                                 f"{len(distinct)} distinct internal links; unknown: {bad}")

    ext = re.findall(r"\]\((https?://[^)\s]+)\)", body) + [str(s.get("url", "")) for s in (meta.get("sources") or []) if s.get("url")]
    off = sorted({u for u in ext if not any(u.split("/")[2].endswith(d) for d in ALLOWED_EXTERNAL)})
    res["SOURCES_ALLOWED"] = (not off and len(meta.get("sources") or []) >= 2, f"{len(ext)} external refs; not on allow-list: {off}")

    lower = body.lower()
    last = lower[lower.rfind("\n## "):] if "\n## " in lower else lower
    axes_missing = [a for a in AXES if a not in last and a.replace("-", " ") not in last]
    if meta.get("id") in (7, 90):
        axes_missing = []
    res["J2_SEVEN_AXES"] = (not axes_missing, f"missing in closing section: {axes_missing}" if axes_missing else "all seven named")

    faq = meta.get("faq") or []
    need_faq = 30 if meta.get("id") == 90 else 3
    res["E7_FAQ"] = (len(faq) >= need_faq and all(x.get("q") and x.get("a") for x in faq), f"{len(faq)} FAQs")

    tk = meta.get("takeaways") or []
    res["E9_TAKEAWAYS"] = (3 <= len(tk) <= 6, f"{len(tk)} takeaways")

    bw = words(body)
    target = plan["target_words"] if plan else 1500
    floor = 300 if meta.get("id") in (7, 90) else max(900, int(target * 0.6))
    total_words = bw + aw + sum(words(f"{x.get('q', '')} {x.get('a', '')}") for x in faq) + \
        sum(words(f"{t.get('term', '')} {t.get('definition', '')}") for t in (meta.get("terms") or []))
    res["LENGTH"] = (total_words >= floor, f"{total_words} words (body {bw}); target {target}")

    if meta.get("id") == 7:
        res["GLOSSARY_TERMS"] = (len(meta.get("terms") or []) >= 80, f"{len(meta.get('terms') or [])} terms")
    if meta.get("id") in (25, 28):
        res["CALC_PLACEHOLDER"] = ("[[calculator]]" in body, "calculator placeholder present" if "[[calculator]]" in body else "missing [[calculator]]")

    # Disclosure presence (section H) — looks for the substance, not exact wording.
    disc = {
        "H1 no guarantee": r"not guaranteed|no guarantee|are not promises|is not guaranteed",
        "H3 loss of principal": r"(lose|loss of) (some or all|principal|capital|money)|principal can be lost|lose money",
        "H5 not advice": r"not (investment|financial|tax|legal) advice|general (education|information)",
    }
    text_all = full.lower()
    missing_d = [k for k, rx in disc.items() if not re.search(rx, text_all)]
    if re.search(r"\bgic|savings account|deposit\b", text_all) and not re.search(r"cdic|deposit insurance", text_all):
        missing_d.append("H2 deposit insurance")
    res["K8_DISCLOSURES_IN_BODY"] = (not missing_d, f"missing: {missing_d}" if missing_d else "present")

    return meta, body, res


def main(ids):
    paths = [ARTICLES / f"{i}.md" for i in ids] if ids else sorted(ARTICLES.glob("*.md"), key=lambda p: int(p.stem))
    failed = 0
    for p in paths:
        if not p.exists():
            print(f"{p.name}: MISSING")
            failed += 1
            continue
        _, _, res = check(p)
        bad = {k: v for k, v in res.items() if not v[0]}
        status = "PASS" if not bad else "FAIL"
        failed += bool(bad)
        print(f"{p.name}: {status}")
        for k, (ok, detail) in res.items():
            if not ok or ids:
                print(f"   {'ok ' if ok else 'XX '} {k}: {detail}")
    return failed


if __name__ == "__main__":
    sys.exit(1 if main([int(x) for x in sys.argv[1:]]) else 0)
