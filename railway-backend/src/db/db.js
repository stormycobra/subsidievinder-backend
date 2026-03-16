const { Pool } = require('pg');
const logger = require('../services/logger');

// Railway geeft automatisch een DATABASE_URL env variabele
// Anders vallen we terug op losse DB_* variabelen
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
    })
  : new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME     || 'subsidievinder',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

pool.on('error', (err) => {
  logger.error('Database pool fout:', err.message);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  logger.debug(`Query (${Date.now() - start}ms): ${text.slice(0, 60)}`);
  return res;
}

module.exports = { pool, query };
