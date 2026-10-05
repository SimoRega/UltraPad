import * as Y from 'yjs';
export const roles = ['viewer', 'commenter', 'editor', 'admin', 'owner'] as const;
export type Role = typeof roles[number];
export const canEdit = (r: Role) => roles.indexOf(r) >= 2;
export const canAdmin = (r: Role) => roles.indexOf(r) >= 3;
export function effectiveRole(workspace: Role | null, project: Role | null): Role | null {
  if (!workspace) return null;
  if (canAdmin(workspace)) return workspace;
  return project ? roles[Math.min(roles.indexOf(workspace), roles.indexOf(project))] : null;
}
export const limits = { text: 1024 * 1024, state: 8 * 1024 * 1024, frame: 64 * 1024, chunk: 48 * 1024, files: 500, editors: 10 };
export function validateName(name: string): string {
  const result = name.normalize('NFC').trim();
  if (!result || result.length > 120 || /[\\/\x00-\x1f]/.test(result) || result === '.' || result === '..') throw new Error('Nome non valido');
  return result;
}
const languages: Record<string, string> = { md: 'markdown', json: 'json', xml: 'xml', html: 'html', css: 'css', js: 'javascript', ts: 'typescript', java: 'java', cs: 'csharp', py: 'python', tex: 'plaintext', bib: 'plaintext', txt: 'plaintext' };
export function languageFor(name: string): string { return languages[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'plaintext'; }
export function candidate(current: Y.Doc, update: Uint8Array): Y.Doc {
  const next = new Y.Doc();
  try {
    Y.applyUpdate(next, Y.encodeStateAsUpdate(current)); Y.applyUpdate(next, update);
    const text = next.getText('content');
    if ([...next.share.keys()].some(k => k !== 'content')) throw new Error('SCHEMA');
    if (text.toDelta().some((d: { insert?: unknown; attributes?: Record<string, unknown> }) => typeof d.insert !== 'string' || (d.attributes && Object.keys(d.attributes).length))) throw new Error('SCHEMA');
    if (new TextEncoder().encode(text.toString()).byteLength > limits.text || Y.encodeStateAsUpdate(next).byteLength > limits.state) throw new Error('QUOTA');
    return next;
  } catch (e) { next.destroy(); throw e; }
}
export async function sha256(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice().buffer))].map(b => b.toString(16).padStart(2, '0')).join('');
}
