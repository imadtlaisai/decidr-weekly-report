#!/usr/bin/env node
// Decidr Weekly Marketing Report generator (Claude-assisted edition).
// Reads a week data file (data/week-NN.json) and emits a self-contained HTML report
// matching the Decidr report design. Usage:
//   node generate.mjs --week 24
//   node generate.mjs --data data/week-24.json --out out/report-week-24.html

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// ---- args ----------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : null;
};
const week = arg('week');
const dataPath = arg('data') || (week ? `data/week-${week}.json` : null);
if (!dataPath) {
  console.error('Usage: node generate.mjs --week <N>   (or --data <path> [--out <path>])');
  process.exit(1);
}
const outPath = arg('out') || (week ? `out/report-week-${week}.html` : 'out/report.html');

const data = JSON.parse(readFileSync(resolve(dataPath), 'utf8'));

// ---- trend auto-builder --------------------------------------------------
function extractMetrics(d) {
  return {
    contacts:      d.funnel?.[0]?.value ?? '—',
    mql:           d.funnel?.[1]?.value ?? '—',
    sql:           d.funnel?.[2]?.value ?? '—',
    opps:          d.funnel?.[3]?.value ?? '—',
    metaLeads:     d.campaigns?.metrics?.find(m => /lead/i.test(m.label))?.value ?? '—',
    linkedinLeads: d.linkedin?.metrics?.find(m => /lead/i.test(m.label))?.value ?? '—',
    googleConv:    d.google?.metrics?.find(m => /conv/i.test(m.label))?.value ?? '—',
  };
}

function trendBadge(vals) {
  const clean = vals.map(v => parseFloat(String(v).replace(/[^0-9.-]/g, ''))).filter(n => !isNaN(n));
  if (clean.length < 2) return { badge: 'gray', badgeText: '—' };
  const [prev, curr] = [clean[clean.length - 2], clean[clean.length - 1]];
  if (curr > prev) return { badge: 'up', badgeText: '↑' };
  if (curr < prev) return { badge: 'warn', badgeText: `${Math.round(((curr - prev) / prev) * 100)}%` };
  return { badge: 'gray', badgeText: 'flat' };
}

function buildTrend(d, wk) {
  const wNum = parseInt(wk || '0');
  const loaded = [];
  if (wNum > 0) {
    for (let back = 3; back >= 1; back--) {
      const w = wNum - back;
      if (w <= 0) continue;
      try {
        const prev = JSON.parse(readFileSync(resolve(`data/week-${w}.json`), 'utf8'));
        loaded.push({ w, d: prev });
      } catch {}
    }
  }
  loaded.push({ w: wNum || 0, d });

  // only current week available — fall back to manually specified trend in JSON
  if (loaded.length === 1) return d.trend;

  const headers = loaded.map(({ w }) => `Wk ${w}`);
  const metrics = loaded.map(({ d: wd }) => extractMetrics(wd));
  const row = (label, key) => ({ label, values: metrics.map(m => m[key]), ...trendBadge(metrics.map(m => m[key])) });
  return {
    headers,
    rows: [
      row('Contacts', 'contacts'),
      row('MQL+', 'mql'),
      row('SQL+', 'sql'),
      row('Opportunities', 'opps'),
      row('Meta leads', 'metaLeads'),
      row('LinkedIn leads', 'linkedinLeads'),
      row('Google conv.', 'googleConv'),
    ],
  };
}

data._trend = buildTrend(data, week);

// ---- helpers -------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// color helper: named CSS var or raw hex/color
const col = (c) => (c && c.startsWith('#')) ? c : `var(--${c})`;
const pct = (v, max) => max ? Math.max(2, Math.round((v / max) * 100)) : 0;

const section = (label, inner) => `
  <div class="section">
    <div class="section-label">${esc(label)}</div>
    ${inner}
  </div>`;

const pendingCard = (note) => `
    <div class="card" style="border-style:dashed;background:repeating-linear-gradient(45deg,var(--surface),var(--surface) 10px,var(--surface2) 10px,var(--surface2) 20px);">
      <div class="card-title" style="color:var(--amber-text);">⌛ Pending input</div>
      <p style="font-size:12px;color:var(--text-2);">${esc(note)}</p>
    </div>`;

const badge = (b, label) => b ? `<span class="badge badge-${b}">${esc(label)}</span>` : esc(label);

