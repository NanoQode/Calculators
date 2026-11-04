# Agent sign-up, lead plans and billing

Added November 4, 2026. Licensed agents register free, get free leads once their licence is verified, then buy a monthly plan priced per lead.

## How it works

| Step | What happens | Where |
|---|---|---|
| Discover | Public page `/insurance-leads-for-agents/` (nav button "For Agents", footer, mobile menu, sitemap-core, llms.txt). Paid prices stay off the page unless **Admin → Billing → Settings → Show paid plans** is ticked. | `views/public/agents.ejs`, copy in `src/data/agents-page.js` |
| Register | `/admin/register`: name, email, phone, licence number, provinces, lines, password. Photo optional. New agents are `pending` and `billing = 'metered'`. | `src/lib/agents.js` |
| Approve | Admin checks the licence on the regulator's register and approves. Approval grants `free_leads` (default 10) credits once. | Admin → Agents → Pending |
| Leads | Routing only offers a lead to a metered agent with a credit left and whose filters match. Each delivered lead uses one credit (free first). Reassigning or unassigning a lead gives the credit back. | `src/lib/routing.js`, `src/lib/billing.js` |
| Buy a plan | Agent → Plan & billing → Choose plan → checkout (billing details, GST/HST by billing province) → card (Stripe) or invoice (Interac e-Transfer). | `/admin/plan`, `/admin/plan/checkout/:plan` |
| Paid | Stripe webhook / success page, or an admin "Mark paid" on the invoice: plan active for one month, credits added, monthly cap removed, receipt emailed. | Admin → Billing → Invoices |
| Renew | Stripe renews automatically. Invoice plans: a renewal invoice is emailed `renewal_notice_days` before the period ends; unpaid → "Payment due"; renewal off → plan ends at period end. Unused credits carry over. | `billing.renewals()` (drip heartbeat) |
| Bad lead | Agent reports a lead within `bad_lead_window_days` (default 7) from the lead page; admin or agent manager approves (credit back, optionally marks the lead junk) or declines. | Admin → Billing → Bad-lead reports |

In-house agents (created in the admin, the team avatar, samples) are `billing = 'exempt'` and are never charged. Switch an agent on Admin → Billing → agent page.

## Default plans (Admin → Billing → Lead plans)

| Plan | Leads / month | Per lead | Monthly (before tax) |
|---|---:|---:|---:|
| Starter | 10 | $40 | $400 |
| Growth (Most popular) | 50 | $35 | $1,750 |
| Scale | 100 | $30 | $3,000 |

## Turning on card payments (Stripe)

1. **Admin → Billing → Settings → Card payments (Stripe):** paste the secret key (`sk_live_…`, or `sk_test_…` to try it) and the webhook signing secret (`whsec_…`), then save. No restart needed. The keys are write-only (shown masked after saving) and stored in the site database. Alternatively set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `/etc/instasure/instasure.env` and restart; the environment takes priority over the admin fields.
2. Stripe dashboard → Webhooks → endpoint `https://instasure.ca/api/billing/stripe/webhook` with events `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. Products and tax rates are created in Stripe on first use. Refunds are done in Stripe; then "Record refund" on the invoice.

Without Stripe, agents get an invoice with the e-Transfer instructions from Billing settings. On a non-production server, a "Simulate payment (test mode)" button appears on open invoices.

## Before taking money (owner decisions)

- **Tax:** register for GST/HST and enter the number in Billing settings (printed on every invoice). Defaults charge GST/HST only, by the agent's billing province (ON 13%, NS 14%, NB/NL/PE 15%, others 5%); have an accountant confirm place-of-supply and whether PST/QST applies.
- **Legal:** counsel to review the agent terms (`/terms/#agent-accounts`), the updated privacy policy and How we make money (they now disclose that agents pay a flat fee per introduction and that a request goes to one agent only), and each regulator's rules on paying for leads (FSRA, RIBO, Insurance Council of BC, AIC, etc.).
- **Identity:** legal name and mailing address in Site settings (they print on invoices); an e-Transfer email in Billing settings.

## Images

Stock photos from Pexels and Burst by Shopify (both free for commercial use, no attribution required). They don't show Instasure agents or customers, and the page says so.

| File | Source |
|---|---|
| `public/img/agents/agent-on-call*` (hero, OG image) | https://www.pexels.com/photo/woman-sitting-in-front-of-a-laptop-and-talking-on-the-phone-20148736/ |
| `public/img/agents/agent-with-clients*` | https://www.pexels.com/photo/insurance-agent-sitting-next-to-smiling-clients-8441861/ |
| `public/img/agents/agent-working-leads*` | https://www.shopify.com/stock-photos/photos/customer-service-rep-on-headset (Burst, photo by Sarah Pflug; cropped to 3:2) |
