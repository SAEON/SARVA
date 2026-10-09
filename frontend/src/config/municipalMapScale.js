export const MAP_COLOURS = ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#172554'];

// Equal-frequency breaks retain raw units while making skewed counts readable.
export function municipalMapScale(values) {
 const sorted = values.filter(Number.isFinite).sort((a,b)=>a-b);
 if (!sorted.length) return [];
 const breaks = [...new Set([0,.2,.4,.6,.8].map(q=>sorted[Math.floor((sorted.length-1)*q)]))];
 return breaks.map((value,i)=>({value,colour:MAP_COLOURS[breaks.length===1?2:Math.round(i*4/(breaks.length-1))]}));
}
