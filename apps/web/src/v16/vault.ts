const bytes = (s: string) => new TextEncoder().encode(s);
const b64 = (b: Uint8Array) =>
  btoa(Array.from(b, (c) => String.fromCharCode(c)).join(""));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function key(pass: string, salt: Uint8Array) {
  if (pass.length < 12)
    throw new Error("Usa una passphrase di almeno 12 caratteri.");
  const material = await crypto.subtle.importKey(
    "raw",
    bytes(pass),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt.slice().buffer,
      iterations: 310000,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptEntry(text: string, pass: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(pass, salt),
    bytes(text),
  );
  return JSON.stringify({
    format: "ultrapad-secret",
    v: 1,
    salt: b64(salt),
    iv: b64(iv),
    data: b64(new Uint8Array(cipher)),
  });
}
export async function decryptEntry(text: string, pass: string) {
  const v = JSON.parse(text);
  if (v.format !== "ultrapad-secret" || v.v !== 1)
    throw new Error("Formato segreto non valido");
  try {
    return new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: unb64(v.iv) },
        await key(pass, unb64(v.salt)),
        unb64(v.data),
      ),
    );
  } catch {
    throw new Error("Passphrase errata o contenuto danneggiato.");
  }
}
export function findEntries<T extends { title: string; body: string }>(
  rows: T[],
  query: string,
) {
  const stop = new Set([
    "il",
    "lo",
    "la",
    "i",
    "gli",
    "le",
    "un",
    "una",
    "di",
    "del",
    "della",
    "a",
    "da",
    "in",
    "con",
    "per",
    "che",
    "dove",
    "come",
    "qual",
    "quale",
    "è",
    "ho",
    "mi",
    "trova",
    "cerca",
    "dei",
    "delle",
    "su",
    "e",
  ]);
  const terms = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((x) => x && !stop.has(x));
  return rows
    .map((r) => {
      const title = r.title
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, ""),
        body = r.body
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
      return {
        row: r,
        score: terms.reduce(
          (s, t) => s + (title.includes(t) ? 3 : body.includes(t) ? 1 : 0),
          0,
        ),
      };
    })
    .filter((r) => !terms.length || r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.row);
}