const bar = (b) => `
        <div class="bar-row">
          <span class="bar-label${b.sm ? ' sm' : ''}">${b.badge ? badge(b.badge, b.label || b.badgeLabel) : esc(b.label)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct(b.value, b.max)}%;background:${col(b.color)};"></div></div>
          <span class="bar-num">${esc(b.display ?? b.value)}</span>
          ${b.extra ? `<span class="bar-extra">${esc(b.extra)}</span>` : ''}
        </div>`;

// ---- sections ------------------------------------------------------------
function header(m) {
  return `
  <div class="report-header">
    <div>
      <div class="report-logo">${esc(m.logo)}</div>
      <div class="report-title">${esc(m.title)}</div>
      <div class="report-date">${esc(m.dateRange)} &nbsp;·&nbsp; Prepared for ${esc(m.preparedFor)}</div>
    </div>
    <div style="text-align:right;">
      <span class="badge badge-blue">${esc(m.weekBadge)}</span>
      <div style="font-size:11px;color:var(--text-3);margin-top:8px;">${esc(m.products)}</div>
    </div>
  </div>`;
}

function funnelSection(d) {
  if (!d.funnel) return '';
  const stages = d.funnel.map(s => `
      <div class="funnel-stage${s.alt ? ' alt' : ''}">
        <div class="funnel-label">${esc(s.label)}</div>
        <div class="funnel-num" style="color:${col(s.color)};">${esc(s.value)}</div>
        ${s.conv ? `<div class="funnel-conv" style="color:${col(s.convColor || 'text-2')};">${esc(s.conv)}</div>` : ''}
      </div>`).join('');

  const hl = d.highlight ? `
    <div class="info-box" style="background:var(--${d.highlight.type}-bg);color:var(--${d.highlight.type}-text);border:1px solid rgba(0,0,0,.06);">
      ${d.highlight.html}
    </div>` : '';

  const sbp = d.sqlByProduct;
  const sbpMetrics = sbp ? sbp.metrics.map(mt => `
          <div class="metric">
            <div class="metric-label">${mt.badge ? badge(mt.badge, mt.badgeLabel) : esc(mt.label)}</div>
            <div class="metric-value" style="color:${col(mt.color)};">${esc(mt.value)}</div>
            <div class="metric-sub">${esc(mt.sub)}</div>
          </div>`).join('') : '';
  const sbpBars = sbp ? sbp.bars.map(b => bar({ ...b, sm: true })).join('') : '';

  const tr = d._trend ?? d.trend;
  const trendHeaders = tr ? tr.headers.map(h => `<span style="flex:1;text-align:right;">${esc(h)}</span>`).join('') : '';
  const trendColor = { up: 'green', warn: 'amber', gray: 'text-3', red: 'red' };
  const trendRows = tr ? tr.rows.map(r => {
    const tc = trendColor[r.badge] || 'text-2';
    return `
        <div class="wow" style="grid-template-columns:1.3fr ${tr.headers.map(() => '1fr').join(' ')} 56px;">
          <span style="font-weight:500;">${esc(r.label)}</span>
          ${r.values.map(v => `<span style="color:var(--text-2);text-align:right;">${esc(v)}</span>`).join('')}
          <span style="font-size:12px;font-weight:600;color:var(--${tc});text-align:right;">${esc(r.badgeText)}</span>
        </div>`;
  }).join('') : '';

  const cards = `
    <div class="mg2">
      <div class="card">
        <div class="card-title">SQL by product (MQL+)</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
          ${sbpMetrics}
        </div>
        ${sbpBars}
        ${sbp && sbp.note ? `<p style="font-size:11px;color:var(--text-3);margin-top:10px;padding-top:8px;border-top:1px solid var(--border);">${esc(sbp.note)}</p>` : ''}
      </div>
      <div class="card">
        <div class="card-title">Week-on-week trend</div>
        <div style="display:flex;gap:6px;font-size:10px;color:var(--text-3);font-weight:500;text-transform:uppercase;padding-bottom:8px;border-bottom:1px solid var(--border);margin-bottom:4px;">
          <span style="flex:1.4;"></span>
          ${trendHeaders}
          <span style="width:64px;text-align:right;">Trend</span>
        </div>
        ${trendRows}
        ${tr && tr.note ? `<p style="font-size:11px;color:var(--text-3);margin-top:10px;padding-top:8px;border-top:1px solid var(--border);">${esc(tr.note)}</p>` : ''}
      </div>
    </div>`;

  return section('Lead funnel', `
    <div class="funnel">${stages}</div>
    ${hl}
    ${cards}`);
}

