export async function compressPhoto(source: File): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(source.type) ||
    source.size > 5 * 1024 * 1024
  )
    throw new Error("Scegli PNG, JPEG o WebP fino a 5 MiB.");
  const bitmap = await createImageBitmap(source);
  try {
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Conversione immagine non disponibile.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.65, 0.45, 0.25]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length <= 180000) return data;
    }
    throw new Error("Immagine troppo complessa: riduci la risoluzione.");
  } finally {
    bitmap.close();
  }
}
