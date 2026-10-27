// Quote all fields and neutralise spreadsheet formulas in untrusted labels/URLs.
export function csvCell(value) {
  const text = value == null ? '' : String(value);
  const safe = typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function reportCsv(report) {
  const lines = [ ['SARVA analytics report'], ['From',report.from,'To',report.to,'Timezone','Africa/Johannesburg'],
    ['Generated',report.generatedAt], ['Scope','Activity is date-filtered; coverage is the current snapshot. Lists are ranked and capped at the limits shown in the dashboard.'],
    ['Limitations','Unique IPs are keyed network-address hashes, not people; available only from this update; shared networks and address changes affect counts. Approximate IP location; sessions are browser tabs; clicks are not completed downloads; unknown values are not zero.'] ];
  for (const [name, rows] of Object.entries(report.data)) {
    lines.push([], [name]);
    if (rows == null) { lines.push(['Unavailable']); continue; }
    if (!rows.length) { lines.push(['No recorded data']); continue; }
    const columns = Object.keys(rows[0]);
    lines.push(columns,...rows.map(row => columns.map(key => row[key])));
  }
  return '\uFEFF' + lines.map(row => row.map(csvCell).join(',')).join('\r\n');
}

export function downloadCsv(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
