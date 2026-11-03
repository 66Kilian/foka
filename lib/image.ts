'use client';
// Feltöltés előtt a böngésző átméretezi a képet: így a telefonról feltöltött 8 MB-os fotóból is
// gyorsan betöltődő kép lesz. Nagy: max 1800 px, kicsi: 480×480 középre vágva.

async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.82));
  if (webp && webp.type === 'image/webp') return webp;
  // Safari nem tud WebP-t kódolni → JPEG
  const jpg = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
  if (!jpg) throw new Error('A képet nem sikerült feldolgozni.');
  return jpg;
}

function draw(src: ImageBitmap, w: number, h: number, sx = 0, sy = 0, sw = src.width, sh = src.height) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('A böngésző nem tudja feldolgozni a képet.');
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  return c;
}

export async function prepareImage(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Ez nem kép. JPG, PNG, WebP vagy HEIC fájlt válassz.');
  if (file.size > 40_000_000) throw new Error('Túl nagy fájl (max. 40 MB).');
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Ezt a képformátumot a böngésző nem tudja megnyitni. Próbáld JPG-ként.');
  }
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const full = await encode(draw(bmp, Math.round(bmp.width * scale), Math.round(bmp.height * scale)));
  const side = Math.min(bmp.width, bmp.height);
  const t = Math.min(480, side);
  const thumb = await encode(draw(bmp, t, t, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side));
  bmp.close();
  return { full, thumb };
}
