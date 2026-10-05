import type { SupabaseClient } from '@supabase/supabase-js';
import { room, type Env } from './db';
import { sha256 } from '../../../packages/domain/src/index';
export async function checkpointBytes(env: Env, db: SupabaseClient, fileId: string, generation: number, checkpointId: string): Promise<Uint8Array> {
 const {data: pointer,error}=await db.from('document_checkpoints').select('*').eq('file_id',fileId).eq('id',checkpointId).maybeSingle();
 if(error) throw new Error('CHECKPOINT_METADATA_ERROR');
 if(pointer){
  const {data,error}=await db.storage.from('ultrapad-checkpoints').download(pointer.storage_key);
  if(error || !data)throw new Error('CHECKPOINT_DOWNLOAD_FAILED');
  const bytes=new Uint8Array(await data.arrayBuffer());if(await sha256(bytes)!==pointer.checksum)throw new Error('CHECKPOINT_CHECKSUM');return bytes;
 }
 const stored=await room(env,fileId,generation).fetch(`https://room/checkpoints/${checkpointId}`);
 if(!stored.ok)throw new Error('CHECKPOINT_NOT_FOUND');return new Uint8Array(await stored.arrayBuffer());
}
