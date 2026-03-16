const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const authMiddleware = require('../middleware/auth');
const { query } = require('../db/db');
const logger = require('../services/logger');

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Prompts ──────────────────────────────────────────────
function buildAnalysePrompt(tekst, modus) {
  const basis = `Je bent een subsidie-expert voor het Nederlandse voortgezet onderwijs.
Analyseer de subsidietekst hieronder. Geef ALLEEN geldige JSON terug, geen markdown, geen uitleg.`;

  if (modus === 'beknopt') {
    return `${basis}
JSON-velden: bullets (3 korte zinnen), thema (1 woord), doelgroep (1 zin),
maxBedrag (getal in euros, 0 als onbekend), aanvraagTips (2 tips).

Tekst:\n${tekst}`;
  }
  if (modus === 'aanvraag') {
    return `${basis}
Focus op aanvraagadvies. JSON-velden: bullets (3 aandachtspunten),
thema (1 woord), doelgroep (1 zin), maxBedrag (getal),
aanvraagTips (5 concrete tips voor schoolbesturen).

Tekst:\n${tekst}`;
  }
  // Volledig (standaard)
  return `${basis}
JSON-velden:
- bullets: array van 5 samenvattingszinnen voor een schoolbestuurder
- thema: één van: digitalisering, duurzaamheid, innovatie, inclusie, internationaal, overig
- extraTags: array van 2-3 extra labels (bv. "EU", "cofinanciering vereist")
- doelgroep: beschrijving van de doelgroep
- maxBedrag: getal in euros (0 als onbekend)
- complexiteit: getal 1-10 (aanvraagcomplexiteit)
- urgentie: getal 1-10
- kansScore: getal 1-10 (kans op toekenning voor gemiddelde VO-school)
- aanvraagTips: array van 4 concrete tips voor schoolbesturen

Tekst:\n${tekst}`;
}

// POST /api/ai/analyseer
// Body: { tekst: string, modus: "volledig"|"beknopt"|"aanvraag" }
router.post('/analyseer', authMiddleware, async (req, res) => {
  const { tekst, modus = 'volledig' } = req.body;

  if (!tekst || tekst.trim().length < 50) {
    return res.status(400).json({ error: 'Tekst is te kort (minimaal 50 tekens).' });
  }
  if (tekst.length > 8000) {
    return res.status(400).json({ error: 'Tekst is te lang (maximaal 8000 tekens).' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'Geef altijd alleen geldige JSON terug. Geen markdown, geen uitleg, alleen het JSON-object.',
      messages: [{ role: 'user', content: buildAnalysePrompt(tekst, modus) }],
    });

    const raw = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    logger.info(`AI analyse uitgevoerd door user ${req.user.id}, modus: ${modus}`);
    res.json({ resultaat: parsed, raw });
  } catch (err) {
    logger.error('AI analyse fout:', err.message);
    if (err instanceof SyntaxError) {
      return res.status(502).json({ error: 'AI gaf geen geldige JSON terug. Probeer opnieuw.' });
    }
    res.status(500).json({ error: 'AI-analyse mislukt.' });
  }
});

// POST /api/ai/vergelijk
// Body: { tekstA: string, tekstB: string }
router.post('/vergelijk', authMiddleware, async (req, res) => {
  const { tekstA, tekstB } = req.body;
  if (!tekstA || !tekstB) {
    return res.status(400).json({ error: 'Beide subsidieteksten zijn verplicht.' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Vergelijk deze twee subsidies voor een VO-school in Nederland.
Bespreek per subsidie: doelgroep, bedrag, aanvraagcomplexiteit.
Geef aan voor welk schooltype welke subsidie het meest geschikt is.
Sluit af met een duidelijke aanbeveling in 2-3 zinnen.

Subsidie A:\n${tekstA}\n\nSubsidie B:\n${tekstB}`,
      }],
    });

    const tekst = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
    res.json({ vergelijking: tekst });
  } catch (err) {
    logger.error('AI vergelijking fout:', err.message);
    res.status(500).json({ error: 'Vergelijking mislukt.' });
  }
});

// POST /api/ai/subsidie/:id/samenvatting
// Genereer en sla AI-samenvatting op voor bestaande subsidie (admin)
router.post('/subsidie/:id/samenvatting', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Alleen admins kunnen samenvattingen genereren.' });
  }

  try {
    const sub = await query('SELECT * FROM subsidies WHERE id = $1', [req.params.id]);
    if (!sub.rows.length) return res.status(404).json({ error: 'Subsidie niet gevonden.' });

    const s = sub.rows[0];
    const tekst = `${s.titel}\n\n${s.beschrijving}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'Geef altijd alleen geldige JSON terug.',
      messages: [{ role: 'user', content: buildAnalysePrompt(tekst, 'volledig') }],
    });

    const raw = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    await query(
      `UPDATE subsidies SET
         ai_bullets = $1, ai_tags = $2, thema = $3, aanvraag_tips = $4,
         complexiteit = $5, kans_score = $6, updated_at = NOW()
       WHERE id = $7`,
      [
        JSON.stringify(parsed.bullets),
        JSON.stringify(parsed.extraTags || []),
        parsed.thema,
        JSON.stringify(parsed.aanvraagTips),
        parsed.complexiteit,
        parsed.kansScore,
        req.params.id,
      ]
    );

    res.json({ success: true, resultaat: parsed });
  } catch (err) {
    logger.error('AI samenvatting opslaan fout:', err.message);
    res.status(500).json({ error: 'Samenvatting genereren mislukt.' });
  }
});

module.exports = router;
