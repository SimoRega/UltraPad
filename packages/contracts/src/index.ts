import { z } from 'zod';
import { limits, roles } from '../../domain/src/index';
export const id = z.uuid();
export const roleSchema = z.enum(roles);
export const frameHeader = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hello'), protocol: z.literal(1), ticket: z.string().min(30).max(100) }),
  z.object({ type: z.literal('refresh-auth'), ticket: z.string().min(30).max(100) }),
  z.object({ type: z.literal('sync-request') }),
  z.object({ type: z.literal('update'), updateId: id, generation: z.number().int().positive(), part: z.number().int().min(0).max(171), total: z.number().int().min(1).max(171) }),
  z.object({ type: z.literal('awareness') })
]);
export type Header = { type: string; [key: string]: unknown };
export function pack(header: Header, payload: Uint8Array = new Uint8Array()): ArrayBuffer {
  const json = new TextEncoder().encode(JSON.stringify(header));
  const data = new Uint8Array(4 + json.length + payload.length);
  new DataView(data.buffer).setUint32(0, json.length); data.set(json, 4); data.set(payload, 4 + json.length); return data.buffer;
}
export function unpack(frame: ArrayBuffer, enforceLimit = true): { header: Header; payload: Uint8Array } {
  if (frame.byteLength < 4 || (enforceLimit && frame.byteLength > limits.frame)) throw new Error('FRAME_SIZE');
  const size = new DataView(frame).getUint32(0);
  if (size > 2048 || size + 4 > frame.byteLength) throw new Error('HEADER_SIZE');
  const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(frame, 4, size)));
  if (!parsed || typeof parsed !== 'object' || !('type' in parsed) || typeof parsed.type !== 'string') throw new Error('HEADER');
  return { header: parsed as Header, payload: new Uint8Array(frame, 4 + size) };
}
export function chunks(payload: Uint8Array): Uint8Array[] {
  if (payload.length > limits.state) throw new Error('QUOTA');
  const result: Uint8Array[] = [];
  for (let at = 0; at < payload.length; at += limits.chunk) result.push(payload.slice(at, at + limits.chunk));
  return result.length ? result : [new Uint8Array()];
}
export function join(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, p) => sum + p.length, 0);
  if (size > limits.state) throw new Error('QUOTA');
  const result = new Uint8Array(size); let at = 0;
  for (const p of parts) { result.set(p, at); at += p.length; } return result;
}
export type FileRecord = { id: string; project_id: string; workspace_id: string; parent_id: string | null; name: string; kind: 'text' | 'folder'; generation: number; language: string; metadata_version: number; status: string };
