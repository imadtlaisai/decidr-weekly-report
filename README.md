# Decidr Weekly Marketing Report — generator

A data-driven generator that produces the Decidr weekly marketing report as a
self-contained HTML file, matching the established design. **Claude-assisted edition:**
HubSpot/GA4 data is pulled through the connected Claude session each week, written into a
`data/week-NN.json` file, then rendered by `generate.mjs`.

## Quick start

```bash
node generate.mjs --week 24
# → out/report-week-24.html
open out/report-week-24.html
```

`--data <path>` and `--out <path>` override the defaults.

## Weekly workflow

1. **Pull the data.** Ask Claude (this connected session, or a scheduled agent):
   *"Generate the Decidr weekly report data for the week of <Mon date>."* Claude runs the
   HubSpot queries below and writes `data/week-NN.json`.
2. **Fill the narrative + GA4.** Sections flagged `"placeholder": true` (Website/GA4,
   Live last week, What's next, Q2 totals) aren't in HubSpot — paste them in. They render
   as a dashed "⌛ Pending input" card until filled.
3. **Render.** `node generate.mjs --week NN`.
4. **Share.** The HTML is fully self-contained (only the DM Sans webfont is external);
   email it, or drop it on Netlify like the original.

## Data definitions (important — confirm these match how the CMO reads the report)

- **Week** = Monday–Sunday. Filter `createdate BETWEEN '<Mon>' AND '<Sun>'`.
- **Contacts** = all new contacts created that week. We also report **ex-subscribers**
  (`lifecyclestage` excluding `subscriber`) because newsletter sign-ups inflate the top of
  funnel and don't convert like campaign leads.
- **MQL+ / SQL+ / Opp+** = cumulative (reached that stage *or beyond*), so the funnel
  nests properly: Contacts ⊇ MQL ⊇ SQL ⊇ Opps.
  - MQL+ = `lifecyclestage IN (marketingqualifiedlead, salesqualifiedlead, opportunity, customer)`
  - SQL+ = `... IN (salesqualifiedlead, opportunity, customer)`
  - Opp+ = `... IN (opportunity, customer)`
- **Junk** = `lifecyclestage = Disqualified` (enum id `3069370857`). Also watch obvious test
  rows (e.g. name/company literally "test") — exclude from SQL/opp lists manually.
- **High vs Medium fit** = product-based, matching the original report's own logic
  (DecidrOS = High, Sugarworks = Medium). **There is no numeric fit-score property** in this
  portal (`hubspotscore` is empty), so the 75–100 numbers in the original were manual — omitted.

## HubSpot property map (reverse-engineered from this portal)

| Concept | Property | Notes |
|---|---|---|
| Funnel stage | `lifecyclestage` | `subscriber, lead, marketingqualifiedlead, salesqualifiedlead, opportunity, customer, Partner, Other, Disqualified` |
| Product | `product` | `DecidrOS`, `Sugarworks` (also `Unassigned`) |
| Channel | `hs_analytics_source` | `PAID_SOCIAL`, `DIRECT_TRAFFIC`, `OFFLINE`, `PAID_SEARCH`, … |
| Platform / network | `hs_analytics_source_data_1` | `facebook`, `linkedin`, `import`, referrer URLs, … |
| Campaign / ad name | `hs_analytics_source_data_2` | e.g. `ai roadmap \| tof \| demo leads \| abo \| jun 1` |
| Country | `country` | sparsely populated (most FB Lead Ads have none) |
| Created | `createdate` | week boundary |

## The queries Claude runs (HubSpot MCP `query_crm_data`, SQL)

Replace the dates with the target Mon–Sun.

```sql
-- Funnel
SELECT lifecyclestage, COUNT(*) FROM CONTACT
WHERE createdate BETWEEN '2026-06-08' AND '2026-06-14' GROUP BY lifecyclestage;

-- Product × stage
SELECT product, lifecyclestage, COUNT(*) FROM CONTACT
WHERE createdate BETWEEN '2026-06-08' AND '2026-06-14' GROUP BY product, lifecyclestage;

-- Channel
SELECT hs_analytics_source, COUNT(*) FROM CONTACT
WHERE createdate BETWEEN '2026-06-08' AND '2026-06-14' GROUP BY hs_analytics_source;

-- Platform × stage (LinkedIn vs Facebook quality)
SELECT hs_analytics_source_data_1, lifecyclestage, COUNT(*) FROM CONTACT
WHERE createdate BETWEEN '2026-06-08' AND '2026-06-14' AND hs_analytics_source = 'PAID_SOCIAL'
GROUP BY hs_analytics_source_data_1, lifecyclestage;

-- Geography
SELECT country, COUNT(*) FROM CONTACT
WHERE createdate BETWEEN '2026-06-08' AND '2026-06-14' GROUP BY country ORDER BY COUNT(*) DESC;

-- Campaign volume + MQL+ (two queries; pair them up)
SELECT hs_analytics_source_data_2, COUNT(*) FROM CONTACT
WHERE createdate BETWEEN '2026-06-08' AND '2026-06-14' AND hs_analytics_source = 'PAID_SOCIAL'
GROUP BY hs_analytics_source_data_2 ORDER BY COUNT(*) DESC;
-- ...same with: AND lifecyclestage IN ('marketingqualifiedlead','salesqualifiedlead','opportunity','customer')
```

The SQL/opportunity **contact list** is pulled with `search_crm_objects` filtering
`lifecyclestage IN (salesqualifiedlead, opportunity, customer)` for the week.

## Known data caveats (as of Jun 2026)

- **No real history before June.** The HubSpot org was created **20 May 2026**, and the week
  of **25 May** holds a bulk import (~11k records, 6.4k disqualified). A true 4-week trend
  isn't available yet — the generator shows a Wk-on-Wk comparison until more clean weeks exist.
- **GA4 not in HubSpot.** Pull website metrics from the connected Supermetrics/GA4 source and
  fill `website.metrics` / `website.rows` (remove `"placeholder": true`).
- **Q2 pacing** needs a defined HubSpot saved report that excludes the import; then fill `q2`.

## Files

```
generate.mjs        # renderer (data-driven; CSS matches the original report)
data/week-24.json   # Week 24 data (live HubSpot pull + narrative placeholders)
out/                # generated HTML
README.md
```

## Filling a placeholder section (example: GA4)

Replace the `website` block in the data file:

```json
"website": {
  "metrics": [
    { "label": "Total sessions", "value": "3,773", "color": "purple", "sub": "Paid 2,038 · Organic 1,735" }
  ],
  "rows": [
    { "channel": "Paid total", "bold": true, "alt": true, "sessions": "2,038", "bounce": "70.2%", "bounceClass": "mid", "duration": "1:32", "events": "15", "rate": "0.74%", "rateClass": "mid" },
    { "channel": "Paid Social", "indent": true, "sessions": "1,043", "bounce": "83.3%", "bounceClass": "bad", "duration": "1:16", "events": "0", "rate": "0%", "rateClass": "bad" }
  ]
}
```

`content`, `whatsNext`, and `q2` follow the same shape — see the inline structure in
`generate.mjs` (`contentSection`, `whatsNextSection`, `q2Section`).
