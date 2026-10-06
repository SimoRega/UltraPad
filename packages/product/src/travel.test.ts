import { it, expect } from "vitest";
import { mapsQuery, photoUrl, travelLinks, webUrl } from "./travel";
import { resolveMapsLink } from "./maps";
it("extracts cards/photos without interpreting unsafe links or generating script", () => {
  const cards = travelLinks(
    "# Viaggio\n[Hotel](https://example.com/hotel)\n![Foto](https://example.com/photo.jpg)\nhttps://example.com/hotel\nhttps://localhost/path\nhttps://127.0.0.1/test",
  );
  expect(cards).toHaveLength(1);
  expect(cards[0].title).toBe("Hotel");
  expect(cards[0].image).toBe("https://example.com/photo.jpg");
  expect(webUrl("javascript:alert(1)")).toBeUndefined();
  expect(photoUrl("data:image/svg+xml;base64,YQ==")).toBeUndefined();
  expect(mapsQuery("https://www.google.com/maps/place/Kyoto/@35,135,12z")).toBe(
    "Kyoto",
  );
  expect(mapsQuery("https://www.google.com/maps?query=35,135")).toBe("35,135");
  expect(mapsQuery("https://google.com.evil.org/maps?q=Kyoto")).toBeUndefined();
});
it("resolves only bounded Google Maps redirects and rejects an escape before fetching it", async () => {
  const called: string[] = [];
  const fetcher = (async (url: string | URL | Request) => {
    called.push(String(url));
    return new Response(null, {
      status: 302,
      headers: { location: "https://www.google.com/maps/place/Kyoto" },
    });
  }) as typeof fetch;
  expect(await resolveMapsLink("https://maps.app.goo.gl/abc123", fetcher)).toBe(
    "https://www.google.com/maps/place/Kyoto",
  );
  expect(called).toHaveLength(1);
  const malicious = (async () =>
    new Response(null, {
      status: 302,
      headers: { location: "https://127.0.0.1/admin" },
    })) as typeof fetch;
  await expect(
    resolveMapsLink("https://maps.app.goo.gl/abc", malicious),
  ).rejects.toThrow("INVALID_MAPS_REDIRECT");
  await expect(
    resolveMapsLink("https://evil.org/path", fetcher),
  ).rejects.toThrow("INVALID_MAPS_LINK");
});
