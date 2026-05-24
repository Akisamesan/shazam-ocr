const CROP = {
  topRatio: 0.035,
  heightRatio: 0.105,
  leftRatio: 0.27,
  widthRatio: 0.46,
  scale: 2,
};

export function cropBanner(image: HTMLImageElement): HTMLCanvasElement {
  const sx = Math.round(image.naturalWidth * CROP.leftRatio);
  const sy = Math.round(image.naturalHeight * CROP.topRatio);
  const sw = Math.round(image.naturalWidth * CROP.widthRatio);
  const sh = Math.round(image.naturalHeight * CROP.heightRatio);
  const dw = sw * CROP.scale;
  const dh = sh * CROP.scale;

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh);
  return canvas;
}
