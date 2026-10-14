'use strict';
/**
 * Instasure.ca — entry point.
 *   npm run build   # compile Tailwind CSS
 *   npm run seed    # create admin user, sample advisors, campaigns, scoring rules, guides
 *   npm start       # http://localhost:3000  (admin at /admin)
 */
const config = require('./src/config');
const { createApp } = require('./src/app');
const { seed } = require('./src/db/seed');
const drip = require('./src/lib/drip');

seed({ quiet: false });
const app = createApp();

const server = app.listen(config.port, config.host, () => {
  console.log(`Instasure.ca running on http://localhost:${config.port} (site URL ${config.siteUrl})`);
  if (!config.smtp) console.log('SMTP not configured — emails are stored in Admin → Email log with status "logged".');
});

if (!config.dripDisabled) drip.start(config.dripIntervalMs);

function shutdown() {
  drip.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
