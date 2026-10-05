import React, { Component, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate, useParams, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { auth, configured, request, mutate } from './api';
import { cacheMetadata, clearUserCache, localCopies, type CollaborationClient } from '../../../packages/collaboration-client/src/index';
import { canAdmin, canEdit, type Role } from '../../../packages/domain/src/index';
import type { FileRecord } from '../../../packages/contracts/src/index';
import { decodeText, download, exportLocal, exportProject } from './files';
import './style.css';
const Editor = lazy(() => import('./Editor'));
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true, staleTime: 15_000 } } });
type Project = { id: string; workspace_id: string; name: string; role: Role };
type Workspace = { id: string; name: string; owner_id: string };
type Bootstrap = { projects: Project[]; workspaces: Workspace[] };
type Checkpoint = { id: string; label: string; seq: number; generation: number; created: number };
class Boundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }; static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="notice">L’editor non è disponibile. Ricarica la pagina; il recupero locale resta disponibile dal menu account.</div> : this.props.children; }
}
function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} onCancel={close}><header><h2>{title}</h2><button aria-label="Chiudi" onClick={close}>×</button></header>{children}</dialog>;
}
async function cached<T>(userId: string, key: string, fetcher: () => Promise<T>): Promise<T> {
  try { const value = await fetcher(); await cacheMetadata(userId, key, value); return value; }
  catch (e) { if (e instanceof TypeError || !navigator.onLine) { const value = await cacheMetadata(userId, key); if (value !== undefined) return value as T; } throw e; }
}
function App() {
  const [session, setSession] = useState<Session | null>(null); const [loaded, setLoaded] = useState(!auth);
  useEffect(() => {
    if (!auth) return;
    auth.auth.getSession().then(({ data }) => { setSession(data.session); setLoaded(true); });
    const { data } = auth.auth.onAuthStateChange((_event, next) => { setSession(next); queryClient.clear(); });
    return () => data.subscription.unsubscribe();
  }, []);
  if (!configured) return <main className="landing"><div className="brand"><b>U</b> UltraPad</div><h1>Uno spazio per<br /><em>pensare insieme.</em></h1><p>Note, codice e progetti. Condivisione in tempo reale e lavoro recuperabile.</p><div className="setup"><h2>Configura il tuo ambiente</h2><p>Imposta le tre variabili pubbliche in <code>.env</code>, applica la migrazione SQL e configura il backend. Le istruzioni complete sono in <code>docs/DEPLOY.md</code>.</p><p>Questa schermata indica un ambiente non configurato.</p></div></main>;
  if (!loaded) return <main className="landing">Caricamento sessione…</main>;
  if (!session) return <main className="landing"><div className="brand"><b>U</b> UltraPad</div><h1>Il tuo prossimo progetto,<br /><em>in buona compagnia.</em></h1><p>Scrivi note, modifica codice e condividi idee nello stesso spazio.</p><button className="primary" onClick={() => auth?.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.origin } })}>Accedi con GitHub →</button><p className="muted">TXT · Markdown · JSON · XML · Java · C# · LaTeX come sorgente</p></main>;
  return <Routes><Route path="/" element={<WorkspaceApp session={session} />} /><Route path="/projects/:projectId/files/:fileId" element={<WorkspaceApp session={session} />} /><Route path="/projects/:projectId" element={<WorkspaceApp session={session} />} /></Routes>;
}
function WorkspaceApp({ session }: { session: Session }) {
  const { projectId, fileId } = useParams(); const navigate = useNavigate(); const qc = useQueryClient(); const userId = session.user.id;
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [filter, setFilter] = useState('');
  const [dialog, setDialog] = useState<'workspace' | 'project' | 'file' | 'folder' | 'invite' | 'members' | 'history' | 'account' | null>(null);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [inviteRole, setInviteRole] = useState<Role>('editor'); const [inviteUrl, setInviteUrl] = useState('');
  const [workspaceId, setWorkspaceId] = useState(''); const [parentId, setParentId] = useState<string | null>(null); const [tabs, setTabs] = useState<string[]>([]);
  const client = useRef<CollaborationClient | null>(null); const [initials, setInitials] = useState<Record<string, string>>({}); const inputFile = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(''); const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint>();
  const [restoreOp, setRestoreOp] = useState<{ operation_id: string; checkpoint_id: string }>();
  const bootstrap = useQuery({ queryKey: [userId, 'bootstrap'], queryFn: () => cached(userId, 'bootstrap', () => request<Bootstrap>('/bootstrap')) });
  const project = bootstrap.data?.projects.find(p => p.id === projectId); const activeWorkspace = workspaceId || project?.workspace_id || bootstrap.data?.workspaces[0]?.id;
  const filesQuery = useQuery({ queryKey: [userId, 'files', projectId], enabled: Boolean(projectId), queryFn: () => cached(userId, `files:${projectId}`, () => request<FileRecord[]>(`/projects/${projectId}/files`)) });
  const files = filesQuery.data ?? []; const file = files.find(f => f.id === fileId && f.kind === 'text');
  const history = useQuery({ queryKey: [userId, 'history', fileId], enabled: dialog === 'history' && Boolean(file), queryFn: () => request<Checkpoint[]>(`/files/${fileId}/checkpoints`) });
  const members = useQuery({ queryKey: [userId, 'members', projectId], enabled: dialog === 'members' && Boolean(project), queryFn: () => request<{ user_id: string; role: Role }[]>(`/projects/${projectId}/members`) });
  useEffect(() => { if (fileId) setTabs(current => current.includes(fileId) ? current : [...current, fileId]); }, [fileId]);
  useEffect(() => { setTabs([]); setParentId(null); }, [projectId]);
  async function act(work: () => Promise<void>) {
    if (busy) return; setBusy(true); setMessage('');
    try { await work(); await qc.invalidateQueries({ queryKey: [userId] }); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Operazione non riuscita'); }
    finally { setBusy(false); }
  }
  function open(next: typeof dialog) { setDialog(next); setName(''); setInviteUrl(''); setPreview(''); setSelectedCheckpoint(undefined); }
  async function create() {
    await act(async () => {
      if (dialog === 'workspace') { const w = await mutate<Workspace>('create_workspace', { name }); setWorkspaceId(w.id); }
      if (dialog === 'project') { const p = await mutate<{ id: string }>('create_project', { name, workspace_id: activeWorkspace }); navigate(`/projects/${p.id}`); }
      if (dialog === 'file' || dialog === 'folder') {
        const f = await mutate<FileRecord>('create_file', { name, project_id: projectId, parent_id: parentId, kind: dialog === 'folder' ? 'folder' : 'text' });
        if (f.kind === 'text') navigate(`/projects/${projectId}/files/${f.id}`);
      }
      setDialog(null);
    });
  }
  function tree(parent: string | null, depth = 0): React.ReactNode {
    return files.filter(f => f.parent_id === parent).map(f => <React.Fragment key={f.id}>
      <div className={`tree-row ${f.id === fileId || (f.kind === 'folder' && f.id === parentId) ? 'active' : ''}`} style={{ paddingLeft: 10 + depth * 16 }}>
        <button className="tree-name" onClick={() => f.kind === 'folder' ? setParentId(f.id === parentId ? null : f.id) : navigate(`/projects/${projectId}/files/${f.id}`)}><span>{f.kind === 'folder' ? '▱' : '⌗'}</span>{f.name}</button>
        {project && canEdit(project.role) && <button className="tree-more" aria-label={`Gestisci ${f.name}`} onClick={() => void act(async () => {
          const action = window.prompt('Scrivi: rinomina, sposta, elimina', 'rinomina');
          if (action === 'rinomina') { const next = window.prompt('Nuovo nome', f.name); if (next) await mutate('rename_file', { id: f.id, name: next, metadata_version: f.metadata_version }); }
          if (action === 'sposta') { const options = files.filter(v => v.kind === 'folder' && v.id !== f.id); const next = window.prompt(`ID della cartella, oppure vuoto per la radice:\n${options.map(v => `${v.name}: ${v.id}`).join('\n')}`, f.parent_id ?? ''); if (next !== null) await mutate('move_file', { id: f.id, parent_id: next || null, metadata_version: f.metadata_version }); }
          if (action === 'elimina' && window.confirm(`Eliminare ${f.name}${f.kind === 'folder' ? ' e tutto il contenuto' : ''}? Esporta prima le modifiche locali non sincronizzate.`)) { await mutate('delete_file', { id: f.id }); if (f.id === fileId) navigate(`/projects/${projectId}`); }
        })}>⋯</button>}
      </div>{f.kind === 'folder' && tree(f.id, depth + 1)}</React.Fragment>);
  }
  async function logout() {
    await client.current?.settled();
    const copies = await localCopies(userId); const unsaved = copies.filter(c => c.pending.length);
    if (unsaved.length) {
      if (!window.confirm('Ci sono modifiche non confermate. Scaricarle e poi uscire? Annulla per continuare a lavorare.')) return;
      await exportLocal(unsaved);
    }
    await client.current?.destroy(); client.current = null; await clearUserCache(userId); await auth?.auth.signOut(); navigate('/');
  }
  const inviteToken = new URLSearchParams(window.location.hash.slice(1)).get('invite');
  return <main className="workspace-shell">
    <nav className="rail" aria-label="Workspace"><a className="logo" href="/" aria-label="UltraPad">U</a>
      {bootstrap.data?.workspaces.map(w => <button key={w.id} title={w.name} aria-label={w.name} className={activeWorkspace === w.id ? 'selected' : ''} onClick={() => { setWorkspaceId(w.id); navigate('/'); }}>{w.name.slice(0, 2).toUpperCase()}</button>)}
      <button aria-label="Nuovo workspace" onClick={() => open('workspace')}>+</button><span className="spacer" /><button aria-label="Account" onClick={() => open('account')}>☺</button></nav>
    <aside className="sidebar"><header><div><span className="eyebrow">SPAZIO DI LAVORO</span><h2>{bootstrap.data?.workspaces.find(w => w.id === activeWorkspace)?.name ?? 'UltraPad'}</h2></div></header>
      <div className="section-heading"><span>PROGETTI</span><button aria-label="Nuovo progetto" disabled={!activeWorkspace} onClick={() => open('project')}>+</button></div>
      <div className="projects">{bootstrap.data?.projects.filter(p => p.workspace_id === activeWorkspace).map(p => <button key={p.id} className={p.id === projectId ? 'active' : ''} onClick={() => navigate(`/projects/${p.id}`)}>◇ <span>{p.name}</span></button>)}</div>
      {project && <><div className="section-heading"><span>FILE {parentId ? '· CARTELLA SELEZIONATA' : ''}</span><button aria-label="Nuovo file" disabled={!canEdit(project.role)} onClick={() => open('file')}>+</button></div>
        <input aria-label="Cerca file per nome" placeholder="Cerca un file…" value={filter} onChange={e => setFilter(e.target.value)} />
        <div className="file-tree">{filter ? files.filter(f => f.name.toLowerCase().includes(filter.toLowerCase())).map(f => <button className="tree-name" key={f.id} onClick={() => f.kind === 'text' && navigate(`/projects/${projectId}/files/${f.id}`)}>{f.name}</button>) : tree(null)}</div>
        {canEdit(project.role) && <div className="sidebar-actions"><button onClick={() => open('folder')}>+ Cartella</button><button onClick={() => inputFile.current?.click()}>↑ Importa testo</button></div>}
        <input hidden type="file" ref={inputFile} onChange={e => { const selected = e.target.files?.[0]; e.target.value = ''; if (!selected) return; void act(async () => { const text = await decodeText(selected); const f = await mutate<FileRecord>('create_file', { name: selected.name, project_id: projectId, parent_id: parentId, kind: 'text' }); setInitials(current => ({ ...current, [f.id]: text })); navigate(`/projects/${projectId}/files/${f.id}`); }); }} /></>}
      <div className="sidebar-bottom"><span className="dot saved" />{session.user.user_metadata.user_name ?? session.user.email ?? 'Account'}<small>Spazio privato · {project?.role ?? 'nessun progetto'}</small></div>
    </aside>
    <section className="main-panel"><header className="topbar"><div><span className="eyebrow">ULTRAPAD / PROGETTI</span><h1>{project?.name ?? 'Il tuo atelier'}</h1></div><span className="spacer" />
      {project && <><button onClick={() => void act(() => exportProject(project.id, files))} disabled={busy}>Esporta ZIP</button><button onClick={() => open('members')}>Membri</button>{canAdmin(project.role) && <button className="primary" onClick={() => open('invite')}>Invita +</button>}</>}
    </header>
    {(message || bootstrap.error || filesQuery.error) && <div className="notice" role="alert">{message || bootstrap.error?.message || filesQuery.error?.message}<button aria-label="Chiudi avviso" onClick={() => setMessage('')}>×</button></div>}
    {inviteToken && <div className="notice">Hai ricevuto un invito. Sarà verificato per l’email di questo account.<button className="primary" onClick={() => void act(async () => { const result = await request<{ project_id: string }>('/invitations/accept', { token: inviteToken }); window.history.replaceState(null, '', window.location.pathname); navigate(`/projects/${result.project_id}`); })}>Accetta invito</button></div>}
    {file && project ? <><nav className="tabs" aria-label="File aperti">{[...new Set([...tabs, file.id])].map(id => files.find(f => f.id === id)).filter((f): f is FileRecord => Boolean(f)).map(f => <button className={f.id === fileId ? 'active' : ''} key={f.id} onClick={() => navigate(`/projects/${projectId}/files/${f.id}`)}>⌗ {f.name}</button>)}<span className="spacer" /><button onClick={() => open('history')}>◷ Cronologia</button></nav>
      <Boundary><Suspense fallback={<div className="empty">Caricamento editor…</div>}><Editor key={`${file.id}:${file.generation}`} file={file} userId={userId} role={project.role} initialText={initials[file.id]} clearInitial={() => setInitials(v => { const next = { ...v }; delete next[file.id]; return next; })} clientChanged={c => { client.current = c; }} /></Suspense></Boundary></> : <div className="empty"><span className="empty-symbol">✳</span><h2>{project ? 'Dai forma alle tue idee.' : 'Il lavoro migliore comincia qui.'}</h2><p>{project ? 'Apri un file o creane uno nuovo. Ogni modifica confermata viene conservata dal server.' : 'Crea un workspace e un progetto per iniziare a scrivere con i tuoi collaboratori.'}</p><button className="primary" onClick={() => open(!activeWorkspace ? 'workspace' : !project ? 'project' : 'file')}>{!activeWorkspace ? 'Crea workspace' : !project ? 'Nuovo progetto' : 'Crea il primo file'} →</button><div className="capabilities"><span>Note & codice</span><span>Collaborazione</span><span>Recupero locale</span></div></div>}
    </section>
    {dialog && <Modal title={{ workspace: 'Nuovo workspace', project: 'Nuovo progetto', file: 'Nuovo file', folder: 'Nuova cartella', invite: 'Invita un collaboratore', members: 'Membri del progetto', history: 'Cronologia del file', account: 'Il tuo account' }[dialog]} close={() => setDialog(null)}>
      {['workspace','project','file','folder'].includes(dialog) && <form onSubmit={e => { e.preventDefault(); void create(); }}><label>Nome<input autoFocus required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder={dialog === 'file' ? 'idee.md' : 'Nome'} /></label><button className="primary" disabled={busy}>Crea</button></form>}
      {dialog === 'invite' && <form onSubmit={e => { e.preventDefault(); void act(async () => { const result = await request<{ url: string }>(`/projects/${projectId}/invitations`, { email, role: inviteRole }); setInviteUrl(result.url); }); }}><p>Il link è monouso, scade dopo 72 ore e richiede l’email verificata indicata.</p><label>Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><label>Ruolo<select value={inviteRole} onChange={e => setInviteRole(e.target.value as Role)}><option value="viewer">Lettore</option><option value="editor">Editor</option></select></label><button className="primary" disabled={busy}>Genera link</button>{inviteUrl && <label>Link da condividere<input readOnly value={inviteUrl} /><button type="button" onClick={() => navigator.clipboard.writeText(inviteUrl)}>Copia link</button></label>}</form>}
      {dialog === 'members' && <><p>Il proprietario del workspace mantiene l’accesso a tutti i progetti.</p>{members.data?.map(m => <div className="member-row" key={m.user_id}><code>{m.user_id.slice(0, 8)}</code><span>{m.role}</span>{project && canAdmin(project.role) && m.user_id !== userId && <><select aria-label={`Ruolo di ${m.user_id}`} value={m.role} onChange={e => void act(async () => { await mutate('set_member', { project_id: projectId, user_id: m.user_id, role: e.target.value }); })}><option value="viewer">Lettore</option><option value="editor">Editor</option></select><button onClick={() => void act(async () => { await mutate('set_member', { project_id: projectId, user_id: m.user_id, role: null }); })}>Rimuovi</button></>}</div>)}{members.error && <p role="alert">{members.error.message}</p>}</>}
      {dialog === 'history' && file && <><form onSubmit={e => { e.preventDefault(); void act(async () => { if (client.current?.pending) throw new Error('Attendi la conferma delle modifiche prima di creare una versione.'); await request(`/files/${file.id}/checkpoints`, { label: name }); setName(''); }); }}><label>Nome della versione<input required value={name} onChange={e => setName(e.target.value)} /></label><button disabled={busy || !project || !canEdit(project.role)}>Salva versione server</button></form>{history.data?.map(cp => <button className="checkpoint" key={cp.id} onClick={() => void act(async () => { const result = await request<{ text: string }>(`/files/${file.id}/checkpoints/${cp.id}`); setSelectedCheckpoint(cp); setPreview(result.text); setRestoreOp(undefined); })}><strong>{cp.label}</strong><small>{new Date(cp.created).toLocaleString()} · rev. {cp.seq}</small></button>)}{history.error && <p role="alert">{history.error.message}</p>}{selectedCheckpoint && <><pre className="preview">{preview}</pre><button onClick={() => download(file.name, preview)}>Scarica versione</button>{project && canEdit(project.role) && <button onClick={() => void act(async () => { const f = await mutate<FileRecord>('create_file', { project_id: projectId, parent_id: file.parent_id, name: `copia-${Date.now()}-${file.name}`, kind: 'text' }); setInitials(v => ({ ...v, [f.id]: preview })); setDialog(null); navigate(`/projects/${projectId}/files/${f.id}`); })}>Ripristina come copia</button>}{project && canAdmin(project.role) && <button className="danger" disabled={busy} onClick={() => { if (!window.confirm('Ripristinare il file per tutti? Le modifiche locali della vecchia versione dovranno essere esportate.')) return; const op = restoreOp ?? { operation_id: crypto.randomUUID(), checkpoint_id: selectedCheckpoint.id }; setRestoreOp(op); void act(async () => { await request(`/files/${file.id}/restore`, op); setDialog(null); }); }}>Ripristina per tutti</button>}</>}</>}
      {dialog === 'account' && <><p>{session.user.email}</p><button onClick={() => void act(async () => exportLocal(await localCopies(userId)))}>Esporta tutte le copie locali</button><button className="danger" onClick={() => void act(logout)}>Esci</button>{project && canAdmin(project.role) && <button className="danger" onClick={() => { if (window.confirm('Eliminare progetto e metadati? Esporta prima il contenuto.')) void act(async () => { await mutate('delete_project', { project_id: project.id }); setDialog(null); navigate('/'); }); }}>Elimina progetto</button>}{bootstrap.data?.workspaces.find(w => w.id === activeWorkspace)?.owner_id === userId && <button className="danger" onClick={() => { if (window.confirm('Eliminare il workspace e tutti i suoi progetti?')) void act(async () => { await mutate('delete_workspace', { id: activeWorkspace }); setWorkspaceId(''); setDialog(null); navigate('/'); }); }}>Elimina workspace</button>}</>}
      {busy && <p role="status">Operazione in corso…</p>}{message && <p role="alert" className="error-text">{message}</p>}
    </Modal>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><App /></BrowserRouter></QueryClientProvider></React.StrictMode>);
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
