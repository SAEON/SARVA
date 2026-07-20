import { pool } from "../db/pool.js";

export const ESSENTIAL_VARIABLE_FRAMEWORKS = [
  {
    id: "ev",
    acronym: "EV",
    title: "Essential Variables",
    owner: "Earth observation communities",
    framework_type: "Umbrella concept",
    url: "https://geobon.org/ebvs/what-are-ebvs/",
    summary: "Minimum observation sets used across climate, ocean, biodiversity and ecosystem-services monitoring.",
  },
  {
    id: "ecv",
    acronym: "ECV",
    title: "Essential Climate Variables",
    owner: "GCOS / WMO",
    framework_type: "Climate framework",
    url: "https://gcos.wmo.int/en/essential-climate-variables",
    summary: "Climate observations across atmospheric, oceanic and terrestrial domains.",
  },
  {
    id: "ebv",
    acronym: "EBV",
    title: "Essential Biodiversity Variables",
    owner: "GEO BON",
    framework_type: "Biodiversity framework",
    url: "https://geobon.org/ebvs/what-are-ebvs/",
    summary: "Standard biodiversity measurements for monitoring change from genes to ecosystems.",
  },
  {
    id: "eov",
    acronym: "EOV",
    title: "Essential Ocean Variables",
    owner: "GOOS / UNESCO IOC",
    framework_type: "Ocean framework",
    url: "https://goosocean.org/what-we-do/framework/essential-ocean-variables/",
    summary: "Priority ocean observations across physics, biogeochemistry, biology and ecosystems.",
  },
  {
    id: "eesv",
    acronym: "EESV",
    title: "Essential Ecosystem Service Variables",
    owner: "GEO BON",
    framework_type: "Ecosystem services framework",
    url: "https://geobon.org/eesvs/what-are-eesvs/",
    summary: "Variables for monitoring ecosystem services and links between biodiversity, people and sustainability.",
  },
];

export const ESSENTIAL_VARIABLE_RULES = [
  ["ecv-precipitation", "ecv", "Precipitation", "Atmosphere", ["precipitation", "rainfall", "rain gauge", "rainfall station"]],
  ["ecv-temperature", "ecv", "Temperature", "Atmosphere", ["temperature", "air temperature", "surface temperature", "weather station"]],
  ["ecv-soil-moisture", "ecv", "Soil moisture", "Terrestrial", ["soil moisture", "soil water", "soil wetness"]],
  ["ecv-land-cover", "ecv", "Land cover", "Terrestrial", ["land cover", "land-cover", "land use", "vegetation cover", "surface cover"]],
  ["ecv-biomass", "ecv", "Above-ground biomass", "Terrestrial", ["biomass", "above ground biomass", "above-ground biomass", "carbon stock"]],
  ["ecv-sea-surface-temperature", "ecv", "Sea surface temperature", "Ocean", ["sea surface temperature", "sst", "ocean temperature"]],
  ["ebv-species-populations", "ebv", "Species populations", "Species", ["species population", "species populations", "abundance", "population abundance", "occurrence"]],
  ["ebv-community-composition", "ebv", "Community composition", "Community", ["community composition", "species composition", "assemblage", "biodiversity composition"]],
  ["ebv-ecosystem-structure", "ebv", "Ecosystem structure", "Ecosystem", ["ecosystem structure", "habitat structure", "vegetation structure", "canopy cover"]],
  ["ebv-species-traits", "ebv", "Species traits", "Traits", ["species trait", "species traits", "functional trait", "phenology"]],
  ["eov-sea-surface-temperature", "eov", "Sea surface temperature", "Physics", ["sea surface temperature", "sst", "ocean temperature"]],
  ["eov-salinity", "eov", "Salinity", "Physics", ["salinity", "sea surface salinity", "conductivity"]],
  ["eov-ocean-colour", "eov", "Ocean colour", "Biogeochemistry", ["ocean colour", "ocean color", "chlorophyll", "chlorophyll-a", "phytoplankton"]],
  ["eov-oxygen-nutrients", "eov", "Oxygen and nutrients", "Biogeochemistry", ["oxygen", "dissolved oxygen", "nutrient", "nutrients", "nitrate", "phosphate"]],
  ["eesv-water-services", "eesv", "Water-related services", "Regulating / provisioning", ["water supply", "water yield", "water quality", "catchment service", "ecosystem service"]],
  ["eesv-carbon-climate-services", "eesv", "Carbon and climate regulation", "Regulating", ["carbon sequestration", "carbon storage", "climate regulation", "regulating service"]],
  ["eesv-cultural-services", "eesv", "Cultural services", "Cultural", ["cultural service", "recreation", "tourism", "heritage"]],
].map(([key, framework_id, label, category, terms]) => ({ key, framework_id, label, category, terms }));

