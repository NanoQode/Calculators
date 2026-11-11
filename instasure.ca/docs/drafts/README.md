# Held guide drafts

Drafts here are **not published**: the content sync only reads `src/content/guides/`.

| Draft | Why it is held | To release |
|---|---|---|
| critical-illness-insurance-cost-canada.md | Its example estimates come from the critical illness model (`CI_NS` in `src/lib/quote-engine.js`), which prices a 35-year-old female non-smoker, $100,000 10-year term at about $55/mo, well above the insurer example published by Sun Life (about $32/mo). | Have a licensed advisor review and recalibrate the CI model, regenerate the guide's figures, run `scripts/check-guide.js`, then move the file to `src/content/guides/`. |
