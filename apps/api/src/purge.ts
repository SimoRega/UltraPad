import { createClient } from "@supabase/supabase-js";
import { database, room, type Env } from "./db";
export async function purge(env: Env, token: string, root: string) {
  if (!env.CHECKPOINT_SERVICE_ROLE) throw Error("PURGE_STORAGE_NOT_CONFIGURED");
  const db = database(env, token);
  const { data: job, error } = await db.rpc("begin_purge", { root });
  if (error) throw Error(error.message);
  if (job.completed_at) return { ok: true };
  const admin = createClient(env.SUPABASE_URL, env.CHECKPOINT_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bucket = admin.storage.from("ultrapad-checkpoints");
  for (const f of job.manifest as { id: string; generation: number }[]) {
    // UUID comes exclusively from the locked DB manifest, never from a submitted path.
    for (let generation = 1; generation <= f.generation; generation++) {
      const response = await room(env, f.id, generation).fetch(
        "https://room/purge",
      );
      if (!response.ok) throw Error("PURGE_ROOM_FAILED");
    }
    const { data: folders, error } = await bucket.list(f.id, { limit: 1000 });
    if (error) throw Error("PURGE_LIST_FAILED");
    for (const folder of folders ?? []) {
      if (!/^\d+$/.test(folder.name)) throw Error("PURGE_UNEXPECTED_KEY");
      let offset = 0;
      const keys: string[] = [];
      for (;;) {
        const { data, error } = await bucket.list(`${f.id}/${folder.name}`, {
          limit: 100,
          offset,
        });
        if (error) throw Error("PURGE_LIST_FAILED");
        for (const entry of data ?? []) {
          if (!/^[a-f0-9-]+\.yjs$/i.test(entry.name))
            throw Error("PURGE_UNEXPECTED_KEY");
          keys.push(`${f.id}/${folder.name}/${entry.name}`);
        }
        if (!data || data.length < 100) break;
        offset += 100;
      }
      for (let at = 0; at < keys.length; at += 100) {
        const { error } = await bucket.remove(keys.slice(at, at + 100));
        if (error) throw Error("PURGE_OBJECT_FAILED");
      }
    }
  }
  const { error: finished } = await admin.rpc("finish_purge", { root });
  if (finished) throw Error("PURGE_FINALIZE_FAILED");
  return { ok: true };
}
