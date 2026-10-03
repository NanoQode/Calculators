# Daily blog publishing: 3 guides a day by Michael Le Chi, CFP

This is the standing procedure for instasure.ca's blog (`/guides/{slug}/`). A scheduled routine runs it every morning; a person can run it the same way. Topics come from the **Blog Content Plan** (`docs/blog-content-plan.csv`, the last tab of `docs/instasure-seo-keyword-content-plan.xlsx`), and keywords from the keyword map (`src/data/keywords.js`, `docs/keywords.csv`).

Every guide is written as **Michael Le Chi, CFP** (author slug `michael-le-chi`, profile `/advisors/michael-le-chi/`, bio in `src/data/authors.js`). His name, photo and credential appear in the byline and in the Article and Person structured data.

---

## 1. Pick today's topics

```bash
cd instasure.ca && npm ci --omit=dev   # once per fresh checkout
node scripts/next-topics.js 3 > /tmp/today.json
```

The picker takes `Planned` rows in this order: priority 1 first, then highest keyword-map volume, then volume tier, one topic per insurance segment. It skips topics already in `src/content/guides/`, topics whose compliance note says not to publish until a ranking or review method exists, and Quebec topics while Quebec is waitlisted. Each pick carries the full plan row plus `related_keywords`: the 12 highest-volume keywords from the keyword map for the same product line, with their target pages.

## 2. Research (each topic)

- Start from the plan row: H2 outline, FAQ, value asset, competitor gap, compliance notes, internal links. Then read the related existing guides and the target money page on the site so the article adds to them rather than repeating them.
- **Every fact and number needs a primary source.** Use web search restricted to primary domains (for example `canada.ca`, `fsrao.ca`, `ibc.ca`, `gisa.ca`, `statcan.gc.ca`, `ontario.ca`, `alberta.ca`, `icbc.com`, `mpi.mb.ca`, `sgi.sk.ca`, `bcfsa.ca`, `fcnb.ca`, `nsuarb.novascotia.ca`, `fpcanada.ca`, `olhi.ca`, `giocanada.org`, `equiteassociation.com`, insurer and regulator sites). Page fetches can be blocked from the cloud container; use what the search results from those domains state, and cite the result's URL.
- A figure you cannot confirm from a primary source is **left out** or described in words ("premiums in Ontario are among the highest in Canada"). Never invent a statistic, a date, a quote or a study.
- Instasure's own estimates may be used when labelled as such: "Instasure estimate for an example profile (…), as of {Month YYYY}". Take them from the live page or the estimate engine (`src/lib/quote-engine.js`), never round them into averages.
- Keep 3–6 sources (title, https URL, publisher) for the front matter.

## 3. Keywords, by search volume

| Keyword | Where it goes |
|---|---|
| Focus keyword (plan) | Title, `seo_title` (near the start), slug, meta description, first 100 words, one H2, image alt if any. Density about 0.5–1.5%; never forced. |
| Secondary keywords (plan) | H2s and H3s, FAQ questions and answers, body. Each once or twice. |
| `related_keywords` (by volume) | Work the highest-volume ones into the body and H2s where they read naturally; where a related keyword is a province or city query, add a short local paragraph that links to its `target_path` with the keyword as anchor text. |
| Internal links | Anchor text is a descriptive keyword phrase (never "click here"). |

Use each related keyword at most twice. Readability beats density: the site's audit flags density outside 0.4–2.5%.

## 4. Write the file

