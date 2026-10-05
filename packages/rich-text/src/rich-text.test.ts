import { describe,it,expect } from 'vitest';
import * as Y from 'yjs';
import { validateRichDelta,validAttributes,richHtml,documentFile, type RichOp } from './index';
import { candidate } from '../../domain/src/index';
describe('rich document schema and portable exports',()=>{
 it('accepts supported typography and rejects executable or unbounded attributes',()=>{
  expect(validAttributes({bold:true,font:'Times New Roman',size:'24pt',color:'#123456',background:'#fff2b3',script:'super',header:2,align:'justify',list:'ordered',indent:8,lineHeight:'2',spaceBefore:'48pt',paragraphBorder:'bottom',paragraphBackground:'#eeeeee',firstLineIndent:'12pt',listMarker:'square'})).toBe(true);
  for(const attrs of [{link:'javascript:alert(1)'},{font:'url(evil)'},{size:'100pt'},{indent:9},{spaceAfter:'-1pt'},{color:'red;background:url(x)'},{onclick:'evil'},{bold:false}])expect(validAttributes(attrs)).toBe(false);
  expect(()=>validateRichDelta([{insert:{image:'https://evil.invalid'}}])).toThrow('SCHEMA');
  expect(()=>validateRichDelta([{insert:'x',attributes:{link:'javascript:x'}}])).toThrow('SCHEMA');
 });
 it('concurrent characters and styles converge within the accepted Y.Text schema',()=>{
  const seed=new Y.Doc();seed.getText('content').insert(0,'Hello\n');const a=new Y.Doc(),b=new Y.Doc();Y.applyUpdate(a,Y.encodeStateAsUpdate(seed));Y.applyUpdate(b,Y.encodeStateAsUpdate(seed));
  a.getText('content').format(0,5,{bold:true,size:'24pt'});b.getText('content').insert(5,' world');
  Y.applyUpdate(a,Y.encodeStateAsUpdate(b));Y.applyUpdate(b,Y.encodeStateAsUpdate(a));expect(a.getText('content').toDelta()).toEqual(b.getText('content').toDelta());
  const checked=candidate(seed,Y.encodeStateAsUpdate(a));expect(checked.getText('content').toDelta()[0].attributes).toEqual({bold:true,size:'24pt'});[seed,a,b,checked].forEach(d=>d.destroy());
 });
 it('native document round-trips all styles and HTML escapes both title and text',()=>{
  const delta:RichOp[]=[{insert:'<img src=x onerror=alert(1)>',attributes:{bold:true,font:'Arial',size:'18pt',script:'sub'}},{insert:'\n',attributes:{align:'center',paragraphBorder:'all',spaceAfter:'12pt'}}];
  const native=JSON.parse(documentFile('doc.txt',delta));expect(validateRichDelta(native.delta)).toEqual(delta);
  const html=richHtml(delta,'<script>alert(1)</script>');expect(html).toContain('&lt;img');expect(html).not.toContain('<script>');expect(html).toContain('text-align:center');expect(html).toContain('<sub>');expect(html).toContain('font-size:18pt');
 });
});
