import {encodeAnchor,decodeAnchor} from './v16/anchors';
import SaveCenter from './v16/SaveCenter';
import { useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker';
import { MonacoBinding } from 'y-monaco';
import { CollaborationClient, type SaveStatus } from '../../../packages/collaboration-client/src/index';
import { canEdit } from '../../../packages/domain/src/index';
import { apiUrl, request } from './api';
import { download } from './files';
import { useTheme } from './theme';
import type { EditorProps } from './editor-types';
import { validateRichDelta } from '../../../packages/rich-text/src/index';
import * as Y from 'yjs';
import { toolsFor, insertion, type TextTool } from '../../../packages/presentation/src/tools';
(self as typeof self & { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = { getWorker(_id, label) {
  if (label === 'json') return new JsonWorker(); if (label === 'css') return new CssWorker();
  if (label === 'html') return new HtmlWorker(); if (label === 'typescript' || label === 'javascript') return new TsWorker(); return new EditorWorker();
} };
export default function SourceEditor({ file, userId, role, initialText, initialDelta, clearInitial, clientChanged, localText, localDelta, localChanged, contentChanged,selectionChanged,jumpSelection }: EditorProps) {
  const {theme}=useTheme(); const toolset=toolsFor(file.name);
  const localRef=useRef(localText);localRef.current=localText;const localChangeRef=useRef(localChanged);localChangeRef.current=localChanged;
  const contentRef=useRef(contentChanged);contentRef.current=contentChanged;
  const [localFailure,setLocalFailure]=useState(false);
  const [client, setClient] = useState<CollaborationClient>(); const [status, setStatus] = useState<SaveStatus>('locale');
  const [pending, setPending] = useState(0); const [error, setError] = useState(''); const [currentRole, setRole] = useState(role);
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor>(); const container=useRef<HTMLDivElement>(null); const [wrap, setWrap] = useState(true); const [people, setPeople] = useState(1);
  const clearRef = useRef(clearInitial); clearRef.current = clearInitial;
  const changeRef = useRef(clientChanged); changeRef.current = clientChanged;
  useEffect(() => {
    if(localChanged)return;
    const provider = new CollaborationClient({ userId, fileId: file.id, generation: file.generation, role, apiUrl,
      ticket: () => request(`/files/${file.id}/collaboration-ticket`, {}),
      changed(s, p, r, e) { setStatus(s); setPending(p); setRole(r); if (e) setError(e); }
    });
    let disposed = false;
    provider.start().then(() => {
      if (disposed) return;
      if (initialText !== undefined && !provider.text && !provider.pending) { if(initialDelta)provider.doc.getText('content').applyDelta(validateRichDelta(initialDelta));else provider.doc.getText('content').insert(0, initialText); clearRef.current(); }
      setClient(provider); changeRef.current(provider);
    });
    const onPresence = () => setPeople(provider.awareness.getStates().size);
    provider.awareness.on('change', onPresence);
    return () => { disposed = true; changeRef.current(null); provider.awareness.off('change', onPresence); void provider.destroy(); };
  }, [file.id, file.generation, role, userId, Boolean(localChanged)]);
  useEffect(() => {
    if (!client || !editor) return;
    const model = editor.getModel(); if (!model) return;
    const binding = new MonacoBinding(client.doc.getText('content'), model, new Set([editor]), client.awareness);
    const selection=editor.onDidChangeCursorSelection(()=>{const model=editor.getModel(),s=editor.getSelection();if(model&&s&&!s.isEmpty())selectionChanged?.(encodeAnchor(client.doc,model.getOffsetAt(s.getStartPosition()),model.getOffsetAt(s.getEndPosition()),file.generation));});
    return () => {selection.dispose();binding.destroy();};
  }, [client, editor]);
  useEffect(()=>{
    if(!container.current)return;
    const localDoc=new Y.Doc();const localContent=localDoc.getText('content');if(localDelta)localContent.applyDelta(validateRichDelta(localDelta));else localContent.insert(0,localRef.current??'');
    const model=monaco.editor.createModel(localRef.current??'',file.language,monaco.Uri.parse(`ultrapad://files/${file.id}/${file.generation}`));
    const instance=monaco.editor.create(container.current,{model,theme:'vs-dark',readOnly:!canEdit(role),wordWrap:'on',minimap:{enabled:false},fontSize:14,fontFamily:'ui-monospace, SFMono-Regular, Consolas, monospace',padding:{top:24},automaticLayout:true,scrollBeyondLastLine:false,ariaLabel:`Contenuto ${file.name}`});
    contentRef.current?.(model.getValue());
    const listener=model.onDidChangeContent(event=>{contentRef.current?.(model.getValue());if(localChangeRef.current)try{localDoc.transact(()=>{for(const change of [...event.changes].sort((a,b)=>b.rangeOffset-a.rangeOffset)){if(change.rangeLength)localContent.delete(change.rangeOffset,change.rangeLength);if(change.text)localContent.insert(change.rangeOffset,change.text);}});localChangeRef.current(model.getValue(),validateRichDelta(localContent.toDelta()));setLocalFailure(false);setError('');}catch(e){setLocalFailure(true);setError(e instanceof Error?e.message:'Copie temporanee non salvate. Scarica il contenuto.');}});
    setEditor(instance);
    return ()=>{listener.dispose();instance.dispose();model.dispose();localDoc.destroy();};
  },[file.id,file.generation,file.language,file.name,role]);
  useEffect(()=>{monaco.editor.defineTheme('ultrapad',{base:theme.mode==='light'?'vs':'vs-dark',inherit:true,rules:[],colors:{'editor.background':theme.mode==='light'?'#ffffff':'#17191f','editor.selectionBackground':theme.accent+'40','editorCursor.foreground':theme.accent}});monaco.editor.setTheme('ultrapad');},[theme,editor]);
  const readOnly = !canEdit(currentRole) || status === 'accesso cambiato';
  useEffect(()=>editor?.updateOptions({readOnly,wordWrap:wrap?'on':'off'}),[editor,readOnly,wrap]);
  useEffect(()=>{if(!client||!editor||!jumpSelection)return;const range=decodeAnchor(client.doc,jumpSelection,file.generation);if(!range){setError('Il passaggio non è più disponibile in questa versione.');return;}const model=editor.getModel();if(!model)return;const a=model.getPositionAt(range.start),b=model.getPositionAt(range.end);editor.setSelection({startLineNumber:a.lineNumber,startColumn:a.column,endLineNumber:b.lineNumber,endColumn:b.column});editor.revealPositionInCenter(a);editor.focus();},[client,editor,jumpSelection]);
  useEffect(()=>{if(!editor)return;const line=Number(new URLSearchParams(window.location.search).get('line'));if(Number.isInteger(line)&&line>0){editor.setPosition({lineNumber:line,column:1});editor.revealLineInCenter(line);editor.focus();}},[editor]);
  function insert(tool:TextTool) {
    if(!editor || readOnly)return;const selection=editor.getSelection();const model=editor.getModel();if(!selection||!model)return;
    editor.pushUndoStop();editor.executeEdits('ultrapad-toolbar',[{range:selection,text:insertion(tool,model.getValueInRange(selection)),forceMoveMarkers:true}]);editor.pushUndoStop();editor.focus();
  }
  async function format() {try{const action=editor?.getAction('editor.action.formatDocument');if(!action?.isSupported())throw new Error('Formattazione non disponibile per questo documento.');await action.run();setError('');}catch(e){setError(e instanceof Error?e.message:'Formattazione non riuscita');}}
  function validate() {try{const text=editor?.getValue()??'';if(toolset.validate==='json')JSON.parse(text);else if(new DOMParser().parseFromString(text,'application/xml').getElementsByTagName('parsererror').length)throw new Error('XML non valido: controlla elementi e attributi.');setError(toolset.validate==='json'?'JSON valido.':'XML valido.');}catch(e){setError(e instanceof Error?e.message:'Documento non valido');}}
  return <section className="editor-region" aria-label={`Editor di ${file.name}`}>
    <div className="editor-toolbar"><span className="badge">{toolset.label}</span><span className="muted">{readOnly ? 'Sola lettura' : 'Modificabile'}</span><span className="spacer" />
      <button onClick={() => setWrap(!wrap)} aria-pressed={wrap}>A capo</button><button onClick={() => editor?.getAction('actions.find')?.run()}>Cerca</button>
      <button onClick={() => download(file.name, editor?.getValue() ?? client?.text ?? '')}>Scarica copia locale</button></div>
    <div className="format-toolbar" role="toolbar" aria-label={`Strumenti ${toolset.label}`}>
      <button disabled={readOnly} onClick={()=>{editor?.trigger('toolbar','undo',null);editor?.focus();}} title="Annulla (Ctrl+Z)">↶ Annulla</button><button disabled={readOnly} onClick={()=>{editor?.trigger('toolbar','redo',null);editor?.focus();}}>↷ Ripeti</button>
      {toolset.tools.map(tool=><button key={tool.label} disabled={readOnly || !editor || (!localChanged && !client)} onClick={()=>insert(tool)}>{tool.label}</button>)}
      {toolset.format && <button disabled={readOnly || !editor} onClick={()=>void format()}>Formatta documento</button>}
      {toolset.validate && <button onClick={validate}>Verifica {toolset.validate.toUpperCase()}</button>}
      <button disabled={readOnly} onClick={()=>editor?.getAction('editor.action.indentLines')?.run()}>Indenta</button>
    </div>
    {error && <div className="notice" role="alert">{error}</div>}
    <div className="monaco" ref={container} />
    <footer className="status-bar"><SaveCenter fileId={file.id} status={status} pending={pending} local={Boolean(localChanged)} error={error} userId={userId} client={client} download={()=>download(file.name,editor?.getValue()??client?.text??'')}/><span role="status" aria-live="polite"><i className={`dot ${status === 'salvato sul server' ? 'saved' : ''}`} />{localChanged ? localFailure?'temporaneo non salvato · scarica una copia':'temporaneo · solo questa scheda':status}{pending > 0 ? ` · ${pending} modifiche in attesa` : ''}</span><span>{localChanged?'Nessuna sincronizzazione':`${people} ${people===1?'sessione':'sessioni'}`} · UTF-8 · LF</span></footer>
  </section>;
}
