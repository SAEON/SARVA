# Municipal planning evidence

The default profiler summary separates municipal indicator pressure from cached weather hazards. It introduces no new composite model, confidence grade or impact estimate.

The investigation list ranks up to three available non-context indicators by their existing adjusted 0–100 comparison scores, limited to one per theme. Raw crime counts are excluded from this list until appropriate denominators are available. Rows marked isProxy or confidence=proxy are excluded, as are missing adjusted values. Raw values and source periods accompany the scores. Different units, denominators, cohorts and normalization methods limit interpretation; a high score is not a causal finding or a probability of harm.

Domain comparisons remain available with count coverage, not weighted coverage or statistical confidence. Legacy indices may contain placeholders and renormalize weights over available inputs. They require matching periods, scenarios and inputs for meaningful comparison. No coverage threshold is invented here.

Forecast maxima are municipality/window summaries of coarse fields. An end date earlier than today's Africa/Johannesburg calendar date is labelled expired. Unknown dates are not described as current. Rainfall is not flood exposure; fire-weather proxies are not fire observations. Asset exposure, expected losses, formal validation and sensitivity analysis are not available in this view.

Before using an assessment for planning, review provenance and spatial/temporal alignment, establish hazard-specific exposure, and validate against local records and observed impacts. The conceptual reference is IPCC AR6 WGII Chapter 1: https://www.ipcc.ch/report/ar6/wg2/chapter/chapter-1/.

## Raw-values default view

The profiler now opens with categories and source values, with legacy normalized scores and maps collapsed under Advanced. Crime themes are grouped into one category. Users may select individual count indicators for a custom sum. Only rows with the same category, unit, source, period and scenario can be summed; source and period must be present. Percentages, rates, composite scores and labels containing total/combined/subtotal are excluded from sums. This is a conservative heuristic, not a complete ontology of overlapping offences: users must still confirm category independence. Counts are not population-adjusted rates or measures of people affected. Exports list the chosen operands and provenance. Proxy, score-only and missing raw-value rows are excluded; missing values are not zero.

The map allows world-scale zoom-out. Category and indicator controls select a national raw-value choropleth before selecting a municipality. The continuous colour scale runs from the observed minimum to maximum on the displayed unit/period/scenario basis. Proxy, missing and different-basis rows are grey, and real zero remains a value. Colours show magnitude rather than severity. Cross-municipality tables use source/period/scenario/unit matching by default and export those fields in CSV. Larger counts are not interpreted as higher per-person risk.

The map uses red equal-frequency distribution classes (up to five, with duplicate breaks removed). Legend boundaries remain in the indicator's original units. These classes improve readability for skewed counts and do not express risk or equal numerical intervals. Missing, proxy and incompatible-period records remain grey. The source strip uses catalogue metadata, shows the displayed period and units, and expands to description, available periods, scenario, original source link and local-record update date. The local update date is not a publication date.

The visible year/period selector requests that exact period from the metric API. Municipalities without a value for that period remain missing; the API does not substitute another year. Changing indicators resets the period to latest available.
