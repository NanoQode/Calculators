'use strict';
/**
 * Provinces, territories and cities. Province/city facts make programmatic pages genuinely unique
 * (regulator, auto system, local perils, market events) instead of templated "thin" pages.
 *
 * IMPORTANT: Facts are editorial starting points compiled Oct 2026 from public sources (see `sources`).
 * Each geo record shows as "needs verification" in Admin → Geo until a licensed team member signs off.
 * Pricing benchmarks are MODELLED (labelled as such on the site) unless a source is attached.
 */

const provinces = [
  {
    code: 'on', abbr: 'ON', slug: 'ontario', name: 'Ontario', tz: 'America/Toronto', lang: 'en',
    regulator: { name: 'Financial Services Regulatory Authority of Ontario (FSRA)', short: 'FSRA', url: 'https://www.fsrao.ca/' },
    licensing: 'FSRA licenses life agents (LLQP) and accident & sickness agents; property & casualty brokers are licensed by the Registered Insurance Brokers of Ontario (RIBO).',
    auto: { system: 'private', label: 'Private insurers compete on price', minLiability: 200000 },
    autoNotes: [
      'Ontario auto insurance is sold by private insurers and brokers; rates are filed with and approved by FSRA.',
      'Since July 1, 2026, only medical, rehabilitation and attendant-care accident benefits remain mandatory. Income replacement, non-earner, caregiver, housekeeping, death & funeral and several other benefits became optional — review them at renewal, especially if you are self-employed or a gig driver.',
      'Direct Compensation – Property Damage (DCPD) became optional in 2024; dropping it can save money but shifts risk if you are not at fault.',
    ],
    risks: ['Vehicle theft concentrated in the Greater Toronto Area', 'Basement flooding and sewer backup after intense summer storms', 'Ice storms and freezing rain', 'Severe convective storms and tornadoes in eastern and southwestern Ontario'],
    events2026: ['Optional accident benefits from July 1, 2026', 'Mortgage renewal wave driving mortgage-protection reviews'],
    benchmarks: { autoAnnual: 2164, autoSource: 'FSRA average premium, Oct 2025 (as reported by Ratehub)', homeAnnual: 1600, tenantMonthly: 26, condoMonthly: 38 },
    population: 15996989,
    sources: ['https://www.fsrao.ca/', 'https://www.northbridgeinsurance.ca/ontario-auto-reform/', 'https://www.intact.ca/en/personal-insurance/vehicle/ontario-auto-reform'],
  },
  {
    code: 'qc', abbr: 'QC', slug: 'quebec', name: 'Quebec', tz: 'America/Toronto', lang: 'fr',
    regulator: { name: 'Autorité des marchés financiers (AMF)', short: 'AMF', url: 'https://lautorite.qc.ca/' },
    licensing: 'Representatives and firms must be certified/registered with the AMF; online insurance offers require an AMF-registered firm with a representative available to consumers.',
    auto: { system: 'hybrid', label: 'SAAQ covers bodily injury; private insurers cover property damage', minLiability: 50000, publicInsurer: 'SAAQ' },
    autoNotes: [
      'Bodily injury from auto accidents is covered on a no-fault basis by the Société de l’assurance automobile du Québec (SAAQ), funded through licence and registration fees.',
      'Property damage and civil liability are covered by private insurers; the legal minimum civil liability is $50,000, though most drivers carry $1 million or more.',
    ],
    risks: ['Spring flooding along the St. Lawrence, Ottawa and Rivière des Prairies', 'Ice storms', 'Vehicle theft in the Montreal region'],
    events2026: ['French-language search (“assurance auto”, “assurance habitation”, “soumission”) dominates — French pages are required to compete'],
    benchmarks: { autoAnnual: 950, homeAnnual: 1100, tenantMonthly: 20, condoMonthly: 30 },
    population: 8874683,
    sources: ['https://saaq.gouv.qc.ca/', 'https://lautorite.qc.ca/'],
  },
  {
    code: 'bc', abbr: 'BC', slug: 'british-columbia', name: 'British Columbia', tz: 'America/Vancouver', lang: 'en',
    regulator: { name: 'BC Financial Services Authority (BCFSA)', short: 'BCFSA', url: 'https://www.bcfsa.ca/' },
    licensing: 'Insurance agents, brokers and adjusters are licensed through the Insurance Council of British Columbia / BCFSA.',
    auto: { system: 'public', label: 'ICBC Basic is mandatory; optional coverage from ICBC or private insurers', minLiability: 200000, publicInsurer: 'ICBC' },
    autoNotes: [
      'Every BC vehicle must carry ICBC Basic Autoplan. Since May 2021 BC uses the Enhanced Care (no-fault) model for injury benefits.',
      'ICBC basic rates are frozen through 2027. Optional coverage — extra liability, collision, comprehensive — can be bought from ICBC or private insurers, so that is where shopping saves money.',
    ],
    risks: ['Earthquake (coastal BC) — usually an optional endorsement', 'Wildfire in the Interior', 'Atmospheric-river flooding (Fraser Valley 2021)', 'High strata deductibles for condo owners'],
    events2026: ['ICBC basic rate freeze through 2027'],
    benchmarks: { autoAnnual: 1950, homeAnnual: 1500, tenantMonthly: 24, condoMonthly: 42 },
    population: 5000879,
    sources: ['https://www.icbc.com/', 'https://news.gov.bc.ca/releases/2025AG0063-001064'],
  },
  {
    code: 'ab', abbr: 'AB', slug: 'alberta', name: 'Alberta', tz: 'America/Edmonton', lang: 'en',
    regulator: { name: 'Alberta Superintendent of Insurance (Treasury Board and Finance)', short: 'Superintendent of Insurance', url: 'https://www.alberta.ca/automobile-insurance-reform' },
    licensing: 'Agents and brokers are licensed by the Alberta Insurance Council.',
    auto: { system: 'private', label: 'Private insurers with a government rate cap', minLiability: 200000 },
    autoNotes: [
      'Alberta auto insurance is private but tightly regulated. For 2026 the rate cap for eligible good drivers is 7.5%.',
      'Alberta is moving to a “Care-First” (no-fault-style) injury model from January 1, 2027, with a new adjustable cap on insurers’ average increases.',
      'Alberta auto premiums rose sharply in 2026 (+22.6% year over year in Q2 2026 per the Applied Rating Index), making comparison shopping especially valuable.',
    ],
    risks: ['Hail — Calgary sits in Canada’s “hail alley”', 'Wildfire (Fort McMurray 2016, Jasper 2024)', 'Overland flooding (Calgary 2013)'],
    events2026: ['2026 good-driver rate cap at 7.5%', 'Care-First auto model starts January 1, 2027'],
    benchmarks: { autoAnnual: 2050, homeAnnual: 1850, tenantMonthly: 25, condoMonthly: 36 },
    population: 4262635,
    sources: ['https://www.alberta.ca/automobile-insurance-reform', 'https://globalnews.ca/news/11850466/alberta-auto-insurance-adjustable-rate-cap/'],
  },
  {
    code: 'mb', abbr: 'MB', slug: 'manitoba', name: 'Manitoba', tz: 'America/Winnipeg', lang: 'en',
    regulator: { name: 'Manitoba Financial Institutions Regulation Branch', short: 'FIRB', url: 'https://www.gov.mb.ca/' },
    licensing: 'Agents and brokers are licensed by the Insurance Council of Manitoba.',
    auto: { system: 'public', label: 'Manitoba Public Insurance (MPI) provides basic Autopac', publicInsurer: 'MPI' },
    autoNotes: ['Basic Autopac coverage is provided by Manitoba Public Insurance (MPI) through Autopac agents. Extension coverage is also largely written through MPI.'],
    risks: ['Spring flooding along the Red and Assiniboine rivers', 'Hail and summer storms', 'Extreme cold and frozen pipes'],
    events2026: [],
    benchmarks: { autoAnnual: 1350, homeAnnual: 1800, tenantMonthly: 23, condoMonthly: 34 },
    population: 1342153,
    sources: ['https://www.mpi.mb.ca/'],
  },
  {
    code: 'sk', abbr: 'SK', slug: 'saskatchewan', name: 'Saskatchewan', tz: 'America/Regina', lang: 'en',
    regulator: { name: 'Financial and Consumer Affairs Authority (FCAA)', short: 'FCAA', url: 'https://fcaa.gov.sk.ca/' },
    licensing: 'Licensing is administered by the General Insurance Council and Life Insurance Council of Saskatchewan under the FCAA.',
    auto: { system: 'public', label: 'SGI provides basic plate coverage; optional packages available', publicInsurer: 'SGI' },
    autoNotes: ['Basic coverage comes with your licence plate through SGI (Saskatchewan Auto Fund). Optional packages are available from SGI Canada and some private insurers.'],
    risks: ['Hail and severe summer storms', 'Blizzards and extreme cold', 'Drought and grass fires'],
    events2026: [],
    benchmarks: { autoAnnual: 1300, homeAnnual: 1800, tenantMonthly: 22, condoMonthly: 32 },
    population: 1132505,
    sources: ['https://www.sgi.sk.ca/'],
  },
  {
    code: 'ns', abbr: 'NS', slug: 'nova-scotia', name: 'Nova Scotia', tz: 'America/Halifax', lang: 'en',
    regulator: { name: 'Nova Scotia Superintendent of Insurance', short: 'NS Superintendent of Insurance', url: 'https://www.novascotia.ca/' },
    licensing: 'Agents and brokers are licensed through the Nova Scotia Superintendent of Insurance.',
    auto: { system: 'private', label: 'Private insurers', minLiability: 500000 },
    autoNotes: ['Auto insurance is sold by private insurers; rates are reviewed by the Nova Scotia Utility and Review Board.'],
    risks: ['Hurricanes and post-tropical storms (Fiona 2022)', 'Coastal and flash flooding (July 2023)', 'Wildfire (2023 Tantallon fire)'],
    events2026: [],
    benchmarks: { autoAnnual: 1250, homeAnnual: 1300, tenantMonthly: 22, condoMonthly: 32 },
    population: 969383,
    sources: [],
  },
  {
    code: 'nb', abbr: 'NB', slug: 'new-brunswick', name: 'New Brunswick', tz: 'America/Halifax', lang: 'en',
    regulator: { name: 'Financial and Consumer Services Commission (FCNB)', short: 'FCNB', url: 'https://fcnb.ca/' },
    licensing: 'Agents and brokers are licensed by FCNB. New Brunswick is officially bilingual — French content helps in the north and southeast.',
    auto: { system: 'private', label: 'Private insurers', minLiability: 200000 },
    autoNotes: ['Auto insurance is sold by private insurers; rate filings are reviewed by the New Brunswick Insurance Board.'],
    risks: ['Saint John River spring flooding (2018, 2019)', 'Winter storms and ice', 'Coastal storm surge'],
    events2026: [],
    benchmarks: { autoAnnual: 1050, homeAnnual: 1100, tenantMonthly: 20, condoMonthly: 30 },
    population: 775610,
    sources: [],
  },
  {
    code: 'nl', abbr: 'NL', slug: 'newfoundland-and-labrador', name: 'Newfoundland and Labrador', tz: 'America/St_Johns', lang: 'en',
    regulator: { name: 'Superintendent of Insurance (Digital Government and Service NL)', short: 'Service NL', url: 'https://www.gov.nl.ca/' },
    licensing: 'Agents and brokers are licensed by the Superintendent of Insurance.',
    auto: { system: 'private', label: 'Private insurers', minLiability: 200000 },
    autoNotes: ['Auto insurance is sold by private insurers; the Board of Commissioners of Public Utilities reviews rates.'],
    risks: ['High winds and coastal storms', 'Heavy snowfall (January 2020 blizzard)', 'Coastal flooding'],
    events2026: [],
    benchmarks: { autoAnnual: 1350, homeAnnual: 1200, tenantMonthly: 22, condoMonthly: 32 },
    population: 510550,
    sources: [],
  },
  {
    code: 'pe', abbr: 'PE', slug: 'prince-edward-island', name: 'Prince Edward Island', tz: 'America/Halifax', lang: 'en',
    regulator: { name: 'PEI Superintendent of Insurance', short: 'PEI Superintendent', url: 'https://www.princeedwardisland.ca/' },
    licensing: 'Agents and brokers are licensed by the PEI Superintendent of Insurance.',
    auto: { system: 'private', label: 'Private insurers', minLiability: 200000 },
    autoNotes: ['Auto insurance is sold by private insurers; rates are reviewed by the Island Regulatory and Appeals Commission.'],
    risks: ['Hurricanes and post-tropical storms (Fiona 2022)', 'Coastal erosion and storm surge'],
    events2026: [],
    benchmarks: { autoAnnual: 950, homeAnnual: 1100, tenantMonthly: 20, condoMonthly: 30 },
    population: 154331,
    sources: [],
  },
  {
    code: 'yt', abbr: 'YT', slug: 'yukon', name: 'Yukon', tz: 'America/Whitehorse', lang: 'en', territory: true,
    regulator: { name: 'Yukon Superintendent of Insurance', short: 'Yukon Superintendent', url: 'https://yukon.ca/' },
    licensing: 'Agents and brokers are licensed by the Yukon Superintendent of Insurance.',
    auto: { system: 'private', label: 'Private insurers' },
    autoNotes: ['Auto insurance is sold by private insurers; fewer carriers write northern risks, so a broker’s market access matters.'],
    risks: ['Wildfire', 'Extreme cold', 'Limited insurer availability in remote communities'],
    events2026: [], benchmarks: { autoAnnual: 1300, homeAnnual: 2000, tenantMonthly: 28, condoMonthly: 40 }, population: 40232, sources: [],
  },
  {
    code: 'nt', abbr: 'NT', slug: 'northwest-territories', name: 'Northwest Territories', tz: 'America/Yellowknife', lang: 'en', territory: true,
    regulator: { name: 'NWT Superintendent of Insurance', short: 'NWT Superintendent', url: 'https://www.gov.nt.ca/' },
    licensing: 'Agents and brokers are licensed by the NWT Superintendent of Insurance.',
    auto: { system: 'private', label: 'Private insurers' },
    autoNotes: ['Auto insurance is sold by private insurers.'],
    risks: ['Wildfire (2023 Yellowknife evacuation)', 'Extreme cold', 'Permafrost-related foundation issues'],
    events2026: [], benchmarks: { autoAnnual: 1300, homeAnnual: 2100, tenantMonthly: 28, condoMonthly: 40 }, population: 41070, sources: [],
  },
  {
    code: 'nu', abbr: 'NU', slug: 'nunavut', name: 'Nunavut', tz: 'America/Iqaluit', lang: 'en', territory: true,
    regulator: { name: 'Nunavut Superintendent of Insurance', short: 'Nunavut Superintendent', url: 'https://www.gov.nu.ca/' },
    licensing: 'Agents and brokers are licensed by the Nunavut Superintendent of Insurance.',
    auto: { system: 'private', label: 'Private insurers' },
    autoNotes: ['Auto insurance is sold by private insurers; availability is limited.'],
    risks: ['Extreme cold', 'Limited insurer availability', 'High rebuild costs due to shipping logistics'],
    events2026: [], benchmarks: { autoAnnual: 1300, homeAnnual: 2400, tenantMonthly: 30, condoMonthly: 42 }, population: 36858, sources: [],
  },
];

