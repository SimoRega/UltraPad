import { publishCheckpoint } from './backup';
import { DurableObject } from 'cloudflare:workers';
import * as Y from 'yjs';
import { access, database, type Env } from '../../api/src/db';
import { canEdit, candidate, limits, sha256, type Role } from '../../../packages/domain/src/index';
import { chunks, frameHeader, join, pack, unpack, type Header } from '../../../packages/contracts/src/index';
type Lease = { token: string; userId: string; role: Role; fileId: string; generation: number; expiresAt: number; sessionId: string; window: number; count: number };
type Ticket = { token: string; fileId: string; generation: number };
export class DocumentRoom extends DurableObject<Env> {
  private doc = new Y.Doc();
  private serial: Promise<unknown> = Promise.resolve();
  private fileId = '';
  private generation = 1;
  private seq = 0;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS meta(id INTEGER PRIMARY KEY CHECK(id=1),file_id TEXT,generation INTEGER,seq INTEGER,snapshot BLOB,seed_id TEXT);
      CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,actor TEXT,hash TEXT,seq INTEGER,expires INTEGER);
      CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY,data TEXT,expires INTEGER);
      CREATE TABLE IF NOT EXISTS pieces(socket TEXT,id TEXT,part INTEGER,total INTEGER,blob BLOB,expires INTEGER,PRIMARY KEY(socket,id,part));
      CREATE TABLE IF NOT EXISTS checkpoints(id TEXT PRIMARY KEY,label TEXT,seq INTEGER,generation INTEGER,blob BLOB,hash TEXT,created INTEGER);
      CREATE TABLE IF NOT EXISTS backup_state(id INTEGER PRIMARY KEY CHECK(id=1),seq INTEGER,last_time INTEGER,error TEXT);
      INSERT OR IGNORE INTO backup_state VALUES(1,0,0,NULL);`);
    const row = ctx.storage.sql.exec<{ file_id: string; generation: number; seq: number; snapshot: ArrayBuffer }>('SELECT * FROM meta WHERE id=1').toArray()[0];
    if (row) { this.fileId = row.file_id; this.generation = row.generation; this.seq = row.seq; Y.applyUpdate(this.doc, new Uint8Array(row.snapshot)); }
    this.doc.getText('content');
  }
  protected authorize(token: string, fileId: string, generation: number) { return access(this.env, token, fileId, generation); }
  protected async reserveCapacity(token:string,fileId:string,generation:number,bytes:number){
    const {error}=await database(this.env,token).rpc('reserve_document_bytes',{fid:fileId,gen:generation,n:bytes});
    if(error)throw new Error(error.message.includes('QUOTA')?'WORKSPACE_QUOTA':'ACCESS_CHANGED');
  }
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.serial.then(work, work); this.serial = next.catch(() => undefined); return next;
  }
  private initialize(fileId: string, generation: number) {
    if (this.fileId && (fileId !== this.fileId || generation !== this.generation)) throw new Error('ROOM_MISMATCH');
    if (!this.fileId) {
      this.fileId = fileId; this.generation = generation;
      this.ctx.storage.sql.exec('INSERT INTO meta VALUES(1,?,?,0,?,NULL)', fileId, generation, Y.encodeStateAsUpdate(this.doc).buffer);
    }
  }
  async fetch(request: Request): Promise<Response> {
    return this.enqueue(async () => {
      const url = new URL(request.url);
      if (url.pathname === '/ticket') {
        const data = await request.json<Ticket>(); await this.authorize(data.token, data.fileId, data.generation);
        this.initialize(data.fileId, data.generation);
        const ticket = crypto.randomUUID() + crypto.randomUUID();
        this.ctx.storage.sql.exec('INSERT INTO tickets VALUES(?,?,?)', ticket, JSON.stringify(data), Date.now() + 30_000);
        await this.ctx.storage.setAlarm(Date.now() + 45_000);
        return Response.json({ ticket, generation: this.generation });
      }
      if (url.pathname === '/ws') {
        if (this.ctx.getWebSockets().length >= 32) return new Response('ROOM_FULL', { status: 429 });
        const pair = new WebSocketPair(); this.ctx.acceptWebSocket(pair[1]);
        pair[1].serializeAttachment({ expiresAt: Date.now() + 10_000, sessionId: crypto.randomUUID() });
        await this.ctx.storage.setAlarm(Date.now() + 10_000);
        return new Response(null, { status: 101, webSocket: pair[0] });
      }
      if (url.pathname === '/backup-health') return Response.json(this.ctx.storage.sql.exec('SELECT * FROM backup_state').one());
      if (url.pathname === '/snapshot') return Response.json({ text: this.doc.getText('content').toString(), generation: this.generation, serverSeq: this.seq, payload: [...Y.encodeStateAsUpdate(this.doc)] });
      if (url.pathname === '/checkpoints' && request.method === 'GET') return Response.json(this.ctx.storage.sql.exec('SELECT id,label,seq,generation,hash,created FROM checkpoints ORDER BY created DESC').toArray());
      if (url.pathname === '/checkpoints' && request.method === 'POST') {
        const { label, id } = await request.json<{ label: string; id?: string }>();
        const checkpointId = id ?? crypto.randomUUID();
        const old = this.ctx.storage.sql.exec('SELECT id FROM checkpoints WHERE id=?', checkpointId).toArray()[0];
        if (!old) {
          const count = this.ctx.storage.sql.exec<{ n: number }>('SELECT count(*) n FROM checkpoints').one().n;
          if (count >= 40) throw new Error('CHECKPOINT_QUOTA');
          const blob = Y.encodeStateAsUpdate(this.doc); const hash = await sha256(blob);
          this.ctx.storage.sql.exec('INSERT INTO checkpoints VALUES(?,?,?,?,?,?,?)', checkpointId, label.slice(0, 120), this.seq, this.generation, blob.buffer, hash, Date.now());
        }
        let backup='not-configured';
        if(this.env.CHECKPOINT_SERVICE_ROLE){
          const row=this.ctx.storage.sql.exec<{blob:ArrayBuffer;hash:string;seq:number;label:string}>('SELECT blob,hash,seq,label FROM checkpoints WHERE id=?',checkpointId).one();
          await publishCheckpoint(this.env,{id:checkpointId,fileId:this.fileId,generation:this.generation,seq:row.seq,bytes:new Uint8Array(row.blob),hash:row.hash,label:row.label});backup='published';
        }
        return Response.json({ id: checkpointId, backup });
      }
      if (url.pathname.startsWith('/checkpoints/')) {
        const row = this.ctx.storage.sql.exec<{ blob: ArrayBuffer; hash: string; seq: number; generation: number }>('SELECT * FROM checkpoints WHERE id=?', url.pathname.split('/')[2]).toArray()[0];
        if (!row) return new Response('NOT_FOUND', { status: 404 });
        return new Response(row.blob, { headers: { 'X-Checksum': row.hash, 'X-Server-Seq': String(row.seq), 'X-Generation': String(row.generation) } });
      }
      if (url.pathname === '/seed') {
        const { fileId, generation, text, operationId } = await request.json<{ fileId: string; generation: number; text: string; operationId: string }>();
        this.initialize(fileId, generation);
        const seeded = this.ctx.storage.sql.exec<{ seed_id: string | null }>('SELECT seed_id FROM meta').one().seed_id;
        if (seeded && seeded !== operationId) throw new Error('SEED_CONFLICT');
        if (!seeded) {
          const fresh = new Y.Doc(); fresh.getText('content').insert(0, text);
          const next = candidate(new Y.Doc(), Y.encodeStateAsUpdate(fresh)); fresh.destroy();
          this.ctx.storage.sql.exec('UPDATE meta SET snapshot=?,seed_id=? WHERE id=1', Y.encodeStateAsUpdate(next).buffer, operationId);
          this.doc.destroy(); this.doc = next;
        }
        return Response.json({ generation });
      }
      if (url.pathname === '/revoke') {
        for (const ws of this.ctx.getWebSockets()) { this.send(ws, { type: 'permission-changed' }); ws.close(4003, 'Accesso cambiato'); }
        return Response.json({ ok: true });
      }
      return new Response('NOT_FOUND', { status: 404 });
    }).catch(e => Response.json({ error: e instanceof Error ? e.message : 'ROOM_ERROR' }, { status: 409 }));
  }
  private send(ws: WebSocket, header: Header, payload?: Uint8Array) { try { ws.send(pack(header, payload)); } catch { ws.close(); } }
  private sendState(ws: WebSocket) {
    const data = Y.encodeStateAsUpdate(this.doc); const parts = chunks(data); const transferId = crypto.randomUUID();
    for (let part = 0; part < parts.length; part++) this.send(ws, { type: 'sync-state', generation: this.generation, serverSeq: this.seq, transferId, part, total: parts.length }, parts[part]);
  }
  private broadcast(header: Header, payload?: Uint8Array, except?: WebSocket) {
    for (const ws of this.ctx.getWebSockets()) {
      const lease = ws.deserializeAttachment() as Lease;
      if (!lease?.userId || lease.expiresAt <= Date.now()) { ws.close(4003, 'Autorizzazione scaduta'); continue; }
      if (ws !== except) this.send(ws, header, payload);
    }
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    return this.enqueue(async () => {
      if (typeof message !== 'object') throw new Error('BINARY_REQUIRED');
      const { header: raw, payload } = unpack(message); const header = frameHeader.parse(raw);
      let lease = ws.deserializeAttachment() as Lease;
      const now = Date.now();
      if (header.type === 'hello' || header.type === 'refresh-auth') {
        const row = this.ctx.storage.sql.exec<{ data: string; expires: number }>('SELECT * FROM tickets WHERE id=?', header.ticket).toArray()[0];
        this.ctx.storage.sql.exec('DELETE FROM tickets WHERE id=?', header.ticket);
        if (!row || row.expires <= now) throw new Error('TICKET_EXPIRED');
        const data = JSON.parse(row.data) as Ticket;
        const auth = await this.authorize(data.token, data.fileId, data.generation);
        if (lease.userId && lease.userId !== auth.userId) throw new Error('IDENTITY_CHANGED');
        const editors = this.ctx.getWebSockets().filter(s => { const l = s.deserializeAttachment() as Lease; return s !== ws && l.userId && l.expiresAt > now && canEdit(l.role); }).length;
        if (canEdit(auth.role) && editors >= limits.editors) throw new Error('ROOM_FULL');
        lease = { token: data.token, fileId: data.fileId, generation: data.generation, userId: auth.userId, role: auth.role, expiresAt: Math.min(Date.now() + 45_000, auth.expiresAt), sessionId: lease.sessionId, count: 0, window: now };
        ws.serializeAttachment(lease); this.send(ws, { type: 'authenticated', role: lease.role, sessionId: lease.sessionId, userId: lease.userId });
        if (header.type === 'hello') this.sendState(ws);
        await this.ctx.storage.setAlarm(Date.now() + 10_000); return;
      }
      if (!lease?.userId || lease.expiresAt <= now) throw new Error('AUTH_EXPIRED');
      if (now - lease.window > 1000) { lease.window = now; lease.count = 0; }
      lease.count++; if (lease.count > 220) throw new Error('RATE_LIMIT'); ws.serializeAttachment(lease);
      if (header.type === 'sync-request') { if (payload.length) throw new Error('SYNC_WRITE_FORBIDDEN'); this.sendState(ws); return; }
      if (header.type === 'awareness') {
        if (payload.length > 4096) throw new Error('AWARENESS_QUOTA');
        this.broadcast({ type: 'awareness', userId: lease.userId, sessionId: lease.sessionId }, payload, ws); return;
      }
      if (!canEdit(lease.role) || header.generation !== this.generation) throw new Error('WRITE_FORBIDDEN');
      // Recheck every writing message, including chunk uploads. Revocation never extends a lease on errors.
      const auth = await this.authorize(lease.token, lease.fileId, lease.generation);
      if (!canEdit(auth.role)) throw new Error('WRITE_FORBIDDEN');
      if (header.part >= header.total || payload.length > limits.chunk) throw new Error('CHUNK');
      this.ctx.storage.sql.exec('DELETE FROM pieces WHERE expires<?', now);
      const queued = this.ctx.storage.sql.exec<{ n: number }>('SELECT coalesce(sum(length(blob)),0) n FROM pieces WHERE socket=?', lease.sessionId).one().n;
      if (queued + payload.length > limits.state) throw new Error('ASSEMBLY_QUOTA');
      const previous = this.ctx.storage.sql.exec<{ blob: ArrayBuffer; total: number }>('SELECT blob,total FROM pieces WHERE socket=? AND id=? AND part=?', lease.sessionId, header.updateId, header.part).toArray()[0];
      if (previous && (previous.total !== header.total || await sha256(new Uint8Array(previous.blob)) !== await sha256(payload))) throw new Error('CHUNK_CONFLICT');
      this.ctx.storage.sql.exec('INSERT OR IGNORE INTO pieces VALUES(?,?,?,?,?,?)', lease.sessionId, header.updateId, header.part, header.total, payload.slice().buffer, now + 30_000);
      const rows = this.ctx.storage.sql.exec<{ part: number; total: number; blob: ArrayBuffer }>('SELECT part,total,blob FROM pieces WHERE socket=? AND id=? ORDER BY part', lease.sessionId, header.updateId).toArray();
      if (rows.length !== header.total) return;
      if (rows.some((r, i) => r.part !== i || r.total !== header.total)) throw new Error('CHUNK_ORDER');
      const update = join(rows.map(r => new Uint8Array(r.blob))); const hash = await sha256(update);
      const receipt = this.ctx.storage.sql.exec<{ actor: string; hash: string; seq: number }>('SELECT * FROM receipts WHERE id=?', header.updateId).toArray()[0];
      if (receipt) {
        if (receipt.actor !== lease.userId || receipt.hash !== hash) throw new Error('UPDATE_ID_CONFLICT');
        this.ctx.storage.sql.exec('DELETE FROM pieces WHERE socket=? AND id=?', lease.sessionId, header.updateId);
        this.send(ws, { type: 'ack', updateId: header.updateId, generation: this.generation, serverSeq: receipt.seq }); return;
      }
      const next = candidate(this.doc, update); const seq = this.seq + 1;
      try {await this.reserveCapacity(lease.token,this.fileId,this.generation,Y.encodeStateAsUpdate(next).length);}catch(e){next.destroy();throw e;}
      try {
        this.ctx.storage.transactionSync(() => {
          this.ctx.storage.sql.exec('UPDATE meta SET seq=?,snapshot=? WHERE id=1', seq, Y.encodeStateAsUpdate(next).buffer);
          this.ctx.storage.sql.exec('INSERT INTO receipts VALUES(?,?,?,?,?)', header.updateId, lease.userId, hash, seq, now + 30 * 86400_000);
          this.ctx.storage.sql.exec('DELETE FROM pieces WHERE socket=? AND id=?', lease.sessionId, header.updateId);
        });
        await this.ctx.storage.sync();
      } catch (e) { next.destroy(); this.ctx.abort('STORAGE_SYNC_FAILED'); throw e; }
      this.doc.destroy(); this.doc = next; this.seq = seq;
      await this.ctx.storage.setAlarm(Date.now() + 10_000);
      this.send(ws, { type: 'ack', updateId: header.updateId, generation: this.generation, serverSeq: seq });
      const parts = chunks(update); const transferId = crypto.randomUUID();
      parts.forEach((part, index) => this.broadcast({ type: 'remote-update', transferId, part: index, total: parts.length, serverSeq: seq }, part, ws));
    }).catch(e => { this.send(ws, { type: 'error', code: e instanceof Error ? e.message : 'ROOM_ERROR', retryable: false }); ws.close(4003, 'Sincronizzazione interrotta'); });
  }
  async alarm() {
    return this.enqueue(async () => {
      const now = Date.now();
      this.ctx.storage.sql.exec('DELETE FROM tickets WHERE expires<?', now);
      this.ctx.storage.sql.exec('DELETE FROM pieces WHERE expires<?', now);
      this.ctx.storage.sql.exec('DELETE FROM receipts WHERE expires<?', now);
      for (const ws of this.ctx.getWebSockets()) { const lease = ws.deserializeAttachment() as Lease; if (lease.expiresAt <= now) ws.close(4003, 'Autorizzazione scaduta'); }
      const backup=this.ctx.storage.sql.exec<{seq:number;last_time:number}>('SELECT seq,last_time FROM backup_state').one();
      if(this.env.CHECKPOINT_SERVICE_ROLE && this.seq>backup.seq && now-backup.last_time>=15*60_000){
        try {
          const bytes=Y.encodeStateAsUpdate(this.doc),hash=await sha256(bytes);
          await publishCheckpoint(this.env,{id:crypto.randomUUID(),fileId:this.fileId,generation:this.generation,seq:this.seq,bytes,hash,label:'Automatico'});
          this.ctx.storage.sql.exec('UPDATE backup_state SET seq=?,last_time=?,error=NULL',this.seq,now);
        } catch {this.ctx.storage.sql.exec('UPDATE backup_state SET last_time=?,error=?',now,'BACKUP_FAILED');}
      }
      if (this.ctx.getWebSockets().length) await this.ctx.storage.setAlarm(now + 10_000);
      else if(this.env.CHECKPOINT_SERVICE_ROLE && this.seq>backup.seq) await this.ctx.storage.setAlarm(now+15*60_000);
    });
  }
  webSocketClose(ws: WebSocket) {
    const lease = ws.deserializeAttachment() as Lease;
    this.ctx.storage.sql.exec('DELETE FROM pieces WHERE socket=?', lease.sessionId);
    this.broadcast({ type: 'presence-left', sessionId: lease.sessionId }); ws.close();
  }
  webSocketError(ws: WebSocket) { this.webSocketClose(ws); }
}
