import { Router } from "express";
import { pool } from "../db/pool.js";
import { getLiveCatalogueSummary } from "../services/catalogueSync.js";

export const catalogueRouter = Router();

const BASE_TABLE = "catalogue.catalogue_records";
const CATALOGUE_PUBLIC_URL = "https://catalogue.saeon.ac.za";
const CATALOGUE_GRAPHQL_ENDPOINT = process.env.CATALOGUE_GRAPHQL_ENDPOINT || `${CATALOGUE_PUBLIC_URL}/graphql`;

const ESSENTIAL_VARIABLE_FRAMEWORKS = [
  {
    id: "ev",
    acronym: "EV",
    title: "Essential Variables",
    owner: "Earth observation communities",
    framework_type: "Umbrella concept",
    url: "https://geobon.org/ebvs/what-are-ebvs/",
    summary: "Essential Variables are minimum, policy-relevant observation sets used by communities such as climate, ocean, biodiversity and ecosystem-services monitoring.",
    terms: [
      "ev",
      "evs",
      "essential variable",
      "essential variables",
      "essential environmental variables",
      "environmental variables",
      "monitoring framework",
      "observation framework",
      "indicator framework",
    ],
    related_themes: ["climate", "biodiversity", "ecology", "ocean", "coastal", "risk"],
  },
  {
    id: "ecv",
    acronym: "ECV",
    title: "Essential Climate Variables",
    owner: "GCOS / WMO",
    framework_type: "Climate framework",
    url: "https://gcos.wmo.int/en/essential-climate-variables",
    summary: "GCOS Essential Climate Variables structure climate observations across atmospheric, oceanic and terrestrial domains.",
    terms: [
      "ecv",
      "ecvs",
      "essential variable",
      "essential variables",
      "essential climate variable",
      "essential climate variables",
      "gcos",
      "climate variable",
      "climate variables",
      "temperature",
      "precipitation",
      "greenhouse gases",
      "soil moisture",
      "sea surface temperature",
      "glacier",
      "snow",
      "permafrost",
    ],
    related_themes: ["climate", "precipitation", "hydrology", "ocean"],
  },
  {
    id: "ebv",
    acronym: "EBV",
    title: "Essential Biodiversity Variables",
    owner: "GEO BON",
    framework_type: "Biodiversity framework",
    url: "https://geobon.org/ebvs/what-are-ebvs/",
    summary: "GEO BON EBVs organise biodiversity observations from raw data into variables useful for monitoring, assessment and policy indicators.",
    terms: [
      "ebv",
      "ebvs",
      "essential variable",
      "essential variables",
      "essential biodiversity variable",
      "essential biodiversity variables",
      "geo bon",
      "biodiversity variable",
      "species population",
      "species populations",
      "species traits",
      "community composition",
      "ecosystem structure",
      "ecosystem function",
      "genetic composition",
      "habitat structure",
    ],
    related_themes: ["biodiversity", "ecology", "coastal"],
  },
  {
    id: "eov",
    acronym: "EOV",
    title: "Essential Ocean Variables",
    owner: "GOOS / UNESCO IOC",
    framework_type: "Ocean framework",
    url: "https://goosocean.org/what-we-do/framework/essential-ocean-variables/",
    summary: "GOOS Essential Ocean Variables define priority ocean observations across physics, biogeochemistry, biology and ecosystems.",
    terms: [
      "eov",
      "eovs",
      "essential variable",
      "essential variables",
      "essential ocean variable",
      "essential ocean variables",
      "goos",
      "ocean variable",
      "ocean variables",
      "sea surface temperature",
      "sea surface salinity",
      "ocean colour",
      "ocean color",
      "phytoplankton",
      "oxygen",
      "nutrients",
      "currents",
    ],
    related_themes: ["ocean", "coastal", "climate"],
  },
  {
    id: "eesv",
    acronym: "EESV",
    title: "Essential Ecosystem Service Variables",
    owner: "GEO BON",
    framework_type: "Ecosystem services framework",
    url: "https://geobon.org/eesvs/what-are-eesvs/",
    summary: "Essential Ecosystem Service Variables support monitoring of ecosystem services and links between biodiversity, people and sustainability.",
    terms: [
      "eesv",
      "eesvs",
      "essential variable",
      "essential variables",
      "essential ecosystem service variable",
      "essential ecosystem service variables",
      "ecosystem services",
      "nature contribution",
      "sustainability monitoring",
      "provisioning",
      "regulating services",
      "cultural services",
    ],
    related_themes: ["biodiversity", "ecology", "risk"],
  },
];

