import JSZip from 'jszip';
import * as Y from 'yjs';
import { limits, sha256, validateName } from '../../../packages/domain/src/index';
import type { FileRecord } from '../../../packages/contracts/src/index';
import { validateRichDelta, documentFile, richHtml, type RichOp } from '../../../packages/rich-text/src/index';
import { request } from './api';
export function download(name: string, content: BlobPart, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export async function decodeText(file: File): Promise<string> {
  if (file.size > limits.text || /\.(docx?|rtf|pdf|png|jpe?g|zip|exe)$/i.test(file.name)) throw new Error('Importazione disponibile per file testuali fino a 1 MiB. Office e allegati sono in una milestone successiva.');
  const bytes = new Uint8Array(await file.arrayBuffer()); let encoding = 'utf-8'; let skip = 0;
  if (bytes[0] === 255 && bytes[1] === 254) { encoding = 'utf-16le'; skip = 2; }
  if (bytes[0] === 254 && bytes[1] === 255) { encoding = 'utf-16be'; skip = 2; }
  const value = new TextDecoder(encoding, { fatal: true }).decode(bytes.subarray(skip));
  if (value.includes('\0')) throw new Error('Il file sembra binario.');
  return value.replace(/\r\n?/g, '\n');
}
export async function decodeImport(file:File):Promise<{name:string;text:string;delta?:RichOp[]}> {
  if(!file.name.endsWith('.ultrapad.json'))return {name:validateName(file.name),text:await decodeText(file)};
  if(file.size>limits.state)throw new Error('Documento UltraPad troppo grande.');
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()));
  if(value?.format!=='ultrapad-document'||value.version!==1||typeof value.name!=='string')throw new Error('Documento UltraPad non valido.');
  const delta=validateRichDelta(value.delta);const doc=new Y.Doc();doc.getText('content').applyDelta(delta);const size=Y.encodeStateAsUpdate(doc).length;doc.destroy();if(size>limits.state)throw new Error('QUOTA');
  return {name:validateName(value.name),text:delta.map(op=>op.insert).join(''),delta};
}
export async function exportProject(projectId: string, files: FileRecord[]) {
  const zip = new JSZip();
  const byId = new Map(files.map(f => [f.id, f]));
  function path(f: FileRecord, visited = new Set<string>()): string {
    if (visited.has(f.id)) throw new Error('Albero non valido'); visited.add(f.id);
    return f.parent_id && byId.has(f.parent_id) ? `${path(byId.get(f.parent_id)!, visited)}/${f.name}` : f.name;
  }
  const manifest = { format: 'ultrapad-project', version: 2, snapshotMode: 'per-file-cut', projectId, createdAt: new Date().toISOString(), files: [] as unknown[] };
  for (const file of files) {
    const name = `files/${path(file)}`;
    if (file.kind === 'folder') { zip.folder(name); continue; }
    const snapshot = await request<{ text: string;delta?:RichOp[]; generation: number; serverSeq: number }>(`/files/${file.id}/snapshot`);
    const bytes = new TextEncoder().encode(snapshot.text);
    zip.file(name, bytes);
    const documents=[];if(snapshot.delta?.some(op=>Object.keys(op.attributes??{}).length)){for(const [suffix,content] of [['ultrapad.json',documentFile(file.name,snapshot.delta)],['html',richHtml(snapshot.delta,file.name)]]){const documentPath=`documents/${path(file)}.${suffix}`;const documentBytes=new TextEncoder().encode(content);zip.file(documentPath,documentBytes);documents.push({path:documentPath,sha256:await sha256(documentBytes)});}}
    manifest.files.push({ id: file.id, path: name, kind: file.kind, generation: snapshot.generation, serverSeq: snapshot.serverSeq, sha256: await sha256(bytes), documents });
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('README.txt', 'Export dei sorgenti UltraPad. Taglio per file, acquisito in istanti diversi. Non include ACL o cronologia completa. File UTF-8, newline LF. TXT senza stili; documents/ contiene HTML e documenti UltraPad reimportabili con stili.');
  download('ultrapad-project.zip', await zip.generateAsync({ type: 'arraybuffer' }), 'application/zip');
}
export async function exportLocal(copies: { fileId: string; generation: number; state: Uint8Array; pending: unknown[] }[]) {
  const zip = new JSZip();
  for (const copy of copies) {
    const doc = new Y.Doc(); Y.applyUpdate(doc, copy.state);
    zip.file(`${copy.fileId}-g${copy.generation}.txt`, doc.getText('content').toString());
    zip.file(`${copy.fileId}-g${copy.generation}.ultrapad.json`,documentFile(`${copy.fileId}.txt`,validateRichDelta(doc.getText('content').toDelta())));
    zip.file(`${copy.fileId}-g${copy.generation}.yjs`, copy.state); doc.destroy();
  }
  download('ultrapad-recupero-locale.zip', await zip.generateAsync({ type: 'arraybuffer' }), 'application/zip');
}
