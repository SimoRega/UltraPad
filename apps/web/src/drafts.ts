export type Draft={id:string;name:string;text:string;updated:number};
const key=(user:string)=>`ultrapad-drafts:${user}`;
export function readDrafts(user:string):Draft[]{try{const rows:unknown=JSON.parse(sessionStorage.getItem(key(user))??'[]');return Array.isArray(rows)?rows.filter((d):d is Draft=>d && typeof d.id==='string' && typeof d.name==='string' && typeof d.text==='string' && typeof d.updated==='number'):[];}catch{return [];}}
export function writeDrafts(user:string,rows:Draft[]){sessionStorage.setItem(key(user),JSON.stringify(rows));}
export function readRecent(user:string):string[]{try{const value:unknown=JSON.parse(localStorage.getItem(`ultrapad-recent:${user}`)??'[]');return Array.isArray(value)?value.filter((x):x is string=>typeof x==='string').slice(0,20):[];}catch{return [];}}
export function rememberFile(user:string,id:string){try{localStorage.setItem(`ultrapad-recent:${user}`,JSON.stringify([id,...readRecent(user).filter(x=>x!==id)].slice(0,20)));}catch{/* History is optional. */}}
