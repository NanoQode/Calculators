'use strict';
/**
 * Insurance sales pipeline. Keys are stored in leads.status; labels are what people see.
 * Life/health and P&C both fit: a needs analysis, a quote, an application, underwriting,
 * approval, then the policy is issued and placed ("won").
 */
const STAGES = [
  { key: 'new', label: 'New lead', open: true, board: true },
  { key: 'contacted', label: 'Contacted', open: true, board: true },
  { key: 'needs_analysis', label: 'Needs analysis', open: true, board: true },
  { key: 'quoted', label: 'Quoted', open: true, board: true },
  { key: 'application', label: 'Application submitted', open: true, board: true },
  { key: 'underwriting', label: 'In underwriting', open: true, board: true },
  { key: 'approved', label: 'Approved (awaiting delivery)', open: true, board: true },
  { key: 'won', label: 'Policy issued (won)', open: false, board: true },
  { key: 'nurture', label: 'Nurture (follow up later)', open: false },
  { key: 'lost', label: 'Lost', open: false },
  { key: 'waitlist', label: 'Waitlist (province not served)', open: false },
  { key: 'junk', label: 'Invalid / junk', open: false },
];
const KEYS = STAGES.map((s) => s.key);
const byKey = Object.fromEntries(STAGES.map((s) => [s.key, s]));
const OPEN = STAGES.filter((s) => s.open).map((s) => s.key);
const BOARD = STAGES.filter((s) => s.board).map((s) => s.key);
/** SQL list of open stages, e.g. for capacity checks: ('new','contacted',...) */
const OPEN_SQL = `(${OPEN.map((k) => `'${k}'`).join(',')})`;
/** Progress order used when merging records: the furthest-along stage wins. */
const RANK = { junk: -2, waitlist: -1, lost: 0, nurture: 1, new: 2, contacted: 3, needs_analysis: 4, quoted: 5, application: 6, underwriting: 7, approved: 8, won: 9 };
/** Stages that count as "worked" (an agent has reached the person). */
const WORKED = ['contacted', 'needs_analysis', 'quoted', 'application', 'underwriting', 'approved', 'won'];

/** Contact outcomes logged with a stage change. `stage` is the suggested next stage; `task` a suggested follow-up. */
const DISPOSITIONS = [
  { key: 'connected_interested', label: 'Connected – interested', stage: 'contacted' },
  { key: 'callback_requested', label: 'Connected – asked for a call back', stage: 'contacted', task: 'Call back' },
  { key: 'appointment_booked', label: 'Appointment booked', stage: 'contacted', task: 'Appointment' },
  { key: 'needs_analysis_done', label: 'Needs analysis completed', stage: 'needs_analysis', task: 'Send quote' },
  { key: 'quote_sent', label: 'Quote sent', stage: 'quoted', task: 'Follow up on quote' },
  { key: 'application_signed', label: 'Application signed', stage: 'application' },
  { key: 'medical_scheduled', label: 'Medical / paramedical scheduled', stage: 'underwriting', task: 'Check underwriting status' },
  { key: 'underwriting_requirements', label: 'Underwriting asked for more information', stage: 'underwriting', task: 'Chase underwriting requirements' },
  { key: 'approved', label: 'Approved by insurer', stage: 'approved', task: 'Deliver policy' },
  { key: 'policy_delivered', label: 'Policy delivered / placed', stage: 'won' },
  { key: 'voicemail', label: 'Left voicemail', task: 'Try again' },
  { key: 'no_answer', label: 'No answer', task: 'Try again' },
  { key: 'emailed_texted', label: 'Sent email or text', task: 'Follow up' },
  { key: 'not_ready', label: 'Not ready yet', stage: 'nurture', task: 'Check back' },
  { key: 'not_interested', label: 'Not interested', stage: 'lost' },
  { key: 'bought_elsewhere', label: 'Bought elsewhere / already insured', stage: 'lost' },
  { key: 'price', label: 'Price too high', stage: 'lost' },
  { key: 'declined', label: 'Declined by underwriting', stage: 'lost' },
  { key: 'wrong_number', label: 'Wrong number / bad contact details', stage: 'junk' },
  { key: 'do_not_contact', label: 'Asked not to be contacted', stage: 'lost' },
];
const dispositionByKey = Object.fromEntries(DISPOSITIONS.map((d) => [d.key, d]));

const label = (key) => (byKey[key] ? byKey[key].label : String(key || ''));

module.exports = { STAGES, KEYS, byKey, OPEN, OPEN_SQL, BOARD, RANK, WORKED, DISPOSITIONS, dispositionByKey, label };
