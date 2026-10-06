export function webUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.hostname === "localhost" ||
      !url.hostname.includes(".") ||
      /(?:^|\.)(?:local|localhost|internal|test|invalid)$/.test(url.hostname) ||
      /^[\d.]+$/.test(url.hostname) ||
      url.hostname.includes(":")
    )
      return;
    return url.href;
  } catch {
    return;
  }
}
export function photoUrl(value: string): string | undefined {
  if (
    /^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(value) &&
    value.length <= 180000
  )
    return value;
  return webUrl(value);
}
export function mapsQuery(value: string): string | undefined {
  const safe = webUrl(value);
  if (!safe) return;
  const url = new URL(safe);
  if (
    !/^(?:(?:www|maps)\.)?google\.(?:com|it|co\.jp|co\.uk|fr|de)$/.test(
      url.hostname,
    ) ||
    !(url.pathname.startsWith("/maps") || url.hostname.startsWith("maps."))
  )
    return;
  const point = url.pathname.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (point) return `${point[1]},${point[2]}`;
  const query =
    url.searchParams.get("query") ??
    url.searchParams.get("q") ??
    url.searchParams.get("destination");
  if (query) return query.slice(0, 300);
  const place = url.pathname.match(/\/place\/([^/]+)/);
  if (place) {
    try {
      return decodeURIComponent(place[1]).replace(/\+/g, " ").slice(0, 300);
    } catch {
      return;
    }
  }
  const center = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (center) return `${center[1]},${center[2]}`;
}
export type TravelLink = {
  url: string;
  title: string;
  image?: string;
  end: number;
};
export function travelLinks(text: string): TravelLink[] {
  const links: TravelLink[] = [];
  const seen = new Set<string>();
  let offset = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("![")) {
      const match = line.match(/^!\[[^\]]*\]\((.+)\)$/);
      if (match && links.length)
        links[links.length - 1].image = photoUrl(match[1]);
    } else {
      const markdown = line.match(/\[([^\]]+)\]\((https:\/\/[^\s]+)\)/);
      const matches = markdown
        ? [{ value: markdown[2], title: markdown[1] }]
        : Array.from(line.matchAll(/https:\/\/[^\s<>]+/g), (m) => ({
            value: m[0].replace(/[.,;!?]+$/, ""),
            title: "",
          }));
      for (const match of matches) {
        const url = webUrl(match.value);
        if (url && !seen.has(url) && links.length < 30) {
          links.push({
            url,
            title: match.title || new URL(url).hostname,
            end: offset + line.length,
          });
          seen.add(url);
        }
      }
    }
    offset += line.length + 1;
  }
  return links;
}
