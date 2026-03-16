/**
 * startup.js — wordt uitgevoerd voor de server start
 * Voert automatisch migratie en seed uit als de database leeg is
 */
if (process.env.NODE_ENV !== 'production') require('dotenv').config();
const { query } = require('./db/db');

async function startup() {
  try {
    console.log('Startup: database controleren...');

    // Check of tabellen al bestaan
    const result = await query(`
      SELECT COUNT(*) FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'subsidies'
    `);

    if (result.rows[0].count === '0') {
      console.log('Startup: eerste keer — migratie uitvoeren...');
      const { execSync } = require('child_process');
      execSync('node src/db/migrate.js', { stdio: 'inherit' });
      console.log('Startup: seed data laden...');
      execSync('node src/db/seed.js', { stdio: 'inherit' });
    } else {
      // Check of er data is
      const dataCheck = await query('SELECT COUNT(*) FROM subsidies');
      if (dataCheck.rows[0].count === '0') {
        console.log('Startup: lege database — seed data laden...');
        const { execSync } = require('child_process');
        execSync('node src/db/seed.js', { stdio: 'inherit' });
      } else {
        console.log(`Startup: database OK (${dataCheck.rows[0].count} subsidies gevonden)`);
      }
    }
  } catch (err) {
    console.log('Startup check overgeslagen:', err.message);
  }
}

module.exports = startup;
