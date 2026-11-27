// Keep only a local path; never save pasted credentials, queries or fragments.
export function reviewPage(value) {
 if (value == null || (typeof value === 'string' && !value.trim())) return '';
 if (typeof value !== 'string' || value.length > 2048) throw Error('Invalid page');
 let path=value.trim();
 if (/^https?:\/\//i.test(path)) {
  const url=new URL(path);
  if (!['sarva.saeon.ac.za','localhost','127.0.0.1','[::1]'].includes(url.hostname) || url.username || url.password) throw Error('Use a SARVA page');
  path=url.pathname;
 } else {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//') || path.includes('\\')) throw Error('Use a SARVA page');
  path=path.split(/[?#]/)[0];
  if (!path.startsWith('/')) path='/'+path;
 }
 if (!/^\/(?!\/)[^?#\s\\]{0,200}$/.test(path) || /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(path)) throw Error('Invalid page');
 return path;
}

// Friendly page names are context, never fabricated navigable URLs.
export function reviewPageDetails(value){
 if(typeof value==='string'){
  const name=value.trim();
  if(name && !name.startsWith('/') && !/^[a-z][a-z0-9+.-]*:/i.test(name) && !/[\\?#]/.test(name) && !name.includes('/')){
   if(name.length>200||/[\x00-\x1f\x7f<>]/.test(name))throw Error('Use a page name up to 200 characters or a SARVA link');
   const known={'partners':'/partners','home':'/','about':'/about','explore':'/explore','contact':'/contact','analytics':'/analytics','partners and collaboration':'/partners','partners & collaboration':'/partners','partners and collaborations':'/partners','centres for global change':'/partners/centres-for-global-change','issues and feedback':'/testing','issues & feedback':'/testing'};
   return {path:known[name.toLowerCase()]||'',note:known[name.toLowerCase()]?'':'Affected page (as described): '+name};
  }
 }
 return {path:reviewPage(value),note:''};
}
export function reviewDescription(value,page){return typeof value==='string'&&page.note?value.trim()+'\n\n'+page.note:value;}