Create `src/content/guides/{slug}.md` (slug = the plan's URL slug; never reuse or rename an existing slug):

```
---
{
  "title": "…H1 from the plan, may be refined…",
  "slug": "{slug}",
  "author": "michael-le-chi",
  "seo_title": "…the plan's meta title (30–60 chars)…",
  "meta_description": "…the plan's meta description (120–160 chars)…",
  "excerpt": "…1–2 sentences answering the main question (80–320 chars)…",
  "category": "life | health | home | auto | travel | business | claims",
  "content_type": "guide | comparison | data | news | checklist",
  "focus_keyword": "…",
  "keywords": ["…secondary and related keywords…"],
  "products": ["…product slugs, money page first, e.g. car-insurance…"],
  "provinces": ["…province codes if the post is provincial, e.g. on…"],
  "takeaways": ["3–6 answer-first bullets, each a complete sentence"],
  "faq": [{"q": "…?", "a": "…2–4 sentences…"}],
  "sources": [{"title": "…", "url": "https://…", "publisher": "…"}]
}
---
Body in Markdown…
```

Category is the guide hub: life (life, mortgage protection), health (CI, disability, health and dental, group benefits), home (home, condo, tenant, landlord, pet), auto (car, recreational), travel (travel, Super Visa), business (business, contractor, E&O), claims (insurance basics and consumer rights).

**Body structure**
1. A 2–3 sentence opening that answers the question, with the focus keyword in the first sentence or two.
2. First H2 as a question, followed by a 40–60 word direct answer (featured snippets and AI answers quote this).
3. The plan's H2 outline, adapted. Build the plan's **value asset** (a dated table with clear row and column labels, a checklist, a worked example or a province comparison).
4. Local sections where the topic has provincial or city demand, linking to the matching province or city page.
5. `## Michael's take`: two short paragraphs in Michael's voice (see below).
6. `## Next steps`: links to the instant estimate (`/quote/{product}/`), the money page, the relevant specialist desk page and calculator if any.

No H1 in the body (the title is the H1). FAQ lives in the front matter only: the page renders it and emits FAQPage markup. 1,100+ words (plan target ±15%), average sentence ≤ 22 words, Canadian spelling, "you" voice, plain language.

**Internal links (4+):** every link in the plan's internal-links column that is live, the money page, the quote flow, and 1–2 related published guides. Link only to pages that exist (`guides:check` verifies this); replace any link to a planned post that is not published yet with its money page.

## 5. Michael's voice and opinions

Michael is a Toronto-based Certified Financial Planner with more than a decade in financial planning, formerly an advisor at Sun Life, now independent (Le Chi Financial Wealth Management), and an entrepreneur (online fitness, fintech start-up Planly, ClearPath Building Services). His lens: objective, conflict-free advice for everyday families; how insurance fits the whole plan (budget, debt, savings, retirement, estate); buy what protects the plan, not what is sold hardest.

In `## Michael's take` (and nowhere else), write in the first person as Michael:
- Opinions grounded in planning principles and the facts in the article ("As a planner, I'd start with…", "My rule of thumb is…").
- **Never invent** client stories, anecdotes, conversations, quotes, numbers, awards or experiences beyond his biography. No endorsements of a named insurer or product. No promises about prices or approvals.
- It is general information: the guide template already adds the "not advice for your situation" disclaimer.

## 6. Compliance (every post)

- No "best", "cheapest", "lowest price" or "guaranteed" claims in titles or copy, unless the topic is gated on a published method and that method is live.
- Estimates are labelled as estimates with the profile and date; rules are stated per province with the right regulator.
- Quebec: information only (waitlist), no advisor promises.
- Apply the row's **Compliance & facts to verify** note, and `docs/CONTENT_REVIEW.md`.

## 7. Check, then publish

```bash
node --disable-warning=ExperimentalWarning scripts/check-guide.js src/content/guides/{slug}.md   # must show ✔ (0 errors)
pip install -q openpyxl && python3 scripts/mark-published.py {slug1} {slug2} {slug3}               # CSV + workbook: Published, writer, date
git add src/content/guides docs/blog-content-plan.csv docs/instasure-seo-keyword-content-plan.xlsx
git commit -m "Publish 3 guides: …" && git push origin claude/instasure-competitive-analysis-pmf7wk
```

Publishing is automatic: the server job `/usr/local/sbin/instasure-content-sync` (cron, every 15 minutes) fetches the branch and publishes any guide file whose slug is not live yet, with today's date, Michael as author, the cache purged and IndexNow pinged. It never overwrites a published guide (edit those in Admin → Content, or publish with `--update`). With the Lendmax server tools available, run the sync script directly to publish at once.

## 8. Verify and report

For each slug: `https://instasure.ca/guides/{slug}/` returns 200, its canonical is itself, the JSON-LD has an Article whose author is Michael Le Chi plus FAQPage, and the URL is in `https://instasure.ca/sitemap-guides.xml`. On the server: `tail /var/log/instasure-content.log`.

Finish with a short report: the three titles and URLs, focus keyword and its volume for each, word counts, check results, and anything skipped or left to verify.
