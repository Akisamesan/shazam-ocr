export interface CropConfig {
  topRatio: number;
  leftRatio: number;
  widthRatio: number;
  heightRatio: number;
}

const STORAGE_KEY = "shazam-ocr-crop-config";

export function loadCropConfig(): CropConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.topRatio === "number" &&
      typeof parsed.leftRatio === "number" &&
      typeof parsed.widthRatio === "number" &&
      typeof parsed.heightRatio === "number"
    ) {
      return parsed as CropConfig;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveCropConfig(config: CropConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function showWizard(container: HTMLElement): Promise<CropConfig> {
  return new Promise((resolve) => {
    container.innerHTML = `
      <div class="wizard">
        <h2>初期設定: クロップ範囲の設定</h2>
        <p class="wizard-desc">
          Shazamの通知スクリーンショットを1枚アップロードし、曲名・アーティスト名が表示されている部分を矩形で囲んでください。<br>
          この設定はお使いのデバイスに保存され、次回以降のすべての画像に適用されます。
        </p>
        <label class="wizard-upload" id="wizard-upload">
          <input type="file" id="wizard-file" accept="image/*" hidden />
          <span>スクリーンショットを選択</span>
        </label>
        <div class="wizard-canvas-wrap" id="wizard-canvas-wrap" hidden>
          <canvas id="wizard-canvas"></canvas>
          <div class="wizard-overlay" id="wizard-overlay"></div>
        </div>
        <div class="wizard-actions" id="wizard-actions" hidden>
          <button type="button" id="wizard-reset">リセット</button>
          <button type="button" id="wizard-confirm" class="primary">この範囲で確定</button>
        </div>
      </div>
    `;

    const fileInput = container.querySelector<HTMLInputElement>("#wizard-file")!;
    const uploadLabel = container.querySelector<HTMLLabelElement>("#wizard-upload")!;
    const canvasWrap = container.querySelector<HTMLDivElement>("#wizard-canvas-wrap")!;
    const canvas = container.querySelector<HTMLCanvasElement>("#wizard-canvas")!;
    const overlay = container.querySelector<HTMLDivElement>("#wizard-overlay")!;
    const actions = container.querySelector<HTMLDivElement>("#wizard-actions")!;
    const resetBtn = container.querySelector<HTMLButtonElement>("#wizard-reset")!;
    const confirmBtn = container.querySelector<HTMLButtonElement>("#wizard-confirm")!;

    let displayWidth = 0;
    let displayHeight = 0;

    // Crop rect in ratio coordinates (0-1)
    let cropLeft = 0.27;
    let cropTop = 0.035;
    let cropWidth = 0.46;
    let cropHeight = 0.105;

    // Drag state
    let dragMode: "move" | "nw" | "ne" | "sw" | "se" | null = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartCropLeft = 0;
    let dragStartCropTop = 0;
    let dragStartCropWidth = 0;
    let dragStartCropHeight = 0;

    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        // Fit into container (max 600px wide)
        const maxW = Math.min(600, container.clientWidth - 32);
        const scale = maxW / img.naturalWidth;
        displayWidth = Math.round(img.naturalWidth * scale);
        displayHeight = Math.round(img.naturalHeight * scale);

        canvas.width = displayWidth;
        canvas.height = displayHeight;
        canvasWrap.style.width = `${displayWidth}px`;
        canvasWrap.style.height = `${displayHeight}px`;

        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

        uploadLabel.hidden = true;
        canvasWrap.hidden = false;
        actions.hidden = false;

        renderOverlay();
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });

    function renderOverlay(): void {
      const left = cropLeft * displayWidth;
      const top = cropTop * displayHeight;
      const width = cropWidth * displayWidth;
      const height = cropHeight * displayHeight;

      overlay.innerHTML = `
        <div class="crop-dim crop-dim-top" style="top:0;left:0;width:100%;height:${top}px;"></div>
        <div class="crop-dim crop-dim-bottom" style="top:${top + height}px;left:0;width:100%;height:${displayHeight - top - height}px;"></div>
        <div class="crop-dim crop-dim-left" style="top:${top}px;left:0;width:${left}px;height:${height}px;"></div>
        <div class="crop-dim crop-dim-right" style="top:${top}px;left:${left + width}px;width:${displayWidth - left - width}px;height:${height}px;"></div>
        <div class="crop-rect" style="top:${top}px;left:${left}px;width:${width}px;height:${height}px;">
          <div class="crop-handle nw"></div>
          <div class="crop-handle ne"></div>
          <div class="crop-handle sw"></div>
          <div class="crop-handle se"></div>
        </div>
      `;
    }

    function getPointerRatio(e: PointerEvent): { rx: number; ry: number } {
      const rect = canvasWrap.getBoundingClientRect();
      const rx = (e.clientX - rect.left) / displayWidth;
      const ry = (e.clientY - rect.top) / displayHeight;
      return { rx, ry };
    }

    overlay.addEventListener("pointerdown", (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      const { rx, ry } = getPointerRatio(e);

      dragStartX = rx;
      dragStartY = ry;
      dragStartCropLeft = cropLeft;
      dragStartCropTop = cropTop;
      dragStartCropWidth = cropWidth;
      dragStartCropHeight = cropHeight;

      if (target.classList.contains("nw")) {
        dragMode = "nw";
      } else if (target.classList.contains("ne")) {
        dragMode = "ne";
      } else if (target.classList.contains("sw")) {
        dragMode = "sw";
      } else if (target.classList.contains("se")) {
        dragMode = "se";
      } else if (target.classList.contains("crop-rect")) {
        dragMode = "move";
      } else {
        return;
      }

      e.preventDefault();
      overlay.setPointerCapture(e.pointerId);
    });

    overlay.addEventListener("pointermove", (e: PointerEvent) => {
      if (!dragMode) return;
      const { rx, ry } = getPointerRatio(e);
      const dx = rx - dragStartX;
      const dy = ry - dragStartY;

      const MIN_SIZE = 0.02;

      if (dragMode === "move") {
        cropLeft = clamp(dragStartCropLeft + dx, 0, 1 - cropWidth);
        cropTop = clamp(dragStartCropTop + dy, 0, 1 - cropHeight);
      } else if (dragMode === "se") {
        cropWidth = clamp(dragStartCropWidth + dx, MIN_SIZE, 1 - cropLeft);
        cropHeight = clamp(dragStartCropHeight + dy, MIN_SIZE, 1 - cropTop);
      } else if (dragMode === "sw") {
        const newLeft = clamp(
          dragStartCropLeft + dx,
          0,
          dragStartCropLeft + dragStartCropWidth - MIN_SIZE,
        );
        cropWidth = dragStartCropWidth - (newLeft - dragStartCropLeft);
        cropLeft = newLeft;
        cropHeight = clamp(dragStartCropHeight + dy, MIN_SIZE, 1 - cropTop);
      } else if (dragMode === "ne") {
        cropWidth = clamp(dragStartCropWidth + dx, MIN_SIZE, 1 - cropLeft);
        const newTop = clamp(
          dragStartCropTop + dy,
          0,
          dragStartCropTop + dragStartCropHeight - MIN_SIZE,
        );
        cropHeight = dragStartCropHeight - (newTop - dragStartCropTop);
        cropTop = newTop;
      } else if (dragMode === "nw") {
        const newLeft = clamp(
          dragStartCropLeft + dx,
          0,
          dragStartCropLeft + dragStartCropWidth - MIN_SIZE,
        );
        cropWidth = dragStartCropWidth - (newLeft - dragStartCropLeft);
        cropLeft = newLeft;
        const newTop = clamp(
          dragStartCropTop + dy,
          0,
          dragStartCropTop + dragStartCropHeight - MIN_SIZE,
        );
        cropHeight = dragStartCropHeight - (newTop - dragStartCropTop);
        cropTop = newTop;
      }

      renderOverlay();
    });

    overlay.addEventListener("pointerup", () => {
      dragMode = null;
    });

    resetBtn.addEventListener("click", () => {
      cropLeft = 0.27;
      cropTop = 0.035;
      cropWidth = 0.46;
      cropHeight = 0.105;
      renderOverlay();
    });

    confirmBtn.addEventListener("click", () => {
      const config: CropConfig = {
        topRatio: cropTop,
        leftRatio: cropLeft,
        widthRatio: cropWidth,
        heightRatio: cropHeight,
      };
      saveCropConfig(config);
      resolve(config);
    });
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
