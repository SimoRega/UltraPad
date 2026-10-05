import { createCipheriv, randomBytes, createDecipheriv } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { gzipSync, gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
const key = Buffer.from(process.env.BACKUP_KEY_HEX ?? '', 'hex');
if (key.length!==32) throw new Error('BACKUP_KEY_HEX deve contenere 32 bytes hex. Conservare fuori dal provider e dai backup.');
if (process.argv[2]==='decrypt') {
 const source=await readFile(process.argv[3]);
 if(source.subarray(0,8).toString()!=='UPBK0001') throw new Error('Formato sconosciuto');
 const decipher=createDecipheriv('aes-256-gcm',key,source.subarray(8,20));decipher.setAuthTag(source.subarray(20,36));
 const data=JSON.parse(gunzipSync(Buffer.concat([decipher.update(source.subarray(36)),decipher.final()])).toString());
 const destination=resolve(process.argv[4] ?? 'backups/restored');await mkdir(destination,{recursive:true});
 await writeFile(resolve(destination,'metadata.dump'),Buffer.from(data.postgres,'base64'));
 await writeFile(resolve(destination,'documents.json'),JSON.stringify(data.documents));
 console.log(`Backup verificato e decifrato in ${destination}. Consultare docs/RUNBOOK.md prima del restore.`);process.exit(0);
}
const { DATABASE_URL, BACKUP_API_URL, BACKUP_USER_TOKEN }=process.env;
if(!DATABASE_URL || !BACKUP_API_URL || !BACKUP_USER_TOKEN) throw new Error('Richiesti DATABASE_URL, BACKUP_API_URL, BACKUP_USER_TOKEN. Il token deve appartenere a un owner con tutti i workspace da salvare.');
const dump=spawnSync('pg_dump',['--format=custom','--no-owner','--no-acl'],{env:{...process.env,PGDATABASE:DATABASE_URL},maxBuffer:128*1024*1024});
if(dump.status!==0) throw new Error('pg_dump fallito. Controllare connettività e versione senza stampare le credenziali.');
async function get(path){const response=await fetch(`${BACKUP_API_URL}/v1${path}`,{headers:{Authorization:`Bearer ${BACKUP_USER_TOKEN}`}});if(!response.ok)throw new Error(`Backup HTTP fallito ${response.status}`);return response.json();}
const bootstrap=await get('/bootstrap');const documents=[];
for(const project of bootstrap.projects){
 for(const file of await get(`/projects/${project.id}/files`)){
  if(file.kind==='text') {
    const checkpoints=await get(`/files/${file.id}/checkpoints`);
    for(const cp of checkpoints){const response=await fetch(`${BACKUP_API_URL}/v1/files/${file.id}/checkpoints/${cp.id}/raw`,{headers:{Authorization:`Bearer ${BACKUP_USER_TOKEN}`}});if(!response.ok)throw new Error('Checkpoint backup failed');cp.bytes=Buffer.from(await response.arrayBuffer()).toString('base64');}
    documents.push({file,snapshot:await get(`/files/${file.id}/snapshot`),checkpoints});
   }
 }
}
const nonce=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key,nonce);
const encrypted=Buffer.concat([cipher.update(gzipSync(JSON.stringify({format:1,createdAt:new Date().toISOString(),postgres:dump.stdout.toString('base64'),documents}))),cipher.final()]);
await mkdir('backups',{recursive:true});const target=`backups/${new Date().toISOString().replace(/[:.]/g,'-')}.upbk`;
await writeFile(target,Buffer.concat([Buffer.from('UPBK0001'),nonce,cipher.getAuthTag(),encrypted]),{mode:0o600});
console.log(`Backup creato: ${target}, ${documents.length} documenti. Trasferire in storage indipendente. Include checkpoint correnti e pubblicati. Consultare il runbook per il restore.`);
