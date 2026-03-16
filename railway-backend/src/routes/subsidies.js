const express = require('express');
const { query } = require('../db/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/subsidies  – zoeken & filteren
// Query params: q, thema, bedrag (klein|middel|groot), deadline (urgent|later), page, limit
router.get('/', async (req, res) => {
  try {
    const { q, thema, bedrag, deadline, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = ['s.actief = true'];

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(s.titel ILIKE $${params.length} OR s.beschrijving ILIKE $${params.length} OR s.organisatie ILIKE $${params.length})`);
    }
    if (thema && thema !== 'all') {
      params.push(thema);
      conditions.push(`s.thema = $${params.length}`);
    }
    if (bedrag === 'klein') {
      conditions.push('s.bedrag_max < 10000');
    } else if (bedrag === 'middel') {
      conditions.push('s.bedrag_max BETWEEN 10000 AND 50000');
    } else if (bedrag === 'groot') {
      conditions.push('s.bedrag_max > 50000');
    }
    if (deadline === 'urgent') {
      conditions.push('s.deadline <= NOW() + INTERVAL \'30 days\'');
    } else if (deadline === 'later') {
      conditions.push('s.deadline > NOW() + INTERVAL \'30 days\'');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM subsidies s ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit));
    params.push(offset);
    const result = await query(
      `SELECT s.*, (s.deadline - CURRENT_DATE) AS dagen_resterend
       FROM subsidies s
       ${where}
       ORDER BY s.deadline ASC NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      subsidies: result.rows,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: 'Subsidies ophalen mislukt.' });
  }
});

// GET /api/subsidies/:id  – detail
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT *, (deadline - CURRENT_DATE) AS dagen_resterend
       FROM subsidies WHERE id = $1 AND actief = true`,
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Subsidie niet gevonden.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Subsidie ophalen mislukt.' });
  }
});

// GET /api/subsidies/user/favorieten  (ingelogd)
router.get('/user/favorieten', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*, f.created_at AS opgeslagen_op,
              (s.deadline - CURRENT_DATE) AS dagen_resterend
       FROM favorieten f
       JOIN subsidies s ON s.id = f.subsidie_id
       WHERE f.user_id = $1 AND s.actief = true
       ORDER BY s.deadline ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Favorieten ophalen mislukt.' });
  }
});

// POST /api/subsidies/:id/favoriet  (ingelogd)
router.post('/:id/favoriet', authMiddleware, async (req, res) => {
  try {
    await query(
      `INSERT INTO favorieten (user_id, subsidie_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user.id, req.params.id]
    );
    res.json({ success: true, actie: 'toegevoegd' });
  } catch (err) {
    res.status(500).json({ error: 'Favoriet toevoegen mislukt.' });
  }
});

// DELETE /api/subsidies/:id/favoriet  (ingelogd)
router.delete('/:id/favoriet', authMiddleware, async (req, res) => {
  try {
    await query(
      'DELETE FROM favorieten WHERE user_id = $1 AND subsidie_id = $2',
      [req.user.id, req.params.id]
    );
    res.json({ success: true, actie: 'verwijderd' });
  } catch (err) {
    res.status(500).json({ error: 'Favoriet verwijderen mislukt.' });
  }
});

module.exports = router;
