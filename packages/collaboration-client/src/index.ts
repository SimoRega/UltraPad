import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import { openDB, type IDBPDatabase } from 'idb';
import { chunks, join, pack, unpack, type Header } from '../../contracts/src/index';
import { canEdit, type Role, limits } from '../../domain/src/index';
import { websocketEndpoint } from '../../contracts/src/api-endpoint';
export type SaveStatus = 'locale' | 'sincronizzazione' | 'salvato sul server' | 'offline' | 'accesso cambiato' | 'errore salvataggio';
type Pending = { id: string; payload: Uint8Array; generation: number };
type Persisted = { state: Uint8Array; pending: Pending[]; userId: string; fileId: string; generation: number };
const remote = Symbol('remote');
export class CollaborationClient {
  readonly doc = new Y.Doc(); readonly awareness = new Awareness(this.doc);
  readonly key: string; private db?: IDBPDatabase; private ws?: WebSocket;
  private outbox: Pending[] = []; private sent = new Set<string>(); private sentAt = new Map<string,number>();
  private ackWatchdog?: ReturnType<typeof setInterval>; private status: SaveStatus = 'locale'; private writable = false;
  private stopped = false; private blocked = false; private authenticated = false; private synced = false;
  private retry = 0; private reconnectTimer?: ReturnType<typeof setTimeout>; private authTimer?: ReturnType<typeof setTimeout>;
  private queue: Promise<unknown> = Promise.resolve(); private incoming: Promise<unknown> = Promise.resolve();
  private transfers = new Map<string, { parts: Uint8Array[]; total: number; size: number; started: number }>();
  private sessions = new Map<string, number>(); private persistenceFailed = false;
  constructor(readonly config: { userId: string; fileId: string; generation: number; role: Role; apiUrl: string; ticket: () => Promise<{ ticket: string; generation: number }>; changed: (status: SaveStatus, pending: number, role: Role, error?: string) => void }) {
    this.key = `${config.userId}:${config.fileId}:${config.generation}`;
    this.writable = canEdit(config.role); this.doc.getText('content');
  }
  private notify(status: SaveStatus, error?: string) { this.status = status; this.config.changed(status, this.outbox.length, this.config.role, error); }
  private online = () => { if (!this.stopped && !this.blocked) this.schedule(); };
  private offline = () => {
    this.authenticated = false; this.synced = false; this.sent.clear(); this.sentAt.clear();
    clearTimeout(this.authTimer); clearTimeout(this.reconnectTimer); this.ws?.close();
    if (!this.stopped && !this.blocked) this.notify('offline');
  };
  private networkOnline() { return navigator.onLine !== false; }
  private connected() { return this.networkOnline() && this.ws?.readyState === WebSocket.OPEN; }
  async start() {
    try {
      this.db = await openDB('ultrapad-offline-v1', 1, { upgrade(db) { db.createObjectStore('documents'); db.createObjectStore('metadata'); } });
      if (this.stopped) { this.db.close(); return; }
      const saved = await this.db.get('documents', this.key) as Persisted | undefined;
      if (this.stopped) { this.db.close(); return; }
      if (saved) { Y.applyUpdate(this.doc, saved.state, remote); this.outbox = saved.pending; }
    } catch { this.persistenceFailed = true; this.notify('errore salvataggio', 'Salvataggio sul dispositivo non disponibile. Esporta il testo prima di chiudere.'); }
    if (this.stopped) return;
    this.doc.on('update', this.onUpdate);
    this.awareness.on('update', this.onAwareness);
    window.addEventListener('offline', this.offline); window.addEventListener('online', this.online);
    this.awareness.setLocalStateField('user', { name: this.config.userId.slice(0, 8), color: '#7c83fd', colorLight: '#7c83fd33' });
    this.ackWatchdog=setInterval(()=>{if([...this.sentAt.values()].some(at=>Date.now()-at>15000))this.ws?.close();},5000);
    this.connect();
  }
  private onUpdate = (payload: Uint8Array, origin: unknown) => {
    if (origin === remote || this.stopped) return;
    if (!this.writable && !this.blocked) return;
    const pending = { id: crypto.randomUUID(), payload: payload.slice(), generation: this.config.generation };
    this.outbox.push(pending);
    if (this.outbox.reduce((sum, p) => sum + p.payload.length, 0) > 32 * 1024 * 1024) { this.blocked = true; this.notify('errore salvataggio', 'Troppi aggiornamenti in attesa. Esporta una copia.'); }
    this.persist().then(() => { if (!this.blocked) this.flush(); });
  };
  private persist(): Promise<void> {
    const value: Persisted = { state: Y.encodeStateAsUpdate(this.doc), pending: this.outbox.map(p => ({ ...p, payload: p.payload.slice() })), userId: this.config.userId, fileId: this.config.fileId, generation: this.config.generation };
    const job = this.queue.then(async () => {
      if (!this.db) throw new Error('INDEXEDDB');
      await this.db.put('documents', value, this.key);
      this.notify(this.blocked ? 'accesso cambiato' : this.connected() && this.synced && this.authenticated ? (this.outbox.length ? 'sincronizzazione' : 'salvato sul server') : 'offline');
    }).catch(() => { this.persistenceFailed = true; this.notify('errore salvataggio', 'Il dispositivo non ha confermato il salvataggio locale. Esporta una copia.'); });
    this.queue = job; return job;
  }
  private async connect() {
    if (this.stopped || this.blocked) return;
    if (!this.networkOnline()) { this.notify('offline'); return; }
    try {
      const info = await this.config.ticket();
      if (this.stopped || !this.networkOnline()) return;
      if (info.generation !== this.config.generation) { this.block('Il file è stato ripristinato. Le modifiche di questa versione restano esportabili.'); return; }
      const url = websocketEndpoint(this.config.apiUrl,this.config.fileId,info.generation);
      const ws = new WebSocket(url); this.ws = ws; ws.binaryType = 'arraybuffer'; this.authenticated = false; this.synced = false;
      ws.onopen = () => ws.send(pack({ type: 'hello', protocol: 1, ticket: info.ticket }));
      ws.onmessage = e => { this.incoming = this.incoming.then(() => { if (!this.stopped && this.ws === ws && this.connected()) return this.receive(e.data); }).catch(() => { this.notify('errore salvataggio', 'Risposta del server non valida.'); ws.close(); }); };
      ws.onclose = () => { if (this.ws !== ws) return; this.authenticated = false; this.synced = false; this.sent.clear(); this.sentAt.clear(); clearTimeout(this.authTimer); this.schedule(); };
      ws.onerror = () => this.notify('offline');
    } catch (e) {
      if (e instanceof Error && /ACCESS_CHANGED|FORBIDDEN|403/.test(e.message)) this.block('Accesso al file cambiato. Puoi esportare il testo locale.');
      else this.schedule();
    }
  }
  private schedule() {
    if (this.stopped || this.blocked) return;
    this.notify('offline'); clearTimeout(this.reconnectTimer);
    if (!this.networkOnline()) return;
    this.reconnectTimer = setTimeout(() => this.connect(), Math.min(30_000, 500 * 2 ** Math.min(this.retry++, 6)) + Math.random() * 500);
  }
  private block(error: string) { this.blocked = true; this.writable = false; this.ws?.close(); this.notify('accesso cambiato', error); }
  private async receive(data: ArrayBuffer) {
    const { header, payload } = unpack(data);
    if (header.type === 'authenticated') {
      this.config.role = header.role as Role; this.writable = canEdit(this.config.role); this.authenticated = true; this.retry = 0;
      if (!this.writable && this.outbox.length) { this.block('Non puoi più modificare questo file. Esporta le modifiche locali.'); return; }
      clearTimeout(this.authTimer);
      this.authTimer = setTimeout(async () => {
        try { const info = await this.config.ticket(); if (info.generation !== this.config.generation) { this.block('Versione del file cambiata.'); return; } this.send({ type: 'refresh-auth', ticket: info.ticket }); }
        catch { this.ws?.close(); }
      }, 25_000);
      return;
    }
    if (header.type === 'sync-state' || header.type === 'remote-update') {
      if (header.type === 'sync-state' && header.generation !== this.config.generation) { this.block('Versione del file cambiata.'); return; }
      const update = this.assemble(header, payload); if (!update) return;
      Y.applyUpdate(this.doc, update, remote);
      if (header.type === 'sync-state') this.synced = true;
      await this.persist(); this.flush();
      this.awareness.setLocalStateField('user', { name: this.config.userId.slice(0, 8), color: '#7c83fd', colorLight: '#7c83fd33' });
      return;
    }
    if (header.type === 'ack') {
      if (header.generation !== this.config.generation) throw new Error('ACK_GENERATION');
      this.sent.delete(String(header.updateId)); this.sentAt.delete(String(header.updateId)); this.outbox = this.outbox.filter(p => p.id !== header.updateId); await this.persist(); return;
    }
    if (header.type === 'awareness') {
      // The server-authenticated identity is authoritative, not the claimed user object.
      const temporary = new Y.Doc(); const awareness = new Awareness(temporary);
      try {
        applyAwarenessUpdate(awareness, payload, remote);
        for (const [clientId, state] of awareness.getStates()) {
          if (clientId === awareness.clientID || clientId === this.doc.clientID) continue;
          const safe = { ...state, user: { name: String(header.userId).slice(0, 8), color: '#ffb870', colorLight: '#ffb87033' } };
          awareness.states.set(clientId, safe);
          this.sessions.set(String(header.sessionId), clientId);
        }
        applyAwarenessUpdate(this.awareness, encodeAwarenessUpdate(awareness, [...awareness.getStates().keys()].filter(k => k !== awareness.clientID)), remote);
      } finally { awareness.destroy(); temporary.destroy(); }
      return;
    }
    if (header.type === 'presence-left') { const clientId = this.sessions.get(String(header.sessionId)); if (clientId) removeAwarenessStates(this.awareness, [clientId], remote); return; }
    if (header.type === 'permission-changed' || header.type === 'generation-changed') { this.block('Accesso o versione cambiati. Esporta il lavoro locale e riapri il file.'); return; }
    if (header.type === 'error') {
      const code = String(header.code);
      if (/WRITE_FORBIDDEN|ACCESS_CHANGED|UPDATE_ID_CONFLICT|QUOTA|SCHEMA/.test(code)) this.block(`Sincronizzazione bloccata (${code}). Il testo locale è esportabile.`);
      else { this.notify('errore salvataggio', code); this.ws?.close(); }
    }
  }
  private assemble(header: Header, payload: Uint8Array): Uint8Array | null {
    const id = String(header.transferId); const part = Number(header.part); const total = Number(header.total);
    if (!Number.isInteger(total) || total < 1 || total > 171 || !Number.isInteger(part) || part < 0 || part >= total) throw new Error('TRANSFER');
    for (const [key, t] of this.transfers) if (Date.now() - t.started > 30_000) this.transfers.delete(key);
    if (this.transfers.size > 8) throw new Error('TRANSFER_LIMIT');
    const transfer = this.transfers.get(id) ?? { parts: [], total, size: 0, started: Date.now() };
    if (transfer.total !== total) throw new Error('TRANSFER');
    if (!transfer.parts[part]) { transfer.parts[part] = payload; transfer.size += payload.length; }
    if (transfer.size > limits.state) throw new Error('TRANSFER_SIZE'); this.transfers.set(id, transfer);
    if (transfer.parts.filter(Boolean).length !== total) return null;
    this.transfers.delete(id); return join(transfer.parts);
  }
  private send(header: Header, payload?: Uint8Array) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(pack(header, payload)); }
  private flush() {
    if (!this.connected() || !this.synced || !this.authenticated || !this.writable || this.blocked || this.stopped || this.persistenceFailed) return;
    for (const pending of this.outbox) {
      if (this.sent.has(pending.id)) continue;
      this.sent.add(pending.id); this.sentAt.set(pending.id,Date.now());
      const parts = chunks(pending.payload);
      parts.forEach((p, part) => this.send({ type: 'update', updateId: pending.id, generation: pending.generation, part, total: parts.length }, p));
    }
  }
  private awarenessTimer?: ReturnType<typeof setTimeout>;
  private onAwareness = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    if (origin === remote || !this.synced) return;
    clearTimeout(this.awarenessTimer);
    this.awarenessTimer = setTimeout(() => this.send({ type: 'awareness' }, encodeAwarenessUpdate(this.awareness, [...added, ...updated, ...removed].filter(k => k === this.doc.clientID))), 120);
  };
  get pending() { return this.outbox.length; }
  get text() { return this.doc.getText('content').toString(); }
  async settled() { await this.queue; }
  async destroy() {
    this.stopped = true; clearInterval(this.ackWatchdog); clearTimeout(this.authTimer); clearTimeout(this.reconnectTimer); clearTimeout(this.awarenessTimer);
    window.removeEventListener('offline', this.offline); window.removeEventListener('online', this.online);
    this.doc.off('update', this.onUpdate); this.awareness.off('update', this.onAwareness); this.ws?.close();
    await this.queue; this.awareness.destroy(); this.doc.destroy(); this.db?.close();
  }
}
export async function cacheMetadata(userId: string, key: string, value?: unknown) {
  const db = await openDB('ultrapad-offline-v1', 1, { upgrade(db) { db.createObjectStore('documents'); db.createObjectStore('metadata'); } });
  try { if (value !== undefined) await db.put('metadata', value, `${userId}:${key}`); return await db.get('metadata', `${userId}:${key}`); } finally { db.close(); }
}
export async function localCopies(userId: string): Promise<Persisted[]> {
  const db = await openDB('ultrapad-offline-v1', 1, { upgrade(db) { db.createObjectStore('documents'); db.createObjectStore('metadata'); } });
  try { return (await db.getAll('documents') as Persisted[]).filter(v => v.userId === userId); } finally { db.close(); }
}
export async function clearUserCache(userId: string) {
  const db = await openDB('ultrapad-offline-v1', 1);
  try {
    for (const store of ['documents', 'metadata']) {
      const tx = db.transaction(store, 'readwrite');
      for (const key of await tx.store.getAllKeys()) if (String(key).startsWith(`${userId}:`)) await tx.store.delete(key);
      await tx.done;
    }
  } finally { db.close(); }
}
