const loopback=new Set(['localhost','127.0.0.1','[::1]']);
export function apiEndpoint(value: string, origin: string, development: boolean) {
  const url=new URL(value,origin);
  if(!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('URL API non valido');
  if(development && loopback.has(url.hostname)) return `${origin}/api`;
  return url.href.replace(/\/$/,'');
}
export function developmentTarget(value: string) {
  const url=new URL(value);
  if(!loopback.has(url.hostname) || !['http:','https:'].includes(url.protocol) || url.username || url.password) return null;
  // Wrangler is pinned to IPv4 locally; do not depend on Windows localhost/IPv6 ordering.
  url.hostname='127.0.0.1';return url.href.replace(/\/$/,'');
}
export function websocketEndpoint(base: string, fileId: string, generation: number) {
  const url=new URL(`${base.replace(/\/$/,'')}/ws/${fileId}/${generation}`);
  url.protocol=url.protocol==='https:'?'wss:':'ws:';return url;
}
