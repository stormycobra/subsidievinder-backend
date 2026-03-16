const { query } = require('../db/db');
const { stuurDeadlineAlert } = require('./emailService');
const logger = require('./logger');

// Dagelijkse check: welke gebruikers moeten een alert ontvangen?
async function runDailyCheck() {
  try {
    // Haal alle actieve alerts op waarbij de trigger-datum vandaag valt:
    // deadline - dagen_voor = vandaag
    const result = await query(`
      SELECT
        a.id AS alert_id,
        a.user_id,
        a.dagen_voor,
        u.email,
        u.naam,
        s.id AS subsidie_id,
        s.titel,
        s.organisatie,
        s.bedrag_max,
        s.deadline,
        s.aanvraag_url,
        (s.deadline - CURRENT_DATE) AS dagen_resterend
      FROM alerts a
      JOIN users u ON u.id = a.user_id
      JOIN subsidies s ON s.id = a.subsidie_id
      WHERE a.actief = true
        AND s.actief = true
        AND s.deadline >= CURRENT_DATE
        AND (s.deadline - CURRENT_DATE) = a.dagen_voor
        -- Nog niet verstuurd vandaag
        AND (a.laatste_mail IS NULL OR a.laatste_mail::date < CURRENT_DATE)
    `);

    if (!result.rows.length) {
      logger.info('Geen alerts te versturen vandaag.');
      return;
    }

    // Groepeer per gebruiker
    const perGebruiker = {};
    for (const row of result.rows) {
      if (!perGebruiker[row.user_id]) {
        perGebruiker[row.user_id] = { email: row.email, naam: row.naam, subsidies: [] };
      }
      perGebruiker[row.user_id].subsidies.push(row);
    }

    // Verstuur één email per gebruiker met al hun alerts
    for (const [userId, data] of Object.entries(perGebruiker)) {
      try {
        await stuurDeadlineAlert(data.email, data.naam, data.subsidies);

        // Markeer als verstuurd
        const alertIds = data.subsidies.map(s => s.alert_id);
        await query(
          `UPDATE alerts SET laatste_mail = NOW() WHERE id = ANY($1::int[])`,
          [alertIds]
        );

        // Log per subsidie
        for (const s of data.subsidies) {
          await query(
            `INSERT INTO alert_logs (user_id, subsidie_id, type, onderwerp, succes)
             VALUES ($1, $2, 'deadline', $3, true)`,
            [userId, s.subsidie_id,
             `Deadline herinnering: ${s.titel} - nog ${s.dagen_resterend} dagen`]
          );
        }

        logger.info(`Alert verstuurd naar ${data.email} voor ${data.subsidies.length} subsidie(s)`);
      } catch (emailErr) {
        logger.error(`Alert versturen naar ${data.email} mislukt:`, emailErr.message);
        // Log de mislukking
        await query(
          `INSERT INTO alert_logs (user_id, type, onderwerp, succes)
           VALUES ($1, 'deadline', 'Verzending mislukt', false)`,
          [userId]
        );
      }
    }

    logger.info(`Dagelijkse check voltooid: ${Object.keys(perGebruiker).length} gebruikers genotificeerd`);
  } catch (err) {
    logger.error('runDailyCheck fout:', err.message);
  }
}

module.exports = { runDailyCheck };