const ESSENTIAL_VARIABLE_COVERAGE_RULES = [
  {
    key: "ecv-precipitation",
    framework_id: "ecv",
    framework: "ECV",
    label: "Precipitation",
    category: "Atmosphere",
    terms: ["precipitation", "rainfall", "rain gauge", "rainfall station"],
  },
  {
    key: "ecv-temperature",
    framework_id: "ecv",
    framework: "ECV",
    label: "Temperature",
    category: "Atmosphere",
    terms: ["temperature", "air temperature", "surface temperature", "weather station"],
  },
  {
    key: "ecv-soil-moisture",
    framework_id: "ecv",
    framework: "ECV",
    label: "Soil moisture",
    category: "Terrestrial",
    terms: ["soil moisture", "soil water", "soil wetness"],
  },
  {
    key: "ecv-land-cover",
    framework_id: "ecv",
    framework: "ECV",
    label: "Land cover",
    category: "Terrestrial",
    terms: ["land cover", "land-cover", "land use", "vegetation cover", "surface cover"],
  },
  {
    key: "ecv-biomass",
    framework_id: "ecv",
    framework: "ECV",
    label: "Above-ground biomass",
    category: "Terrestrial",
    terms: ["biomass", "above ground biomass", "above-ground biomass", "carbon stock"],
  },
  {
    key: "ecv-sea-surface-temperature",
    framework_id: "ecv",
    framework: "ECV",
    label: "Sea surface temperature",
    category: "Ocean",
    terms: ["sea surface temperature", "sst", "ocean temperature"],
  },
  {
    key: "ebv-species-populations",
    framework_id: "ebv",
    framework: "EBV",
    label: "Species populations",
    category: "Species",
    terms: ["species population", "species populations", "abundance", "population abundance", "occurrence"],
  },
  {
    key: "ebv-community-composition",
    framework_id: "ebv",
    framework: "EBV",
    label: "Community composition",
    category: "Community",
    terms: ["community composition", "species composition", "assemblage", "biodiversity composition"],
  },
  {
    key: "ebv-ecosystem-structure",
    framework_id: "ebv",
    framework: "EBV",
    label: "Ecosystem structure",
    category: "Ecosystem",
    terms: ["ecosystem structure", "habitat structure", "vegetation structure", "canopy cover"],
  },
  {
    key: "ebv-species-traits",
    framework_id: "ebv",
    framework: "EBV",
    label: "Species traits",
    category: "Traits",
    terms: ["species trait", "species traits", "functional trait", "phenology"],
  },
  {
    key: "eov-sea-surface-temperature",
    framework_id: "eov",
    framework: "EOV",
    label: "Sea surface temperature",
    category: "Physics",
    terms: ["sea surface temperature", "sst", "ocean temperature"],
  },
  {
    key: "eov-salinity",
    framework_id: "eov",
    framework: "EOV",
    label: "Salinity",
    category: "Physics",
    terms: ["salinity", "sea surface salinity", "conductivity"],
  },
  {
    key: "eov-ocean-colour",
    framework_id: "eov",
    framework: "EOV",
    label: "Ocean colour",
    category: "Biogeochemistry",
    terms: ["ocean colour", "ocean color", "chlorophyll", "chlorophyll-a", "phytoplankton"],
  },
  {
    key: "eov-oxygen-nutrients",
    framework_id: "eov",
    framework: "EOV",
    label: "Oxygen and nutrients",
    category: "Biogeochemistry",
    terms: ["oxygen", "dissolved oxygen", "nutrient", "nutrients", "nitrate", "phosphate"],
  },
  {
    key: "eesv-water-services",
    framework_id: "eesv",
    framework: "EESV",
    label: "Water-related services",
    category: "Regulating / provisioning",
    terms: ["water supply", "water yield", "water quality", "catchment service", "ecosystem service"],
  },
  {
    key: "eesv-carbon-climate-services",
    framework_id: "eesv",
    framework: "EESV",
    label: "Carbon and climate regulation",
    category: "Regulating",
    terms: ["carbon sequestration", "carbon storage", "climate regulation", "regulating service"],
  },
  {
    key: "eesv-cultural-services",
    framework_id: "eesv",
    framework: "EESV",
    label: "Cultural services",
    category: "Cultural",
    terms: ["cultural service", "recreation", "tourism", "heritage"],
  },
];

const SMART_THEME_RULES = [
  {
    key: "climate",
    label: "Climate",
    terms: ["climate", "temperature", "weather", "rainfall", "precipitation", "drought"],
  },
  {
    key: "water",
    label: "Water",
    terms: ["water", "river", "catchment", "hydrology", "runoff", "dam", "rainfall"],
  },
  {
    key: "biodiversity",
    label: "Biodiversity",
    terms: ["biodiversity", "species", "vegetation", "fynbos", "ecosystem", "ecology"],
  },
  {
    key: "coastal",
    label: "Coastal and Marine",
    terms: ["coast", "marine", "ocean", "estuary", "estuaries", "sea", "benguela", "agulhas"],
  },
  {
    key: "agriculture",
    label: "Agriculture",
    terms: ["agriculture", "crop", "soil", "farming", "bioenergy", "irrigation"],
  },
  {
    key: "observations",
    label: "Observations",
    terms: ["observation", "observations database", "station", "sensor", "monitor", "time series"],
  },
  {
    key: "risk",
    label: "Risk and Vulnerability",
    terms: ["risk", "vulnerability", "hazard", "resilience", "adaptation", "exposure"],
  },
];

