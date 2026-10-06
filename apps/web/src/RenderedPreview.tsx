import {LatexColors,previewColorMacros} from './v16/LatexColors';
import {useEffect,useState} from 'react';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
DOMPurify.addHook('uponSanitizeAttribute',(_node,attribute)=>{if(['src','href','xlink:href','poster','background'].includes(attribute.attrName)&&!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(attribute.attrValue)&&!attribute.attrValue.startsWith('#'))attribute.keepAttr=false;});
const markdown=new MarkdownIt({html:false,linkify:false,typographer:true});
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const policy="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'";
let latexStyles:Promise<string>|undefined;
function fontStyles(){return latexStyles??=Promise.all([import('../../../node_modules/latex.js/dist/css/base.css?inline'),import('../../../node_modules/latex.js/dist/css/article.css?inline'),import('../../../node_modules/latex.js/dist/css/katex.css?inline')]).then(async styles=>{let css=styles.map(s=>s.default).join('\n').replace(/\/\*[\s\S]*?\*\//g,'');const urls=[...new Set([...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m=>m[1]))];for(const path of urls){if(path.startsWith('data:'))continue;const url=new URL(path,window.location.href);if(url.origin!==window.location.origin||!url.pathname.match(/\.(woff2?|ttf|otf)$/))throw new Error('Font non disponibile');const response=await fetch(url);if(!response.ok)throw new Error('Font non disponibile');const blob=await response.blob();const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});css=css.split(path).join(data);}return css;}).catch(error=>{latexStyles=undefined;throw error;});}
export async function renderPreview(name:string,text:string){
 if(text.length>50000)throw new Error('Anteprima disponibile fino a 50.000 caratteri. Il sorgente resta modificabile e scaricabile.');
 let html=text;let css=':where(body){font:16px/1.6 system-ui;margin:24px;color:#20232a;background:white;overflow-wrap:anywhere}pre{white-space:pre-wrap}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px}';
 if(/\.md$/i.test(name))html=markdown.render(text);
 if(/\.tex$/i.test(name)){
  const {parse,HtmlGenerator}=await import('latex.js');
  const generator=parse(previewColorMacros(text),{generator:new HtmlGenerator({hyphenate:false,CustomMacros:LatexColors})});
  const container=document.createElement('div');container.appendChild(generator.domFragment());html=container.innerHTML;
  css+=await fontStyles();
 }
 const clean=DOMPurify.sanitize(html,{WHOLE_DOCUMENT:true,FORBID_TAGS:['script','iframe','object','embed','base','meta','link','form','input','button'],FORBID_ATTR:['srcset','action','formaction','target']});
 const doc=new DOMParser().parseFromString(clean,'text/html');
 const meta=doc.createElement('meta');meta.httpEquiv='Content-Security-Policy';meta.content=policy;doc.head.insertBefore(meta,doc.head.firstChild);
 const style=doc.createElement('style');style.textContent=css;doc.head.appendChild(style);
 return '<!doctype html>'+doc.documentElement.outerHTML;
}
export default function RenderedPreview({name,text}:{name:string;text:string}){
 const [result,setResult]=useState<{html:string;error:string}>({html:'',error:''});const [url,setUrl]=useState('');
 useEffect(()=>{let active=true;const timer=setTimeout(()=>{void renderPreview(name,text).then(html=>{if(active)setResult({html,error:''});}).catch(error=>{if(active)setResult({html:'',error:text.length>50000?'Anteprima disponibile fino a 50.000 caratteri.':'Anteprima non disponibile: '+String(error.message).slice(0,200)});});},300);return()=>{active=false;clearTimeout(timer);};},[name,text]);
 useEffect(()=>{if(!result.html){setUrl('');return;}const html=`<!doctype html><html><head><meta charset="utf-8"><title>${escape(name)} · Anteprima</title><meta name="referrer" content="no-referrer"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0}</style></head><body><iframe title="Anteprima" sandbox="" referrerpolicy="no-referrer" srcdoc="${escape(result.html)}"></iframe></body></html>`;const blob=URL.createObjectURL(new Blob([html],{type:'text/html'}));setUrl(blob);return()=>URL.revokeObjectURL(blob);},[name,result.html]);
 return <aside className="rendered-preview" aria-label="Anteprima renderizzata"><header><strong>Anteprima</strong>{url&&<a className="preview-page" href={url} target="_blank" rel="noopener noreferrer">Apri in un’altra pagina</a>}</header><p className="muted">{/\.tex$/i.test(name)?'LaTeX → HTML: pacchetti e impaginazione PDF non supportati.':'Script, risorse esterne e moduli disattivati.'} La nuova pagina è una copia dell’anteprima corrente.</p>{result.error?<p role="alert">{result.error}</p>:result.html?<iframe title={`Anteprima ${name}`} sandbox="" referrerPolicy="no-referrer" srcDoc={result.html}/>:<p>Preparazione anteprima…</p>}</aside>;
}
