import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { FileRecord } from '../../../packages/contracts/src/index';
export function Modal({title,close,children}:{title:string;close:()=>void;children:ReactNode}) {
 const ref=useRef<HTMLDialogElement>(null);const label=useId();
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const dialog=ref.current;if(dialog&&!dialog.open)dialog.showModal();return()=>{dialog?.close();if(previous?.isConnected)previous.focus();};},[]);
 return <dialog ref={ref} aria-labelledby={label} onCancel={e=>{e.preventDefault();close();}}><header><h2 id={label}>{title}</h2><button aria-label="Chiudi" onClick={close}>×</button></header>{children}</dialog>;
}
export function useConfirmation(){
 const [question,setQuestion]=useState<{message:string;resolve:(value:boolean)=>void}>();const pending=useRef<(value:boolean)=>void>(undefined);
 useEffect(()=>()=>pending.current?.(false),[]);
 function finish(value:boolean){pending.current?.(value);pending.current=undefined;setQuestion(undefined);}
 function confirm(message:string){pending.current?.(false);return new Promise<boolean>(resolve=>{pending.current=resolve;setQuestion({message,resolve});});}
 const confirmation=question?<Modal title="Conferma operazione" close={()=>finish(false)}><p>{question.message}</p><div className="dialog-actions"><button onClick={()=>finish(false)}>Annulla</button><button className="primary" onClick={()=>finish(true)}>Conferma</button></div></Modal>:null;
 return {confirm,confirmation};
}
export function FileActions({file,files,busy,loading,submit,close}:{file:FileRecord;files:FileRecord[];busy:boolean;loading:boolean;submit:(action:'rename'|'move'|'delete',value:string)=>void;close:()=>void}){
 const [action,setAction]=useState<'rename'|'move'|'delete'>('rename');const [name,setName]=useState(file.name);const [parent,setParent]=useState(file.parent_id??'');
 const blocked=new Set([file.id]);let changed=true;while(changed){changed=false;for(const f of files)if(f.parent_id&&blocked.has(f.parent_id)&&!blocked.has(f.id)){blocked.add(f.id);changed=true;}}
 function path(f:FileRecord,seen=new Set<string>()):string{if(seen.has(f.id))return f.name;seen.add(f.id);const parent=files.find(p=>p.id===f.parent_id);return parent?`${path(parent,seen)} / ${f.name}`:f.name;}
 const folders=files.filter(f=>f.kind==='folder'&&!blocked.has(f.id));
 return <form onSubmit={e=>{e.preventDefault();submit(action,action==='rename'?name:parent);}}><p className="dialog-target">{file.name}</p><div className="segmented file-action-tabs">{([['rename','Rinomina'],['move','Sposta'],['delete','Elimina']] as const).map(([value,label])=><button type="button" key={value} aria-pressed={action===value} onClick={()=>setAction(value)}>{label}</button>)}</div>{action==='rename'&&<label>Nuovo nome<input autoFocus required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>}{action==='move'&&<label>Cartella di destinazione<select value={parent} onChange={e=>setParent(e.target.value)} disabled={loading}><option value="">Radice del progetto</option>{folders.map(f=><option key={f.id} value={f.id}>{path(f)}</option>)}</select>{loading&&<small>Caricamento cartelle…</small>}</label>}{action==='delete'&&<p>Spostare nel cestino {file.kind==='folder'?'la cartella e tutti i suoi file':'questo file'}? Potrai ripristinare dal cestino. Esporta prima eventuali modifiche locali non sincronizzate.</p>}<div className="dialog-actions"><button type="button" onClick={close}>Annulla</button><button className={action==='delete'?'danger':'primary'} disabled={busy||(action==='move'&&loading)}>{action==='delete'?'Sposta nel cestino':action==='move'?'Sposta file':'Salva nome'}</button></div></form>;
}
export function TopicDialog({current,suggestions,busy,save,close}:{current:string;suggestions:string[];busy:boolean;save:(theme:string)=>void;close:()=>void}){
 const [value,setValue]=useState(current);
 return <form onSubmit={e=>{e.preventDefault();save(value);}}><label>Tema del documento o progetto<input autoFocus maxLength={60} value={value} onChange={e=>setValue(e.target.value)} placeholder="Es. Tesi, Backend, Appunti"/></label><div className="topic-suggestions">{suggestions.filter(Boolean).slice(0,12).map(topic=><button type="button" key={topic} onClick={()=>setValue(topic)}>{topic}</button>)}</div><p>Con un tema vuoto il raggruppamento segue il tema del progetto o il formato del file.</p><div className="dialog-actions"><button type="button" onClick={close}>Annulla</button><button type="button" disabled={busy} onClick={()=>save('')}>Rimuovi tema</button><button className="primary" disabled={busy}>Salva tema</button></div></form>;
}
