import "./style.css";
import { cropBanner } from "./crop.ts";
import { ocrCanvas } from "./ocr.ts";
import { parseShazamBanner } from "./parser.ts";
import {
  spotifySearchUrl,
  appleMusicSearchUrl,
  tsutayaDiscasSearchUrl,
  geoRentalSearchUrl,
} from "./services.ts";
import { buildCsv, downloadCsv } from "./csv.ts";
import { loadCropConfig, showWizard } from "./wizard.ts";

interface Entry {
  id: string;
  filename: string;
  title: string;
  artist: string;
  status: "processing" | "done" | "error";
  thumbnailUrl: string;
  bannerUrl: string;
}

const entries: Entry[] = [];
let nextId = 0;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app not found");

// Check if crop config exists; if not, show wizard first
if (!loadCropConfig()) {
  void runWizardThenMain();
} else {
  initMainUI();
}

async function runWizardThenMain(): Promise<void> {
  await showWizard(app!);
  initMainUI();
}

function initMainUI(): void {
  app!.innerHTML = `
    <header>
      <h1>Shazam OCR → CSV</h1>
      <p>iPhoneのShazam通知スクショを投げ込むと、曲名とアーティストを抽出してCSVにします。誤認識は手動で直せます。</p>
    </header>
    <main>
      <label class="dropzone" id="dropzone">
        <input type="file" id="file-input" accept="image/*" multiple hidden />
        <span>クリックで選択 / 画像をドラッグ&amp;ドロップ / ペースト</span>
      </label>
      <div id="entries"></div>
      <footer>
        <button id="reconfigure" type="button">クロップ範囲を再設定</button>
        <button id="clear" type="button" disabled>クリア</button>
        <button id="download" type="button" disabled>CSVダウンロード</button>
      </footer>
    </main>
  `;

  const fileInput = document.querySelector<HTMLInputElement>("#file-input");
  const dropzone = document.querySelector<HTMLLabelElement>("#dropzone");
  const entriesEl = document.querySelector<HTMLDivElement>("#entries");
  const downloadBtn = document.querySelector<HTMLButtonElement>("#download");
  const clearBtn = document.querySelector<HTMLButtonElement>("#clear");
  const reconfigureBtn = document.querySelector<HTMLButtonElement>("#reconfigure");
  if (!fileInput || !dropzone || !entriesEl || !downloadBtn || !clearBtn || !reconfigureBtn) {
    throw new Error("UI bootstrap failed");
  }

  reconfigureBtn.addEventListener("click", () => {
    void runWizardThenMain();
  });

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragging");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragging"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragging");
    if (e.dataTransfer?.files) void handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files) void handleFiles(fileInput.files);
    fileInput.value = "";
  });

  window.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) void handleFiles(files);
  });

  downloadBtn.addEventListener("click", () => {
    const rows = entries.map((e) => ({
      title: e.title,
      artist: e.artist,
      spotifyUrl: spotifySearchUrl(e.title, e.artist),
      appleMusicUrl: appleMusicSearchUrl(e.title, e.artist),
      tsutayaUrl: tsutayaDiscasSearchUrl(e.title, e.artist),
      geoUrl: geoRentalSearchUrl(e.title, e.artist),
    }));
    downloadCsv(`shazam-${formatDate()}.csv`, buildCsv(rows));
  });

  clearBtn.addEventListener("click", () => {
    for (const e of entries) URL.revokeObjectURL(e.thumbnailUrl);
    entries.length = 0;
    render();
  });

  async function handleFiles(files: FileList | File[]): Promise<void> {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    for (const file of list) {
      const id = `e${nextId++}`;
      const entry: Entry = {
        id,
        filename: file.name,
        title: "",
        artist: "",
        status: "processing",
        thumbnailUrl: URL.createObjectURL(file),
        bannerUrl: "",
      };
      entries.push(entry);
      render();

      try {
        const image = await loadImage(entry.thumbnailUrl);
        const banner = cropBanner(image);
        entry.bannerUrl = banner.toDataURL();
        const text = await ocrCanvas(banner, (status, p) => {
          const el = document.querySelector(`[data-progress="${id}"]`);
          if (el) el.textContent = `${status} ${Math.round(p * 100)}%`;
        });
        const parsed = parseShazamBanner(text);
        entry.title = parsed.title;
        entry.artist = parsed.artist;
        entry.status = "done";
      } catch (err) {
        console.error(err);
        entry.status = "error";
      }
      render();
    }
  }

  function entryRow(e: Entry): string {
    const spotify = spotifySearchUrl(e.title, e.artist);
    const appleMusic = appleMusicSearchUrl(e.title, e.artist);
    const tsutaya = tsutayaDiscasSearchUrl(e.title, e.artist);
    const geo = geoRentalSearchUrl(e.title, e.artist);

    const serviceLink = (url: string, label: string): string =>
      `<a href="${escapeAttr(url)}" class="service-link${url ? "" : " disabled"}">${label}</a>`;

    return `
      <tr class="entry" data-id="${e.id}">
        <td class="td-thumb">
          <img src="${e.thumbnailUrl}" alt="" class="thumb" />
          ${e.bannerUrl ? `<img src="${e.bannerUrl}" alt="" class="banner" />` : ""}
        </td>
        <td class="td-field">
          <input type="text" data-field="title" value="${escapeAttr(e.title)}" placeholder="曲名" />
          ${e.status === "processing" ? `<div class="progress" data-progress="${e.id}">処理中…</div>` : ""}
          ${e.status === "error" ? `<div class="error">読み取り失敗</div>` : ""}
          <div class="filename">${escapeText(e.filename)}</div>
        </td>
        <td class="td-field">
          <input type="text" data-field="artist" value="${escapeAttr(e.artist)}" placeholder="アーティスト" />
        </td>
        <td class="td-link">${serviceLink(spotify, "Spotify")}</td>
        <td class="td-link">${serviceLink(appleMusic, "Apple Music")}</td>
        <td class="td-link">${serviceLink(tsutaya, "TSUTAYA")}</td>
        <td class="td-link">${serviceLink(geo, "GEO")}</td>
        <td class="td-remove">
          <button type="button" class="remove" data-remove="${e.id}" aria-label="削除">×</button>
        </td>
      </tr>
    `;
  }

  function refreshServiceLinks(tr: HTMLTableRowElement, entry: Entry): void {
    const urls = [
      spotifySearchUrl(entry.title, entry.artist),
      appleMusicSearchUrl(entry.title, entry.artist),
      tsutayaDiscasSearchUrl(entry.title, entry.artist),
      geoRentalSearchUrl(entry.title, entry.artist),
    ];
    tr.querySelectorAll<HTMLAnchorElement>("a.service-link").forEach((a, i) => {
      const url = urls[i] ?? "";
      a.href = url;
      a.classList.toggle("disabled", !url);
    });
  }

  function attachRowListeners(tr: HTMLTableRowElement): void {
    const id = tr.dataset["id"];
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    tr.querySelectorAll<HTMLInputElement>("input[data-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const field = input.dataset["field"];
        if (field === "title" || field === "artist") {
          entry[field] = input.value;
          refreshServiceLinks(tr, entry);
          updateButtons();
        }
      });
    });

    tr.querySelector<HTMLButtonElement>(".remove")?.addEventListener("click", () => {
      URL.revokeObjectURL(entry.thumbnailUrl);
      const idx = entries.indexOf(entry);
      if (idx >= 0) entries.splice(idx, 1);
      render();
    });

    tr.querySelectorAll<HTMLAnchorElement>("a.service-link").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const url = a.getAttribute("href");
        if (url)
          window.open(url, "_blank", "width=1024,height=768,resizable=yes,scrollbars=yes,noopener");
      });
    });
  }

  function render(): void {
    if (!entriesEl) return;
    if (entries.length === 0) {
      entriesEl.innerHTML = "";
      updateButtons();
      return;
    }

    entriesEl.innerHTML = `
      <div class="table-wrap">
        <table class="entries-table">
          <thead>
            <tr>
              <th></th>
              <th>曲名</th>
              <th>アーティスト</th>
              <th>Spotify</th>
              <th>Apple Music</th>
              <th>TSUTAYA</th>
              <th>GEO</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(entryRow).join("")}
          </tbody>
        </table>
      </div>
    `;

    for (const tr of entriesEl.querySelectorAll<HTMLTableRowElement>("tr.entry")) {
      attachRowListeners(tr);
    }
    updateButtons();
  }

  function updateButtons(): void {
    if (!downloadBtn || !clearBtn) return;
    const hasAny = entries.length > 0;
    const allDone = entries.every((e) => e.status !== "processing");
    downloadBtn.disabled = !(hasAny && allDone);
    clearBtn.disabled = !hasAny;
  }

  render();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function formatDate(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
