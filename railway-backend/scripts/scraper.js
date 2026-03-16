/**
 * SubsidieVinder Scraper
 * Gebruik: node scripts/scraper.js
 *
 * Scrapet subsidies van Nederlandse bronnen en slaat ze op in de database.
 * Vereist: Playwright, dotenv, pg
 */

require('dotenv').config({ path: '../.env' });
const { chromium } = require('playwright');
const { query } = require('../src/db/db');

// ─── Bronnen configuratie ─────────────────────────────────
const BRONNEN = [
  {
    naam: 'Rijksoverheid - Subsidies onderwijs',
    url: 'https://www.rijksoverheid.nl/onderwerpen/subsidies-voor-onderwijs-en-onderzoek',
    type: 'rijksoverheid',
  },
  {
    naam: 'DUO - Regelingen',
    url: 'https://www.duo.nl/particulier/voortgezet-onderwijs/subsidies-en-regelingen.jsp',
    type: 'duo',
  },
  {
    naam: 'RVO - Onderwijs subsidies',
    url: 'https://www.rvo.nl/subsidies-regelingen?sector=onderwijs',
    type: 'rvo',
  },
];

// ─── Extractie per type ───────────────────────────────────

async function scrapeRijksoverheid(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const items = await page.$$eval('article, .item, .subsidy-item', els =>
    els.map(el => ({
      titel: el.querySelector('h2, h3, .title')?.textContent?.trim(),
      beschrijving: el.querySelector('p, .description')?.textContent?.trim(),
      link: el.querySelector('a')?.href,
    })).filter(i => i.titel)
  );
  return items;
}

async function scrapeGeneriek(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Haal alle links met trefwoorden op
  const links = await page.$$eval('a', els =>
    els
      .filter(a => {
        const tekst = a.textContent.toLowerCase();
        return tekst.includes('subsidie') || tekst.includes('regeling') || tekst.includes('budget');
      })
      .map(a => ({ tekst: a.textContent.trim(), href: a.href }))
      .filter(l => l.href.startsWith('http'))
      .slice(0, 10)
  );
  return links;
}

// ─── Sla subsidie op (upsert op bron_url) ────────────────

async function slaSubsidieOp(data) {
  await query(
    `INSERT INTO subsidies
       (titel, organisatie, beschrijving, thema, doelgroep,
        bedrag_min, bedrag_max, deadline, aanvraag_url, bron_url, gescraped_op)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
     ON CONFLICT (bron_url) DO UPDATE SET
       titel = EXCLUDED.titel,
       beschrijving = EXCLUDED.beschrijving,
       gescraped_op = NOW(),
       updated_at = NOW()`,
    [
      data.titel,
      data.organisatie,
      data.beschrijving,
      data.thema || 'overig',
      data.doelgroep || 'Voortgezet onderwijs',
      data.bedrag_min || 0,
      data.bedrag_max || 0,
      data.deadline || null,
      data.aanvraag_url,
      data.bron_url,
    ]
  );
}

// ─── Detecteer thema op basis van trefwoorden ─────────────

function detecteerThema(tekst) {
  const t = (tekst || '').toLowerCase();
  if (t.includes('digitaal') || t.includes('ict') || t.includes('technolog')) return 'digitalisering';
  if (t.includes('duurzaam') || t.includes('groen') || t.includes('klimaat')) return 'duurzaamheid';
  if (t.includes('innovatie') || t.includes('vernieuw')) return 'innovatie';
  if (t.includes('inclusie') || t.includes('kansen') || t.includes('gelijk')) return 'inclusie';
  if (t.includes('europa') || t.includes('erasmus') || t.includes('internationaal')) return 'internationaal';
  return 'overig';
}

// ─── Hoofdfunctie ─────────────────────────────────────────

async function runScraper() {
  console.log('Scraper gestart:', new Date().toLocaleString('nl-NL'));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (compatible; SubsidieVinderBot/1.0)',
  });

  let totaalNieuw = 0;

  for (const bron of BRONNEN) {
    console.log(`\nScrapen: ${bron.naam}`);
    const page = await context.newPage();
    try {
      const items = await scrapeGeneriek(page, bron.url);
      console.log(`  ${items.length} items gevonden`);

      for (const item of items) {
        if (!item.tekst || item.tekst.length < 5) continue;
        const thema = detecteerThema(item.tekst);
        await slaSubsidieOp({
          titel: item.tekst.slice(0, 499),
          organisatie: bron.naam,
          beschrijving: `Gevonden op: ${bron.url}`,
          thema,
          bron_url: item.href || bron.url,
          aanvraag_url: item.href || bron.url,
        });
        totaalNieuw++;
      }
    } catch (err) {
      console.error(`  Fout bij scrapen ${bron.naam}:`, err.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log(`\nScraper klaar. ${totaalNieuw} items verwerkt.`);
  process.exit(0);
}

runScraper().catch(err => {
  console.error('Scraper crashte:', err);
  process.exit(1);
});
