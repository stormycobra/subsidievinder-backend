# SubsidieVinder — Backend

Node.js + Express backend voor de SubsidieVinder app.
Inclusief: REST API, PostgreSQL database, AI-proxy, email alerts en scraper.

---

## Snel starten

### 1. Vereisten
- Node.js 18+
- PostgreSQL 14+
- Een Anthropic API key

### 2. Installeren

```bash
cd subsidievinder-backend
npm install
```

### 3. Environment instellen

```bash
cp .env.example .env
# Vul je eigen waarden in:
# - DB_PASSWORD
# - ANTHROPIC_API_KEY
# - JWT_SECRET  (gebruik: openssl rand -hex 32)
# - SMTP_USER + SMTP_PASS
```

### 4. Database aanmaken

```bash
# In PostgreSQL:
createdb subsidievinder

# Tabellen aanmaken:
npm run migrate
```

### 5. Starten

```bash
npm run dev      # development (met auto-reload)
npm start        # productie
```

De server draait op http://localhost:3001

---

## API Endpoints

### Auth
| Methode | Route | Beschrijving |
|---------|-------|-------------|
| POST | /api/auth/register | Account aanmaken |
| POST | /api/auth/login | Inloggen → JWT token |
| GET | /api/auth/me | Eigen profiel ophalen |
| PUT | /api/auth/me | Profiel bijwerken |

### Subsidies
| Methode | Route | Beschrijving |
|---------|-------|-------------|
| GET | /api/subsidies | Zoeken & filteren |
| GET | /api/subsidies/:id | Detail subsidie |
| GET | /api/subsidies/user/favorieten | Mijn favorieten |
| POST | /api/subsidies/:id/favoriet | Favoriet toevoegen |
| DELETE | /api/subsidies/:id/favoriet | Favoriet verwijderen |

#### Zoekparameters
```
GET /api/subsidies?q=digitalisering&thema=digitalisering&bedrag=middel&deadline=urgent&page=1&limit=20
```

### AI
| Methode | Route | Beschrijving |
|---------|-------|-------------|
| POST | /api/ai/analyseer | Subsidietekst analyseren |
| POST | /api/ai/vergelijk | Twee subsidies vergelijken |
| POST | /api/ai/subsidie/:id/samenvatting | AI-samenvatting opslaan (admin) |

#### Voorbeeld AI analyse (Frontend fetch)
```javascript
const response = await fetch('http://localhost:3001/api/ai/analyseer', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`,
  },
  body: JSON.stringify({
    tekst: '...de subsidietekst...',
    modus: 'volledig',  // volledig | beknopt | aanvraag
  }),
});
const data = await response.json();
console.log(data.resultaat.bullets);
```

### Alerts
| Methode | Route | Beschrijving |
|---------|-------|-------------|
| GET | /api/alerts | Mijn alerts |
| POST | /api/alerts | Alert aanmaken |
| DELETE | /api/alerts/:id | Alert verwijderen |
| GET | /api/alerts/voorkeuren | Email voorkeuren |
| PUT | /api/alerts/voorkeuren | Voorkeuren opslaan |
| GET | /api/alerts/log | Verzendgeschiedenis |

---

## Scraper

Scrapet subsidies van rijksoverheid.nl, duo.nl en rvo.nl:

```bash
npm run scrape
```

De scraper:
1. Bezoekt elke bron
2. Detecteert subsidielinks
3. Slaat ze op in de database (upsert op URL)
4. Detecteert thema automatisch op basis van trefwoorden

---

## Email alerts (Cron)

De server draait automatisch elke dag om 08:00 een check:
- Welke alerts trigger vandaag?
- Stuur één email per gebruiker met alle relevante subsidies
- Log de verzending in `alert_logs`

Handmatig triggeren:
```bash
node -e "require('./src/services/alertService').runDailyCheck()"
```

---

## Database schema

```
users              → accounts van scholen/medewerkers
subsidies          → alle subsidies (handmatig + gescraped)
favorieten         → user ↔ subsidie koppeling
alerts             → per user per subsidie, N dagen van tevoren
alert_voorkeuren   → frequentie en thema-filters per user
alert_logs         → alle verzonden emails
```

---

## Koppeling met de Next.js frontend

In je Next.js project:

```javascript
// lib/api.js
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function getSubsidies(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/api/subsidies?${qs}`);
  return res.json();
}

export async function analyzeSubsidie(tekst, modus, token) {
  const res = await fetch(`${BASE}/api/ai/analyseer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ tekst, modus }),
  });
  return res.json();
}
```

---

## Productie deployment

Aanbevolen stack:
- **Server**: Railway, Render of een VPS (DigitalOcean, Hetzner)
- **Database**: Railway Postgres of Supabase (gratis tier)
- **Email**: Resend (gratis 3000 emails/maand) of Sendgrid

```bash
NODE_ENV=production npm start
```
