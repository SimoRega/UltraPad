import FileIcon from './FileIcon';
export default function FileTab({name,active,select,close,disabled=false}:{name:string;active:boolean;select:()=>void;close:()=>void;disabled?:boolean}){
 return <span className={`file-tab ${active?'active':''}`}><button className="tab-select" title={name} aria-label={`Apri ${name}`} aria-current={active?'page':undefined} onClick={select} disabled={disabled}><FileIcon name={name}/><span className="tab-title">{name}</span></button><button className="tab-close" aria-label={`Chiudi ${name}`} disabled={disabled} onClick={close}>×</button></span>;
}
