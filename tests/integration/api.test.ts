import { env } from 'cloudflare:test';
import { expect, it } from 'vitest';
import app from '../../apps/api/src/index';
import type { Env } from '../../apps/api/src/db';
const bindings={...env,APP_ORIGIN:'http://localhost:5173',SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'test-only'} as unknown as Env;
it('permits authenticated request preflight from the configured frontend only',async()=>{
 const response=await app.fetch(new Request('http://api/v1/mutations',{method:'OPTIONS',headers:{Origin:'http://localhost:5173','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}}),bindings);
 expect(response.status).toBe(204);expect(response.headers.get('Access-Control-Allow-Origin')).toBe(bindings.APP_ORIGIN);
 expect(response.headers.get('Access-Control-Allow-Headers')?.toLowerCase()).toContain('authorization');
 const denied=await app.fetch(new Request('http://api/v1/mutations',{method:'OPTIONS',headers:{Origin:'https://untrusted.invalid'}}),bindings);
 expect(denied.status).toBe(403);expect(denied.headers.get('Access-Control-Allow-Origin')).toBeNull();
});
it('health is reachable through an HTTP proxy without relaxing origin checks',async()=>{
 const response=await app.fetch(new Request('http://127.0.0.1:8787/health',{headers:{Origin:bindings.APP_ORIGIN}}),bindings);
 expect(response.status).toBe(200);expect(await response.json()).toMatchObject({service:'ultrapad',configured:true});
});
it('loopback aliases on the same frontend port are accepted only for local HTTP requests',async()=>{
 for(const origin of ['http://127.0.0.1:5173','http://[::1]:5173']) {
  const response=await app.fetch(new Request('http://127.0.0.1:8787/v1/mutations',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST'}}),bindings);
  expect(response.status).toBe(204);expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
 }
});
it('a local alias permits transport but does not authorize mutations without a JWT',async()=>{
 const response=await app.fetch(new Request('http://127.0.0.1:8787/v1/mutations',{method:'POST',headers:{Origin:'http://127.0.0.1:5173','Content-Type':'application/json'},body:JSON.stringify({op:'create_workspace',args:{name:'Denied'}})}),bindings);
 expect(response.status).toBe(401);expect(await response.json()).toMatchObject({error:'UNAUTHORIZED'});
});
it('production requests, wrong ports and deceptive localhost suffixes do not gain alias access',async()=>{
 for(const [target,origin] of [
  ['https://api.example.invalid/v1/mutations','http://127.0.0.1:5173'],
  ['http://127.0.0.1:8787/v1/mutations','http://127.0.0.1:5174'],
  ['http://127.0.0.1:8787/v1/mutations','http://localhost.evil.invalid:5173'],
  ['http://127.0.0.1:8787/v1/mutations','https://127.0.0.1:5173']
 ]) {
  const response=await app.fetch(new Request(target,{method:'OPTIONS',headers:{Origin:origin}}),bindings);
  expect(response.status).toBe(403);expect(await response.json()).toMatchObject({error:'ORIGIN'});
  expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
 }
});
it('normalizes a configured trailing slash and retains exact production origin matching',async()=>{
 const local=await app.fetch(new Request('http://127.0.0.1:8787/health',{headers:{Origin:'http://localhost:5173'}}),{...bindings,APP_ORIGIN:'http://localhost:5173/'});
 expect(local.status).toBe(200);expect(local.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
 const production=await app.fetch(new Request('https://api.example.invalid/health',{headers:{Origin:'https://app.example.invalid'}}),{...bindings,APP_ORIGIN:'https://app.example.invalid/'});
 expect(production.status).toBe(200);expect(production.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.invalid');
});
it('local WebSocket upgrades use the same origin policy without issuing edit authorization',async()=>{
 const response=await app.fetch(new Request('http://127.0.0.1:8787/ws/00000000-0000-4000-8000-000000000002/1',{headers:{Origin:'http://127.0.0.1:5173',Upgrade:'websocket'}}),bindings);
 expect(response.status).toBe(101);response.webSocket!.accept();response.webSocket!.close();
});

it('presence requires authentication before disclosing session identities',async()=>{
 const response=await app.fetch(new Request('http://127.0.0.1:8787/v1/files/00000000-0000-4000-8000-000000000001/presence',{headers:{Origin:bindings.APP_ORIGIN}}),bindings);
 expect(response.status).toBe(401);expect(await response.json()).toMatchObject({error:'UNAUTHORIZED'});
});
