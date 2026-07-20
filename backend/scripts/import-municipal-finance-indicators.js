import "dotenv/config";
import { pool } from "../src/db/pool.js";

const BASE_URL = "https://municipaldata.treasury.gov.za/api";
const SOURCE_URL = "https://municipaldata.treasury.gov.za/docs";
const TIMEOUT_MS = Number(process.env.MUNICIPAL_FINANCE_TIMEOUT_MS || 90000);
const MAX_RETRIES = Number(process.env.MUNICIPAL_FINANCE_MAX_RETRIES || 3);
const START_YEAR = Number(process.env.MUNICIPAL_FINANCE_START_YEAR || 2025);
const MIN_YEAR = Number(process.env.MUNICIPAL_FINANCE_MIN_YEAR || 2020);

const REVENUE_CODES = [
  "0200", "0300", "0400", "0500", "0600", "0700", "0800", "0900", "1000", "1100",
  "1200", "1300", "1400", "1500", "1550", "1570", "1590", "1600", "1700", "1800",
  "1900", "2000", "2100", "2200", "2300", "2400", "2500", "2600", "2700", "2800",
];

const OPERATING_EXPENDITURE_CODES = [
  "2900", "3000", "3100", "3200", "3300", "3400", "3500", "3600", "3700", "3800",
  "3900", "4000", "4100", "4200", "4300",
];

const CAPITAL_TRANSFER_CODES = ["4600", "4700"];

const FINANCIAL_POSITION_CODES = {
  current_assets: "0110",
  cash: "0120",
  short_term_investments: "0125",
  current_liabilities: "0320",
  bank_overdraft: "0330",
  current_borrowings: "0340",
  current_financial_liabilities: "0360",
  total_current_liabilities: "0430",
  non_current_financial_liabilities: "0450",
  total_non_current_liabilities: "0490",
  total_liabilities: "0500",
};

const INFRASTRUCTURE_CODES = [
  "0120", "0130", "0140", "0150", "0170", "0180", "0190",
  "0210", "0220", "0230", "0240", "0250", "0260", "0270", "0280", "0290",
  "0310", "0320", "0330", "0340", "0350", "0360", "0370", "0380", "0390", "0400",
  "0420", "0430", "0440", "0450", "0460", "0470",
  "0490", "0500", "0510", "0520", "0530",
  "0540", "0550",
  "0570", "0580", "0590", "0600", "0610", "0620", "0630", "0640", "0650",
  "0670", "0680", "0690", "0700", "0710",
  "0730", "0740", "0750", "0760",
];

const INDICATORS = [
  ["governance_audit_outcome_risk", "Audit outcome risk", "Governance - audit and compliance", "Risk score derived from the latest audit opinion, where clean audits score lowest and disclaimed/adverse/outstanding outcomes score highest.", "audit risk score", "higher_risk", 300],
  ["governance_uifw_to_revenue", "UIFW expenditure to revenue", "Governance - audit and compliance", "Unauthorised, irregular, fruitless and wasteful expenditure as a share of operating revenue.", "percent", "higher_risk", 310],
  ["governance_unauthorised_to_revenue", "Unauthorised expenditure to revenue", "Governance - audit and compliance", "Unauthorised expenditure as a share of operating revenue.", "percent", "higher_risk", 320],
  ["governance_irregular_to_revenue", "Irregular expenditure to revenue", "Governance - audit and compliance", "Irregular expenditure as a share of operating revenue.", "percent", "higher_risk", 330],
  ["governance_fruitless_to_revenue", "Fruitless and wasteful expenditure to revenue", "Governance - audit and compliance", "Fruitless and wasteful expenditure as a share of operating revenue.", "percent", "higher_risk", 340],
  ["finance_operating_margin_pressure", "Operating deficit pressure", "Governance - financial resilience", "Risk score from operating surplus or deficit margin. Larger deficits produce higher pressure.", "percent", "higher_risk", 350],
  ["finance_debt_to_revenue", "Debt to revenue", "Governance - financial resilience", "Borrowings and financial liabilities as a share of operating revenue.", "percent", "higher_risk", 360],
  ["finance_liabilities_to_revenue", "Total liabilities to revenue", "Governance - financial resilience", "Total liabilities as a share of operating revenue.", "percent", "higher_risk", 370],
  ["finance_cash_ratio", "Cash ratio", "Governance - financial resilience", "Cash and short-term investments divided by current liabilities.", "ratio", "higher_resilience", 380],
  ["finance_current_ratio", "Current ratio", "Governance - financial resilience", "Current assets divided by current liabilities.", "ratio", "higher_resilience", 390],
  ["finance_capex_to_revenue", "Capital expenditure to revenue", "Governance - infrastructure investment", "Capital expenditure as a share of operating revenue.", "percent", "higher_resilience", 400],
  ["finance_infrastructure_capex_share", "Infrastructure share of capital expenditure", "Governance - infrastructure investment", "Infrastructure capital expenditure as a share of total capital expenditure.", "percent", "higher_resilience", 410],
];

