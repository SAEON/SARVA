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
