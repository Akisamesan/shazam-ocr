import { createWorker, PSM } from "tesseract.js";

export type OcrProgress = (status: string, progress: number) => void;

type Worker = Awaited<ReturnType<typeof createWorker>>;

let workerPromise: Promise<Worker> | null = null;
let activeLogger: OcrProgress | null = null;

function ensureWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker(["jpn", "eng"], 1, {
      logger: (m) => activeLogger?.(m.status, m.progress),
    }).then(async (w) => {
      await w.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: "1",
      });
      return w;
    });
  }
  return workerPromise;
}

export async function ocrCanvas(
  canvas: HTMLCanvasElement,
  onProgress?: OcrProgress,
): Promise<string> {
  activeLogger = onProgress ?? null;
  try {
    const worker = await ensureWorker();
    const { data } = await worker.recognize(canvas);
    return data.text;
  } finally {
    activeLogger = null;
  }
}
