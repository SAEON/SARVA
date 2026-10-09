export function categoryFor(row) {
    return /crime|safety|murder|assault|robbery|theft/i.test(`${row.theme} ${row.label}`) ? 'Crime' : row.theme || 'Other';
}
export function hasRawEvidence(row) {
    return !row.isProxy && row.confidence !== 'proxy' && row.rawValue != null && Number.isFinite(Number(row.rawValue)) && !/composite|0.?100|index/i.test(row.displayUnit || row.unit || '');
}
export function countIsAdditive(row) {
    return hasRawEvidence(row) && /cases|count|persons|households|events|number|people/i.test(row.displayUnit || row.unit || '') && !/percent|%|rate|per\s|index|total|combined|subtotal/i.test(`${row.label} ${row.displayUnit || row.unit || ''}`);
}
export function rawTotal(rows) {
    if (!rows.length) return {total:null,reason:'Select compatible counts to calculate a total.'};
    if (rows.some(r=>!countIsAdditive(r))) return {total:null,reason:'Only individual counts can be added. Percentages, rates, totals and indices are excluded.'};
    const signature=r=>JSON.stringify([r.displayUnit || r.unit,r.period || '',r.scenario || '',r.sourceName || '',categoryFor(r)]);
    if(rows.some(r=>signature(r)!==signature(rows[0]))) return {total:null,reason:'Choose the same unit, source, period, scenario and category.'};
    if(!rows[0].period || !rows[0].sourceName) return {total:null,reason:'A source and period are required for a defensible total.'};
    return {total:rows.reduce((sum,r)=>sum+Number(r.rawValue),0),reason:'Custom sum of selected source counts. Confirm that the chosen categories do not overlap.'};
}