function matchedTermsForText(text, terms) {
  const haystack = String(text || "").toLowerCase();
  return terms.filter((term) => haystack.includes(term.toLowerCase()));
}

async function seedDefinitions(db) {
  for (const framework of ESSENTIAL_VARIABLE_FRAMEWORKS) {
    await db.query(
      `
        INSERT INTO catalogue.essential_variable_frameworks
          (id, acronym, title, owner, framework_type, url, summary, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, now())
        ON CONFLICT (id) DO UPDATE SET
          acronym = EXCLUDED.acronym,
          title = EXCLUDED.title,
          owner = EXCLUDED.owner,
          framework_type = EXCLUDED.framework_type,
          url = EXCLUDED.url,
          summary = EXCLUDED.summary,
          updated_at = now()
      `,
      [framework.id, framework.acronym, framework.title, framework.owner, framework.framework_type, framework.url, framework.summary]
    );
  }

  for (const rule of ESSENTIAL_VARIABLE_RULES) {
    await db.query(
      `
        INSERT INTO catalogue.essential_variable_rules
          (key, framework_id, label, category, terms, updated_at)
        VALUES ($1, $2, $3, $4, $5, now())
        ON CONFLICT (key) DO UPDATE SET
          framework_id = EXCLUDED.framework_id,
          label = EXCLUDED.label,
          category = EXCLUDED.category,
          terms = EXCLUDED.terms,
          updated_at = now()
      `,
      [rule.key, rule.framework_id, rule.label, rule.category, rule.terms]
    );
  }
}

async function insertCoverageBatch(db, rows) {
  if (!rows.length) return;

  const values = [];
  const placeholders = rows.map((row, rowIndex) => {
    const offset = rowIndex * 4;
    values.push(row.record_id, row.rule_key, row.framework_id, row.matched_terms);
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
  });

  await db.query(
    `
      INSERT INTO catalogue.record_essential_variables
        (record_id, rule_key, framework_id, matched_terms)
      VALUES ${placeholders.join(", ")}
      ON CONFLICT (record_id, rule_key) DO UPDATE SET
        framework_id = EXCLUDED.framework_id,
        matched_terms = EXCLUDED.matched_terms,
        refreshed_at = now()
    `,
    values
  );
}

export async function refreshCatalogueEssentialVariables({ client = pool, logger = console } = {}) {
  const db = client;
  let runId = null;

  try {
    const run = await db.query(
      "INSERT INTO catalogue.essential_variable_refresh_run (status) VALUES ('running') RETURNING id"
    );
    runId = run.rows[0].id;

    await seedDefinitions(db);
    await db.query("TRUNCATE catalogue.record_essential_variables");

    const records = await db.query(`
      SELECT record_id, search_text
      FROM catalogue.record_search_index
    `);

    const batch = [];
    let matchedRecords = 0;
    let matchedVariables = 0;

    for (const record of records.rows) {
      let recordMatched = false;
      for (const rule of ESSENTIAL_VARIABLE_RULES) {
        const matched_terms = matchedTermsForText(record.search_text, rule.terms);
        if (!matched_terms.length) continue;

        recordMatched = true;
        matchedVariables += 1;
        batch.push({
          record_id: record.record_id,
          rule_key: rule.key,
          framework_id: rule.framework_id,
          matched_terms: matched_terms.slice(0, 6),
        });

        if (batch.length >= 500) {
          await insertCoverageBatch(db, batch.splice(0, batch.length));
        }
      }
      if (recordMatched) matchedRecords += 1;
    }

    await insertCoverageBatch(db, batch);

    await db.query(
      `
        UPDATE catalogue.essential_variable_refresh_run
        SET finished_at = now(), status = 'success', matched_records = $1, matched_variables = $2
        WHERE id = $3
      `,
      [matchedRecords, matchedVariables, runId]
    );

    logger.log?.(`Essential-variable coverage refreshed for ${matchedRecords} catalogue records`);
    return { status: "success", matchedRecords, matchedVariables };
  } catch (error) {
    if (runId) {
      await db.query(
        `
          UPDATE catalogue.essential_variable_refresh_run
          SET finished_at = now(), status = 'failed', error_message = $1
          WHERE id = $2
        `,
        [error.message, runId]
      );
    }
    throw error;
  }
}
