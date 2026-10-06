import ToolMenu from './ToolMenu';
import {plannerPeriod} from './v17/Planner';
import {encodeAnchor} from './v16/anchors';
import Execution from './v16/Execution';
import Discussion,{type SelectionAnchor} from './v16/Discussion';
import Links from './v16/Links';
import {canEdit} from '../../../packages/domain/src/index';
import { lazy, Suspense, useRef, useState, useEffect } from 'react';
import Preview from './RenderedPreview';
import type { EditorProps } from './editor-types';
import type { CollaborationClient } from '../../../packages/collaboration-client/src/index';
const Source=lazy(()=>import('./SourceEditor'));const Rich=lazy(()=>import('./RichEditor'));
export default function Editor(props:EditorProps){
 const [discussion,setDiscussion]=useState(false);const [links,setLinks]=useState(false);const [anchor,setAnchor]=useState<SelectionAnchor>();const [jump,setJump]=useState<SelectionAnchor>();
 const [focus,setFocus]=useState(false);const [width,setWidth]=useState('900');
 useEffect(()=>{document.body.classList.toggle('editor-focus',focus);return()=>document.body.classList.remove('editor-focus');},[focus]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setFocus(false);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
 const structured=/\.travel\.md$/i.test(props.file.name)?'travel':plannerPeriod(props.file.name)?'planner':/\.sheet\.json$/i.test(props.file.name)?'sheet':undefined;const [visual,setVisual]=useState(true);
 const supportsDocument=/\.txt$/i.test(props.file.name);const [mode,setMode]=useState<'document'|'source'>(supportsDocument?'document':'source');const [switching,setSwitching]=useState(false);const client=useRef<CollaborationClient|null>(null);
 async function switchMode(value:typeof mode){if(switching||value===mode)return;setSwitching(true);try{await client.current?.settled();setMode(value);}finally{setSwitching(false);}}
 const [text,setText]=useState(props.localText??'');const [preview,setPreview]=useState(false);const supportsPreview=/\.(html?|md|tex)$/i.test(props.file.name);
 const Component=supportsDocument&&mode==='document'?Rich:Source;
 return <><nav className="focus-controls editor-commandbar" aria-label="Area di scrittura">
 {supportsDocument&&<div className="document-modes" aria-label="Vista del file"><button disabled={switching} aria-pressed={mode==='document'} onClick={()=>void switchMode('document')}>Documento visuale</button><button disabled={switching} aria-pressed={mode==='source'} onClick={()=>void switchMode('source')}>Sorgente testo</button></div>}
 {structured&&<div className="document-modes"><button aria-pressed={visual} onClick={()=>setVisual(true)}>{structured==='sheet'?'Foglio di calcolo':structured==='travel'?'Travel planner':'Calendario'}</button><button aria-pressed={!visual} onClick={()=>setVisual(false)}>Sorgente testo</button></div>}
 {supportsPreview&&!structured&&<button aria-pressed={preview} onClick={()=>setPreview(v=>!v)}>Anteprima affiancata</button>}
 <span className="spacer"/>{!props.localChanged&&<button aria-pressed={discussion} onClick={()=>setDiscussion(v=>!v)}>Commenti</button>}
 <ToolMenu label="Opzioni editor">{!props.localChanged&&<button onClick={()=>setLinks(true)}>Collegamenti</button>}<label>Larghezza<select value={width} onChange={e=>setWidth(e.target.value)}><option value="680">Stretta</option><option value="900">Media</option><option value="1200">Ampia</option></select></label></ToolMenu>
 <button aria-pressed={focus} onClick={()=>setFocus(v=>!v)}>{focus?'Esci da Focus':'Focus'}</button>
 </nav><style>{`.document-paper{max-width:${width}px}`}</style><><div className="editor-split"><Suspense fallback={<div className="empty">Caricamento editor…</div>}><Component {...props} visual={visual?structured:undefined} selectionChanged={a=>{setAnchor(a);props.selectionChanged?.(a);}} jumpSelection={jump??props.jumpSelection} contentChanged={setText} clientChanged={value=>{client.current=value;props.clientChanged(value);if(value){const query=new URLSearchParams(window.location.search).get('find');if(query){const y=value.doc.getText('content');const index=y.toString().toLowerCase().indexOf(query.toLowerCase());if(index>=0)setJump(encodeAnchor(value.doc,index,index+query.length,props.file.generation));}}}}/></Suspense>{discussion&&!props.localChanged&&<Discussion file={props.file} role={props.role} userId={props.userId} anchor={anchor} locate={setJump}/>} {supportsPreview&&preview&&<Preview name={props.file.name} text={text}/>}</div>{!props.localChanged&&<Execution id={props.file.id} name={props.file.name} text={text} files={props.relatedFiles??[]} open={(f,line)=>props.openRelated?.(f,undefined,line)}/>} {links&&<Links file={props.file} files={props.relatedFiles??[]} editable={canEdit(props.role)} close={()=>setLinks(false)} anchor={anchor} open={(f,a)=>{props.openRelated?.(f,a);}}/>}</></>;
}
