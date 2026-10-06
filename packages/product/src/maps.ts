import { mapsQuery, webUrl } from "./travel";
function allowed(value: string) {
  const safe = webUrl(value);
  if (!safe) return false;
  const u = new URL(safe);
  return (
    ((u.hostname === "maps.app.goo.gl" || u.hostname === "goo.gl") &&
      /^\/(?:maps\/)?[a-zA-Z0-9_-]+\/?$/.test(u.pathname)) ||
    (/^(?:(?:www|maps)\.)?google\.(?:com|it|co\.jp|co\.uk|fr|de)$/.test(
      u.hostname,
    ) &&
      u.pathname.startsWith("/maps"))
  );
}
export async function resolveMapsLink(
  value: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  if (value.length > 2048 || !allowed(value)) throw Error("INVALID_MAPS_LINK");
  let current = value;
  for (let i = 0; i < 5; i++) {
    if (mapsQuery(current)) return current;
    const response = await fetcher(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "text/html" },
    });
    await response.body?.cancel();
    const location = response.headers.get("location");
    if (![301, 302, 303, 307, 308].includes(response.status) || !location)
      throw Error("MAPS_PREVIEW_UNAVAILABLE");
    const next = new URL(location, current).href;
    if (next.length > 4096 || !allowed(next))
      throw Error("INVALID_MAPS_REDIRECT");
    current = next;
  }
  throw Error("MAPS_PREVIEW_UNAVAILABLE");
}
