import { CollaborationClient } from '../../../packages/collaboration-client/src/index';
import type { Role } from '../../../packages/domain/src/index';
// This source is only served by tests/e2e/vite.config.ts. It is never included in the production build.
const args=new URLSearchParams(location.search);const fileId=args.get('fileId')!;const token=args.get('token')??'editor';const generation=Number(args.get('generation')??1);
const textarea=document.getElementById('content') as HTMLTextAreaElement;
const client=new CollaborationClient({userId:token,fileId,generation,role:(token==='viewer'?'viewer':'editor') as Role,apiUrl:'http://localhost:8788',ticket:async()=>{
 const result=await fetch('http://localhost:8788/ticket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,fileId,generation})});if(!result.ok)throw new Error('ACCESS_CHANGED');return result.json() as Promise<{ticket:string;generation:number}>;
},changed(status){document.getElementById('status')!.textContent=status;}});
Object.assign(window,{testClient:client});client.doc.on('update',()=>{textarea.value=client.text;});
textarea.disabled=token==='viewer';textarea.addEventListener('input',()=>client.doc.transact(()=>{const text=client.doc.getText('content');text.delete(0,text.length);text.insert(0,textarea.value);}));
await client.start();textarea.value=client.text;
