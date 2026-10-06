type Props = {name:string; kind?:string; className?:string};
export function fileIconType(name:string,kind?:string){
 if(kind==='folder')return 'folder';
 if(/\.sheet\.json$/i.test(name)||/\.(csv|xlsx?|ods)$/i.test(name))return 'sheet';
 if(/planner-(giornaliero|settimanale|mensile|annuale)\.md$/i.test(name))return 'calendar';
 const ext=name.split('.').pop()?.toLowerCase();
 if(ext==='java')return 'java';
 if(['html','htm','xml','svg','vue','jsx','tsx'].includes(ext??''))return 'code';
 if(['json','yaml','yml'].includes(ext??''))return 'data';
 if(['js','mjs','cjs','ts','py','cs','c','cpp','h','go','rs','rb','php','sql','sh','css','scss'].includes(ext??''))return ext!;
 if(['tex','bib'].includes(ext??''))return 'tex';
 if(ext==='md')return 'markdown';
 if(ext==='pdf')return 'pdf';
 return 'text';
}
export default function FileIcon({name,kind,className=''}:Props){
 const type=fileIconType(name,kind);
 const glyph:Record<string,string>={js:'JS',mjs:'JS',cjs:'JS',ts:'TS',py:'Py',cs:'C#',c:'C',cpp:'C++',h:'C',go:'Go',rs:'Rs',rb:'Rb',php:'PHP',sql:'SQL',sh:'$_',css:'#',scss:'#',markdown:'M↓',tex:'TₑX',pdf:'PDF'};
 return <svg className={`file-type-icon ${className}`} data-file-type={type} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
 {type==='folder'?<path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z"/>:type==='java'?<><path d="M5 10h12v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-6Zm12 1h2a3 3 0 0 1 0 6h-2M3 22h16M9 7c-3-2 3-3 0-5M13 7c-3-2 3-3 0-5"/></>:type==='code'?<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16"/>:type==='data'?<><path d="M8 3H6v6l-3 3 3 3v6h2m8-18h2v6l3 3-3 3v6h-2"/><circle cx="12" cy="9" r=".5"/><circle cx="12" cy="15" r=".5"/></>:type==='sheet'?<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></>:type==='calendar'?<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h2m4 0h2m-8 3h2"/></>:<><path d="M14 2H5a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8l-6-6Zm0 0v6h6"/>{type==='text'?<path d="M8 12h8m-8 4h8m-8 3h5"/>:<text x="12" y="17" textAnchor="middle" stroke="none" fill="currentColor" fontSize={type==='pdf'||type==='cpp'||type==='php'||type==='sql'?6:8} fontWeight="700">{glyph[type]}</text>}</>}
 </svg>;
}
