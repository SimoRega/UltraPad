import CommandPalette from './v112/CommandPalette';
import ResizeHandle,{usePanelWidth} from './v112/ResizeHandle';
import ContextMenu from './v112/ContextMenu';
import {useEffect} from 'react';
import FileTab from './FileTab';
import FileIcon from './FileIcon';
import OfficeImport,{isOffice} from './v16/OfficeImport';
import {requestGuestTransfer} from './v16/GuestTransfer';
import Templates,{templates} from './v16/Templates';
import {lazy,Suspense,useRef,useState} from 'react';
import {validateName,languageFor,limits} from '../../../packages/domain/src/index';
import {validateRichDelta,type RichOp} from '../../../packages/rich-text/src/index';
import {Modal, useConfirmation} from './Dialogs';
import {Appearance} from './theme';
import {readDrafts,writeDrafts,type Draft} from './drafts';
import {decodeImport,download} from './files';
const Editor=lazy(()=>import('./Editor'));
const guestStore='guest-v1.5';
const extensions=['txt','md','html','tex','json','xml','css','js','ts','java','cs','py','bib'];
export default function GuestApp({leave}:{leave:()=>void}){
 const panel=usePanelWidth('ultrapad-explorer:guest',230);const [palette,setPalette]=useState(false);const [context,setContext]=useState<{x:number;y:number;id:string}>();
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='p'){e.preventDefault();setPalette(v=>!v);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
 const [office,setOffice]=useState<File>();const [filesOpen,setFilesOpen]=useState(false);const [drafts,setDrafts]=useState(()=>readDrafts(guestStore).slice(0,20));
 const latest=useRef(drafts);latest.current=drafts;
 const [selected,setSelected]=useState<string>();const file=drafts.find(d=>d.id===selected);
 const [dialog,setDialog]=useState<'create'|'rename'|'appearance'|null>(null);
 const [template,setTemplate]=useState('blank');const [name,setName]=useState('');const [message,setMessage]=useState('');
 const [storageFailure,setStorageFailure]=useState(false);const [busy,setBusy]=useState(false);
 const input=useRef<HTMLInputElement>(null);const {confirm,confirmation}=useConfirmation();
 function persist(rows:Draft[]){
  latest.current=rows;setDrafts(rows);
  try{writeDrafts(guestStore,rows);setStorageFailure(false);setMessage('');}
  catch{setStorageFailure(true);setMessage('La copia nella scheda non è stata salvata. Il testo resta aperto: scaricalo prima di uscire o ricaricare.');throw new Error('Copia locale non salvata. Scarica il file.');}
 }
 function create(){try{if(drafts.length>=20)throw new Error('Limite di 20 file ospite. Scarica e rimuovi quelli completati.');const fileName=validateName(name);const chosen=templates.find(t=>t.id===template)??templates[0];const draft={id:crypto.randomUUID(),name:fileName,text:chosen.text,delta:chosen.delta,updated:Date.now()};setSelected(draft.id);persist([draft,...latest.current]);setDialog(null);}catch(e){setMessage((e as Error).message);}}
 function change(text:string,delta?:RichOp[]){
  // Keep the live copy in memory even when sessionStorage is full.
  const rows=latest.current.map(d=>d.id===selected?{...d,text,delta,updated:Date.now()}:d);
  if(new TextEncoder().encode(text).length>limits.text){latest.current=rows;setDrafts(rows);setStorageFailure(true);setMessage('File oltre 1 MiB. Scarica una copia prima di uscire.');throw new Error('File oltre 1 MiB. Scarica una copia.');}
  if(delta)validateRichDelta(delta);persist(rows);
 }
 async function importFile(source:File){if(isOffice(source.name)){setOffice(source);return;}setBusy(true);try{if(latest.current.length>=20)throw new Error('Limite di 20 file ospite.');const imported=await decodeImport(source);const d={...imported,id:crypto.randomUUID(),updated:Date.now()};setSelected(d.id);persist([d,...latest.current]);}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 async function importFiles(sources:File[]){if(storageFailure||busy)return;for(const source of sources.slice(0,20)){if(isOffice(source.name)&&sources.length>1){setMessage('Importa DOCX/RTF singolarmente per controllare la conversione.');continue;}await importFile(source);}}
 const blocked=storageFailure||busy;
 const commands=[{label:'Nuovo file ospite',disabled:blocked,run:()=>{setTemplate('blank');setName('senza-titolo.txt');setDialog('create');}},{label:'Importa file locali',disabled:blocked,run:()=>input.current?.click()},{label:'Temi e colori',run:()=>setDialog('appearance')},{label:'Torna all’accesso',disabled:blocked,run:leave}];
 return <main className={`guest-shell ${filesOpen?'mobile-files-open':''}`}><header className="guest-header"><div className="brand"><b>U</b> UltraPad <span className="badge">Ospite</span></div><div className="quick-actions"><button className="mobile-files-toggle" aria-expanded={filesOpen} onClick={()=>setFilesOpen(v=>!v)}>File</button><button disabled={blocked} onClick={()=>{setTemplate('blank');setName('senza-titolo.txt');setDialog('create');}}>+ Nuovo file</button><button disabled={blocked} onClick={()=>input.current?.click()}>Importa file locale</button><button onClick={()=>setPalette(true)}>Comandi</button><button onClick={()=>setDialog('appearance')}>Aspetto</button><button disabled={blocked||!drafts.length} onClick={()=>{try{requestGuestTransfer();leave();}catch{setMessage('Impossibile preparare il trasferimento. Scarica una copia.');}}}>Accedi e conserva i file</button><button disabled={blocked} onClick={leave}>Torna all’accesso</button></div></header><p className="guest-notice">Nessun account, nessun database. I tuoi file restano solo in questa scheda fino alla sua chiusura: scaricali per conservarli.</p>{message&&<div className="notice" role="alert">{message}</div>}
 <input ref={input} type="file" multiple hidden aria-label="Importa file ospite" onChange={e=>{const sources=Array.from(e.target.files??[]);e.target.value='';void importFiles(sources);}}/>
 <div className="guest-workspace"><aside className="guest-files" style={{width:panel.width,position:'relative'}} aria-label="File ospite" onDragOver={e=>{if(e.dataTransfer.types.includes('Files')&&!blocked)e.preventDefault();}} onDrop={e=>{if(e.dataTransfer.files.length){e.preventDefault();void importFiles(Array.from(e.dataTransfer.files));}}}><ResizeHandle width={panel.width} change={panel.setWidth}/><h2>I tuoi file locali</h2>{drafts.map(d=><button key={d.id} onContextMenu={e=>{e.preventDefault();setContext({x:e.clientX,y:e.clientY,id:d.id});}} disabled={blocked} className={selected===d.id?'active':''} onClick={()=>{setSelected(d.id);setFilesOpen(false);}}><FileIcon name={d.name}/>{d.name}</button>)}{!drafts.length&&<p>Nessun documento. Crea il tuo primo file.</p>}</aside><section className="guest-content">
 {file?<><nav className="tabs" aria-label="File aperti"><FileTab name={file.name} active disabled={blocked} select={()=>{}} close={()=>setSelected(undefined)}/></nav><div className="draft-heading"><div><h2>{file.name}</h2><p className="muted">Solo locale · nessuna sincronizzazione</p></div><button disabled={blocked} onClick={()=>{setName(file.name);setDialog('rename');}}>Nome e formato</button><button disabled={blocked} className="danger" onClick={async()=>{if(await confirm('Eliminare questo file ospite? Scaricalo prima per conservarlo.'))try{persist(latest.current.filter(d=>d.id!==file.id));setSelected(undefined);}catch{/* Error already visible. */}}}>Elimina file</button></div><Suspense fallback={<p>Caricamento editor…</p>}><Editor key={file.id} file={{id:file.id,name:file.name,project_id:'',workspace_id:'',parent_id:null,kind:'text',generation:1,language:languageFor(file.name),metadata_version:1,status:'ready'}} userId={guestStore} role="owner" localText={file.text} localDelta={file.delta} localChanged={change} clearInitial={()=>{}} clientChanged={()=>{}}/></Suspense></>:<div className="empty"><h1>Il tuo spazio ospite</h1><p>Crea un documento o apri un file dal tuo computer. Qui compaiono esclusivamente i file creati o importati da te in questa scheda.</p><button className="primary" disabled={blocked} onClick={()=>{setTemplate('blank');setName('senza-titolo.txt');setDialog('create');}}>Crea un nuovo file</button></div>}
 </section></div>
 {dialog&&<Modal title={dialog==='appearance'?'Temi e colori':dialog==='create'?'Nuovo file ospite':'Nome e formato'} close={()=>setDialog(null)}>{dialog==='appearance'?<Appearance/>:<form onSubmit={e=>{e.preventDefault();if(dialog==='create')create();else if(file)try{const next=validateName(name);persist(latest.current.map(d=>d.id===file.id?{...d,name:next}:d));setDialog(null);}catch(e){setMessage((e as Error).message);}}}>{dialog==='create'&&<Templates value={template} onChange={id=>{setTemplate(id);setName(templates.find(t=>t.id===id)!.name);}}/>}<label>Nome<input autoFocus required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label><label>Formato<select value={extensions.includes(name.split('.').pop()??'')?name.split('.').pop():'txt'} onChange={e=>setName((name.replace(/\.[^.]+$/,'')||'senza-titolo')+'.'+e.target.value)}>{extensions.map(ext=><option key={ext} value={ext}>{ext.toUpperCase()}</option>)}</select></label><p>Solo in questa scheda. Nessun salvataggio nel database.</p><button className="primary" disabled={blocked}>{dialog==='create'?'Crea':'Salva'}</button></form>}</Modal>}
 {palette&&<CommandPalette actions={commands} close={()=>setPalette(false)}/>} {context&&<ContextMenu x={context.x} y={context.y} close={()=>setContext(undefined)} actions={[{label:'Apri',disabled:blocked,run:()=>setSelected(context.id)},{label:'Scarica copia',run:()=>{const d=drafts.find(d=>d.id===context.id);if(d)download(d.name,d.text);}}]}/>}
 {office&&<OfficeImport source={office} close={()=>setOffice(undefined)} accept={async imported=>{if(latest.current.length>=20)throw new Error('Limite di 20 file ospite.');const d={...imported,id:crypto.randomUUID(),updated:Date.now()};persist([d,...latest.current]);setSelected(d.id);}}/>}{confirmation}
 {storageFailure&&!file&&drafts.length>0&&<button onClick={()=>{for(const d of drafts)download(d.name,d.text);}}>Scarica copie locali</button>}
 </main>;
}