function campaignSection(d) {
  if (!d.channels && !d.geography && !d.platformCompare) return '';
  const channelBars = d.channels ? `
    <div class="card" style="margin-bottom:10px;">
      ${d.channels.bars.map(bar).join('')}
    </div>` : '';

  const geo = d.geography ? `
      <div class="card">
        <div class="card-title">Geography (known)</div>
        ${d.geography.bars.map(b => bar({ ...b, sm: true })).join('')}
        ${d.geography.note ? `<p style="font-size:11px;color:var(--text-3);margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">${esc(d.geography.note)}</p>` : ''}
      </div>` : '';

  const cmp = d.platformCompare ? `
      <div class="card">
        <div class="card-title">LinkedIn vs Facebook</div>
        <div class="compare">
          ${d.platformCompare.cards.map(c => `
          <div class="compare-card">
            <div class="compare-platform">${esc(c.platform)}</div>
            <div class="compare-rate" style="color:var(--${c.rateColor});">${esc(c.rate)}</div>
            <div class="compare-meta">${c.metaHtml}</div>
          </div>`).join('')}
        </div>
        ${d.platformCompare.note ? `<p style="font-size:11px;color:var(--text-3);margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">${esc(d.platformCompare.note)}</p>` : ''}
      </div>` : '';

  const grid = (geo || cmp) ? `<div class="mg2">${geo}${cmp}</div>` : '';
  return section('Campaign performance — channel mix & quality', channelBars + grid);
}

function employeeSizeSection(d) {
  if (!d.employeeSize) return '';
  const es = d.employeeSize;
  const metrics = es.metrics ? `<div class="mg3">${es.metrics.map(mt => `<div class="metric"><p class="metric-label">${esc(mt.label)}</p><p class="metric-value" style="color:${col(mt.color)};">${esc(mt.value)}</p><p class="metric-sub">${esc(mt.sub)}</p></div>`).join('')}</div>` : '';
  const bars = `<div class="card">
    <div class="card-title">Known company size (by employees)</div>
    ${es.bars.map(b => bar({ ...b, sm: true })).join('')}
    ${es.note ? `<p style="font-size:11px;color:var(--text-3);margin-top:10px;padding-top:8px;border-top:1px solid var(--border);">${esc(es.note)}</p>` : ''}
  </div>`;
  return section('Contacts by company size', metrics + bars);
}

function soaSizeSection(d) {
  if (!d.stateOfAiSize) return '';
  const s = d.stateOfAiSize;
  const colCard = (c) => {
    const maxv = Math.max(1, ...c.bars.map(b => b.value));
    const bars = c.bars.map(b => bar({ label: b.label, value: b.value, display: String(b.value), color: b.color, max: maxv, sm: true })).join('');
    return `<div class="card" style="margin-bottom:0;">
        <div class="card-title">${badge(c.badge, c.platform)} · ${esc(c.leads)} leads</div>
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:12px;">
          <span style="font-size:26px;font-weight:600;color:var(--${c.statColor || 'text'});">${esc(c.big)}</span>
          <span style="font-size:12px;color:var(--text-2);">${esc(c.bigLabel)} · median ${esc(c.median)}</span>
        </div>
        ${bars}
      </div>`;
  };
  const verdict = s.verdict ? `<div class="info-box" style="background:var(--teal-bg);color:var(--teal-text);border:1px solid rgba(0,0,0,.06);margin-bottom:14px;">${s.verdict}</div>` : '';
  const note = s.note ? `<p style="font-size:11px;color:var(--text-3);margin-top:10px;">${esc(s.note)}</p>` : '';
  return section('State of AI — company size by channel', verdict + `<div class="mg2">${colCard(s.columns[0])}${colCard(s.columns[1])}</div>` + note);
}