function parseList(value) {
  return typeof value === "string"
    ? value.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
}

function buildThemeClause(theme) {
  const bundles = {
    climate: ["climat", "temperatur", "atmospher", "meteorolog", "weather"],
    hydrology: ["hydrolog", "catchment", "river", "stream", "runoff", "water"],
    precipitation: ["rainfal", "precip", "rain gauge"],
    ocean: ["ocean", "sea", "coast", "estuari", "benguela", "agulha", "salin"],
    ecology: ["ecolog", "ecosystem", "veget", "plant", "forestri", "alien", "fynbo"],
    geospatial: ["map", "spatial", "raster", "resolut", "locat", "region", "area"],
    modelling: ["model", "simul", "analysi", "statist", "dataset", "methodolog", "uncertainti"],
    "sa-regions": ["south africa", "southern africa", "cape", "western cape", "jonkershoek", "stellenbosch", "saeon"],
    timeseries: ["time series", "histor", "long-term", "annual", "daili", "month"],
    observations: ["observation", "observations database", "station", "sensor", "monitor", "time series"],
    risk: ["risk", "vulnerability", "hazard", "resilience", "adaptation", "exposure"],
    biodiversity: ["biodiversity", "species", "vegetation", "fynbos", "ecosystem", "ecology"],
    coastal: ["coast", "marine", "ocean", "estuary", "estuaries", "sea", "benguela", "agulhas"],
    agriculture: ["agriculture", "crop", "soil", "farming", "bioenergy", "irrigation"],
  };

  const terms = bundles[theme];
  if (!terms) return null;

  return `(${terms
    .map((term) => `(title ILIKE '%${term}%' OR abstract ILIKE '%${term}%')`)
    .join(" OR ")})`;
}

