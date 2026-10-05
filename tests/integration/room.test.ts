import { env, runInDurableObject, evictDurableObject, runDurableObjectAlarm } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { pack, unpack, chunks } from '../../packages/contracts/src/index';
import type { Env } from '../../apps/api/src/db';
const binding = (env as unknown as Env).ROOMS;
const fileId = '00000000-0000-4000-8000-000000000001';
function next(ws: WebSocket): Promise<ReturnType<typeof unpack>> { return new Promise((resolve,reject)=>{ const timer=setTimeout(()=>reject(new Error('message timeout')),3000); ws.addEventListener('message',function handler(e){ clearTimeout(timer); ws.removeEventListener('message',handler); resolve(unpack(e.data as ArrayBuffer)); }); }); }
async function connect(token='editor') {
  const stub=binding.get(binding.newUniqueId());
  const info=await stub.fetch(new Request('https://room/ticket',{method:'POST',body:JSON.stringify({token,fileId,generation:1})}));
  const {ticket}=await info.json() as {ticket:string};
  const upgrade=await stub.fetch(new Request('https://room/ws',{headers:{Upgrade:'websocket'}}));
  const ws=upgrade.webSocket!;ws.accept(); ws.binaryType = 'arraybuffer';
  const messages: ReturnType<typeof unpack>[]=[];ws.addEventListener('message',e=>{ if (typeof e.data === 'string') console.log('STRING SERVER',e.data); else messages.push(unpack(e.data as ArrayBuffer)); });
  const ready=next(ws);ws.send(pack({type:'hello',protocol:1,ticket}));await ready;
  // Receive sync without racing a queued event.
  if (!messages.some(m=>m.header.type==='sync-state')) await next(ws);
  return {stub,ws,messages,ticket};
}
async function update(ws:WebSocket,doc:Y.Doc,id=crypto.randomUUID()) {
  const wait=next(ws);ws.send(pack({type:'update',updateId:id,generation:1,part:0,total:1},Y.encodeStateAsUpdate(doc)));return {result:await wait,id};
}
describe('real workerd SQLite storage and WebSocket protocol (test ACL adapter)',()=>{
 it('commits before ACK, restores state from SQLite and deduplicates receipts',async()=>{
  const {stub,ws}=await connect();const doc=new Y.Doc();doc.getText('content').insert(0,'persisted 😀');
  const first=await update(ws,doc);expect(first.result.header.type).toBe('ack');expect(first.result.header.serverSeq).toBe(1);
  const twice=await update(ws,doc,first.id);expect(twice.result.header.serverSeq).toBe(1);
  await runInDurableObject(stub,async(_instance,state)=>{
   const row=state.storage.sql.exec<{snapshot:ArrayBuffer;seq:number}>('SELECT snapshot,seq FROM meta').one();
   const recovered=new Y.Doc();Y.applyUpdate(recovered,new Uint8Array(row.snapshot));expect(recovered.getText('content').toString()).toBe('persisted 😀');expect(row.seq).toBe(1);recovered.destroy();
  });
  await evictDurableObject(stub);
  const sync=next(ws); ws.send(pack({type:'sync-request'})); const revived=await sync; const rehydrated=new Y.Doc();Y.applyUpdate(rehydrated,revived.payload);expect(rehydrated.getText('content').toString()).toBe('persisted 😀');
  rehydrated.destroy();ws.close();doc.destroy();
 });
 it('blocks a viewer including hidden sync-step2 writes',async()=>{
  const {ws}=await connect('viewer');const doc=new Y.Doc();doc.getText('content').insert(0,'unauthorized');
  const reply=await update(ws,doc);expect(reply.result.header.type).toBe('error');expect(reply.result.header.code).toBe('WRITE_FORBIDDEN');ws.close();doc.destroy();
  const other=await connect('viewer');const wait=next(other.ws);other.ws.send(pack({type:'sync-step2'},new Uint8Array([1])));expect((await wait).header.type).toBe('error');other.ws.close();
 });
 it('rejects an update ID reused with different bytes',async()=>{
  const {ws}=await connect();const a=new Y.Doc();a.getText('content').insert(0,'one');const first=await update(ws,a);
  a.getText('content').insert(3,'two');const reply=await update(ws,a,first.id);expect(reply.result.header.code).toBe('UPDATE_ID_CONFLICT');ws.close();a.destroy();
 });
 it('keeps immutable checkpoints and seeds a separate generation',async()=>{
  const {stub,ws}=await connect();const doc=new Y.Doc();doc.getText('content').insert(0,'version one');await update(ws,doc);
  const response=await stub.fetch(new Request('https://room/checkpoints',{method:'POST',body:JSON.stringify({label:'v1'})}));const cp=await response.json() as {id:string};
  doc.getText('content').insert(11,' modified');await update(ws,doc);
  const snapshot=await stub.fetch(`https://room/checkpoints/${cp.id}`);const recovered=new Y.Doc();Y.applyUpdate(recovered,new Uint8Array(await snapshot.arrayBuffer()));expect(recovered.getText('content').toString()).toBe('version one');ws.close();doc.destroy();recovered.destroy();
 });
 it('closes silently connected readers when the lease expires',async()=>{
  const {stub,ws}=await connect('viewer');
  await runInDurableObject(stub,(_instance,state)=>{for(const socket of state.getWebSockets()){const lease=socket.deserializeAttachment() as {expiresAt:number};lease.expiresAt=Date.now()-1;socket.serializeAttachment(lease);}});
  const closed=new Promise<number>(resolve=>ws.addEventListener('close',event=>resolve(event.code)));
  await runDurableObjectAlarm(stub);expect(await closed).toBe(4003);
 });
 it('accepts a 1 MiB paste through bounded chunks and rehydrates it after eviction',async()=>{
  const {stub,ws}=await connect();const doc=new Y.Doc();doc.getText('content').insert(0,'x'.repeat(1024*1024));
  const parts=chunks(Y.encodeStateAsUpdate(doc));const id=crypto.randomUUID();const wait=next(ws);const start=performance.now();
  for(let part=parts.length-1;part>=0;part--)ws.send(pack({type:'update',updateId:id,generation:1,part,total:parts.length},parts[part]));
  expect((await wait).header.type).toBe('ack');console.log(`M0_LOCAL_1MIB_ACK_MS=${(performance.now()-start).toFixed(2)} CHUNKS=${parts.length}`);
  await evictDurableObject(stub);const snapshot=await stub.fetch('https://room/snapshot');const value=await snapshot.json() as {text:string};expect(value.text.length).toBe(1024*1024);ws.close();doc.destroy();
 });
 it('rejects revoked tickets and one-use ticket replay',async()=>{
  const {stub,ws,ticket}=await connect();const denied=await stub.fetch(new Request('https://room/ticket',{method:'POST',body:JSON.stringify({token:'revoked',fileId,generation:1})}));expect(denied.status).toBe(409);
  const wait=next(ws);ws.send(pack({type:'refresh-auth',ticket}));expect((await wait).header.code).toBe('TICKET_EXPIRED');ws.close();
 });
});
