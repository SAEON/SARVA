const n=v=>v==null?'Unavailable':Number(v).toLocaleString('en-ZA');
const clean=v=>Array.from(String(v??'Unknown / local'),c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127?' ':c).join('');
export function reportText(report){
 const d=report.data,u=d.usage?.[0];
 const lines=['SARVA activity report',`Period: ${report.from} through ${report.to}, inclusive (SAST, UTC+02:00)`,`Generated: ${report.generatedAt}`,'',
 `Page views (events): ${n(u?.views)}`,`Browser sessions with page views: ${n(u?.sessions)}`,`Active signed-in accounts (distinct tracked account IDs): ${n(u?.active_accounts)}`,`New account registrations: ${n(d.registrations?.[0]?.count)}`,`Unique IP hashes (network identifiers, not people): ${n(u?.unique_ips)}`];
 function list(title,rows,format){lines.push('',title);if(rows==null)lines.push('Unavailable');else if(!rows.length)lines.push('No recorded activity');else lines.push(...rows.map(format));}
 list('Countries - page-view events (all recorded countries)',d.countries,r=>`${clean(r.label)}: ${n(r.views)} page views; ${n(r.accounts)} distinct signed-in accounts`);
 list('Most-viewed pages - top 10',d.pages,r=>`${clean(r.label)}: ${n(r.count)} page views`);
 list('Map/resource interactions - top 20',d.mapResources,r=>`${clean(r.label)} / ${clean(r.action)}: ${n(r.events)} events; ${n(r.accounts)} distinct signed-in accounts`);
 lines.push('',`Secondary measure - download-link clicks: ${n(u?.downloads)} (not completed downloads).`,'Limitations: Tracking is partial and affected by consent, privacy settings and automated traffic. Active accounts exclude anonymous and untracked use; they are not total people. Sessions and IP hashes are not people. Registrations come from account records and include accounts later deactivated. Country locations are approximate; unknown/local is retained. Distinct-account counts across groups must not be added. Ranked lists are capped as labelled. Missing datasets are unavailable, not zero.');
 if(report.unavailable?.length)lines.push('Unavailable datasets: '+report.unavailable.join(', '));
 return lines.join('\n')+'\n';
}
export function downloadText(text,name){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
