const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, naam, school } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail en wachtwoord zijn verplicht.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Wachtwoord moet minimaal 8 tekens bevatten.' });
    }

    const bestaand = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (bestaand.rows.length > 0) {
      return res.status(409).json({ error: 'Dit e-mailadres is al in gebruik.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (email, password, naam, school)
       VALUES ($1, $2, $3, $4) RETURNING id, email, naam, school, rol`,
      [email.toLowerCase(), hash, naam, school]
    );

    // Sla standaard alertvoorkeuren op
    await query(
      `INSERT INTO alert_voorkeuren (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [result.rows[0].id]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, rol: user.rol },
      process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ error: 'Registratie mislukt.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail en wachtwoord zijn verplicht.' });
    }

    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Onjuist e-mailadres of wachtwoord.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, rol: user.rol },
      process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

    const { password: _, ...userZonderPassword } = user;
    res.json({ token, user: userZonderPassword });
  } catch (err) {
    res.status(500).json({ error: 'Inloggen mislukt.' });
  }
});

// GET /api/auth/me  (ingelogd)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.naam, u.school, u.rol, u.created_at, av.*
       FROM users u
       LEFT JOIN alert_voorkeuren av ON av.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Profiel ophalen mislukt.' });
  }
});

// PUT /api/auth/me  – profiel bijwerken
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { naam, school } = req.body;
    const result = await query(
      `UPDATE users SET naam = $1, school = $2, updated_at = NOW()
       WHERE id = $3 RETURNING id, email, naam, school`,
      [naam, school, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Profiel bijwerken mislukt.' });
  }
});

module.exports = router;
