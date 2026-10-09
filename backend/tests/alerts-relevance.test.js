import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyRiskRelevance} from '../src/routes/alerts.js';

for (const title of ['SAPS ready to respond to criminality', 'Police issue warning ahead of protests', 'Municipality announces housing plan', 'Measles outbreak alert', 'Emergency response to armed conflict']) {
 test(`excludes general news: ${title}`,()=>assert.equal(classifyRiskRelevance(title,'South Africa emergency preparedness and response').isRelevant,false));
}
for (const title of ['Flooding damages homes in KwaZulu-Natal', 'Drought threatens municipal water supply', 'Heatwave warning for vulnerable residents', 'Climate adaptation plan for coastal communities', 'Cholera outbreak linked to contaminated water supply', 'Air quality pollution threatens residents', 'Biodiversity loss threatens ecosystem resilience']) {
 test(`includes environmental relevance: ${title}`,()=>assert.equal(classifyRiskRelevance(title).isRelevant,true));
}
test('explains the specific environmental topic without claiming warning severity',()=>{
 const result=classifyRiskRelevance('Municipal flood preparedness plan');
 assert.match(result.reason,/flood/);
 assert.equal(result.severity,'watch');
});