async function createCatalogueSavedList(filter) {
  const query = `
    mutation ($filter: JSON, $createdBy: String!) {
      saveList(filter: $filter, createdBy: $createdBy) {
        id
      }
    }
  `;

  const response = await fetch(CATALOGUE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: {
        createdBy: "SARVA portal",
        filter,
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok || payload.errors) {
    throw new Error(payload.errors?.[0]?.message || `Catalogue GraphQL HTTP ${response.status}`);
  }

  return payload.data?.saveList?.id;
}

function sourceUrl(url) {
  const nextUrl = new URL(url);
  nextUrl.searchParams.set("referrer", "sarva");
  return nextUrl.toString();
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSearchText(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function frameworkForQuery(value) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return null;

  return ESSENTIAL_VARIABLE_FRAMEWORKS.find((framework) => {
    const terms = [framework.id, framework.acronym, framework.title, ...framework.terms].map(normalizeSearchText);
    return terms.some((term) => term && normalized === term);
  }) || null;
}

function resolvedEssentialVariableFilter(query) {
  const requested = normalizeSearchText(query.ev || query.essentialVariable);
  if (requested) {
    const framework = ESSENTIAL_VARIABLE_FRAMEWORKS.find(
      (item) => item.id === requested || item.acronym.toLowerCase() === requested
    );
    if (framework) return framework.id;
  }

  return frameworkForQuery(query.text || query.q || query.search)?.id || "";
}

function effectiveCatalogueText(query) {
  const queryText = cleanString(query.text || query.q || query.search);
  const framework = frameworkForQuery(queryText);
  const selectedEv = resolvedEssentialVariableFilter(query);

  if (framework && (!selectedEv || selectedEv === framework.id)) {
    return "";
  }

  return queryText;
}

function frameworkMatches(queryText = "", theme = "") {
  const normalized = normalizeSearchText(queryText);
  const themeKey = cleanString(theme);

  return ESSENTIAL_VARIABLE_FRAMEWORKS
    .map((framework) => {
      const exactAcronym = normalized === framework.id || normalized === framework.acronym.toLowerCase();
      const termMatch = normalized
        ? framework.terms.some((term) => {
            const normalizedTerm = normalizeSearchText(term);
            return normalizedTerm && (
              normalized === normalizedTerm ||
              normalized.includes(normalizedTerm) ||
              normalizedTerm.includes(normalized)
            );
          })
        : false;
      const themeMatch = themeKey && framework.related_themes.includes(themeKey);
      const score = exactAcronym ? 1 : termMatch ? 0.82 : themeMatch ? 0.45 : 0;

      return {
        id: framework.id,
        acronym: framework.acronym,
        title: framework.title,
        owner: framework.owner,
        framework_type: framework.framework_type,
        url: sourceUrl(framework.url),
        summary: framework.summary,
        related_terms: framework.terms.slice(0, 8),
        related_themes: framework.related_themes,
        matched: score > 0,
        score,
      };
    })
    .sort((a, b) => Number(b.matched) - Number(a.matched) || b.score - a.score || a.title.localeCompare(b.title));
}

function catalogueRecordUrl(row) {
  if (row.saeon_id) {
    return sourceUrl(`${CATALOGUE_PUBLIC_URL}/records/${encodeURIComponent(row.saeon_id)}`);
  }

  return sourceUrl(`${CATALOGUE_PUBLIC_URL}/records`);
}

function doiUrl(doi) {
  const clean = cleanString(doi);
  if (!clean) return null;
  if (/^https?:\/\//i.test(clean)) return clean;
  return `https://doi.org/${clean.replace(/^doi:/i, "")}`;
}

function classifyRecord(row) {
  const text = [
    row.title,
    row.abstract,
    row.collection_name,
    row.provider_name,
    row.download_format,
    row.download_label,
    row.raw_metadata,
  ].map((value) => (typeof value === "string" ? value : JSON.stringify(value || ""))).join(" ").toLowerCase();

  if (text.includes("observations database") || text.includes("observation")) return "Observation";
  if (text.includes("wms") || text.includes("map") || text.includes("raster") || ["tif", "tiff", "shp"].includes(String(row.download_format || "").toLowerCase())) return "Map layer";
  if (text.includes("model") || text.includes("forecast") || text.includes("projection")) return "Model";
  if (String(row.download_format || "").toLowerCase() === "pdf") return "Document";
  return "Dataset";
}

function themeTagsForRow(row) {
  const haystack = [
    row.title,
    row.abstract,
    row.collection_name,
    row.provider_name,
    row.raw_metadata,
  ].map((value) => (typeof value === "string" ? value : JSON.stringify(value || ""))).join(" ").toLowerCase();

  return SMART_THEME_RULES
    .filter((rule) => rule.terms.some((term) => haystack.includes(term)))
    .slice(0, 3)
    .map((rule) => ({ key: rule.key, label: rule.label }));
}

function rowSearchText(row) {
  return [
    row.title,
    row.abstract,
    row.collection_name,
    row.provider_name,
    row.publisher_name,
    row.download_label,
    row.download_format,
    row.licence_identifier,
    row.raw_metadata,
    row.keywords,
    row.subjects,
  ].map((value) => (typeof value === "string" ? value : JSON.stringify(value || ""))).join(" ").toLowerCase();
}

function essentialVariableTagsForRow(row) {
  const haystack = rowSearchText(row);

  return ESSENTIAL_VARIABLE_COVERAGE_RULES
    .map((rule) => {
      const matchedTerms = rule.terms.filter((term) => haystack.includes(term.toLowerCase()));
      return matchedTerms.length
        ? {
            key: rule.key,
            framework_id: rule.framework_id,
            framework: rule.framework,
            label: rule.label,
            category: rule.category,
            matched_terms: matchedTerms.slice(0, 3),
          }
        : null;
    })
    .filter(Boolean)
    .slice(0, 8);
}

function buildEssentialVariableClause(value, params) {
  const clean = normalizeSearchText(value);
  if (!clean) return null;

  const framework = ESSENTIAL_VARIABLE_FRAMEWORKS.find((item) => item.id === clean || item.acronym.toLowerCase() === clean);
  const coverageRule = ESSENTIAL_VARIABLE_COVERAGE_RULES.find((item) => item.key === clean);

  if (!framework && !coverageRule) return null;

  params.push(framework?.id || coverageRule.framework_id);
  const index = params.length;
  const rulePredicate = coverageRule ? `AND rev.rule_key = $${index + 1}` : "";
  if (coverageRule) params.push(coverageRule.key);

  return `
    EXISTS (
      SELECT 1
      FROM catalogue.record_essential_variables rev
      WHERE rev.record_id = catalogue_records.id
        AND rev.framework_id = $${index}
        ${rulePredicate}
    )
  `;
}

function buildFilterClause(query) {
  const whereParts = [];
  const params = [];
  let simIndex = null;
  let tsQueryIndex = null;

  const queryText = effectiveCatalogueText(query);

  if (queryText) {
    const text = queryText;
    params.push(text);
    tsQueryIndex = params.length;
    params.push(`%${text}%`);
    const patternIndex = params.length;

    let clause = `
      (
        search_index.search_vector @@ websearch_to_tsquery('english', $${tsQueryIndex})
        OR search_index.search_text ILIKE $${patternIndex}
        OR
        title ILIKE $${patternIndex}
        OR abstract ILIKE $${patternIndex}
        OR doi ILIKE $${patternIndex}
        OR collection_name ILIKE $${patternIndex}
        OR provider_name ILIKE $${patternIndex}
        OR download_label ILIKE $${patternIndex}
        OR download_filename ILIKE $${patternIndex}
        OR raw_metadata::text ILIKE $${patternIndex}
        OR EXISTS (
          SELECT 1
          FROM catalogue.record_keywords rk
          WHERE rk.record_id = catalogue_records.id
            AND rk.keyword ILIKE $${patternIndex}
        )
        OR EXISTS (
          SELECT 1
          FROM catalogue.record_subjects rs
          WHERE rs.record_id = catalogue_records.id
            AND rs.subject ILIKE $${patternIndex}
        )
        OR EXISTS (
          SELECT 1
          FROM catalogue.record_creators rc
          WHERE rc.record_id = catalogue_records.id
            AND (rc.name ILIKE $${patternIndex} OR rc.affiliation ILIKE $${patternIndex})
        )
        OR EXISTS (
          SELECT 1
          FROM catalogue.record_contributors rcon
          WHERE rcon.record_id = catalogue_records.id
            AND (rcon.name ILIKE $${patternIndex} OR rcon.affiliation ILIKE $${patternIndex})
        )
    `;

    if (text.length >= 2) {
      params.push(text);
      simIndex = params.length;
      clause += `
        OR word_similarity(title, $${simIndex}) > 0.25
        OR word_similarity(abstract, $${simIndex}) > 0.20
        OR word_similarity(doi, $${simIndex}) > 0.25
        OR word_similarity(collection_name, $${simIndex}) > 0.20
        OR word_similarity(provider_name, $${simIndex}) > 0.20
        OR EXISTS (
          SELECT 1
          FROM catalogue.record_creators rc
          WHERE rc.record_id = catalogue_records.id
            AND word_similarity(rc.name, $${simIndex}) > 0.30
        )
        OR EXISTS (
          SELECT 1
          FROM catalogue.record_contributors rcon
          WHERE rcon.record_id = catalogue_records.id
            AND word_similarity(rcon.name, $${simIndex}) > 0.30
        )
        OR EXISTS (
          SELECT 1
          FROM catalogue.record_keywords rk
          WHERE rk.record_id = catalogue_records.id
            AND word_similarity(rk.keyword, $${simIndex}) > 0.30
        )
        OR EXISTS (
          SELECT 1
          FROM catalogue.record_subjects rs
          WHERE rs.record_id = catalogue_records.id
            AND word_similarity(rs.subject, $${simIndex}) > 0.30
        )
      `;
    }

    clause += ")";
    whereParts.push(clause);
  }

  const collections = parseList(query.collections);
  const providers = parseList(query.providers);
  const formats = parseList(query.formats);
  const licences = parseList(query.licences);

  if (collections.length) {
    params.push(collections);
    whereParts.push(`collection_name = ANY($${params.length})`);
  }

  if (providers.length) {
    params.push(providers);
    whereParts.push(`provider_name = ANY($${params.length})`);
  }

  if (formats.length) {
    params.push(formats);
    whereParts.push(`download_format = ANY($${params.length})`);
  }

  if (licences.length) {
    params.push(licences);
    whereParts.push(`licence_identifier = ANY($${params.length})`);
  }

  if (query.yearFrom) {
    params.push(Number(query.yearFrom));
    whereParts.push(`publication_year >= $${params.length}`);
  }

  if (query.yearTo) {
    params.push(Number(query.yearTo));
    whereParts.push(`publication_year <= $${params.length}`);
  }

  if (String(query.singleSitesOnly) === "true") {
    whereParts.push(`
      doi IS NOT NULL
      AND spatial_north IS NOT NULL
      AND spatial_east IS NOT NULL
      AND spatial_north = spatial_south
      AND spatial_east = spatial_west
      AND download_url IS NOT NULL
    `);
  }

  const themeClause = buildThemeClause(query.theme);
  if (themeClause) whereParts.push(themeClause);

  const essentialVariableClause = buildEssentialVariableClause(resolvedEssentialVariableFilter(query), params);
  if (essentialVariableClause) whereParts.push(essentialVariableClause);

  return {
    whereSql: whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "",
    params,
    simIndex,
    tsQueryIndex,
  };
}

async function facetQuery(client, baseWhereSql, baseParams, column) {
  const whereSql = baseWhereSql
    ? `${baseWhereSql} AND ${column} IS NOT NULL`
    : `WHERE ${column} IS NOT NULL`;

  const result = await client.query(
    `
      SELECT ${column} AS value, COUNT(*)::int AS count
      FROM ${BASE_TABLE} catalogue_records
      LEFT JOIN catalogue.record_search_index search_index
        ON search_index.record_id = catalogue_records.id
      ${whereSql}
      GROUP BY ${column}
      ORDER BY count DESC, value ASC
      LIMIT 30
    `,
    baseParams
  );

  return result.rows;
}

function suggestionLabel(row) {
  return cleanString(row.label || row.value || row.title);
}

catalogueRouter.get("/catalogue/suggest", async (req, res) => {
  const client = await pool.connect();
  try {
    const text = cleanString(req.query.q || req.query.text || req.query.search);
    if (text.length < 2) {
      return res.json({ status: "ok", query: text, suggestions: [] });
    }

    const pattern = `%${text}%`;
    const suggestions = [];

    const [records, collections, providers, keywords] = await Promise.all([
      client.query(
        `
          SELECT
            'record' AS type,
            cr.saeon_id AS id,
            cr.title AS label,
            cr.collection_name AS detail,
            (
              ts_rank_cd(search_index.search_vector, websearch_to_tsquery('english', $2), 32)
              + GREATEST(
                  word_similarity(coalesce(search_index.search_text, ''), $2),
                  word_similarity(cr.title, $2)
                )
            ) AS score
          FROM catalogue.catalogue_records cr
          JOIN catalogue.record_search_index search_index
            ON search_index.record_id = cr.id
          WHERE search_index.search_vector @@ websearch_to_tsquery('english', $2)
             OR search_index.search_text ILIKE $1
             OR word_similarity(search_index.search_text, $2) > 0.30
          ORDER BY score DESC NULLS LAST, cr.publication_year DESC NULLS LAST
          LIMIT 6
        `,
        [pattern, text]
      ),
      client.query(
        `
          SELECT 'collection' AS type, collection_name AS id, collection_name AS label, count(*)::int AS count
          FROM catalogue.catalogue_records
          WHERE collection_name ILIKE $1 OR word_similarity(collection_name, $2) > 0.30
          GROUP BY collection_name
          ORDER BY count DESC, collection_name ASC
          LIMIT 5
        `,
        [pattern, text]
      ),
      client.query(
        `
          SELECT 'provider' AS type, provider_name AS id, provider_name AS label, count(*)::int AS count
          FROM catalogue.catalogue_records
          WHERE provider_name ILIKE $1 OR word_similarity(provider_name, $2) > 0.30
          GROUP BY provider_name
          ORDER BY count DESC, provider_name ASC
          LIMIT 5
        `,
        [pattern, text]
      ),
      client.query(
        `
          SELECT 'topic' AS type, keyword AS id, keyword AS label, count(*)::int AS count
          FROM catalogue.record_keywords
          WHERE keyword ILIKE $1 OR word_similarity(keyword, $2) > 0.32
          GROUP BY keyword
          ORDER BY count DESC, keyword ASC
          LIMIT 5
        `,
        [pattern, text]
      ),
    ]);

    suggestions.push(
      ...frameworkMatches(text)
        .filter((framework) => framework.matched)
        .map((framework) => ({
          type: "framework",
          id: framework.id,
          label: `${framework.acronym} - ${framework.title}`,
          detail: `${framework.owner} | ${framework.framework_type}`,
          url: framework.url,
          count: null,
        })),
      ...records.rows,
      ...collections.rows,
      ...providers.rows,
      ...keywords.rows
    );

    const unique = new Map();
    for (const item of suggestions) {
      const label = suggestionLabel(item);
      if (!label) continue;
      const key = `${item.type}:${label.toLowerCase()}`;
      if (!unique.has(key)) {
        unique.set(key, {
          type: item.type,
          id: item.id,
          label,
          detail: item.detail || (item.count ? `${item.count} records` : null),
          url: item.url || null,
          count: item.count || null,
        });
      }
    }

    res.json({
      status: "ok",
      query: text,
      suggestions: [...unique.values()].slice(0, 12),
    });
  } catch (error) {
    console.error("Catalogue suggestions failed:", error);
    res.status(500).json({ status: "error", message: "Suggestions failed", error: error.message });
  } finally {
    client.release();
  }
});

catalogueRouter.get("/catalogue/status", async (req, res) => {
  try {
    const [counts, lastRun, live] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT count(*)::int FROM catalogue.catalogue_records) AS records,
          (SELECT count(*)::int FROM catalogue.record_keywords) AS keywords,
          (SELECT count(*)::int FROM catalogue.record_creators) AS creators
      `),
      pool.query(`
        SELECT id, started_at, finished_at, status, total_count, processed_count, error_message
        FROM catalogue.sync_run
        ORDER BY started_at DESC
        LIMIT 1
      `),
      getLiveCatalogueSummary()
        .then((summary) => ({ available: true, ...summary }))
        .catch((error) => ({
          available: false,
          error: error.name === "AbortError" ? "SAEON catalogue request timed out" : error.message,
        })),
    ]);

    res.json({
      status: "ok",
      data: {
        counts: counts.rows[0],
        lastRun: lastRun.rows[0] || null,
        live,
      },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

catalogueRouter.get("/catalogue/share-link", async (req, res) => {
  try {
    const type = String(req.query.type || "").trim();
    const value = String(req.query.value || "").trim();

    if (!value) {
      return res.json({
        status: "ok",
        url: sourceUrl(`${CATALOGUE_PUBLIC_URL}/records`),
      });
    }

    const filters = {
      collection: {
        filterId: "collection-filter",
        field: "collection_name.raw",
      },
      institution: {
        filterId: "data-provider-filter",
        field: "provider_name.raw",
      },
      provider: {
        filterId: "publisher-filter",
        field: "publisher.raw",
      },
    };

    const filterConfig = filters[type];
    if (!filterConfig) {
      return res.status(400).json({ status: "error", message: "Unsupported catalogue link type" });
    }

    const listId = await createCatalogueSavedList({
      terms: [
        {
          ...filterConfig,
          value,
          context: "exact",
        },
      ],
    });

    if (!listId) {
      throw new Error("Catalogue did not return a saved-list id");
    }

    const url = sourceUrl(`${CATALOGUE_PUBLIC_URL}/list/records`);
    const nextUrl = new URL(url);
    nextUrl.searchParams.set("search", listId);
    nextUrl.searchParams.set("disableSidebar", "false");
    nextUrl.searchParams.set("showSearchBar", "true");

    res.json({
      status: "ok",
      id: listId,
      url: nextUrl.toString(),
    });
  } catch (error) {
    console.error("Catalogue share link failed:", error);
    res.status(500).json({ status: "error", message: "Catalogue link could not be created", error: error.message });
  }
});

catalogueRouter.get("/catalogue/search", async (req, res) => {
  const client = await pool.connect();
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Number.parseInt(req.query.pageSize, 10) || 20);
    const offset = (page - 1) * pageSize;
    const { whereSql, params, simIndex, tsQueryIndex } = buildFilterClause(req.query);
    const resolvedEv = resolvedEssentialVariableFilter(req.query);
    const frameworks = frameworkMatches(
      cleanString(req.query.text || req.query.q || req.query.search),
      req.query.theme || resolvedEv
    );

    let scoreSql = "0.0::real AS score";
    if (simIndex !== null && tsQueryIndex !== null) {
      scoreSql = `
        LEAST(
          1.0,
          (
            ts_rank_cd(search_index.search_vector, websearch_to_tsquery('english', $${tsQueryIndex}), 32) * 1.6
          )
          +
          GREATEST(
            word_similarity(coalesce(search_index.search_text, ''), $${simIndex}) * 0.55,
            word_similarity(title, $${simIndex}) * 0.45,
            word_similarity(abstract, $${simIndex}) * 0.25,
            word_similarity(doi, $${simIndex}) * 0.35,
            word_similarity(collection_name, $${simIndex}) * 0.25,
            word_similarity(provider_name, $${simIndex}) * 0.25
          )
          +
          (CASE WHEN title ILIKE '%' || $${simIndex} || '%' THEN 0.40 ELSE 0 END)
          +
          (CASE WHEN abstract ILIKE '%' || $${simIndex} || '%' THEN 0.30 ELSE 0 END)
          +
          (CASE WHEN collection_name ILIKE '%' || $${simIndex} || '%' THEN 0.20 ELSE 0 END)
          +
          (CASE WHEN provider_name ILIKE '%' || $${simIndex} || '%' THEN 0.10 ELSE 0 END)
          +
          (CASE WHEN doi IS NOT NULL THEN 0.04 ELSE 0 END)
          +
          (CASE WHEN download_url IS NOT NULL THEN 0.04 ELSE 0 END)
          +
          (CASE WHEN spatial_north IS NOT NULL THEN 0.03 ELSE 0 END)
          +
          (CASE WHEN temporal_start IS NOT NULL OR temporal_end IS NOT NULL THEN 0.03 ELSE 0 END)
        ) AS score
      `;
    }

    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const result = await client.query(
      `
        SELECT
          id,
          saeon_id,
          doi,
          title,
          abstract,
          collection_name,
          provider_name,
          download_url,
          download_label,
          download_format,
          licence_text,
          licence_uri,
          licence_identifier,
          publication_year,
          publisher_name,
          temporal_start,
          temporal_end,
          spatial_north,
          spatial_east,
          spatial_south,
          spatial_west,
          download_count,
          raw_metadata,
          ARRAY(
            SELECT rc.name
            FROM catalogue.record_creators rc
            WHERE rc.record_id = catalogue_records.id
            ORDER BY rc.id
            LIMIT 5
          ) AS creators,
          ARRAY(
            SELECT rk.keyword
            FROM catalogue.record_keywords rk
            WHERE rk.record_id = catalogue_records.id
            ORDER BY rk.keyword
            LIMIT 8
          ) AS keywords,
          ARRAY(
            SELECT rs.subject
            FROM catalogue.record_subjects rs
            WHERE rs.record_id = catalogue_records.id
            ORDER BY rs.subject
            LIMIT 8
          ) AS subjects,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'key', evr.key,
                  'framework_id', rev.framework_id,
                  'framework', evf.acronym,
                  'label', evr.label,
                  'category', evr.category,
                  'matched_terms', rev.matched_terms
                )
                ORDER BY evf.acronym, evr.label
              )
              FROM catalogue.record_essential_variables rev
              JOIN catalogue.essential_variable_rules evr
                ON evr.key = rev.rule_key
              JOIN catalogue.essential_variable_frameworks evf
                ON evf.id = rev.framework_id
              WHERE rev.record_id = catalogue_records.id
            ),
            '[]'::json
          ) AS essential_variables,
          ${scoreSql},
          COUNT(*) OVER()::int AS total_count
        FROM ${BASE_TABLE} catalogue_records
        LEFT JOIN catalogue.record_search_index search_index
          ON search_index.record_id = catalogue_records.id
        ${whereSql}
        ORDER BY
          score DESC NULLS LAST,
          publication_year DESC NULLS LAST,
          created_at DESC
        LIMIT $${limitIndex}
        OFFSET $${offsetIndex}
      `,
      [...params, pageSize, offset]
    );

    const rows = result.rows;
    const total = rows.length ? rows[0].total_count : 0;

    client.query(
      `
        INSERT INTO catalogue.search_event (search_text, filters, result_count, user_agent)
        VALUES ($1, $2, $3, $4)
      `,
      [
        cleanString(req.query.text || req.query.q || req.query.search) || null,
        {
          collections: parseList(req.query.collections),
          providers: parseList(req.query.providers),
          formats: parseList(req.query.formats),
          licences: parseList(req.query.licences),
          theme: cleanString(req.query.theme) || null,
          ev: resolvedEv || null,
          yearFrom: req.query.yearFrom || null,
          yearTo: req.query.yearTo || null,
          singleSitesOnly: String(req.query.singleSitesOnly) === "true",
        },
        total,
        req.get("user-agent") || null,
      ]
    ).catch((error) => {
      console.warn("Catalogue search analytics could not be recorded:", error.message);
    });

    const [collections, providers, formats, licences, years] = await Promise.all([
      facetQuery(client, whereSql, params, "collection_name"),
      facetQuery(client, whereSql, params, "provider_name"),
      facetQuery(client, whereSql, params, "download_format"),
      facetQuery(client, whereSql, params, "licence_identifier"),
      facetQuery(client, whereSql, params, "publication_year"),
    ]);

    const records = rows.map((row) => ({
      id: row.saeon_id || row.id,
      saeon_id: row.saeon_id,
      doi: row.doi,
      title: row.title,
      abstract: row.abstract,
      collection_name: row.collection_name,
      provider_name: row.provider_name,
      publisher_name: row.publisher_name,
      download_url: row.download_url,
      download_label: row.download_label,
      download_format: row.download_format,
      licence_text: row.licence_text,
      licence_uri: row.licence_uri,
      licence_identifier: row.licence_identifier,
      publication_year: row.publication_year,
      temporal_start: row.temporal_start,
      temporal_end: row.temporal_end,
      spatial: {
        north: row.spatial_north,
        east: row.spatial_east,
        south: row.spatial_south,
        west: row.spatial_west,
      },
      download_count: row.download_count,
      creators: row.creators || [],
      keywords: row.keywords || [],
      subjects: row.subjects || [],
      record_type: classifyRecord(row),
      themes: themeTagsForRow(row),
      essential_variables: Array.isArray(row.essential_variables) && row.essential_variables.length
        ? row.essential_variables
        : essentialVariableTagsForRow(row),
      catalogue_url: catalogueRecordUrl(row),
      doi_url: doiUrl(row.doi),
      badges: [
        row.doi ? "DOI" : null,
        row.download_url ? "Data link" : null,
        row.spatial_north !== null ? "Spatial" : null,
        row.temporal_start || row.temporal_end ? "Temporal" : null,
        row.licence_identifier ? row.licence_identifier : null,
      ].filter(Boolean).slice(0, 5),
      score: Number(row.score ?? 0),
      metadata: row.raw_metadata,
    }));

    const essentialVariableCounts = new Map();
    for (const record of records) {
      for (const item of record.essential_variables || []) {
        const existing = essentialVariableCounts.get(item.framework_id) || {
          value: item.framework_id,
          label: item.framework,
          title: ESSENTIAL_VARIABLE_FRAMEWORKS.find((framework) => framework.id === item.framework_id)?.title || item.framework,
          count: 0,
        };
        existing.count += 1;
        essentialVariableCounts.set(item.framework_id, existing);
      }
    }
    const essentialVariables = [...essentialVariableCounts.values()]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    res.json({
      status: "ok",
      total,
      page,
      pageSize,
      frameworks,
      records,
      facets: {
        collections,
        providers,
        formats,
        licences,
        years,
        essential_variables: essentialVariables,
      },
    });
  } catch (error) {
    console.error("Catalogue search failed:", error);
    res.status(500).json({ status: "error", message: "Search failed", error: error.message });
  } finally {
    client.release();
  }
});

catalogueRouter.get("/catalogue/single-sites/locations", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        saeon_id,
        doi,
        title,
        spatial_north AS lat,
        spatial_east AS lon,
        download_url
      FROM catalogue.catalogue_records
      WHERE
        doi IS NOT NULL
        AND spatial_north IS NOT NULL
        AND spatial_east IS NOT NULL
        AND spatial_north = spatial_south
        AND spatial_east = spatial_west
        AND download_url IS NOT NULL
      ORDER BY title
    `);

    res.json({ status: "ok", total: result.rowCount, records: result.rows });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Single-site locations query failed", error: error.message });
  }
});
