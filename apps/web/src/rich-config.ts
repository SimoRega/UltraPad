import Quill, { Parchment } from 'quill';
import QuillCursors from 'quill-cursors';
import { fonts } from '../../../packages/rich-text/src/index';
class FontStyle extends Parchment.StyleAttributor{value(node:HTMLElement){return super.value(node).replace(/["']/g,'');}}
Quill.register(new FontStyle('font','font-family',{scope:Parchment.Scope.INLINE,whitelist:[...fonts]}),true);
Quill.register(new Parchment.StyleAttributor('size','font-size',{scope:Parchment.Scope.INLINE,whitelist:Array.from({length:89},(_,i)=>`${i+8}pt`)}),true);
for(const [name,property,whitelist] of [
 ['lineHeight','line-height',['1','1.15','1.5','2','2.5','3']],
 ['spaceBefore','margin-top',Array.from({length:49},(_,i)=>`${i}pt`)],
 ['spaceAfter','margin-bottom',Array.from({length:49},(_,i)=>`${i}pt`)],
 ['firstLineIndent','text-indent',Array.from({length:49},(_,i)=>`${i}pt`)]
] as const)Quill.register(new Parchment.StyleAttributor(name,property,{scope:Parchment.Scope.BLOCK,whitelist:[...whitelist]}),true);
class BlockColor extends Parchment.StyleAttributor{value(node:HTMLElement){const value=String(super.value(node));const match=value.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);return match?'#'+match.slice(1).map(v=>Number(v).toString(16).padStart(2,'0')).join(''):value;}}
Quill.register(new BlockColor('paragraphBackground','background-color',{scope:Parchment.Scope.BLOCK}),true);
Quill.register(new Parchment.ClassAttributor('paragraphBorder','up-border',{scope:Parchment.Scope.BLOCK,whitelist:['all','top','bottom','left','right']}),true);
Quill.register(new Parchment.ClassAttributor('listMarker','up-list-marker',{scope:Parchment.Scope.BLOCK,whitelist:['square','check']}),true);
Quill.register('modules/cursors',QuillCursors,true);
export default Quill;
