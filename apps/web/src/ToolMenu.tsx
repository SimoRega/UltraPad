import {useEffect,useRef,useState,type ReactNode} from 'react';
export default function ToolMenu({label,children,open:controlled,onToggle,className=''}:{label:string;children:ReactNode;open?:boolean;onToggle?:(value:boolean)=>void;className?:string}){
 const [local,setLocal]=useState(false);const open=controlled??local;const host=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);
 const change=(value:boolean)=>{setLocal(value);onToggle?.(value);};
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!host.current?.contains(e.target as Node))change(false);};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();change(false);trigger.current?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[open]);
 return <div ref={host} className={`tool-menu ${className}`}><button ref={trigger} type="button" aria-label={label} aria-expanded={open} onClick={()=>change(!open)}>{label} <span aria-hidden="true">⌄</span></button>{open&&<div className="tool-popover" role="region" aria-label={label}>{children}</div>}</div>;
}
