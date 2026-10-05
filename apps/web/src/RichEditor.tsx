import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { QuillBinding } from 'y-quill';
import type { Range } from 'quill';
import Quill from './rich-config';
import 'quill/dist/quill.core.css';
import { CollaborationClient, type SaveStatus } from '../../../packages/collaboration-client/src/index';
import { canEdit, limits } from '../../../packages/domain/src/index';
import { fonts, inlineFormats, blockFormats, richFormats, validateRichDelta, validAttributes, richHtml, documentFile, type Attributes } from '../../../packages/rich-text/src/index';
import type { EditorProps } from './editor-types';
import { apiUrl, request } from './api';
import { download } from './files';

type RelativeRange={anchor:Y.RelativePosition;head:Y.RelativePosition};
const points=[0,4,6,8,12,18,24,36,48];
export default function RichEditor(props:EditorProps){
 const {file,userId,role,localChanged}=props;const holder=useRef<HTMLDivElement>(null);const editorRef=useRef<Quill|undefined>(undefined);const docRef=useRef<Y.Doc|undefined>(undefined);const relative=useRef<RelativeRange|undefined>(undefined);
 const propsRef=useRef(props);propsRef.current=props;const [editor,setEditor]=useState<Quill>();const [status,setStatus]=useState<SaveStatus>('locale');const [currentRole,setCurrentRole]=useState(role);const [pending,setPending]=useState(0);const [people,setPeople]=useState(1);const [error,setError]=useState('');const [localFailure,setLocalFailure]=useState(false);
 const [tab,setTab]=useState<'text'|'paragraph'|'styles'>('text');const [formats,setFormats]=useState<Attributes>({});const [size,setSize]=useState('12');const [paint,setPaint]=useState<Attributes>();const paintRef=useRef<Attributes|undefined>(undefined);
 const readOnly=!canEdit(currentRole)||status==='accesso cambiato';
 function range():Range{const q=editorRef.current;const doc=docRef.current;const max=Math.max(0,(q?.getLength()??1)-1);if(doc&&relative.current){const a=Y.createAbsolutePositionFromRelativePosition(relative.current.anchor,doc);const b=Y.createAbsolutePositionFromRelativePosition(relative.current.head,doc);if(a&&b){const index=Math.min(max,Math.min(a.index,b.index));return {index,length:Math.max(0,Math.min(max,Math.max(a.index,b.index))-index)};}}return {index:0,length:0};}
 function inspect(){const q=editorRef.current;if(!q)return;const r=range();const raw=q.getFormat(r.index,r.length);const attrs:Attributes={};for(const [key,value] of Object.entries(raw))if(validAttributes({[key]:value}))attrs[key]=value as string|number|boolean;setFormats(attrs);setSize(typeof attrs.size==='string'?attrs.size.replace('pt',''):'12');}
 function apply(name:string,value:unknown,block=false){const q=editorRef.current;if(!q||!q.isEnabled())return;const r=range();q.history.cutoff();if(block)q.formatLine(r.index,Math.max(1,r.length),name,value,'user');else if(r.length)q.formatText(r.index,r.length,name,value,'user');else{q.setSelection(r,'silent');q.format(name,value,'user');}q.history.cutoff();inspect();}
 function applyPaint(attrs:Attributes,r:Range){const q=editorRef.current;if(!q||!q.isEnabled())return;const inline:Record<string,unknown>={};const block:Record<string,unknown>={};for(const name of inlineFormats)inline[name]=attrs[name]??false;for(const name of blockFormats)block[name]=attrs[name]??false;q.history.cutoff();q.formatText(r.index,r.length,inline,'user');q.formatLine(r.index,Math.max(1,r.length),block,'user');q.history.cutoff();inspect();}
 useEffect(()=>{
  let disposed=false;let binding:QuillBinding|undefined;let q:Quill|undefined;let localDoc:Y.Doc|undefined;let provider:CollaborationClient|undefined;let cleanup:(()=>void)|undefined;let cancelPreparation:(()=>void)|undefined;
  async function initialize(){
   const initial=propsRef.current;
   if(localChanged){localDoc=new Y.Doc();if(initial.localDelta)localDoc.getText('content').applyDelta(validateRichDelta(initial.localDelta));else localDoc.getText('content').insert(0,initial.localText??'');}
   else{provider=new CollaborationClient({userId,fileId:file.id,generation:file.generation,role,apiUrl,ticket:()=>request(`/files/${file.id}/collaboration-ticket`,{document:initial.initialText===undefined}),changed(s,p,r,e){if(!disposed){setStatus(s);setPending(p);setCurrentRole(r);if(e)setError(e);}}});await provider.start();if(disposed)return;
    if(initial.initialText!==undefined&&!provider.text&&!provider.pending){provider.doc.transact(()=>{const content=provider!.doc.getText('content');if(initial.initialDelta)content.applyDelta(validateRichDelta(initial.initialDelta));else content.insert(0,initial.initialText!);if(!content.toString().endsWith('\n'))content.insert(content.length,'\n',{});});initial.clearInitial();}
    propsRef.current.clientChanged(provider);
   }
   const doc=localDoc??provider!.doc;const text=doc.getText('content');docRef.current=doc;
   if(localDoc&&!text.toString().endsWith('\n'))text.insert(text.length,'\n',{});
   if(provider&&canEdit(role)&&!text.toString().endsWith('\n'))await new Promise<void>(resolve=>{const ready=()=>{if(text.toString().endsWith('\n')){text.unobserve(ready);resolve();}};cancelPreparation=()=>{text.unobserve(ready);resolve();};text.observe(ready);ready();});
   if(!holder.current||disposed)return;
   const node=document.createElement('div');holder.current.replaceChildren(node);
   q=new Quill(node,{theme:undefined,readOnly:!canEdit(role),formats:richFormats,modules:{toolbar:false,history:{userOnly:true,delay:500},cursors:{transformOnTextChange:true}},placeholder:'Scrivi il tuo documento…'});
   q.root.setAttribute('role','textbox');q.root.setAttribute('aria-label',`Contenuto ${file.name}`);q.root.setAttribute('aria-multiline','true');
   editorRef.current=q;binding=new QuillBinding(text,q,provider?.awareness);q.history.clear();setEditor(q);
   relative.current={anchor:Y.createRelativePositionFromTypeIndex(text,0),head:Y.createRelativePositionFromTypeIndex(text,0)};
   const selection=(r:Range|null,_old:Range|null,source:string)=>{if(!r)return;relative.current={anchor:Y.createRelativePositionFromTypeIndex(text,r.index),head:Y.createRelativePositionFromTypeIndex(text,r.index+r.length)};if(paintRef.current&&r.length&&source==='user'){const copied=paintRef.current;paintRef.current=undefined;setPaint(undefined);setError('');applyPaint(copied,r);}inspect();};
   const change=()=>{if(q&&binding){const expected=text.toString().endsWith('\n')?text.toString():text.toString()+'\n';if(q.getText()!==expected){const r=range();const focused=q.hasFocus();binding.quill.setContents(text.toDelta(),binding);if(focused)q.setSelection(r,'silent');}}if(localDoc){try{const delta=validateRichDelta(text.toDelta());propsRef.current.localChanged?.(text.toString(),delta);setLocalFailure(false);setError('');}catch(e){setLocalFailure(true);setError(e instanceof Error?e.message:'Il documento non è stato salvato nella scheda. Scarica una copia.');}}};
   text.observe(change);q.on('selection-change',selection);
   const paste=(event:ClipboardEvent)=>{event.preventDefault();event.stopImmediatePropagation();if(!q?.isEnabled())return;const value=(event.clipboardData?.getData('text/plain')??'').replace(/\r\n?/g,'\n').replace(/\0/g,'');const r=range();if(new TextEncoder().encode(q.getText()+value).length>limits.text){setError('Il testo supera 1 MiB. Incolla una porzione più piccola.');return;}const Delta=Quill.import('delta');q.updateContents(new Delta().retain(r.index).delete(r.length).insert(value),'user');q.setSelection(r.index+value.length,0,'silent');};
   const drop=(event:DragEvent)=>{event.preventDefault();event.stopImmediatePropagation();};q.root.addEventListener('paste',paste,true);q.root.addEventListener('drop',drop,true);
   const presence=()=>setPeople(provider?.awareness.getStates().size??1);provider?.awareness.on('change',presence);
   cleanup=()=>{text.unobserve(change);q?.off('selection-change',selection);q?.root.removeEventListener('paste',paste,true);q?.root.removeEventListener('drop',drop,true);provider?.awareness.off('change',presence);};
   if(localDoc)change();inspect();
  }
  void initialize().catch(()=>{if(!disposed)setError('Documento non disponibile. Scarica le copie locali oppure ricarica il file.');});
  return()=>{disposed=true;cancelPreparation?.();cleanup?.();binding?.destroy();q?.disable();q?.root.remove();holder.current?.replaceChildren();editorRef.current=undefined;docRef.current=undefined;relative.current=undefined;propsRef.current.clientChanged(null);localDoc?.destroy();void provider?.destroy();};
 },[file.id,file.generation,file.name,userId,role,Boolean(localChanged)]);
 useEffect(()=>{editor?.enable(!readOnly);},[editor,readOnly]);
 const disabled=readOnly||!editor;
 function focus(){const r=range();editor?.setSelection(r,'silent');}
 function button(label:string,action:()=>void,pressed?:boolean){return <button key={label} type="button" disabled={disabled} aria-pressed={pressed} onMouseDown={e=>e.preventDefault()} onClick={()=>{action();focus();}}>{label}</button>;}
 function sizeChange(value:number){const bounded=Math.min(96,Math.max(8,Math.round(value)||12));setSize(String(bounded));apply('size',`${bounded}pt`);}
 function cases(mode:'upper'|'lower'|'title'){
  if(!editor?.isEnabled())return;const r=range();if(!r.length){setError('Seleziona il testo da convertire.');return;}let start=true;
  const ops=editor.getContents(r.index,r.length).ops.map(op=>{if(typeof op.insert!=='string')return op;let transformed='';for(const char of op.insert){transformed+=mode==='upper'?char.toLocaleUpperCase('it-IT'):mode==='lower'?char.toLocaleLowerCase('it-IT'):start?char.toLocaleUpperCase('it-IT'):char.toLocaleLowerCase('it-IT');start=!/[\p{L}\p{N}]/u.test(char);}return {...op,insert:transformed};});const Delta=Quill.import('delta');editor.history.cutoff();editor.updateContents(new Delta().retain(r.index).delete(r.length).concat(new Delta(ops)),'user');editor.history.cutoff();const length=ops.reduce((sum,op)=>sum+(typeof op.insert==='string'?op.insert.length:0),0);const content=docRef.current?.getText('content');if(content)relative.current={anchor:Y.createRelativePositionFromTypeIndex(content,r.index),head:Y.createRelativePositionFromTypeIndex(content,r.index+length)};editor.setSelection(r.index,length,'silent');inspect();setError('');
 }
 function clear(){if(!editor?.isEnabled())return;const r=range();if(!r.length){setError('Seleziona il testo da ripulire.');return;}editor.history.cutoff();editor.removeFormat(r.index,r.length,'user');editor.formatLine(r.index,r.length,Object.fromEntries(blockFormats.map(f=>[f,false])),'user');editor.history.cutoff();inspect();}
 function copyPaint(){if(!editor)return;const r=range();const values=editor.getFormat(r.index,r.length);const attrs:Attributes={};for(const [key,value] of Object.entries(values))if(validAttributes({[key]:value}))attrs[key]=value as string|number|boolean;paintRef.current=attrs;setPaint(attrs);setError('Pennello attivo: seleziona il testo a cui applicare il formato.');}
 function exportRich(kind:'html'|'native'|'text'){const doc=docRef.current;if(!doc)return;const delta=validateRichDelta(doc.getText('content').toDelta());if(kind==='text')download(file.name,doc.getText('content').toString());else if(kind==='html')download(`${file.name}.html`,richHtml(delta,file.name),'text/html;charset=utf-8');else download(`${file.name}.ultrapad.json`,documentFile(file.name,delta),'application/json');}
 const count=docRef.current?.getText('content').length??0;
 return <section className="editor-region rich-region" aria-label={`Editor di ${file.name}`}>
  <div className="editor-toolbar"><span className="badge">Documento · TXT</span><span className="muted">{readOnly?'Sola lettura':'Modificabile'}</span><span className="spacer"/><button disabled={!editor} onClick={()=>exportRich('text')}>Scarica testo</button><button disabled={!editor} onClick={()=>exportRich('html')}>Esporta HTML</button><button disabled={!editor} onClick={()=>exportRich('native')}>Scarica documento</button></div>
  <div className="rich-ribbon"><nav className="segmented" aria-label="Gruppi di formattazione">{([['text','Testo'],['paragraph','Paragrafo'],['styles','Stili']] as const).map(([value,label])=><button key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>{label}</button>)}</nav><div className="rich-common">{button('↶ Annulla',()=>editor?.history.undo())}{button('↷ Ripeti',()=>editor?.history.redo())}</div></div>
  <div className="rich-tools" role="toolbar" aria-label="Formattazione documento">
  {tab==='text'&&<><label>Carattere<select aria-label="Famiglia font" disabled={disabled} value={String(formats.font??'Arial')} onChange={e=>apply('font',e.target.value)}>{fonts.map(font=><option key={font}>{font}</option>)}</select></label><label>Punti<input aria-label="Dimensione font" type="number" min={8} max={96} disabled={disabled} value={size} onChange={e=>{setSize(e.target.value);const n=Number(e.target.value);if(Number.isInteger(n)&&n>=8&&n<=96)apply('size',`${n}pt`);}} onBlur={()=>{if(!Number.isInteger(Number(size))||Number(size)<8||Number(size)>96)setSize(typeof formats.size==='string'?formats.size.replace('pt',''):'12');}}/></label>{button('− Dimensione',()=>sizeChange(Number(size)-1))}{button('+ Dimensione',()=>sizeChange(Number(size)+1))}
   {button('Grassetto',()=>apply('bold',!formats.bold),Boolean(formats.bold))}{button('Corsivo',()=>apply('italic',!formats.italic),Boolean(formats.italic))}{button('Sottolineato',()=>apply('underline',!formats.underline),Boolean(formats.underline))}{button('Barrato',()=>apply('strike',!formats.strike),Boolean(formats.strike))}
   <label>Testo<input aria-label="Colore testo" type="color" disabled={disabled} value={String(formats.color??'#202430')} onChange={e=>apply('color',e.target.value)}/></label><label>Evidenzia<input aria-label="Evidenziazione testo" type="color" disabled={disabled} value={String(formats.background??'#fff2b3')} onChange={e=>apply('background',e.target.value)}/></label>
   {button('Apice',()=>apply('script',formats.script==='super'?false:'super'),formats.script==='super')}{button('Pedice',()=>apply('script',formats.script==='sub'?false:'sub'),formats.script==='sub')}
   {button('MAIUSCOLO',()=>cases('upper'))}{button('minuscolo',()=>cases('lower'))}{button('Maiuscole Iniziali',()=>cases('title'))}{button('Cancella formattazione',clear)}
  </>}
  {tab==='paragraph'&&<>{(['left','center','right','justify'] as const).map((align,index)=>button(['A sinistra','Al centro','A destra','Giustificato'][index],()=>apply('align',align==='left'?false:align,true),(formats.align??'left')===align))}
   <label>Elenco<select aria-label="Tipo elenco" disabled={disabled} value={String(formats.list==='ordered'?'ordered':formats.list==='checked'||formats.list==='unchecked'?'check':formats.list==='bullet'?(formats.listMarker??'bullet'):'none')} onChange={e=>{const v=e.target.value;apply('list',v==='none'?false:v==='ordered'?'ordered':v==='check'?'unchecked':'bullet',true);apply('listMarker',v==='square'?'square':false,true);}}><option value="none">Nessuno</option><option value="bullet">Pallini</option><option value="square">Quadrati</option><option value="check">Spunte</option><option value="ordered">Numerato</option></select></label>
   {button('Aumenta rientro',()=>apply('indent',Math.min(8,Number(formats.indent??0)+1),true))}{button('Riduci rientro',()=>apply('indent',Number(formats.indent??0)>1?Number(formats.indent)-1:false,true))}
   <label>Interlinea<select aria-label="Interlinea" disabled={disabled} value={String(formats.lineHeight??'1.5')} onChange={e=>apply('lineHeight',e.target.value,true)}>{['1','1.15','1.5','2','2.5','3'].map(n=><option key={n}>{n}</option>)}</select></label>
   {([['spaceBefore','Prima (pt)'],['spaceAfter','Dopo (pt)'],['firstLineIndent','Prima riga (pt)']] as const).map(([key,label])=><label key={key}>{label}<select aria-label={label} disabled={disabled} value={String(formats[key]??(key==='spaceAfter'?'8pt':'0pt'))} onChange={e=>apply(key,e.target.value,true)}>{points.map(n=><option key={n} value={`${n}pt`}>{n}</option>)}</select></label>)}
   <label>Sfondo<input aria-label="Sfondo paragrafo" type="color" disabled={disabled} value={String(formats.paragraphBackground??'#e7e2fa')} onChange={e=>apply('paragraphBackground',e.target.value,true)}/></label>{button('Rimuovi sfondo',()=>apply('paragraphBackground',false,true))}
   <label>Bordi<select aria-label="Bordi paragrafo" disabled={disabled} value={String(formats.paragraphBorder??'none')} onChange={e=>apply('paragraphBorder',e.target.value==='none'?false:e.target.value,true)}>{[['none','Nessuno'],['all','Completi'],['top','Superiore'],['bottom','Inferiore'],['left','Sinistro'],['right','Destro']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
  </>}
  {tab==='styles'&&<><label>Stile<select aria-label="Stile testo" disabled={disabled} value={Number(formats.header??0)} onChange={e=>apply('header',Number(e.target.value)||false,true)}>{['Testo normale','Titolo','Sottotitolo','Intestazione 1','Intestazione 2'].map((label,index)=><option key={label} value={index}>{label}</option>)}</select></label>{button(paint?'Pennello attivo':'Copia formato',copyPaint,Boolean(paint))}{button('Applica formato',()=>{if(paint){applyPaint(paint,range());paintRef.current=undefined;setPaint(undefined);setError('');}})}{button('Cancella formattazione',clear)}<span className="muted">Copia formato, poi seleziona il testo di destinazione.</span></>}
  </div>
  {error&&<div className="notice" role="alert">{error}<button onClick={()=>setError('')}>Chiudi messaggio</button></div>}
  <div className="document-scroll"><div className="document-paper" ref={holder}/></div>
  <footer className="status-bar"><span role="status" aria-live="polite"><i className={`dot ${status==='salvato sul server'?'saved':''}`}/>{localChanged?localFailure?'temporaneo non salvato · scarica una copia':'temporaneo · solo questa scheda':status}{pending?` · ${pending} modifiche in attesa`:''}</span><span>{count} caratteri · {localChanged?'stili locali · nessuna sincronizzazione':`${people} ${people===1?'sessione':'sessioni'} · stili condivisi`}</span></footer>
 </section>;
}
