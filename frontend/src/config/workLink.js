export function workLinkError(value){
 const text=String(value||'').trim();if(!text)return '';
 try{const url=new URL(text);if(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password)return '';}catch{ /* Explain the correction without changing the entry. */ }
 return 'Enter a full link starting with https://, or leave this blank and upload a file. Put descriptive text in Short description. Your entries have been kept.';
}