const INDEX_DEFINITIONS = [
  ["governance_audit_compliance_imported", "Audit and compliance governance pressure", "Governance", "AGSA audit outcomes and National Treasury UIFW expenditure indicators.", 100],
  ["governance_financial_resilience_imported", "Financial resilience governance pressure", "Governance", "National Treasury Municipal Money liquidity, operating-balance, debt and liabilities indicators.", 102],
  ["governance_infrastructure_investment_imported", "Infrastructure investment governance pressure", "Governance", "National Treasury Municipal Money capital expenditure and infrastructure investment indicators.", 104],
  ["imported_governance_risk", "Imported governance risk pressure", "Governance", "Composite of AGSA audit, National Treasury finance, infrastructure and compliance indicators.", 108],
];

function quoteCutValue(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function makeCut({ municipalityCode, year, amountTypeCode, financialPeriod, itemCodes }) {
  const parts = [
    `financial_year_end.year:${year}`,
    `amount_type.code:${amountTypeCode}`,
    `financial_period.period:${financialPeriod}`,
    `demarcation.code:${quoteCutValue(municipalityCode)}`,
  ];
  if (itemCodes?.length) parts.push(`item.code:${itemCodes.map(quoteCutValue).join(";")}`);
  return parts.join("|");
}

async function fetchJson(path, params = {}) {
  const url = new URL(`${BASE_URL}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "SARVA-Municipal-Risk-Profiler/1.0",
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const payload = await response.json();
      if (payload.status && payload.status !== "ok") throw new Error(payload.message || `API status ${payload.status}`);
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`National Treasury API request failed: ${url.toString()} (${lastError?.message || "unknown error"})`);
}

async function members(cube, dimension, cut) {
  const payload = await fetchJson(`cubes/${cube}/members/${dimension}`, { cut, pagesize: 10000 });
  return payload.data || [];
}

async function aggregate(cube, cut) {
  const payload = await fetchJson(`cubes/${cube}/aggregate`, { cut, aggregates: "amount.sum", pagesize: 10000 });
  return amountSum(payload.cells || []);
}

async function facts(cube, cut, order) {
  const payload = await fetchJson(`cubes/${cube}/facts`, { cut, order, pagesize: 10000 });
  return payload.data || [];
}

function findValue(row, suffix) {
  if (Object.hasOwn(row, suffix)) return row[suffix];
  const key = Object.keys(row).find((candidate) => candidate.endsWith(suffix));
  return key ? row[key] : undefined;
}

function amountSum(rows) {
  const values = rows
    .map((row) => Number(findValue(row, "amount.sum") ?? findValue(row, "amount")))
    .filter(Number.isFinite);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function safeRatio(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

function riskScore(value, good, bad) {
  if (!Number.isFinite(value)) return null;
  if (bad === good) return 50;
  return Math.max(0, Math.min(100, ((value - good) / (bad - good)) * 100));
}

function resilienceScore(value, bad, good) {
  if (!Number.isFinite(value)) return null;
  if (good === bad) return 50;
  return Math.max(0, Math.min(100, ((value - bad) / (good - bad)) * 100));
}

function auditScore(outcome) {
  const text = String(outcome || "").toLowerCase();
  if (!text) return null;
  if (/clean|unqualified.*no findings/.test(text)) return 0;
  if (/unqualified/.test(text)) return 30;
  if (/qualified/.test(text)) return 65;
  if (/adverse|disclaimed/.test(text)) return 90;
  if (/outstanding|not submitted/.test(text)) return 100;
  return 55;
}

async function latestAuditOpinion(municipalityCode) {
  const rows = await facts(
    "audit_opinions",
    `demarcation.code:${quoteCutValue(municipalityCode)}`,
    "financial_year_end.year:desc"
  );
  if (rows.length === 0) return {};
  const sorted = [...rows].sort((a, b) => Number(findValue(b, "financial_year_end.year") || 0) - Number(findValue(a, "financial_year_end.year") || 0));
  const row = sorted[0];
  return {
    year: Number(findValue(row, "financial_year_end.year")) || null,
    outcome: findValue(row, "opinion.label") || null,
    reportUrl: findValue(row, "opinion.report_url") || null,
  };
}

async function chooseAmountType(cube, municipalityCode, year) {
  const rows = await members(cube, "amount_type", `financial_year_end.year:${year}|demarcation.code:${quoteCutValue(municipalityCode)}`);
  const candidates = rows.map((row) => ({
    code: String(findValue(row, "amount_type.code") || "").trim(),
    label: String(findValue(row, "amount_type.label") || findValue(row, "label") || "").trim(),
  })).filter((row) => row.code);
  return candidates.find((row) => row.code.toUpperCase() === "AUDA")
    || candidates.find((row) => /audit/i.test(row.label))
    || candidates.find((row) => /actual/i.test(row.label))
    || null;
}

async function chooseFinancialPeriod(cube, municipalityCode, year, amountTypeCode) {
  const rows = await members(cube, "financial_period", `financial_year_end.year:${year}|amount_type.code:${amountTypeCode}|demarcation.code:${quoteCutValue(municipalityCode)}`);
  const periods = rows.map((row) => Number(findValue(row, "financial_period.period"))).filter(Number.isFinite);
  if (periods.includes(year)) return year;
  if (periods.includes(12)) return 12;
  return periods.length ? Math.max(...periods) : null;
}

async function cubeConfig(cube, municipalityCode, year) {
  const amountType = await chooseAmountType(cube, municipalityCode, year);
  if (!amountType) return null;
  const financialPeriod = await chooseFinancialPeriod(cube, municipalityCode, year, amountType.code);
  if (!financialPeriod) return null;
  return { amountTypeCode: amountType.code, amountTypeLabel: amountType.label || amountType.code, financialPeriod };
}

async function chooseProfileYear(municipalityCode, auditYear) {
  const start = auditYear || START_YEAR;
  for (let year = start; year >= MIN_YEAR; year -= 1) {
    const configs = await Promise.all([
      cubeConfig("incexp_v2", municipalityCode, year),
      cubeConfig("financial_position_v2", municipalityCode, year),
      cubeConfig("capital_v2", municipalityCode, year),
    ]);
    if (configs.every(Boolean)) return { year, income: configs[0], position: configs[1], capital: configs[2] };
  }
  return null;
}

async function aggregatedAmount(cube, municipalityCode, year, config, itemCodes) {
  return aggregate(cube, makeCut({
    municipalityCode,
    year,
    amountTypeCode: config.amountTypeCode,
    financialPeriod: config.financialPeriod,
    itemCodes,
  }));
}

async function uifwExpenditure(municipalityCode, year) {
  const result = {};
  for (const [itemCode, field] of [
    ["unauthorised", "unauthorised"],
    ["irregular", "irregular"],
    ["fruitless", "fruitlessWasteful"],
  ]) {
    result[field] = await aggregate(
      "uifwexp",
      `financial_year_end.year:${year}|demarcation.code:${quoteCutValue(municipalityCode)}|item.code:${quoteCutValue(itemCode)}`
    );
  }
  return result;
}

async function financeProfile(municipalityCode) {
  const audit = await latestAuditOpinion(municipalityCode);
  const selected = await chooseProfileYear(municipalityCode, audit.year);
  if (!selected) throw new Error(`No common audited/actual finance year found for ${municipalityCode}`);

  const revenue = await aggregatedAmount("incexp_v2", municipalityCode, selected.year, selected.income, REVENUE_CODES);
  const expenditureRaw = await aggregatedAmount("incexp_v2", municipalityCode, selected.year, selected.income, OPERATING_EXPENDITURE_CODES);
  const operatingExpenditure = Number.isFinite(expenditureRaw) ? Math.abs(expenditureRaw) : null;
  const capitalTransfers = await aggregatedAmount("incexp_v2", municipalityCode, selected.year, selected.income, CAPITAL_TRANSFER_CODES);
  const operatingSurplus = Number.isFinite(revenue) && Number.isFinite(operatingExpenditure) ? revenue - operatingExpenditure : null;

  const position = {};
  for (const [field, code] of Object.entries(FINANCIAL_POSITION_CODES)) {
    const amount = await aggregatedAmount("financial_position_v2", municipalityCode, selected.year, selected.position, [code]);
    position[field] = Number.isFinite(amount) ? Math.abs(amount) : null;
  }

  const capitalExpenditureRaw = await aggregatedAmount("capital_v2", municipalityCode, selected.year, selected.capital);
  const capitalExpenditure = Number.isFinite(capitalExpenditureRaw) ? Math.abs(capitalExpenditureRaw) : null;
  const infrastructureCapexRaw = await aggregatedAmount("capital_v2", municipalityCode, selected.year, selected.capital, INFRASTRUCTURE_CODES);
  const infrastructureCapex = Number.isFinite(infrastructureCapexRaw) ? Math.abs(infrastructureCapexRaw) : null;
  const uifw = await uifwExpenditure(municipalityCode, selected.year);

  const borrowings = [position.current_borrowings, position.current_financial_liabilities, position.non_current_financial_liabilities]
    .filter(Number.isFinite)
    .reduce((sum, value) => sum + value, 0);
  const currentLiabilities = position.current_liabilities ?? position.total_current_liabilities;
  const cashAndInvestments = [position.cash, position.short_term_investments].filter(Number.isFinite).reduce((sum, value) => sum + value, 0);
  const uifwTotal = [uifw.unauthorised, uifw.irregular, uifw.fruitlessWasteful].filter(Number.isFinite).reduce((sum, value) => sum + value, 0);

  const ratios = {
    currentRatio: safeRatio(position.current_assets, currentLiabilities),
    cashRatio: safeRatio(cashAndInvestments, currentLiabilities),
    debtToRevenue: safeRatio(borrowings || null, revenue),
    liabilitiesToRevenue: safeRatio(position.total_liabilities, revenue),
    operatingMargin: safeRatio(operatingSurplus, revenue),
    capexToRevenue: safeRatio(capitalExpenditure, revenue),
    infrastructureCapexShare: safeRatio(infrastructureCapex, capitalExpenditure),
    uifwToRevenue: safeRatio(uifwTotal || null, revenue),
    unauthorisedToRevenue: safeRatio(uifw.unauthorised, revenue),
    irregularToRevenue: safeRatio(uifw.irregular, revenue),
    fruitlessToRevenue: safeRatio(uifw.fruitlessWasteful, revenue),
  };

  return { audit, selected, revenue, operatingExpenditure, operatingSurplus, capitalTransfers, capitalExpenditure, infrastructureCapex, position, borrowings, uifw, ratios };
}

function indicatorRows(profile) {
  const { ratios } = profile;
  return [
    ["governance_audit_outcome_risk", auditScore(profile.audit.outcome), profile.audit.outcome, "audit outcome"],
    ["governance_uifw_to_revenue", riskScore(ratios.uifwToRevenue, 0, 0.15), percentageValue(ratios.uifwToRevenue), "percent"],
    ["governance_unauthorised_to_revenue", riskScore(ratios.unauthorisedToRevenue, 0, 0.10), percentageValue(ratios.unauthorisedToRevenue), "percent"],
    ["governance_irregular_to_revenue", riskScore(ratios.irregularToRevenue, 0, 0.10), percentageValue(ratios.irregularToRevenue), "percent"],
    ["governance_fruitless_to_revenue", riskScore(ratios.fruitlessToRevenue, 0, 0.03), percentageValue(ratios.fruitlessToRevenue), "percent"],
    ["finance_operating_margin_pressure", riskScore(ratios.operatingMargin, 0.05, -0.20), percentageValue(ratios.operatingMargin), "percent"],
    ["finance_debt_to_revenue", riskScore(ratios.debtToRevenue, 0.15, 1.00), percentageValue(ratios.debtToRevenue), "percent"],
    ["finance_liabilities_to_revenue", riskScore(ratios.liabilitiesToRevenue, 0.50, 2.00), percentageValue(ratios.liabilitiesToRevenue), "percent"],
    ["finance_cash_ratio", resilienceScore(ratios.cashRatio, 0.05, 1.00), ratios.cashRatio, "ratio"],
    ["finance_current_ratio", resilienceScore(ratios.currentRatio, 0.50, 2.00), ratios.currentRatio, "ratio"],
    ["finance_capex_to_revenue", resilienceScore(ratios.capexToRevenue, 0.02, 0.20), percentageValue(ratios.capexToRevenue), "percent"],
    ["finance_infrastructure_capex_share", resilienceScore(ratios.infrastructureCapexShare, 0.20, 0.80), percentageValue(ratios.infrastructureCapexShare), "percent"],
  ].filter(([, value]) => Number.isFinite(value));
}

function percentageValue(ratio) {
  return Number.isFinite(ratio) ? ratio * 100 : null;
}

async function upsertDefinitions(client) {
  for (const [key, label, theme, description, unit, direction, sortOrder] of INDICATORS) {
    await client.query(
      `
        INSERT INTO sarva.municipal_indicator_definition
          (key, label, theme, description, unit, direction, source_name, source_url, is_proxy, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9)
        ON CONFLICT (key) DO UPDATE SET
          label = EXCLUDED.label,
          theme = EXCLUDED.theme,
          description = EXCLUDED.description,
          unit = EXCLUDED.unit,
          direction = EXCLUDED.direction,
          source_name = EXCLUDED.source_name,
          source_url = EXCLUDED.source_url,
          is_proxy = false,
          sort_order = EXCLUDED.sort_order,
          updated_at = now()
      `,
      [key, label, theme, description, unit, direction, "National Treasury Municipal Money API and AGSA audit opinions, latest audited profile year per municipality", SOURCE_URL, sortOrder]
    );
  }

  for (const [key, label, theme, description, sortOrder] of INDEX_DEFINITIONS) {
    await client.query(
      `
        INSERT INTO sarva.municipal_index_definition
          (key, label, theme, description, source_name, source_url, is_proxy, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, false, $7)
        ON CONFLICT (key) DO UPDATE SET
          label = EXCLUDED.label,
          theme = EXCLUDED.theme,
          description = EXCLUDED.description,
          source_name = EXCLUDED.source_name,
          source_url = EXCLUDED.source_url,
          is_proxy = false,
          sort_order = EXCLUDED.sort_order,
          updated_at = now()
      `,
      [key, label, theme, description, "SARVA municipal risk profiler using National Treasury Municipal Money API and AGSA audit opinions", SOURCE_URL, sortOrder]
    );
  }
}

async function rebuildGovernanceWeights(client) {
  await client.query(`
    DELETE FROM sarva.municipal_index_indicator
    WHERE index_key IN (
      'governance_audit_compliance_imported',
      'governance_financial_resilience_imported',
      'governance_infrastructure_investment_imported',
      'imported_governance_risk'
    );

    WITH classified AS (
      SELECT key, theme
      FROM sarva.municipal_indicator_definition
      WHERE direction <> 'context'
        AND is_proxy = false
        AND theme IN (
          'Governance - audit and compliance',
          'Governance - financial resilience',
          'Governance - infrastructure investment',
          'Governance - institutional capacity'
        )
    ),
    rollups AS (
      SELECT
        CASE
          WHEN theme = 'Governance - audit and compliance' THEN 'governance_audit_compliance_imported'
          WHEN theme = 'Governance - financial resilience' THEN 'governance_financial_resilience_imported'
          WHEN theme = 'Governance - infrastructure investment' THEN 'governance_infrastructure_investment_imported'
          ELSE 'governance_institutional_capacity_imported'
        END AS index_key,
        key
      FROM classified
      UNION ALL
      SELECT 'imported_governance_risk', key
      FROM classified
    ),
    weighted AS (
      SELECT
        index_key,
        key,
        1.0 / count(*) OVER (PARTITION BY index_key) AS weight,
        row_number() OVER (PARTITION BY index_key ORDER BY key) AS sort_order
      FROM rollups
    )
    INSERT INTO sarva.municipal_index_indicator (index_key, indicator_key, weight, sort_order)
    SELECT index_key, key, weight, sort_order
    FROM weighted
    ON CONFLICT (index_key, indicator_key) DO UPDATE SET
      weight = EXCLUDED.weight,
      sort_order = EXCLUDED.sort_order;
  `);
}

async function upsertValues(client, municipality, profile) {
  const notes = [
    `Financial year used: ${profile.selected.year}.`,
    `Audit outcome: ${profile.audit.outcome || "not available"}.`,
    `Income and expenditure: ${profile.selected.income.amountTypeLabel} (${profile.selected.income.amountTypeCode}), period ${profile.selected.income.financialPeriod}.`,
    `Financial position: ${profile.selected.position.amountTypeLabel} (${profile.selected.position.amountTypeCode}), period ${profile.selected.position.financialPeriod}.`,
    `Capital acquisition: ${profile.selected.capital.amountTypeLabel} (${profile.selected.capital.amountTypeCode}), period ${profile.selected.capital.financialPeriod}.`,
  ].join(" ");

  for (const [indicatorKey, value, rawValue, rawUnit] of indicatorRows(profile)) {
    await client.query(
      `
        INSERT INTO sarva.municipal_indicator_value
          (municipality_gid, indicator_key, period, scenario, value, raw_value, raw_unit, confidence, source_label, source_url, notes)
        VALUES ($1, $2, $3, 'national_treasury_audited_profile', $4, $5, $6, 'imported', $7, $8, $9)
        ON CONFLICT (municipality_gid, indicator_key, period, scenario) DO UPDATE SET
          value = EXCLUDED.value,
          raw_value = EXCLUDED.raw_value,
          raw_unit = EXCLUDED.raw_unit,
          confidence = EXCLUDED.confidence,
          source_label = EXCLUDED.source_label,
          source_url = EXCLUDED.source_url,
          notes = EXCLUDED.notes,
          updated_at = now()
      `,
      [
        municipality.gid,
        indicatorKey,
        String(profile.selected.year),
        Math.max(0, Math.min(100, value)),
        Number.isFinite(rawValue) ? rawValue : null,
        rawUnit,
        "National Treasury Municipal Money API and AGSA audit opinions, latest audited profile year per municipality",
        profile.audit.reportUrl || SOURCE_URL,
        notes,
      ]
    );
  }
}

async function municipalitiesToImport(client) {
  const requested = String(process.env.MUNICIPAL_FINANCE_CODES || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const result = await client.query(`
    SELECT gid, namecode, municname, map_title, COALESCE(NULLIF(municname, ''), NULLIF(map_title, ''), namecode) AS municipality
    FROM sarva.municipal_boundaries
    WHERE namecode IS NOT NULL AND btrim(namecode) <> ''
    ORDER BY namecode
  `);

  if (requested.length === 0) return result.rows;
  const requestedSet = new Set(requested);
  return result.rows
    .map((row) => ({ ...row, treasuryCode: municipalityCodeCandidates(row).find((code) => requestedSet.has(code)) || String(row.namecode || "").toUpperCase() }))
    .filter((row) => requestedSet.has(row.treasuryCode));
}

function municipalityCodeCandidates(row) {
  const values = [];
  for (const value of [row.namecode, row.municname, row.map_title]) {
    const text = String(value || "").trim();
    if (!text) continue;
    values.push(text.toUpperCase());
    const match = text.match(/\(([A-Z]{2,3}\d{0,3}|[A-Z]{3})\)\s*$/i);
    if (match) values.push(match[1].toUpperCase());
  }
  return values;
}

async function main() {
  const client = await pool.connect();
  const failures = [];
  let importedMunicipalities = 0;
  let importedValues = 0;

  try {
    await client.query("BEGIN");
    await upsertDefinitions(client);
    await client.query("COMMIT");

    const municipalities = await municipalitiesToImport(client);
    for (const municipality of municipalities) {
      const treasuryCode = municipality.treasuryCode || municipalityCodeCandidates(municipality).at(-1) || municipality.namecode;
      try {
        const profile = await financeProfile(treasuryCode);
        await client.query("BEGIN");
        await upsertValues(client, municipality, profile);
        await rebuildGovernanceWeights(client);
        await client.query("COMMIT");
        importedMunicipalities += 1;
        importedValues += indicatorRows(profile).length;
        console.log(`Imported ${treasuryCode} ${municipality.municipality}: ${indicatorRows(profile).length} governance indicators for ${profile.selected.year}`);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        failures.push({ code: treasuryCode, message: error.message });
        console.warn(`Skipped ${treasuryCode}: ${error.message}`);
      }
    }

    console.log(JSON.stringify({ importedMunicipalities, importedValues, failures: failures.slice(0, 20), failureCount: failures.length }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Municipal finance indicator import failed: ${error.message}`);
  process.exit(1);
});
