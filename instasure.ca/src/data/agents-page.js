'use strict';
/**
 * Copy for /insurance-leads-for-agents/ (B2B page that recruits licensed agents to buy leads).
 * Primary keyword: "insurance leads for agents" (title, H1, first 100 words, slug).
 * Secondary: "exclusive insurance leads", "life insurance leads canada", "free insurance leads",
 * "buy insurance leads", "insurance leads canada" (H2s, FAQ, body).
 * Facts here must stay true to the product: free-lead count, claim window and served provinces come
 * from settings; nothing claims volumes, conversion rates or regulator approval.
 */
const PATH = '/insurance-leads-for-agents/';
const UPDATED = '2026-11-04';
const PHOTOS = {
  hero: { base: '/img/agents/agent-on-call', w: 1600, h: 1067, alt: 'Insurance agent smiling on a phone call at her laptop' },
  clients: { base: '/img/agents/agent-with-clients', w: 1600, h: 1068, alt: 'Insurance agent reviewing a policy with an older couple at a table' },
  dashboard: { base: '/img/agents/agent-working-leads', w: 1600, h: 1067, alt: 'Agent wearing a headset working through leads on a laptop' },
};

const steps = (free) => [
  { icon: 'how_to_reg', name: 'Register free', text: 'Create your agent account in about three minutes: your licence number, the provinces and lines you’re licensed for, and a password. No credit card.' },
  { icon: 'verified_user', name: 'We verify your licence', text: 'We check your licence on the provincial regulator’s public register before any lead is sent, so every agent on the network is licensed.' },
  { icon: 'redeem', name: `Get ${free} free leads`, text: `Once you’re approved, your first ${free} exclusive leads arrive by email and in your dashboard as people ask for help.` },
  { icon: 'trending_up', name: 'Choose a plan when you’re ready', text: 'After your free leads, pick a monthly plan in your dashboard. Every plan is priced per lead; turn renewal off any time.' },
];

const inLead = [
  { icon: 'person', title: 'Contact details', text: 'Name, email and phone, plus the best time to call and their preferred language.' },
  { icon: 'request_quote', title: 'What they asked for', text: 'Product, coverage amount, quote answers and the instant estimate they saw on the site.' },
  { icon: 'grade', title: 'Lead score and grade', text: 'A 0–100 score and A–D grade from completeness, timeframe and engagement, so you call the hottest first.' },
  { icon: 'schedule', title: 'Timeframe and intent', text: 'When they want coverage and the page they came from, such as a mortgage-renewal or Super Visa guide.' },
  { icon: 'fact_check', title: 'Consent record', text: 'The exact consent wording they agreed to and when, kept with the lead for your compliance file.' },
  { icon: 'history', title: 'Full history', text: 'Every later request from the same person is added to the same lead, never sent to someone else as a new one.' },
];

const dashboard = [
  ['group', 'My leads', 'Every lead with its score, stage and next step; search and filter in seconds.'],
  ['view_kanban', 'Pipeline', 'Drag leads from New to Contacted, Quoted, Application and Policy issued.'],
  ['task_alt', 'Follow-ups', 'Reminders that pop up in the dashboard and arrive by email when they’re due.'],
  ['insights', 'Conversions', 'Contact, quote and win rates by month, and your average time to first contact.'],
  ['tune', 'Lead preferences', 'Choose provinces, lines, products and the lowest grade you want, or pause leads.'],
  ['receipt_long', 'Plan & billing', 'Your credits, plan, invoices and receipts in one place, with GST/HST shown.'],
];

const comparison = [
  ['Who else gets the lead', 'Nobody: one licensed agent per lead', 'Can go to several agents at once'],
  ['Where it comes from', 'A person asking for an estimate or advice on instasure.ca', 'Varies by vendor'],
  ['Licence check', 'Every agent verified on the regulator’s register', 'Not always'],
  ['Bad leads', 'Reported from the lead page and credited back if invalid', 'Varies by vendor'],
  ['Tools', 'Built-in pipeline, follow-ups and conversion tracking', 'Often a spreadsheet or email'],
  ['Commitment', 'Free start, then monthly plans; renewal can be turned off any time', 'Some vendors require contracts or minimums'],
];

function faq({ free, windowDays, served, publicPricing, lowest }) {
  const where = served.length ? served.join(', ') : 'the provinces we serve';
  return [
    { q: 'How do insurance leads for agents work on Instasure?', a: `Canadians ask for an instant estimate or a licensed advisor on instasure.ca. Each request is checked, scored A to D and sent to one agent licensed for that province and product. You get an email alert straight away and the full request in your dashboard: contact details, product, quote answers, timeframe and consent record.` },
    { q: 'Are the leads exclusive?', a: 'Yes. Each lead goes to one agent only and is never resold or shared. If a lead is moved to another agent, for example because you paused your leads, the credit it used is returned to you automatically.' },
    { q: 'How many free leads do I get?', a: `${free} free exclusive leads once your licence is verified. Registration is free and needs no credit card. When your free leads are used, you choose a monthly plan in your dashboard to keep receiving leads.` },
    { q: 'Who can join?', a: `Agents and brokers with a current insurance licence (life and accident & sickness, or general insurance) in at least one of these provinces: ${where}. We check every licence on the provincial regulator’s public register before sending leads. Quebec isn’t open yet.` },
    { q: 'What kinds of insurance leads are there?', a: 'Life (term, whole, no-medical, mortgage and final expense), critical illness and disability, health and dental, travel and Super Visa, car, home, condo, tenant and business insurance, plus specialist niches such as high-risk drivers and newcomers. You only receive the lines you’re licensed for.' },
    { q: 'How much do leads cost after the free ones?', a: publicPricing && lowest ? `Paid plans are priced per lead and billed monthly, from ${lowest} per lead plus GST/HST. Every plan and price is shown in your dashboard before you pay anything, and you can turn renewal off at any time.` : 'Paid plans are priced per lead and billed monthly, plus GST/HST. You see every plan and price in your dashboard before you pay anything, there’s no long-term contract, and you can turn renewal off at any time.' },
    { q: 'What happens if a lead is fake or wrong?', a: `Report it from the lead page within ${windowDays} days of delivery. If the phone number and email don’t work, it’s a duplicate, it’s outside your licence, or the person says they never asked to be contacted, we return the credit.` },
    { q: 'Do unused lead credits expire?', a: 'No. Each paid month adds your plan’s lead credits. If fewer matching leads arrive in a month than your plan includes, the balance carries over to the next month.' },
    { q: 'Can I choose which leads I receive?', a: 'Yes. In Lead preferences you can narrow leads by province, insurance line, product and minimum lead grade, and pause new leads at any time, for example while you’re on holiday.' },
    { q: 'Is paying for insurance leads allowed?', a: 'You pay a flat fee per lead for marketing, not a commission or a share of any sale. Rules on paying for leads, referral arrangements and disclosure differ by province and regulator, such as FSRA, RIBO or the Insurance Council of BC, so follow your regulator’s guidance and your agency or MGA’s policy.' },
  ];
}

module.exports = { PATH, UPDATED, PHOTOS, steps, inLead, dashboard, comparison, faq };
