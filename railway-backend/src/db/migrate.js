if (process.env.NODE_ENV !== 'production') require('dotenv').config();
const { query } = require('./db');

async function migrate() {
  console.log('Database migratie starten...');

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      email      VARCHAR(255) UNIQUE NOT NULL,
      password   VARCHAR(255) NOT NULL,
      naam       VARCHAR(255),
      school     VARCHAR(255),
      rol        VARCHAR(50) DEFAULT 'gebruiker',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS subsidies (
      id            SERIAL PRIMARY KEY,
      titel         VARCHAR(500) NOT NULL,
      organisatie   VARCHAR(255),
      beschrijving  TEXT,
      samenvatting  TEXT,
      ai_bullets    JSONB,
      ai_tags       JSONB,
      thema         VARCHAR(100),
      doelgroep     VARCHAR(255),
      bedrag_min    INTEGER DEFAULT 0,
      bedrag_max    INTEGER DEFAULT 0,
      deadline      DATE,
      aanvraag_url  TEXT,
      bron_url      TEXT UNIQUE,
      voorwaarden   JSONB,
      aanvraag_tips JSONB,
      complexiteit  INTEGER,
      kans_score    INTEGER,
      actief        BOOLEAN DEFAULT true,
      gescraped_op  TIMESTAMP,
      created_at    TIMESTAMP DEFAULT NOW(),
      updated_at    TIMESTAMP DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_subsidies_thema    ON subsidies(thema);
    CREATE INDEX IF NOT EXISTS idx_subsidies_deadline ON subsidies(deadline);
    CREATE INDEX IF NOT EXISTS idx_subsidies_actief   ON subsidies(actief);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS favorieten (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      subsidie_id INTEGER REFERENCES subsidies(id) ON DELETE CASCADE,
      created_at  TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, subsidie_id)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      subsidie_id INTEGER REFERENCES subsidies(id) ON DELETE CASCADE,
      dagen_voor  INTEGER DEFAULT 30,
      actief      BOOLEAN DEFAULT true,
      laatste_mail TIMESTAMP,
      created_at  TIMESTAMP DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS alert_logs (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      subsidie_id INTEGER REFERENCES subsidies(id) ON DELETE SET NULL,
      type        VARCHAR(50),
      verzonden_op TIMESTAMP DEFAULT NOW(),
      onderwerp   VARCHAR(500),
      succes      BOOLEAN DEFAULT true
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS alert_voorkeuren (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      frequentie     VARCHAR(20) DEFAULT 'dagelijks',
      alert_60_dagen BOOLEAN DEFAULT true,
      alert_30_dagen BOOLEAN DEFAULT true,
      alert_7_dagen  BOOLEAN DEFAULT true,
      alert_nieuw    BOOLEAN DEFAULT false,
      themas         JSONB DEFAULT '["all"]',
      created_at     TIMESTAMP DEFAULT NOW(),
      updated_at     TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log('Migratie voltooid.');
  process.exit(0);
}

migrate().catch(err => { console.error('Migratie mislukt:', err); process.exit(1); });
