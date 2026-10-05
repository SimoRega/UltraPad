export function parseEnv(contents) {
 const values={};
 for(const line of contents.split(/\r?\n/)) {
  const match=line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if(match) values[match[1]]=match[2].replace(/^(['"])(.*)\1$/, '$2');
 }
 return values;
}
export function publicKeyValid(key) {
 if(!key || /YOUR_|[\r\n]/.test(key)) return false;
 if(/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
 try { return key.split('.').length===3 && JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon'; }
 catch { return false; }
}
export function mergeEnv(contents, values) {
 const remaining={...values};
 const lines=contents.replace(/\r\n/g,'\n').split('\n').map(line=>{
  const key=line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/)?.[1];
  if(key && key in values) { delete remaining[key]; return `${key}=${values[key]}`; }
  return line;
 });
 return `${lines.join('\n').trimEnd()}\n${Object.entries(remaining).map(([key,value])=>`${key}=${value}`).join('\n')}`.trim()+'\n';
}
