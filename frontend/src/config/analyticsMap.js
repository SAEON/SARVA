const countryName=code=>{try{return code?new Intl.DisplayNames(['en'],{type:'region'}).of(code):'Unknown / local';}catch{return code;}};
export function mapFeatures(rows) {
 const groups=new Map();
 for(const row of rows||[]) {
  if(row.latitude==null||row.longitude==null||!Number.isFinite(Number(row.latitude))||!Number.isFinite(Number(row.longitude))||Math.abs(Number(row.latitude))>90||Math.abs(Number(row.longitude))>180) continue;
  const key=[row.country,row.region,row.city,row.latitude,row.longitude].join('|');
  const group=groups.get(key)||{type:'Feature',geometry:{type:'Point',coordinates:[Number(row.longitude),Number(row.latitude)]},properties:{country:countryName(row.country),city:row.city||'Unknown city',views:0,clicks:0,interactions:0,desktop:0,mobile:0,tablet:0,automated:0}};
  group.properties.views+=Number(row.views)||0; group.properties.clicks+=Number(row.clicks)||0; group.properties.interactions+=Number(row.interactions)||0;
  const device=String(row.device||'').toLowerCase();if(device in group.properties)group.properties[device]+=Number(row.views)||0;
  groups.set(key,group);
 }
 return {type:'FeatureCollection',features:[...groups.values()].filter(f=>f.properties.views>0)};
}
