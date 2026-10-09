export const MAP_COLOURS = ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'];

// Equal-frequency breaks retain raw units while making skewed counts readable.
export function municipalMapScale(values) {
 const sorted = values.filter(Number.isFinite).sort((a,b)=>a-b);
 if (!sorted.length) return [];
 const breaks = [...new Set([0,.2,.4,.6,.8].map(q=>sorted[Math.floor((sorted.length-1)*q)]))];
 return breaks.map((value,i)=>({value,colour:MAP_COLOURS[breaks.length===1?2:Math.round(i*4/(breaks.length-1))]}));
}
