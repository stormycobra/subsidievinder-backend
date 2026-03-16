const nodemailer = require('nodemailer');
const logger = require('./logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Email templates ──────────────────────────────────────

function deadlineEmailHtml({ naam, subsidies }) {
  const items = subsidies.map(s => `
    <div style="background:#f8f8f6;border-radius:8px;padding:14px;margin-bottom:10px">
      <p style="font-weight:500;font-size:15px;margin:0 0 6px">${s.titel}</p>
      <p style="font-size:13px;color:#666;margin:0 0 4px">${s.organisatie}</p>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <span style="background:${s.dagen_resterend <= 14 ? '#FCEBEB' : '#FAEEDA'};color:${s.dagen_resterend <= 14 ? '#791F1F' : '#633806'};padding:3px 8px;border-radius:12px;font-size:12px;font-weight:500">
          ${s.dagen_resterend <= 14 ? '⚠ ' : ''}Nog ${s.dagen_resterend} dagen
        </span>
        <span style="font-size:13px;color:#555">Max. €${Number(s.bedrag_max).toLocaleString('nl-NL')}</span>
      </div>
      ${s.aanvraag_url ? `<a href="${s.aanvraag_url}" style="display:inline-block;margin-top:8px;font-size:12px;color:#1D9E75">Aanvragen →</a>` : ''}
    </div>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#1a1a1a">
  <div style="background:#085041;border-radius:10px 10px 0 0;padding:20px;text-align:center;margin-bottom:0">
    <h1 style="color:#fff;font-size:18px;margin:0;font-weight:500">SubsidieVinder</h1>
  </div>
  <div style="background:#fff;border:1px solid #e5e5e5;border-radius:0 0 10px 10px;padding:24px">
    <h2 style="font-size:16px;font-weight:500;margin:0 0 6px">⚠ Deadline herinnering</h2>
    <p style="font-size:13px;color:#666;margin:0 0 20px">Hallo ${naam || 'gebruiker'}, de volgende subsidies sluiten binnenkort.</p>
    ${items}
    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}"
       style="display:block;background:#1D9E75;color:#fff;text-align:center;padding:12px;border-radius:8px;text-decoration:none;font-weight:500;margin-top:16px">
      Bekijk alle subsidies →
    </a>
    <p style="font-size:11px;color:#999;text-align:center;margin-top:20px">
      Je ontvangt dit omdat je deadline-alerts hebt ingesteld op SubsidieVinder.
    </p>
  </div>
</body>
</html>`;
}

function nieuweSubsidieEmailHtml({ naam, subsidie }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#1a1a1a">
  <div style="background:#085041;border-radius:10px 10px 0 0;padding:20px;text-align:center">
    <h1 style="color:#fff;font-size:18px;margin:0;font-weight:500">SubsidieVinder</h1>
  </div>
  <div style="background:#fff;border:1px solid #e5e5e5;border-radius:0 0 10px 10px;padding:24px">
    <h2 style="font-size:16px;font-weight:500;margin:0 0 6px">Nieuwe subsidie gevonden</h2>
    <p style="font-size:13px;color:#666;margin:0 0 16px">Hallo ${naam || 'gebruiker'}, we hebben een nieuwe subsidie gevonden die aansluit bij jouw thema's.</p>
    <div style="background:#E1F5EE;border-radius:8px;padding:14px">
      <span style="background:#085041;color:#fff;font-size:11px;padding:3px 8px;border-radius:12px;font-weight:500">Nieuw</span>
      <p style="font-weight:500;font-size:15px;margin:8px 0 4px">${subsidie.titel}</p>
      <p style="font-size:13px;color:#555;margin:0">Max. €${Number(subsidie.bedrag_max).toLocaleString('nl-NL')} · Deadline: ${new Date(subsidie.deadline).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </div>
    <a href="${process.env.FRONTEND_URL}/subsidies/${subsidie.id}"
       style="display:block;background:#1D9E75;color:#fff;text-align:center;padding:12px;border-radius:8px;text-decoration:none;font-weight:500;margin-top:16px">
      Bekijk subsidie →
    </a>
  </div>
</body>
</html>`;
}

// ─── Verzend functies ─────────────────────────────────────

async function stuurDeadlineAlert(email, naam, subsidies) {
  const count = subsidies.length;
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `⚠ Deadline herinnering: ${count} subsidie${count !== 1 ? 's' : ''} sluit${count === 1 ? '' : 'en'} binnenkort`,
    html: deadlineEmailHtml({ naam, subsidies }),
  });
  logger.info(`Deadline alert verstuurd naar ${email} (${count} subsidies)`);
}

async function stuurNieuweSubsidieAlert(email, naam, subsidie) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Nieuwe subsidie: ${subsidie.titel}`,
    html: nieuweSubsidieEmailHtml({ naam, subsidie }),
  });
  logger.info(`Nieuwe subsidie alert verstuurd naar ${email}: ${subsidie.titel}`);
}

module.exports = { stuurDeadlineAlert, stuurNieuweSubsidieAlert };