function metaSection(d) {
  if (!d.campaigns) return '';
  const cols = d.campaigns.columns || { c3: 'MQL%', c4: 'Spend', c5: 'Cost / lead' };
  const metricGrid = d.campaigns.metrics?.length === 4 ? 'mg4' : 'mg3';
  const metrics = d.campaigns.metrics ? `<div class="${metricGrid}">${d.campaigns.metrics.map(mt => `<div class="metric"><p class="metric-label">${esc(mt.label)}</p><p class="metric-value" style="color:${col(mt.color)};">${esc(mt.value)}</p><p class="metric-sub">${esc(mt.sub)}</p></div>`).join('')}</div>` : '';
  const table = `
    <div class="card">
      <table>
        <thead>
          <tr>
            <th style="width:200px;">Campaign</th>
            <th>Type</th>
            <th class="r" style="width:68px;">Contacts</th>
            <th class="r" style="width:58px;">${esc(cols.c3)}</th>
            <th class="r" style="width:72px;">${esc(cols.c4)}</th>
            <th class="r" style="width:75px;">${esc(cols.c5)}</th>
            <th class="r" style="width:75px;">${esc(cols.c6 || 'Cost / MQL')}</th>
          </tr>
        </thead>
        <tbody>
          ${d.campaigns.rows.map((r, i) => `
          <tr${(!r.bold && i % 2) ? ' class="alt"' : ''}>
            <td>${r.bold ? `<strong>${esc(r.name)}</strong>` : esc(r.name)}</td>
            <td>${badge(r.channelBadge, r.channelLabel)}</td>
            <td class="r">${esc(r.contacts)}</td>
            <td class="r ${r.mqlClass || ''}">${esc(r.mql)}</td>
            <td class="r ${r.extra1Class || ''}">${esc(r.extra1)}</td>
            <td class="r">${esc(r.extra2)}</td>
            <td class="r ${r.extra3Class || ''}">${esc(r.extra3)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${d.campaigns.note ? `<p style="font-size:11px;color:var(--text-3);margin-top:8px;">${esc(d.campaigns.note)}</p>` : ''}
    </div>`;
  return section('Meta Ads — campaigns & cost per lead', metrics + table);
}

function creativesSection(block) {
  if (!block || !block.items) return '';
  const cards = block.items.map((c, i) => {
    // Prefer a locally-downloaded image, base64-inlined so the report is self-contained
    // and never depends on expiring FB/IG CDN URLs. Fall back to a remote thumb if present.
    let src = c.thumb || '';
    if (c.img) {
      try { src = `data:image/jpeg;base64,${readFileSync(resolve(c.img)).toString('base64')}`; }
      catch { /* file missing — keep remote fallback */ }
    }
    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
        <div style="position:relative;background:var(--surface2);">
          <img src="${esc(src)}" alt="${esc(c.name)}" loading="lazy" referrerpolicy="no-referrer" style="width:100%;aspect-ratio:1/1;object-fit:cover;display:block;">
          ${i === 0 ? '<span class="badge badge-green" style="position:absolute;top:8px;left:8px;">★ Top</span>' : ''}
          ${c.tag ? `<span class="badge badge-gray" style="position:absolute;top:8px;right:8px;">${esc(c.tag)}</span>` : ''}
        </div>
        <div style="padding:10px 12px;">
          <div style="font-size:12px;font-weight:500;line-height:1.35;margin-bottom:9px;height:33px;overflow:hidden;">${esc(c.name)}</div>
          <div style="display:flex;gap:6px;border-top:1px solid var(--border);padding-top:9px;">
            <div style="text-align:center;flex:1;"><div style="font-size:15px;font-weight:600;color:var(--green);">${esc(c.leads)}</div><div style="font-size:10px;color:var(--text-3);">leads</div></div>
            <div style="text-align:center;flex:1;"><div style="font-size:15px;font-weight:600;color:var(--amber);">${esc(c.cpl)}</div><div style="font-size:10px;color:var(--text-3);">cost/lead</div></div>
            <div style="text-align:center;flex:1;"><div style="font-size:15px;font-weight:600;color:var(--text-2);">${esc(c.spend)}</div><div style="font-size:10px;color:var(--text-3);">spend</div></div>
          </div>
        </div>
      </div>`;
  }).join('');
  const grid = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">${cards}</div>`;
  const note = block.note ? `<p style="font-size:11px;color:var(--text-3);margin-top:10px;">${esc(block.note)}</p>` : '';
  return section(block.label || 'Top performing creatives — Meta', grid + note);
}

