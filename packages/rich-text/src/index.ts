export type Attributes=Record<string,string|number|boolean>;
export type RichOp={insert:string;attributes?:Attributes};
export const fonts=['Arial','Times New Roman','Calibri','Roboto','Georgia','Courier New'] as const;
export const inlineFormats=['bold','italic','underline','strike','font','size','color','background','script'];
export const blockFormats=['header','align','list','indent','lineHeight','spaceBefore','spaceAfter','paragraphBackground','paragraphBorder','firstLineIndent','listMarker'];
export const richFormats=[...inlineFormats,...blockFormats];
const color=/^#[0-9a-f]{6}$/i;
export function validAttributes(value:unknown):value is Attributes {
 if(!value || typeof value!=='object' || Array.isArray(value))return false;
 return Object.entries(value).every(([key,v])=>{
  if(['bold','italic','underline','strike'].includes(key))return v===true;
  if(['color','background','paragraphBackground'].includes(key))return typeof v==='string'&&color.test(v);
  if(key==='font')return typeof v==='string'&&(fonts as readonly string[]).includes(v);
  if(key==='size')return typeof v==='string'&&/^\d+pt$/.test(v)&&Number(v.slice(0,-2))>=8&&Number(v.slice(0,-2))<=96;
  if(key==='script')return v==='super'||v==='sub';
  if(key==='header')return typeof v==='number'&&[1,2,3,4].includes(v);
  if(key==='align')return ['center','right','justify'].includes(String(v))&&typeof v==='string';
  if(key==='list')return ['bullet','ordered','checked','unchecked'].includes(String(v))&&typeof v==='string';
  if(key==='indent')return typeof v==='number'&&Number.isInteger(v)&&v>=1&&v<=8;
  if(key==='lineHeight')return typeof v==='string'&&['1','1.15','1.5','2','2.5','3'].includes(v);
  if(['spaceBefore','spaceAfter','firstLineIndent'].includes(key))return typeof v==='string'&&/^\d+pt$/.test(v)&&Number(v.slice(0,-2))<=48;
  if(key==='listMarker')return v==='square'||v==='check';
  if(key==='paragraphBorder')return typeof v==='string'&&['all','top','bottom','left','right'].includes(v);
  return false;
 });
}
export function validateRichDelta(value:unknown):RichOp[] {
 if(!Array.isArray(value)||value.length>100000)throw new Error('SCHEMA');
 if(!value.every(op=>op&&typeof op==='object'&&typeof op.insert==='string'&&Object.keys(op).every(k=>k==='insert'||k==='attributes')&&(op.attributes===undefined||validAttributes(op.attributes))))throw new Error('SCHEMA');
 const rows=value as RichOp[];if(new TextEncoder().encode(rows.map(op=>op.insert).join('')).length>1024*1024)throw new Error('QUOTA');return rows;
}
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function richHtml(delta:RichOp[],title='Documento'):string {
 validateRichDelta(delta);let body='';let fragments='';let content='';let counters:number[]=[];
 function paragraph(attrs:Attributes={}) {
  const tag=attrs.header?`h${attrs.header}`:'p';const styles:string[]=[];
  if(attrs.align)styles.push(`text-align:${attrs.align}`);if(attrs.indent)styles.push(`margin-left:${Number(attrs.indent)*2}em`);
  if(attrs.lineHeight)styles.push(`line-height:${attrs.lineHeight}`);if(attrs.spaceBefore)styles.push(`margin-top:${attrs.spaceBefore}`);if(attrs.spaceAfter)styles.push(`margin-bottom:${attrs.spaceAfter}`);
  if(attrs.firstLineIndent)styles.push(`text-indent:${attrs.firstLineIndent}`);
  if(attrs.paragraphBackground)styles.push(`background-color:${attrs.paragraphBackground}`);
  if(attrs.paragraphBorder)styles.push(`border${attrs.paragraphBorder==='all'?'':'-'+attrs.paragraphBorder}:1px solid #64748b;padding:8px`);
  const level=Number(attrs.indent)||0;if(attrs.list==='ordered'){counters.length=level+1;counters[level]=(counters[level]||0)+1;}else counters=[];
  const marker=attrs.list==='ordered'?`${counters[level]}. `:attrs.list==='checked'?'☑ ':attrs.list==='unchecked'?'☐ ':attrs.list==='bullet'?(attrs.listMarker==='square'?'▪ ':attrs.listMarker==='check'?'✓ ':'• '):'';
  body+=`<${tag} style="${styles.join(';')}">${marker}${fragments||'<br>'}</${tag}>`;fragments='';content='';
 }
 for(const op of delta){const a=op.attributes??{};const segments=op.insert.split('\n');segments.forEach((segment,i)=>{
  if(segment){let span=escape(segment);if(a.bold)span=`<strong>${span}</strong>`;if(a.italic)span=`<em>${span}</em>`;if(a.underline)span=`<u>${span}</u>`;if(a.strike)span=`<s>${span}</s>`;if(a.script)span=`<${a.script==='super'?'sup':'sub'}>${span}</${a.script==='super'?'sup':'sub'}>`;
   const styles=[];if(a.font)styles.push(`font-family:'${a.font}'`);if(a.size)styles.push(`font-size:${a.size}`);if(a.color)styles.push(`color:${a.color}`);if(a.background)styles.push(`background-color:${a.background}`);
   fragments+=`<span style="${escape(styles.join(';'))}">${span}</span>`;content+=segment;
  }if(i<segments.length-1)paragraph(a);
 });}if(content||fragments)paragraph();
 return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(title)}</title><style>body{max-width:850px;margin:40px auto;padding:24px;font-family:Arial,sans-serif;color:#202430;white-space:pre-wrap}p{margin:0 0 8pt;min-height:1em}h1{font-size:32pt}h2{font-size:24pt}h3{font-size:20pt}h4{font-size:16pt}</style></head><body>${body}</body></html>`;
}
export function documentFile(name:string,delta:RichOp[]){validateRichDelta(delta);return JSON.stringify({format:'ultrapad-document',version:1,name,delta},null,2);}
