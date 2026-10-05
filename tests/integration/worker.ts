import { DocumentRoom } from '../../apps/collaboration/src/room';
import type { Env } from '../../apps/api/src/db';
import type { Role } from '../../packages/domain/src/index';
export class TestRoom extends DocumentRoom {
  protected async reserveCapacity() {}
  protected async authorize(token: string, fileId: string, generation: number) {
    if (token === 'revoked') throw new Error('ACCESS_CHANGED');
    return { file: { id: fileId, generation }, userId: token === 'viewer' ? 'viewer-user' : 'editor-user', role: (token === 'viewer' ? 'viewer' : 'editor') as Role, expiresAt: Date.now()+3600000 };
  }
}
export default { async fetch(request: Request, env: Env) {
 const url=new URL(request.url); let result: Response;
 if(request.method==='OPTIONS') return new Response(null,{headers:{'Access-Control-Allow-Origin':request.headers.get('Origin')??'http://localhost:5174','Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}});
 if(url.pathname==='/ticket') {
  const body=await request.json<{token:string;fileId:string;generation:number}>();
  const stub=env.ROOMS.get(env.ROOMS.idFromName(`${body.fileId}:${body.generation}`));
  result=await stub.fetch(new Request('https://room/ticket',{method:'POST',body:JSON.stringify(body)}));
 } else if(url.pathname==='/v1/bootstrap') {
  result=Response.json({workspaces:[{id:'10000000-0000-4000-8000-000000000001',name:'Test workspace',owner_id:'00000000-0000-4000-8000-000000000001'}],projects:[{id:'20000000-0000-4000-8000-000000000001',workspace_id:'10000000-0000-4000-8000-000000000001',name:'Progetto di test',role:'owner'}]});
 } else if(/^\/v1\/projects\/.*\/files$/.test(url.pathname)) {
  result=Response.json([{id:'30000000-0000-4000-8000-000000000001',project_id:'20000000-0000-4000-8000-000000000001',workspace_id:'10000000-0000-4000-8000-000000000001',name:'idee.md',kind:'text',parent_id:null,generation:1,language:'markdown',metadata_version:1,status:'ready'}]);
 } else if(/^\/v1\/files\/.*\/collaboration-ticket$/.test(url.pathname)) {
  const fileId=url.pathname.split('/')[3];const stub=env.ROOMS.get(env.ROOMS.idFromName(`${fileId}:1`));
  result=await stub.fetch(new Request('https://room/ticket',{method:'POST',body:JSON.stringify({fileId,generation:1,token:'editor'})}));
 } else if(url.pathname.startsWith('/ws/')) {
  const [, , fileId, generation]=url.pathname.split('/');
  return env.ROOMS.get(env.ROOMS.idFromName(`${fileId}:${generation}`)).fetch(new Request('https://room/ws',{headers:request.headers}));
 } else result=new Response('test only');
 result=new Response(result.body,result);result.headers.set('Access-Control-Allow-Origin',request.headers.get('Origin')??'http://localhost:5174');result.headers.set('Access-Control-Allow-Headers','Content-Type,Authorization');result.headers.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');return result;
} };