function spendSection(d) {
  if (!d.spend) return '';
  if (d.spend.placeholder) return section('Paid media — spend & cost per lead', pendingCard(d.spend.note));
  const s = d.spend;
  const spendGrid = s.metrics?.length === 4 ? 'mg4' : 'mg3';
  const metrics = s.metrics.map(m => `<div class="metric"><p class="metric-label">${esc(m.label)}</p><p class="metric-value" style="color:${col(m.color)};">${esc(m.value)}</p><p class="metric-sub">${esc(m.sub)}</p></div>`).join('');
  const rows = s.rows.map((r, i) => `
          <tr${r.bold ? '' : (i % 2 ? ' class="alt"' : '')}>
            <td>${r.bold ? `<strong>${esc(r.platform)}</strong>` : esc(r.platform)}</td>
            <td class="r">${esc(r.spend)}</td>
            <td class="r">${esc(r.leads)}</td>
            <td class="r ${r.cplClass || ''}">${esc(r.cpl)}</td>
            <td class="r">${esc(r.mql)}</td>
            <td class="r ${r.cpmqlClass || ''}">${esc(r.cpmql)}</td>
          </tr>`).join('');
  return section('Paid media — spend & cost per lead', `
    <div class="${spendGrid}">${metrics}</div>
    <div class="card">
      <table>
        <thead><tr><th style="width:185px;">Platform</th><th class="r">Spend</th><th class="r">Leads</th><th class="r">Cost / lead</th><th class="r">MQL+</th><th class="r">Cost / MQL</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${s.note ? `<p style="font-size:11px;color:var(--text-3);margin-top:8px;">${esc(s.note)}</p>` : ''}
    </div>`);
}

// Generic table: headers + rows (cells = string or {v, cls, bold}); aligns 'l'/'r' per column.
function renderTable(tbl) {
  const aligns = tbl.aligns || tbl.headers.map((_, i) => (i === 0 ? 'l' : 'r'));
  const cell = (c) => (c && typeof c === 'object')
    ? `${c.bold ? '<strong>' : ''}${esc(c.v)}${c.bold ? '</strong>' : ''}`
    : esc(c);
  const cls = (c, i) => `${aligns[i] === 'r' ? 'r ' : ''}${(c && typeof c === 'object' && c.cls) ? c.cls : ''}`.trim();
  const thead = `<tr>${tbl.headers.map((h, i) => `<th class="${aligns[i] === 'r' ? 'r' : ''}"${tbl.widths && tbl.widths[i] ? ` style="width:${tbl.widths[i]};"` : ''}>${esc(h)}</th>`).join('')}</tr>`;
  const body = tbl.rows.map((r, ri) => {
    const bold = (r && typeof r === 'object' && r.bold);
    const cells = (r.cells || r);
    return `<tr${(!bold && ri % 2) ? ' class="alt"' : ''}>${cells.map((c, i) => `<td class="${cls(c, i)}">${bold ? `<strong>${cell(c)}</strong>` : cell(c)}</td>`).join('')}</tr>`;
  }).join('');
  return `<div class="card"><table><thead>${thead}</thead><tbody>${body}</tbody></table>${tbl.note ? `<p style="font-size:11px;color:var(--text-3);margin-top:8px;">${esc(tbl.note)}</p>` : ''}</div>`;
}

// Generic section: optional metric cards + a table. Used for LinkedIn / Google ad sections.
function genericSection(label, block) {
  if (!block) return '';
  if (block.placeholder) return section(label, pendingCard(block.note));
  const m = block.metrics ? `<div class="mg${block.metrics.length === 4 ? 4 : 3}">${block.metrics.map(mt => `<div class="metric"><p class="metric-label">${esc(mt.label)}</p><p class="metric-value" style="color:${col(mt.color)};">${esc(mt.value)}</p><p class="metric-sub">${esc(mt.sub)}</p></div>`).join('')}</div>` : '';
  return section(label, m + (block.table ? renderTable(block.table) : ''));
}

