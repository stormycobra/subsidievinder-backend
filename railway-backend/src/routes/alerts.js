const express = require('express');
const { query } = require('../db/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/alerts  – alle alerts van ingelogde gebruiker
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*, s.titel, s.deadline, s.thema, s.bedrag_max,
              (s.deadline - CURRENT_DATE) AS dagen_resterend,
              (s.deadline - CURRENT_DATE - a.dagen_voor) AS trigger_over
       FROM alerts a
       JOIN subsidies s ON s.id = a.subsidie_id
       WHERE a.user_id = $1 AND a.actief = true
       ORDER BY s.deadline ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Alerts ophalen mislukt.' });
  }
});

// POST /api/alerts  – alert aanmaken
// Body: { subsidie_id, dagen_voor }
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { subsidie_id, dagen_voor = 30 } = req.body;
    if (!subsidie_id) return res.status(400).json({ error: 'subsidie_id is verplicht.' });

    const result = await query(
      `INSERT INTO alerts (user_id, subsidie_id, dagen_voor)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [req.user.id, subsidie_id, dagen_voor]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Alert aanmaken mislukt.' });
  }
});

// DELETE /api/alerts/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await query(
      'DELETE FROM alerts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Alert verwijderen mislukt.' });
  }
});

// GET /api/alerts/voorkeuren
router.get('/voorkeuren', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM alert_voorkeuren WHERE user_id = $1',
      [req.user.id]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Voorkeuren ophalen mislukt.' });
  }
});

// PUT /api/alerts/voorkeuren
router.put('/voorkeuren', authMiddleware, async (req, res) => {
  try {
    const {
      frequentie, alert_60_dagen, alert_30_dagen,
      alert_7_dagen, alert_nieuw, themas,
    } = req.body;

    const result = await query(
      `INSERT INTO alert_voorkeuren
         (user_id, frequentie, alert_60_dagen, alert_30_dagen, alert_7_dagen, alert_nieuw, themas)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id) DO UPDATE SET
         frequentie = $2, alert_60_dagen = $3, alert_30_dagen = $4,
         alert_7_dagen = $5, alert_nieuw = $6, themas = $7, updated_at = NOW()
       RETURNING *`,
      [req.user.id, frequentie, alert_60_dagen, alert_30_dagen,
       alert_7_dagen, alert_nieuw, JSON.stringify(themas || ['all'])]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Voorkeuren opslaan mislukt.' });
  }
});

// GET /api/alerts/log  – verzendgeschiedenis
router.get('/log', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT al.*, s.titel AS subsidie_titel
       FROM alert_logs al
       LEFT JOIN subsidies s ON s.id = al.subsidie_id
       WHERE al.user_id = $1
       ORDER BY al.verzonden_op DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Logboek ophalen mislukt.' });
  }
});

module.exports = router;
