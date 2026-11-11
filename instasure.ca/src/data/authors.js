'use strict';
/**
 * Named authors of instasure.ca guides. Seeded into the `advisors` table (authors and advisors share it,
 * because posts reference advisors for author_id and reviewer_id). Inserted if missing, never overwritten,
 * so edits made in Admin → Advisors stick. The `default` author is used for any guide without one.
 *
 * Michael's biography and credentials were supplied by the site owner (October 3, 2026); see
 * docs/CONTENT_REVIEW.md for the items to keep verifiable (CFP status on FP Canada's register).
 */
module.exports = [
  {
    slug: 'michael-le-chi',
    default: true,
    name: 'Michael Le Chi',
    designations: 'CFP',
    title: 'Certified Financial Planner · Contributing author',
    photo: '/img/team/michael-le-chi.webp',
    years_experience: 10,
    languages: ['en'],
    provinces: ['on'],
    categories: ['life', 'health', 'travel', 'auto', 'property', 'business'],
    accepting_leads: 0,
    bio_md: [
      'Michael Minh Le Chi is a Certified Financial Planner (CFP) and wealth manager based in Toronto, Ontario, with more than a decade in financial planning. His work centres on one idea: everyday individuals and families deserve objective, conflict-free financial advice.',
      '',
      'Before founding his independent practice, Le Chi Financial Wealth Management, Michael spent several years as an advisor at Sun Life Financial, where he was recognized as a Top 3 Consultant for three consecutive years and built and led his own advisory team. He specialized in comprehensive financial roadmaps that take clients from the start of their careers to a secure, independent retirement.',
      '',
      'Michael has also built businesses outside financial planning. He co-founded a global online fitness business with his wife, joined the fintech start-up Planly as a core contributor in 2019, and is co-owner of ClearPath Building Services.',
      '',
      'At Instasure.ca, Michael writes our guides and brings a planner\'s view to insurance: how coverage fits a household\'s budget, goals and long-term plan, and where it overlaps with savings, debt and retirement.',
      '',
      '*Michael\'s articles are general information, not personal financial, tax or insurance advice. For a recommendation on your situation, speak with an advisor licensed in your province.*',
    ].join('\n'),
  },
];
