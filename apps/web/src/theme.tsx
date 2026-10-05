import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
export type Theme = {mode:'light'|'dark';accent:string;background:'solid'|'glass'|'abstract'};
export const pastelColors=['#b7acf4','#a9c9ee','#a5d9ca','#f0c6a1','#e9bad4','#bfc9d7'];
const previous=['#7c6aef','#1769d2','#00836b','#b84e13','#bd347c','#64748b'];
const defaults:Theme={mode:'dark',accent:pastelColors[0],background:'solid'};
const Context=createContext({theme:defaults,setTheme:(_theme:Theme)=>{}});
export function contrastText(hex:string) {
 const channels=hex.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722>.179?'#111111':'#ffffff';
}
function stored():Theme {try{const v=JSON.parse(localStorage.getItem('ultrapad-appearance')??'null');if(v && ['light','dark'].includes(v.mode) && /^#[\da-f]{6}$/i.test(v.accent))return {mode:v.mode,accent:pastelColors[previous.indexOf(v.accent)]??v.accent,background:['solid','glass','abstract'].includes(v.background)?v.background:'solid'};return defaults;}catch{return defaults;}}
export function ThemeProvider({children}:{children:ReactNode}) {
 const [theme,setTheme]=useState(stored);
 useEffect(()=>{document.documentElement.dataset.theme=theme.mode;document.documentElement.dataset.background=theme.background;document.documentElement.style.setProperty('--accent',theme.accent);document.documentElement.style.setProperty('--on-accent',contrastText(theme.accent));try{localStorage.setItem('ultrapad-appearance',JSON.stringify(theme));}catch{/* Theme remains usable without storage. */}},[theme]);
 return <Context.Provider value={{theme,setTheme}}>{children}</Context.Provider>;
}
export function useTheme(){return useContext(Context);}
export function Appearance(){const {theme,setTheme}=useTheme();return <div className="appearance"><p>Colori pastello e superfici morbide. Le preferenze restano su questo browser.</p><div className="segmented"><button aria-pressed={theme.mode==='light'} onClick={()=>setTheme({...theme,mode:'light'})}>☀ Bianco</button><button aria-pressed={theme.mode==='dark'} onClick={()=>setTheme({...theme,mode:'dark'})}>☾ Nero</button></div><label>Colore principale<input aria-label="Colore principale" type="color" value={theme.accent} onChange={e=>setTheme({...theme,accent:e.target.value})}/></label><div className="swatches">{pastelColors.map(color=><button key={color} aria-label={`Colore ${color}`} aria-pressed={theme.accent===color} style={{background:color}} onClick={()=>setTheme({...theme,accent:color})}/>)}</div><label>Sfondo<select aria-label="Sfondo" value={theme.background} onChange={e=>setTheme({...theme,background:e.target.value as Theme['background']})}><option value="solid">Uniforme</option><option value="glass">Gradient glass · animato</option><option value="abstract">Astratto · statico</option></select></label><div className={`background-preview ${theme.background}`} aria-hidden="true"/><p>Le animazioni si fermano quando il dispositivo richiede movimento ridotto.</p><button onClick={()=>setTheme(defaults)}>Ripristina aspetto</button></div>;}
