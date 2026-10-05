const loopback=new Set(['localhost','127.0.0.1','[::1]']);
export function configuredOrigin(value: string) {
  try { const url=new URL(value);return ['http:','https:'].includes(url.protocol) && !url.username && !url.password ? url.origin : ''; }
  catch { return ''; }
}
export function originAllowed(configured: string, received: string | undefined, requestUrl: string) {
  const expected=configuredOrigin(configured);
  if(!expected)return false;
  // CLI/server callers may omit Origin; all /v1 operations still require a verified JWT.
  if(!received)return true;
  if(received===expected)return true;
  try {
    const source=new URL(received);const app=new URL(expected);const target=new URL(requestUrl);
    return received===source.origin && target.protocol==='http:' && loopback.has(target.hostname)
      && source.protocol==='http:' && app.protocol==='http:' && source.port===app.port
      && loopback.has(source.hostname) && loopback.has(app.hostname);
  } catch {return false;}
}
