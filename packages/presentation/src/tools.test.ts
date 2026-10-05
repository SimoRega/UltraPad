import { expect, it } from 'vitest';
import { insertion, toolsFor, topicFor } from './tools';
it('offers distinct tools for all thirteen supported text formats and safe fallback',()=>{
 const extensions=['txt','md','json','xml','html','css','js','ts','java','cs','py','tex','bib'];
 expect(new Set(extensions.map(ext=>toolsFor(`file.${ext}`).label)).size).toBe(13);
 for(const ext of extensions)expect(toolsFor(`file.${ext}`).tools.length).toBeGreaterThan(1);
 expect(toolsFor('file.JSON').validate).toBe('json');expect(toolsFor('file.xml').validate).toBe('xml');
 expect(toolsFor('file.unknown').label).toBe('Testo semplice');
});
it('wraps selections without losing text and groups by explicit theme before format',()=>{
 const bold=toolsFor('notes.md').tools.find(t=>t.label==='Grassetto')!;
 expect(insertion(bold,'collaborativo')).toBe('**collaborativo**');expect(insertion(bold,'')).toBe('**testo**');
 expect(topicFor({name:'notes.md',theme:'Ricerca'},'Progetto')).toBe('Ricerca');
 expect(topicFor({name:'notes.md'},'Progetto')).toBe('Progetto');
 expect(topicFor({name:'paper.tex'})).toBe('Tesi e ricerca');
});
