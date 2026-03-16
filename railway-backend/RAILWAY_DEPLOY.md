# SubsidieVinder Backend — Railway Deployment

Volg deze stappen om de backend live te zetten op Railway.app (gratis tier).

---

## Stap 1 — GitHub repo aanmaken

Railway deployt vanuit GitHub. Maak een nieuwe repo aan:

```bash
cd subsidievinder-backend

# Initialiseer git
git init
git add .
git commit -m "Initial commit: SubsidieVinder backend"

# Maak repo op GitHub (via github.com/new) en push:
git remote add origin https://github.com/JOUW_NAAM/subsidievinder-backend.git
git branch -M main
git push -u origin main
```

---

## Stap 2 — Railway project aanmaken

1. Ga naar **railway.app** en log in (gratis met GitHub)
2. Klik op **"New Project"**
3. Kies **"Deploy from GitHub repo"**
4. Selecteer je `subsidievinder-backend` repo
5. Railway detecteert automatisch Node.js en start de build

---

## Stap 3 — PostgreSQL database toevoegen

1. In je Railway project, klik op **"+ New"**
2. Kies **"Database" → "Add PostgreSQL"**
3. Railway maakt automatisch een `DATABASE_URL` variabele aan
4. Kopieer de `DATABASE_URL` — je hebt hem nodig in stap 4

---

## Stap 4 — Environment variabelen instellen

In Railway → jouw service → **"Variables"** tab, voeg toe:

| Variabele | Waarde | Uitleg |
|-----------|--------|--------|
| `NODE_ENV` | `production` | Schakelt productie-modus in |
| `DATABASE_URL` | *(automatisch van PostgreSQL service)* | Verbinding database |
| `DB_HOST` | *(uit DATABASE_URL)* | Database host |
| `DB_PORT` | `5432` | Database poort |
| `DB_NAME` | `railway` | Database naam |
| `DB_USER` | `postgres` | Database gebruiker |
| `DB_PASSWORD` | *(uit DATABASE_URL)* | Database wachtwoord |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Jouw Anthropic API key |
| `JWT_SECRET` | *(willekeurige string, min 32 tekens)* | Sessiebeveiliging |
| `SMTP_HOST` | `smtp.gmail.com` | E-mail server |
| `SMTP_PORT` | `587` | E-mail poort |
| `SMTP_USER` | `jouw@gmail.com` | E-mail afzender |
| `SMTP_PASS` | *(Gmail app-wachtwoord)* | E-mail wachtwoord |
| `EMAIL_FROM` | `SubsidieVinder <noreply@subsidievinder.nl>` | Afzendernaam |
| `FRONTEND_URL` | `https://subsidievinder.vercel.app` | Jouw Vercel URL |

### JWT_SECRET genereren:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Gmail app-wachtwoord:
1. Ga naar myaccount.google.com → Beveiliging
2. Schakel 2-staps-verificatie in
3. Zoek op "App-wachtwoorden" → maak nieuw wachtwoord aan voor "Mail"

---

## Stap 5 — Database tabellen aanmaken

Na de eerste deploy, open Railway terminal of voer lokaal uit:

```bash
# Optie A: Via Railway CLI
railway run node src/db/migrate.js
railway run node src/db/seed.js

# Optie B: Lokaal met productie DATABASE_URL
DATABASE_URL="postgresql://..." node src/db/migrate.js
DATABASE_URL="postgresql://..." node src/db/seed.js
```

---

## Stap 6 — Frontend verbinden met backend

Update je `subsidievinder-app.html`:

Zoek in het bestand naar:
```javascript
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
```

Of als je de standalone HTML gebruikt, zoek naar de fetch calls en vervang:
```
http://localhost:3001
```
door jouw Railway URL:
```
https://subsidievinder-backend.up.railway.app
```

En herdeployeer op Vercel:
```bash
cd subsidievinder
vercel --prod
```

---

## Stap 7 — Testen

```bash
# Health check
curl https://jouw-app.up.railway.app/health

# Verwacht: {"status":"ok","timestamp":"..."}

# Subsidies ophalen
curl https://jouw-app.up.railway.app/api/subsidies
```

---

## Architectuur overzicht

```
Browser (Vercel)
    │
    │ HTTPS
    ▼
Vercel (subsidievinder.vercel.app)
    │  index.html (statisch)
    │
    │ API calls naar /api/*
    ▼
Railway (subsidievinder-backend.up.railway.app)
    │  Node.js + Express
    │
    ├── /api/auth      → JWT login/register
    ├── /api/subsidies → zoeken, filteren, favorieten
    ├── /api/alerts    → deadline alerts beheer
    └── /api/ai        → Anthropic proxy (lost CORS op!)
         │
         ▼
    Anthropic API (claude-sonnet)
         │
    PostgreSQL (Railway)
         │
    Cron (dagelijks 08:00)
         │
    SMTP (deadline emails)
```

---

## Kosten (gratis tier)

| Service | Gratis limiet |
|---------|---------------|
| Railway backend | $5 krediet/maand (~500 uur) |
| Railway PostgreSQL | 1 GB opslag |
| Vercel frontend | Onbeperkt statisch |
| Anthropic API | Betaald per gebruik (~€0.01/analyse) |

---

## Troubleshooting

**Build faalt:** Check of `package.json` een `"start"` script heeft.

**Database verbinding mislukt:** Controleer of alle `DB_*` variabelen overeenkomen met de PostgreSQL service in Railway.

**CORS fout in browser:** Voeg je Vercel URL toe aan `FRONTEND_URL` in Railway variables.

**AI analyse werkt niet:** Controleer `ANTHROPIC_API_KEY` in Railway variables.
