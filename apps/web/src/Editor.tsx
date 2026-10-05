import { lazy, Suspense, useRef, useState } from 'react';
import Preview from './RenderedPreview';
import type { EditorProps } from './editor-types';
import type { CollaborationClient } from '../../../packages/collaboration-client/src/index';
const Source=lazy(()=>import('./SourceEditor'));const Rich=lazy(()=>import('./RichEditor'));
export default function Editor(props:EditorProps){
 const supportsDocument=/\.txt$/i.test(props.file.name);const [mode,setMode]=useState<'document'|'source'>(supportsDocument?'document':'source');const [switching,setSwitching]=useState(false);const client=useRef<CollaborationClient|null>(null);
 async function switchMode(value:typeof mode){if(switching||value===mode)return;setSwitching(true);try{await client.current?.settled();setMode(value);}finally{setSwitching(false);}}
 const [text,setText]=useState(props.localText??'');const [preview,setPreview]=useState(false);const supportsPreview=/\.(html?|md|tex)$/i.test(props.file.name);
 const Component=supportsDocument&&mode==='document'?Rich:Source;
 return <>{supportsDocument&&<nav className="document-modes" aria-label="Vista del file"><button disabled={switching} aria-pressed={mode==='document'} onClick={()=>void switchMode('document')}>Documento visuale</button><button disabled={switching} aria-pressed={mode==='source'} onClick={()=>void switchMode('source')}>Sorgente testo</button><span className="muted">TXT · stili conservati in UltraPad</span></nav>}<>{supportsPreview&&<nav className="document-modes"><button aria-pressed={preview} onClick={()=>setPreview(v=>!v)}>Anteprima affiancata</button></nav>}<div className="editor-split"><Suspense fallback={<div className="empty">Caricamento editor…</div>}><Component {...props} contentChanged={setText} clientChanged={value=>{client.current=value;props.clientChanged(value);}}/></Suspense>{supportsPreview&&preview&&<Preview name={props.file.name} text={text}/>}</div></></>;
}
