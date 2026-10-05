import { createClient } from '@supabase/supabase-js';
import type { Env } from '../../api/src/db';
export async function publishCheckpoint(env: Env, checkpoint: { id: string; fileId: string; generation: number; seq: number; bytes: Uint8Array; hash: string; label: string }) {
  if (!env.CHECKPOINT_SERVICE_ROLE) throw new Error('CHECKPOINT_BACKUP_NOT_CONFIGURED');
  // This privileged client is exclusively used by trusted room backup jobs, never by ordinary API CRUD.
  const db=createClient(env.SUPABASE_URL,env.CHECKPOINT_SERVICE_ROLE,{auth:{persistSession:false,autoRefreshToken:false}});
  const reservation=await db.rpc('reserve_checkpoint_bytes',{fid:checkpoint.fileId,cid:checkpoint.id,n:checkpoint.bytes.length});
  if(reservation.error)throw new Error('CHECKPOINT_QUOTA');
  const path=`${checkpoint.fileId}/${checkpoint.generation}/${checkpoint.id}.yjs`;
  const {error}=await db.storage.from('ultrapad-checkpoints').upload(path,checkpoint.bytes.slice().buffer,{contentType:'application/octet-stream',upsert:false});
  if(error && !/already exists|Duplicate/i.test(error.message)) throw new Error('CHECKPOINT_UPLOAD_FAILED');
  const pointer=await db.from('document_checkpoints').upsert({id:checkpoint.id,file_id:checkpoint.fileId,generation:checkpoint.generation,server_seq:checkpoint.seq,storage_key:path,checksum:checkpoint.hash,label:checkpoint.label,size_bytes:checkpoint.bytes.length},{onConflict:'id',ignoreDuplicates:true});
  if(pointer.error) throw new Error('CHECKPOINT_POINTER_FAILED');
  if(checkpoint.label==='Automatico'){
    const older=await db.from('document_checkpoints').select('id,storage_key').eq('file_id',checkpoint.fileId).eq('label','Automatico').order('created_at',{ascending:false}).range(20,1000);
    for(const row of older.data??[]){
      const removed=await db.storage.from('ultrapad-checkpoints').remove([row.storage_key]);
      if(removed.error)continue;
      await db.from('document_checkpoints').delete().eq('id',row.id);
      await db.from('resource_reservations').delete().eq('file_id',checkpoint.fileId).eq('kind','checkpoint').eq('resource_id',row.id);
    }
  }
}