// tier 1 = indexable programmatic pages by default; tier 2 = indexable for province-level products;
// tier 3 = generated but noindex until enriched with custom content in the admin.
const cities = [
  // Ontario — GTA + major centres
  { slug: 'toronto', name: 'Toronto', prov: 'on', pop: 2794356, tier: 1, region: 'GTA', autoFactor: 1.25, risks: ['Among Canada’s highest vehicle-theft volumes', 'Basement flooding from intense summer storms (2013, 2018, 2024)', 'Large condo market with high deductible assessments'], near: ['mississauga', 'vaughan', 'markham', 'richmond-hill', 'pickering'] },
  { slug: 'ottawa', name: 'Ottawa', prov: 'on', pop: 1017449, tier: 1, region: 'Eastern Ontario', autoFactor: 0.85, risks: ['Tornadoes (Dunrobin 2018) and the 2022 derecho', 'Ice storms and freeze–thaw damage', 'Ottawa River spring flooding'], near: ['kingston', 'gatineau'] },
  { slug: 'mississauga', name: 'Mississauga', prov: 'on', pop: 717961, tier: 1, region: 'GTA (Peel)', autoFactor: 1.32, risks: ['High auto claim frequency in Peel Region', 'Vehicle theft', 'Condo growth with rising deductibles'], near: ['brampton', 'oakville', 'toronto', 'milton'] },
  { slug: 'brampton', name: 'Brampton', prov: 'on', pop: 656480, tier: 1, region: 'GTA (Peel)', autoFactor: 1.55, risks: ['Historically among Ontario’s most expensive auto premiums', 'High claims and fraud history in Peel', 'Vehicle theft'], near: ['mississauga', 'vaughan', 'milton', 'guelph'] },
  { slug: 'hamilton', name: 'Hamilton', prov: 'on', pop: 569353, tier: 1, region: 'Golden Horseshoe', autoFactor: 1.08, risks: ['Older housing stock (wiring, plumbing) affects home premiums', 'Escarpment run-off and basement flooding'], near: ['burlington', 'st-catharines', 'oakville', 'cambridge'] },
  { slug: 'london', name: 'London', prov: 'on', pop: 422324, tier: 1, region: 'Southwestern Ontario', autoFactor: 0.86, risks: ['Severe thunderstorms and tornado watches', 'Student rental market (tenant insurance)'], near: ['kitchener', 'windsor', 'guelph'] },
  { slug: 'markham', name: 'Markham', prov: 'on', pop: 338503, tier: 1, region: 'GTA (York)', autoFactor: 1.25, risks: ['High-value vehicle theft (SUVs, trucks)', 'Basement flooding'], near: ['richmond-hill', 'toronto', 'vaughan', 'pickering'] },
  { slug: 'vaughan', name: 'Vaughan', prov: 'on', pop: 323103, tier: 1, region: 'GTA (York)', autoFactor: 1.35, risks: ['High-value vehicle theft', 'High auto claim costs'], near: ['richmond-hill', 'brampton', 'toronto', 'markham'] },
  { slug: 'kitchener', name: 'Kitchener', prov: 'on', pop: 256885, tier: 1, region: 'Waterloo Region', autoFactor: 0.86, risks: ['Student and young-professional rentals', 'Winter driving'], near: ['waterloo', 'cambridge', 'guelph', 'london'] },
  { slug: 'windsor', name: 'Windsor', prov: 'on', pop: 229660, tier: 1, region: 'Southwestern Ontario', autoFactor: 1.0, risks: ['Basement flooding events (2016, 2017)', 'Cross-border commuters (travel medical coverage)'], near: ['london'] },
  { slug: 'oakville', name: 'Oakville', prov: 'on', pop: 213759, tier: 2, region: 'GTA (Halton)', autoFactor: 1.05, risks: ['High-value homes and vehicles', 'Vehicle theft'], near: ['mississauga', 'burlington', 'milton'] },
  { slug: 'richmond-hill', name: 'Richmond Hill', prov: 'on', pop: 202022, tier: 2, region: 'GTA (York)', autoFactor: 1.3, risks: ['High-value vehicle theft', 'Basement flooding'], near: ['markham', 'vaughan', 'toronto'] },
  { slug: 'burlington', name: 'Burlington', prov: 'on', pop: 186948, tier: 2, region: 'GTA (Halton)', autoFactor: 0.95, risks: ['Flash flooding (2014 record rainfall)'], near: ['oakville', 'hamilton', 'milton'] },
  { slug: 'oshawa', name: 'Oshawa', prov: 'on', pop: 175383, tier: 2, region: 'Durham', autoFactor: 1.12, risks: ['Commuter-heavy driving on the 401', 'Winter storms off Lake Ontario'], near: ['whitby', 'ajax', 'pickering'] },
  { slug: 'barrie', name: 'Barrie', prov: 'on', pop: 147829, tier: 2, region: 'Simcoe', autoFactor: 0.92, risks: ['Snowbelt winter driving', 'Tornado history (1985, 2021)'], near: ['toronto', 'vaughan'] },
  { slug: 'guelph', name: 'Guelph', prov: 'on', pop: 143740, tier: 2, region: 'Wellington', autoFactor: 0.82, risks: ['Student rentals'], near: ['kitchener', 'cambridge', 'brampton'] },
  { slug: 'cambridge', name: 'Cambridge', prov: 'on', pop: 138479, tier: 3, region: 'Waterloo Region', autoFactor: 0.86, risks: ['Grand River flooding history'], near: ['kitchener', 'guelph', 'hamilton'] },
  { slug: 'whitby', name: 'Whitby', prov: 'on', pop: 138501, tier: 3, region: 'Durham', autoFactor: 1.1, risks: ['Commuter-heavy driving'], near: ['oshawa', 'ajax', 'pickering'] },
  { slug: 'st-catharines', name: 'St. Catharines', prov: 'on', pop: 136803, tier: 2, region: 'Niagara', autoFactor: 0.9, risks: ['Lake-effect weather', 'Cross-border travel'], near: ['hamilton', 'burlington'] },
  { slug: 'milton', name: 'Milton', prov: 'on', pop: 132979, tier: 3, region: 'GTA (Halton)', autoFactor: 1.05, risks: ['Fast-growing new-build neighbourhoods'], near: ['oakville', 'mississauga', 'brampton', 'burlington'] },
  { slug: 'kingston', name: 'Kingston', prov: 'on', pop: 132485, tier: 2, region: 'Eastern Ontario', autoFactor: 0.78, risks: ['Student rentals', 'Winter storms'], near: ['ottawa'] },
  { slug: 'ajax', name: 'Ajax', prov: 'on', pop: 126666, tier: 3, region: 'Durham', autoFactor: 1.15, risks: ['Commuter-heavy driving', 'Vehicle theft'], near: ['pickering', 'whitby', 'oshawa'] },
  { slug: 'waterloo', name: 'Waterloo', prov: 'on', pop: 121436, tier: 2, region: 'Waterloo Region', autoFactor: 0.85, risks: ['Large student rental market'], near: ['kitchener', 'cambridge', 'guelph'] },
  { slug: 'thunder-bay', name: 'Thunder Bay', prov: 'on', pop: 108843, tier: 3, region: 'Northern Ontario', autoFactor: 0.78, risks: ['Extreme cold and frozen pipes', 'Wildlife collisions'], near: [] },
  { slug: 'pickering', name: 'Pickering', prov: 'on', pop: 99186, tier: 3, region: 'Durham', autoFactor: 1.15, risks: ['Vehicle theft', 'Commuter-heavy driving'], near: ['ajax', 'markham', 'toronto'] },
  { slug: 'sudbury', name: 'Sudbury', prov: 'on', pop: 166004, tier: 3, region: 'Northern Ontario', autoFactor: 0.78, risks: ['Winter driving and wildlife collisions'], near: [] },
  // Quebec
  { slug: 'montreal', name: 'Montreal', prov: 'qc', pop: 1762949, tier: 1, region: 'Greater Montreal', autoFactor: 1.15, risks: ['Spring flooding (2017, 2019)', 'Vehicle theft linked to export through the port', 'Ice storms (1998, April 2023)'], near: ['laval', 'longueuil', 'gatineau'] },
  { slug: 'quebec-city', name: 'Quebec City', prov: 'qc', pop: 549459, tier: 1, region: 'Capitale-Nationale', autoFactor: 0.85, risks: ['Heavy snowfall and winter driving', 'Freeze–thaw damage'], near: ['montreal', 'sherbrooke'] },
  { slug: 'laval', name: 'Laval', prov: 'qc', pop: 438366, tier: 1, region: 'Greater Montreal', autoFactor: 1.1, risks: ['Rivière des Prairies flooding (2017, 2019)', 'Vehicle theft'], near: ['montreal', 'longueuil'] },
  { slug: 'gatineau', name: 'Gatineau', prov: 'qc', pop: 291041, tier: 2, region: 'Outaouais', autoFactor: 0.95, risks: ['Ottawa River flooding (2017, 2019)', '2018 tornadoes'], near: ['ottawa', 'montreal'] },
  { slug: 'longueuil', name: 'Longueuil', prov: 'qc', pop: 254483, tier: 2, region: 'Greater Montreal', autoFactor: 1.05, risks: ['Vehicle theft', 'Ice storms'], near: ['montreal', 'laval'] },
  { slug: 'sherbrooke', name: 'Sherbrooke', prov: 'qc', pop: 172950, tier: 3, region: 'Estrie', autoFactor: 0.85, risks: ['River flooding', 'Winter driving'], near: ['montreal', 'quebec-city'] },
  // British Columbia
  { slug: 'vancouver', name: 'Vancouver', prov: 'bc', pop: 662248, tier: 1, region: 'Metro Vancouver', autoFactor: 1.1, risks: ['Earthquake risk (optional coverage)', 'Very high strata deductibles', 'High property values'], near: ['burnaby', 'richmond', 'surrey', 'coquitlam'] },
  { slug: 'surrey', name: 'Surrey', prov: 'bc', pop: 568322, tier: 1, region: 'Metro Vancouver', autoFactor: 1.05, risks: ['Fast-growing condo and townhouse stock', 'Earthquake and flood risk in low-lying areas'], near: ['langley', 'burnaby', 'richmond', 'abbotsford'] },
  { slug: 'burnaby', name: 'Burnaby', prov: 'bc', pop: 249125, tier: 1, region: 'Metro Vancouver', autoFactor: 1.05, risks: ['High-rise condo deductibles', 'Earthquake risk'], near: ['vancouver', 'coquitlam', 'surrey'] },
  { slug: 'richmond', name: 'Richmond', prov: 'bc', pop: 209937, tier: 2, region: 'Metro Vancouver', autoFactor: 1.05, risks: ['Low-lying land protected by dikes (flood)', 'Earthquake and liquefaction risk'], near: ['vancouver', 'burnaby', 'surrey'] },
  { slug: 'abbotsford', name: 'Abbotsford', prov: 'bc', pop: 153524, tier: 2, region: 'Fraser Valley', autoFactor: 0.95, risks: ['Sumas Prairie flooding (2021)', 'Agricultural and rural properties'], near: ['langley', 'surrey'] },
  { slug: 'coquitlam', name: 'Coquitlam', prov: 'bc', pop: 148625, tier: 2, region: 'Metro Vancouver', autoFactor: 1.0, risks: ['Earthquake risk', 'Wildland–urban interface'], near: ['burnaby', 'vancouver'] },
  { slug: 'kelowna', name: 'Kelowna', prov: 'bc', pop: 144576, tier: 1, region: 'Okanagan', autoFactor: 0.95, risks: ['Wildfire (2003, 2023)', 'Lake flooding (2017)'], near: [] },
  { slug: 'langley', name: 'Langley', prov: 'bc', pop: 132603, tier: 3, region: 'Metro Vancouver', autoFactor: 0.98, risks: ['Fraser River flooding', 'Earthquake risk'], near: ['surrey', 'abbotsford'] },
  { slug: 'victoria', name: 'Victoria', prov: 'bc', pop: 91867, tier: 1, region: 'Vancouver Island', autoFactor: 0.9, risks: ['High earthquake risk (Cascadia)', 'Older heritage homes'], near: [] },
  // Alberta
  { slug: 'calgary', name: 'Calgary', prov: 'ab', pop: 1306784, tier: 1, region: 'Southern Alberta', autoFactor: 1.05, risks: ['Severe hail — 2024 hailstorm among Canada’s costliest insured events', 'Bow and Elbow river flooding (2013)', 'Rising auto premiums ahead of Care-First'], near: ['airdrie', 'red-deer'] },
  { slug: 'edmonton', name: 'Edmonton', prov: 'ab', pop: 1010899, tier: 1, region: 'Capital Region', autoFactor: 1.0, risks: ['Hail and summer storms', 'Extreme cold and frozen pipes', 'Wildfire smoke and evacuations nearby'], near: ['red-deer'] },
  { slug: 'red-deer', name: 'Red Deer', prov: 'ab', pop: 100844, tier: 2, region: 'Central Alberta', autoFactor: 0.95, risks: ['Hail', 'Winter driving on Highway 2'], near: ['calgary', 'edmonton'] },
  { slug: 'lethbridge', name: 'Lethbridge', prov: 'ab', pop: 98406, tier: 2, region: 'Southern Alberta', autoFactor: 0.9, risks: ['High winds', 'Hail'], near: ['calgary'] },
  { slug: 'airdrie', name: 'Airdrie', prov: 'ab', pop: 74100, tier: 3, region: 'Calgary Region', autoFactor: 1.0, risks: ['Hail', 'Commuter driving to Calgary'], near: ['calgary'] },
  // Prairies
  { slug: 'winnipeg', name: 'Winnipeg', prov: 'mb', pop: 749607, tier: 1, region: 'Manitoba', autoFactor: 1.0, risks: ['Red River spring flooding', 'Hail and summer storms', 'Extreme cold'], near: ['brandon'] },
  { slug: 'brandon', name: 'Brandon', prov: 'mb', pop: 51313, tier: 3, region: 'Westman', autoFactor: 0.95, risks: ['Assiniboine River flooding', 'Hail'], near: ['winnipeg'] },
  { slug: 'saskatoon', name: 'Saskatoon', prov: 'sk', pop: 266141, tier: 1, region: 'Saskatchewan', autoFactor: 1.0, risks: ['Hail and severe storms', 'Extreme cold'], near: ['regina'] },
  { slug: 'regina', name: 'Regina', prov: 'sk', pop: 226404, tier: 1, region: 'Saskatchewan', autoFactor: 1.0, risks: ['Hail and high winds', 'Blizzards'], near: ['saskatoon'] },
  // Atlantic
  { slug: 'halifax', name: 'Halifax', prov: 'ns', pop: 439819, tier: 1, region: 'Halifax Regional Municipality', autoFactor: 1.1, risks: ['Post-tropical storms (Fiona 2022)', 'July 2023 flash flooding', '2023 Tantallon wildfire'], near: [] },
  { slug: 'moncton', name: 'Moncton', prov: 'nb', pop: 79470, tier: 2, region: 'Southeast NB', autoFactor: 1.0, risks: ['Winter storms', 'Coastal storm surge'], near: ['saint-john', 'fredericton'] },
  { slug: 'saint-john', name: 'Saint John', prov: 'nb', pop: 69895, tier: 2, region: 'Southern NB', autoFactor: 1.0, risks: ['Saint John River flooding (2018, 2019)', 'Coastal storms'], near: ['moncton', 'fredericton'] },
  { slug: 'fredericton', name: 'Fredericton', prov: 'nb', pop: 63116, tier: 2, region: 'Central NB', autoFactor: 0.95, risks: ['Saint John River flooding (2018, 2019)'], near: ['saint-john', 'moncton'] },
  { slug: 'st-johns', name: 'St. John’s', prov: 'nl', pop: 110525, tier: 1, region: 'Avalon', autoFactor: 1.0, risks: ['High winds and coastal storms', 'Heavy snowfall (2020 blizzard)'], near: [] },
  { slug: 'charlottetown', name: 'Charlottetown', prov: 'pe', pop: 38809, tier: 2, region: 'Queens County', autoFactor: 1.0, risks: ['Post-tropical storms (Fiona 2022)', 'Coastal erosion'], near: [] },
  // North
  { slug: 'whitehorse', name: 'Whitehorse', prov: 'yt', pop: 28201, tier: 3, region: 'Yukon', autoFactor: 1.0, risks: ['Wildfire', 'Extreme cold'], near: [] },
  { slug: 'yellowknife', name: 'Yellowknife', prov: 'nt', pop: 20340, tier: 3, region: 'NWT', autoFactor: 1.0, risks: ['Wildfire (2023 evacuation)', 'Extreme cold'], near: [] },
];

