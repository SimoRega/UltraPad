export type Profile = { id: string; firstName: string; lastName: string; avatar: string };
export function safeAvatar(value: unknown): string {
 if(typeof value!=='string'||value.length>1800)return '';
 if(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value))return value;
 try { const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''; } catch{return '';}
}
export function profileFor(id:string,email:string|undefined,metadata:Record<string,unknown>={}):Profile {
 const words=(email?.split('@')[0]??'').split(/[._-]+/).filter(Boolean).map(w=>w.charAt(0).toUpperCase()+w.slice(1));
 const field=(key:string,fallback:string)=>typeof metadata[key]==='string'?(metadata[key] as string).slice(0,80):fallback;
 return {id,firstName:field('first_name',words[0]??'Utente'),lastName:field('last_name',words.slice(1).join(' ')),avatar:safeAvatar(metadata.profile_avatar??metadata.avatar_url)};
}