function sqlContactsSection(d) {
  if (!d.sqlContacts) return '';
  const sc = d.sqlContacts;
  const contactRow = (c) => `<div class="contact-row"><span class="cn">${esc(c.name)}</span><span class="cc">${c.detail}</span>${c.score ? `<span class="score" style="color:var(--green);">${esc(c.score)}</span>` : ''}</div>`;
  const left = `
      <div class="card" style="margin-bottom:0;">
        <div class="card-title">${badge(sc.left.titleBadge, sc.left.titleBadgeLabel)} ${esc(sc.left.titleSuffix)}</div>
        ${sc.left.contacts.map(contactRow).join('')}
      </div>`;
  const opps = sc.right.opps ? `
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
          <div style="font-size:12px;font-weight:500;color:var(--text-2);margin-bottom:8px;">${esc(sc.right.oppsTitle)}</div>
          ${sc.right.opps.map(contactRow).join('')}
        </div>` : '';
  const right = `
      <div class="card" style="margin-bottom:0;">
        <div class="card-title">${badge(sc.right.titleBadge, sc.right.titleBadgeLabel)} ${esc(sc.right.titleSuffix)}</div>
        ${sc.right.contacts.map(contactRow).join('')}
        ${opps}
      </div>`;
  return section('SQL & opportunity contacts this week', `<div class="mg2">${left}${right}</div>`);
}

function websiteSection(d) {
  if (!d.website) return '';
  if (d.website.placeholder) return section('Website performance — GA4', pendingCard(d.website.note));
  const w = d.website;
  const metrics = w.metrics.map(m => `<div class="metric"><p class="metric-label">${esc(m.label)}</p><p class="metric-value" style="color:${col(m.color)};">${esc(m.value)}</p><p class="metric-sub">${esc(m.sub)}</p></div>`).join('');
  const rows = w.rows.map(r => `<tr${r.alt ? ' class="alt"' : ''}><td${r.indent ? ' style="padding-left:14px;color:var(--text-2);"' : ''}>${r.bold ? `<strong>${esc(r.channel)}</strong>` : esc(r.channel)}</td><td class="r">${esc(r.sessions)}</td><td class="r ${r.bounceClass || ''}">${esc(r.bounce)}</td><td class="r ${r.durClass || ''}">${esc(r.duration)}</td><td class="r">${esc(r.events)}</td><td class="r ${r.rateClass || ''}">${esc(r.rate)}</td></tr>`).join('');
  return section('Website performance — GA4', `
    <div class="mg3">${metrics}</div>
    <div class="card">
      <table>
        <thead><tr><th style="width:185px;">Channel</th><th class="r">Sessions</th><th class="r">Bounce rate</th><th class="r">Avg duration</th><th class="r">Key events</th><th class="r">Key event rate</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`);
}

function observationsSection(d) {
  if (!d.observations) return '';
  const rows = d.observations.map((o, i) => `
      <div class="obs"><div class="obs-num" style="background:var(--${o.color}-bg);color:var(--${o.color}-text);">${i + 1}</div><div class="obs-text">${o.html}</div></div>`).join('');
  return section('Key observations', `<div class="card">${rows}</div>`);
}

function contentSection(d) {
  if (!d.content) return '';
  if (d.content.placeholder) return section('Live last week from marketing', pendingCard(d.content.note));
  // expects d.content.columns: [{titleHtml, items:[{color,text,sub}]}]
  const cols = d.content.columns.map(c => `
      <div class="card">
        <div class="card-title">${c.titleHtml}</div>
        ${c.items.map(it => `<div class="content-item"><div class="content-dot" style="background:${col(it.color)};"></div><div><div class="content-text">${esc(it.text)}</div>${it.sub ? `<div class="content-sub">${esc(it.sub)}</div>` : ''}</div></div>`).join('')}
      </div>`).join('');
  return section('Live last week from marketing', `<div class="mg2">${cols}</div>`);
}

function whatsNextSection(d) {
  if (!d.whatsNext) return '';
  if (d.whatsNext.placeholder) return section("What's next this week", pendingCard(d.whatsNext.note));
  const items = d.whatsNext.items.map(it => `<div class="next-item"><div class="next-box"></div><div><div class="next-title">${esc(it.title)}</div>${it.sub ? `<div class="next-sub">${esc(it.sub)}</div>` : ''}</div></div>`).join('');
  return section("What's next this week", `<div class="card">${items}</div>`);
}

function q2Section(d) {
  if (!d.q2) return '';
  if (d.q2.placeholder) return section('Q2 running total', pendingCard(d.q2.note));
  const metrics = d.q2.metrics.map(m => `<div class="metric"><p class="metric-label">${esc(m.label)}</p><p class="metric-value" style="color:${col(m.color)};">${esc(m.value)}</p><p class="metric-sub">${esc(m.sub)}</p></div>`).join('');
  return section('Q2 running total', `<div class="mg4">${metrics}</div>`);
}