const provinceBySlug = Object.fromEntries(provinces.map((p) => [p.slug, p]));
const provinceByCode = Object.fromEntries(provinces.map((p) => [p.code, p]));
const cityKey = (c) => `${c.prov}/${c.slug}`;
const cityByKey = Object.fromEntries(cities.map((c) => [cityKey(c), c]));
const citiesByProv = provinces.reduce((acc, p) => {
  acc[p.code] = cities.filter((c) => c.prov === p.code).sort((a, b) => b.pop - a.pop);
  return acc;
}, {});

/** Postal-code first letter → province code (Canada Post FSA). */
const POSTAL_PREFIX = {
  A: 'nl', B: 'ns', C: 'pe', E: 'nb', G: 'qc', H: 'qc', J: 'qc', K: 'on', L: 'on', M: 'on', N: 'on', P: 'on',
  R: 'mb', S: 'sk', T: 'ab', V: 'bc', Y: 'yt', X: 'nt', // X covers NT and NU
};

function provinceFromPostal(postal) {
  const m = String(postal || '').trim().toUpperCase().match(/^([A-Z])\d[A-Z]\s?\d[A-Z]\d$/);
  return m ? POSTAL_PREFIX[m[1]] || null : null;
}

module.exports = { provinces, cities, provinceBySlug, provinceByCode, cityByKey, citiesByProv, cityKey, provinceFromPostal };
