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