// ---- assemble ------------------------------------------------------------
const CSS = `
  :root {
    --bg:#F7F6F3;--surface:#FFFFFF;--surface2:#F0EEE9;
    --border:rgba(0,0,0,0.08);--border-strong:rgba(0,0,0,0.15);
    --text:#1A1916;--text-2:#6B6860;--text-3:#9E9B94;
    --blue:#1A56E8;--blue-bg:#EBF1FD;--blue-text:#1240C0;
    --green:#0A7C4A;--green-bg:#E4F5EC;--green-text:#065C37;
    --amber:#B05E00;--amber-bg:#FDF0E0;--amber-text:#8A4900;
    --red:#C0291A;--red-bg:#FDECEA;--red-text:#991F14;
    --purple:#5B3FD4;--purple-bg:#EEEAFC;--purple-text:#3D28A8;
    --teal:#0B7A6E;--teal-bg:#E2F4F2;--teal-text:#085F55;
    --coral:#993C1D;--coral-bg:#FAECE7;--coral-text:#712B13;
    --radius:10px;--radius-sm:6px;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--text);font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  @media print{body{background:#fff;}.section{break-inside:avoid;animation:none!important;opacity:1!important;transform:none!important;}.card{break-inside:avoid;}}
  .wrap{max-width:900px;margin:0 auto;padding:48px 24px 80px;}
  .report-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:40px;padding-bottom:28px;border-bottom:1.5px solid var(--border-strong);}
  .report-logo{font-size:13px;font-weight:600;color:var(--text-3);letter-spacing:.06em;text-transform:uppercase;}
  .report-title{font-size:26px;font-weight:600;color:var(--text);margin:6px 0 4px;letter-spacing:-.3px;}
  .report-date{font-size:13px;color:var(--text-2);}
  .section{margin-bottom:36px;animation:fadeUp .5s ease both;}
  .section-label{font-size:16px;font-weight:700;color:#000;text-transform:uppercase;letter-spacing:.04em;margin-bottom:12px;display:flex;align-items:center;gap:8px;}
  .section-label::after{content:'';flex:1;height:1px;background:var(--border);}
  .card{background:var(--surface);border-radius:var(--radius);border:1px solid var(--border);padding:18px 20px;margin-bottom:10px;}
  .card-title{font-size:13px;font-weight:700;color:#000;margin-bottom:14px;text-transform:uppercase;letter-spacing:.05em;}
  .mg4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;}
  .mg3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;}
  .mg2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;}
  @media(max-width:600px){.mg4,.mg3{grid-template-columns:1fr 1fr;}.mg2{grid-template-columns:1fr;}}
  .metric{background:var(--surface2);border-radius:var(--radius-sm);padding:14px 16px;}
  .metric-label{font-size:11px;color:var(--text-2);margin-bottom:4px;}
  .metric-value{font-size:24px;font-weight:600;line-height:1.1;}
  .metric-sub{font-size:11px;color:var(--text-2);margin-top:3px;}
  .funnel{display:flex;align-items:stretch;margin-bottom:20px;border-radius:var(--radius);overflow:hidden;border:1px solid var(--border);}
  .funnel-stage{flex:1;padding:16px 12px;text-align:center;background:var(--surface);border-right:1px solid var(--border);}
  .funnel-stage:last-child{border-right:none;}
  .funnel-stage.alt{background:var(--surface2);}
  .funnel-num{font-size:28px;font-weight:600;margin:4px 0 2px;line-height:1;}
  .funnel-label{font-size:11px;color:var(--text-2);}
  .funnel-conv{font-size:11px;font-weight:500;margin-top:3px;}
  .badge{display:inline-block;font-size:10px;font-weight:600;padding:2px 7px;border-radius:20px;white-space:nowrap;}
  .badge-blue{background:var(--blue-bg);color:var(--blue-text);}
  .badge-green{background:var(--green-bg);color:var(--green-text);}
  .badge-amber{background:var(--amber-bg);color:var(--amber-text);}
  .badge-red{background:var(--red-bg);color:var(--red-text);}
  .badge-purple{background:var(--purple-bg);color:var(--purple-text);}
  .badge-teal{background:var(--teal-bg);color:var(--teal-text);}
  .badge-coral{background:var(--coral-bg);color:var(--coral-text);}
  .badge-gray{background:var(--surface2);color:var(--text-2);}
  .badge-up{background:var(--green-bg);color:var(--green-text);}
  .badge-warn{background:var(--amber-bg);color:var(--amber-text);}
  .bar-row{display:flex;align-items:center;gap:10px;margin-bottom:9px;}
  .bar-row:last-child{margin-bottom:0;}
  .bar-label{width:150px;flex-shrink:0;font-size:12px;color:var(--text-2);}
  .bar-label.sm{width:110px;}
  .bar-track{flex:1;height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;}
  .bar-fill{height:100%;border-radius:4px;}
  .bar-num{font-size:12px;font-weight:500;width:30px;text-align:right;flex-shrink:0;}
  .bar-extra{font-size:11px;color:var(--text-3);width:60px;text-align:right;flex-shrink:0;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th{text-align:left;font-weight:600;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;padding:0 10px 10px 0;border-bottom:1px solid var(--border);}
  td{padding:8px 10px 8px 0;border-bottom:1px solid var(--border);color:var(--text);vertical-align:middle;}
  tr:last-child td{border-bottom:none;}
  tr.alt td{background:var(--surface2);}
  .r{text-align:right;}
  .good{color:var(--green);font-weight:500;}
  .mid{color:var(--amber);font-weight:500;}
  .bad{color:var(--red);font-weight:500;}
  .obs{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border);}
  .obs:last-child{border-bottom:none;}
  .obs-num{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px;}
  .obs-text{font-size:13px;color:var(--text);line-height:1.6;flex:1;}
  .obs-text strong{font-weight:600;}
  .contact-row{display:flex;align-items:flex-start;gap:8px;padding:6px 8px;background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:4px;font-size:12px;}
  .contact-row:last-child{margin-bottom:0;}
  .cn{font-weight:500;color:var(--text);flex:1;}
  .cc{color:var(--text-2);font-size:11px;width:230px;flex-shrink:0;}
  .score{font-size:11px;font-weight:600;width:36px;text-align:right;flex-shrink:0;}
  .wow{display:grid;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px;}
  .wow:last-child{border-bottom:none;}
  .compare{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .compare-card{background:var(--surface2);border-radius:var(--radius-sm);padding:14px 16px;text-align:center;}
  .compare-platform{font-size:11px;color:var(--text-3);margin-bottom:8px;}
  .compare-rate{font-size:22px;font-weight:600;}
  .compare-meta{font-size:11px;color:var(--text-2);margin-top:4px;line-height:1.5;}
  .content-item{display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px;}
  .content-item:last-child{border-bottom:none;}
  .content-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;margin-top:6px;}
  .content-text{flex:1;color:var(--text);}
  .content-sub{font-size:11px;color:var(--text-3);margin-top:1px;}
  .next-item{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border);}
  .next-item:last-child{border-bottom:none;}
  .next-box{width:18px;height:18px;border-radius:4px;border:1.5px solid var(--border-strong);flex-shrink:0;margin-top:2px;}
  .next-title{font-size:13px;font-weight:500;color:var(--text);}
  .next-sub{font-size:11px;color:var(--text-3);margin-top:2px;}
  .info-box{border-radius:var(--radius-sm);padding:10px 14px;font-size:12px;line-height:1.6;margin-bottom:14px;}
  .footer{margin-top:60px;padding-top:24px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;}
  .footer-text{font-size:11px;color:var(--text-3);}
  @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(data.meta.titleTag || (data.meta.logo + ' — ' + data.meta.title))}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
${header(data.meta)}
${funnelSection(data)}
${campaignSection(data)}
${employeeSizeSection(data)}
${soaSizeSection(data)}
${spendSection(data)}
${metaSection(data)}
${creativesSection(data.creatives)}
${creativesSection(data.creativesRoadmap)}
${genericSection('LinkedIn Ads — campaigns & cost per lead', data.linkedin)}
${genericSection('Google Ads — campaigns & spend', data.google)}
${sqlContactsSection(data)}
${websiteSection(data)}
${observationsSection(data)}
  <div class="footer">
    <div class="footer-text">${esc(data.meta.footerLeft)}</div>
    <div class="footer-text">${esc(data.meta.footerRight)}</div>
  </div>
</div>
</body>
</html>`;

mkdirSync(dirname(resolve(outPath)), { recursive: true });
writeFileSync(resolve(outPath), html, 'utf8');
console.log(`✓ Wrote ${outPath} (${(html.length / 1024).toFixed(1)} KB) from ${dataPath}`);
