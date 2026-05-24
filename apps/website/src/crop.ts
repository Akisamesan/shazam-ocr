import type { CropConfig } from "./wizard.ts";
import { loadCropConfig } from "./wizard.ts";

/** iPhone 15 Pro のデフォルト値（フォールバック） */
const DEFAULT_CROP: CropConfig = {
  topRatio: 0.035,
  heightRatio: 0.105,
  leftRatio: 0.27,
  widthRatio: 0.46,
};

const SCALE = 2;

export function cropBanner(image: HTMLImageElement): HTMLCanvasElement {
  const config = loadCropConfig() ?? DEFAULT_CROP;

  const sx = Math.round(image.naturalWidth * config.leftRatio);
  const sy = Math.round(image.naturalHeight * config.topRatio);
  const sw = Math.round(image.naturalWidth * config.widthRatio);
  const sh = Math.round(image.naturalHeight * config.heightRatio);
  const dw = sw * SCALE;
  const dh = sh * SCALE;

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
