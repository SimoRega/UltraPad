import { useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker';
import { MonacoBinding } from 'y-monaco';
import { CollaborationClient, type SaveStatus } from '../../../packages/collaboration-client/src/index';
import { canEdit, type Role } from '../../../packages/domain/src/index';
import type { FileRecord } from '../../../packages/contracts/src/index';
import { apiUrl, request } from './api';
import { download } from './files';
(self as typeof self & { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = { getWorker(_id, label) {
  if (label === 'json') return new JsonWorker(); if (label === 'css') return new CssWorker();
  if (label === 'html') return new HtmlWorker(); if (label === 'typescript' || label === 'javascript') return new TsWorker(); return new EditorWorker();
} };
export default function Editor({ file, userId, role, initialText, clearInitial, clientChanged }: { file: FileRecord; userId: string; role: Role; initialText?: string; clearInitial: () => void; clientChanged: (client: CollaborationClient | null) => void }) {
  const [client, setClient] = useState<CollaborationClient>(); const [status, setStatus] = useState<SaveStatus>('locale');
  const [pending, setPending] = useState(0); const [error, setError] = useState(''); const [currentRole, setRole] = useState(role);
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor>(); const container=useRef<HTMLDivElement>(null); const [wrap, setWrap] = useState(true); const [people, setPeople] = useState(1);
  const clearRef = useRef(clearInitial); clearRef.current = clearInitial;
  const changeRef = useRef(clientChanged); changeRef.current = clientChanged;
  useEffect(() => {
    const provider = new CollaborationClient({ userId, fileId: file.id, generation: file.generation, role, apiUrl,
      ticket: () => request(`/files/${file.id}/collaboration-ticket`, {}),
      changed(s, p, r, e) { setStatus(s); setPending(p); setRole(r); if (e) setError(e); }
    });
    let disposed = false;
    provider.start().then(() => {
      if (disposed) return;
      if (initialText !== undefined && !provider.text && !provider.pending) { provider.doc.getText('content').insert(0, initialText); clearRef.current(); }
      setClient(provider); changeRef.current(provider);
    });
    const onPresence = () => setPeople(provider.awareness.getStates().size);
    provider.awareness.on('change', onPresence);
    return () => { disposed = true; changeRef.current(null); provider.awareness.off('change', onPresence); void provider.destroy(); };
  }, [file.id, file.generation, role, userId]);
  useEffect(() => {
    if (!client || !editor) return;
    const model = editor.getModel(); if (!model) return;
    const binding = new MonacoBinding(client.doc.getText('content'), model, new Set([editor]), client.awareness);
    return () => binding.destroy();
  }, [client, editor]);
  useEffect(()=>{
    if(!container.current)return;
    const model=monaco.editor.createModel('',file.language,monaco.Uri.parse(`ultrapad://files/${file.id}/${file.generation}`));
    const instance=monaco.editor.create(container.current,{model,theme:'vs-dark',readOnly:!canEdit(role),wordWrap:'on',minimap:{enabled:false},fontSize:14,fontFamily:'ui-monospace, SFMono-Regular, Consolas, monospace',padding:{top:24},automaticLayout:true,scrollBeyondLastLine:false,ariaLabel:`Contenuto ${file.name}`});
    setEditor(instance);
    return ()=>{instance.dispose();model.dispose();};
  },[file.id,file.generation,file.language,file.name,role]);
  const readOnly = !canEdit(currentRole) || status === 'accesso cambiato';
  useEffect(()=>editor?.updateOptions({readOnly,wordWrap:wrap?'on':'off'}),[editor,readOnly,wrap]);
  return <section className="editor-region" aria-label={`Editor di ${file.name}`}>
    <div className="editor-toolbar"><span className="badge">{file.language}</span><span className="muted">{readOnly ? 'Sola lettura' : 'Modificabile'}</span><span className="spacer" />
      <button onClick={() => setWrap(!wrap)} aria-pressed={wrap}>A capo</button><button onClick={() => editor?.getAction('actions.find')?.run()}>Cerca</button>
      <button onClick={() => download(file.name, client?.text ?? '')}>Scarica copia locale</button></div>
    {error && <div className="notice" role="alert">{error}</div>}
    <div className="monaco" ref={container} />
    <footer className="status-bar"><span role="status" aria-live="polite"><i className={`dot ${status === 'salvato sul server' ? 'saved' : ''}`} />{status}{pending > 0 ? ` · ${pending} modifiche in attesa` : ''}</span><span>{people} {people === 1 ? 'sessione' : 'sessioni'} · UTF-8 · LF</span></footer>
  </section>;
}
