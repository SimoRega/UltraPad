import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { candidate, effectiveRole, validateName, limits } from './index';
import { pack, unpack, chunks, join, frameHeader } from '../../contracts/src/index';
describe('domain boundaries', () => {
  it('limits roles by workspace and requires an explicit project grant', () => {
    expect(effectiveRole('editor', 'admin')).toBe('editor'); expect(effectiveRole('viewer', 'editor')).toBe('viewer');
    expect(effectiveRole('editor', null)).toBe(null); expect(effectiveRole('owner', null)).toBe('owner'); expect(effectiveRole(null, 'owner')).toBe(null);
  });
  it('rejects paths and normalizes Unicode filenames', () => {
    for (const name of ['../secret', '/file', '..', '.', 'a\\b', 'a\0b', '']) expect(() => validateName(name)).toThrow();
    expect(validateName(' cafe\u0301.md ')).toBe('café.md');
  });
  it('converges with reordered and duplicate updates', () => {
    const a = new Y.Doc(), b = new Y.Doc(); const updates: Uint8Array[] = [];
    a.on('update', update => updates.push(update)); a.getText('content').insert(0,'α😀'); a.getText('content').insert(1,'世界');
    Y.applyUpdate(b,updates[1]); Y.applyUpdate(b,updates[0]); Y.applyUpdate(b,updates[1]);
    expect(b.getText('content').toString()).toBe(a.getText('content').toString()); a.destroy(); b.destroy();
  });
  it('rejects writes to other shared types, embeds, attributes and oversized text', () => {
    const base = new Y.Doc();
    const wrong = new Y.Doc(); wrong.getMap('permissions').set('role','owner'); expect(() => candidate(base,Y.encodeStateAsUpdate(wrong))).toThrow('SCHEMA');
    const embedded = new Y.Doc(); embedded.getText('content').insertEmbed(0,{ script:'bad' }); expect(() => candidate(base,Y.encodeStateAsUpdate(embedded))).toThrow('SCHEMA');
    const formatted = new Y.Doc(); formatted.getText('content').insert(0,'text',{ bold:true }); expect(() => candidate(base,Y.encodeStateAsUpdate(formatted))).toThrow('SCHEMA');
    const large = new Y.Doc(); large.getText('content').insert(0,'x'.repeat(limits.text+1)); expect(() => candidate(base,Y.encodeStateAsUpdate(large))).toThrow('QUOTA');
    expect(base.getText('content').toString()).toBe(''); [base,wrong,embedded,formatted,large].forEach(d=>d.destroy());
  });
});
describe('binary protocol', () => {
  it('reassembles state larger than the frame limit', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(60_000)); const payload = new Uint8Array(120_000); payload.set(bytes); payload.set(bytes,60_000);
    expect(join(chunks(payload))).toEqual(payload);
    const encoded = pack({type:'sync-state'}, chunks(payload)[0]); expect(unpack(encoded).payload).toEqual(chunks(payload)[0]);
  });
  it('rejects oversized/truncated frames and hidden viewer sync updates', () => {
    expect(()=>unpack(new ArrayBuffer(2))).toThrow(); expect(()=>unpack(new ArrayBuffer(limits.frame+1))).toThrow();
    expect(()=>frameHeader.parse({type:'sync-step2'})).toThrow();
  });
});
