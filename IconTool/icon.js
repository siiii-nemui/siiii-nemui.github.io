// IconTool/icon.js

// ---- 最小限のZIP(無圧縮/store)ビルダー ----
const ZIP_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = ZIP_CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() >> 1) & 0x1f);
  const dosDate =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0xf) << 5) |
    (date.getDate() & 0x1f);
  return { dosTime, dosDate };
}

// ファイル名をUTF-8として扱わせるための汎用フラグ (EFS: Language encoding flag)
const ZIP_UTF8_FLAG = 0x0800;

// files: [{ name: string, data: Uint8Array }]
function createZip(files) {
  const encoder = new TextEncoder();
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime(new Date());

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const data = file.data;
    const crc = crc32(data);
    const size = data.length;

    const localHeader = new DataView(new ArrayBuffer(30));
    localHeader.setUint32(0, 0x04034b50, true);
    localHeader.setUint16(4, 20, true);
    localHeader.setUint16(6, ZIP_UTF8_FLAG, true);
    localHeader.setUint16(8, 0, true);
    localHeader.setUint16(10, dosTime, true);
    localHeader.setUint16(12, dosDate, true);
    localHeader.setUint32(14, crc, true);
    localHeader.setUint32(18, size, true);
    localHeader.setUint32(22, size, true);
    localHeader.setUint16(26, nameBytes.length, true);
    localHeader.setUint16(28, 0, true);

    localChunks.push(new Uint8Array(localHeader.buffer), nameBytes, data);

    const centralHeader = new DataView(new ArrayBuffer(46));
    centralHeader.setUint32(0, 0x02014b50, true);
    centralHeader.setUint16(4, 20, true);
    centralHeader.setUint16(6, 20, true);
    centralHeader.setUint16(8, ZIP_UTF8_FLAG, true);
    centralHeader.setUint16(10, 0, true);
    centralHeader.setUint16(12, dosTime, true);
    centralHeader.setUint16(14, dosDate, true);
    centralHeader.setUint32(16, crc, true);
    centralHeader.setUint32(20, size, true);
    centralHeader.setUint32(24, size, true);
    centralHeader.setUint16(28, nameBytes.length, true);
    centralHeader.setUint16(30, 0, true);
    centralHeader.setUint16(32, 0, true);
    centralHeader.setUint16(34, 0, true);
    centralHeader.setUint16(36, 0, true);
    centralHeader.setUint32(38, 0, true);
    centralHeader.setUint32(42, offset, true);

    centralChunks.push(new Uint8Array(centralHeader.buffer), nameBytes);

    offset += localHeader.byteLength + nameBytes.length + size;
  });

  const centralSize = centralChunks.reduce((sum, c) => sum + c.length, 0);
  const centralOffset = offset;

  const endRecord = new DataView(new ArrayBuffer(22));
  endRecord.setUint32(0, 0x06054b50, true);
  endRecord.setUint16(4, 0, true);
  endRecord.setUint16(6, 0, true);
  endRecord.setUint16(8, files.length, true);
  endRecord.setUint16(10, files.length, true);
  endRecord.setUint32(12, centralSize, true);
  endRecord.setUint32(16, centralOffset, true);
  endRecord.setUint16(20, 0, true);

  return new Blob(
    [...localChunks, ...centralChunks, new Uint8Array(endRecord.buffer)],
    { type: "application/zip" },
  );
}

// ---- アイコン切り抜きエディタ本体 ----
class IconEditor {
  constructor() {
    this.images = []; // { id, file, name, url, img, naturalWidth, naturalHeight }
    this.currentId = null;
    this.minBoxPx = 20;
    // 読み込んだ全画像に共通で適用される、単一の切り抜き位置(元画像のピクセル座標)
    this.sharedCrop = null;

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.dropArea = document.getElementById("drop-area");
    this.emptyState = document.getElementById("empty-state");
    this.stageWrap = document.getElementById("stage-wrap");
    this.stageImg = document.getElementById("stage-img");
    this.cropBox = document.getElementById("crop-box");
    this.cropHandle = document.getElementById("crop-handle");
    this.stageHint = document.getElementById("stage-hint");

    this.fileInput = document.getElementById("file-input");
    this.fileInputAdd = document.getElementById("file-input-add");
    this.thumbList = document.getElementById("thumb-list");
    this.outputSizeDisplay = document.getElementById("output-size-display");
    this.exportBtn = document.getElementById("export-btn");
    this.statusText = document.getElementById("status-text");
  }

  get currentImage() {
    return this.images.find((it) => it.id === this.currentId) || null;
  }

  bindEvents() {
    this.fileInput.addEventListener("change", (e) => {
      this.handleFiles(e.target.files);
      e.target.value = "";
    });
    this.fileInputAdd.addEventListener("change", (e) => {
      this.handleFiles(e.target.files);
      e.target.value = "";
    });

    ["dragenter", "dragover"].forEach((evt) => {
      this.dropArea.addEventListener(evt, (e) => {
        e.preventDefault();
        this.dropArea.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach((evt) => {
      this.dropArea.addEventListener(evt, (e) => {
        e.preventDefault();
        this.dropArea.classList.remove("dragover");
      });
    });
    this.dropArea.addEventListener("drop", (e) => {
      if (e.dataTransfer && e.dataTransfer.files) {
        this.handleFiles(e.dataTransfer.files);
      }
    });

    // ウィンドウ全体へのドロップでブラウザが画像を開いてしまうのを防止
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", (e) => e.preventDefault());

    this.stageWrap.addEventListener("mousedown", (e) =>
      this.onStageMouseDown(e),
    );
    this.cropHandle.addEventListener("mousedown", (e) =>
      this.onHandleMouseDown(e),
    );
    this.stageWrap.addEventListener("wheel", (e) => this.onWheel(e), {
      passive: false,
    });

    window.addEventListener("resize", () => this.renderCropBox());

    this.exportBtn.addEventListener("click", () => this.exportAll());
  }

  // ---- 画像の読み込み・管理 ----
  handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length === 0) return;

    files.forEach((file) => {
      const id =
        (window.crypto && crypto.randomUUID && crypto.randomUUID()) ||
        `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const url = URL.createObjectURL(file);

      this.images.push({
        id,
        file,
        name: file.name,
        url,
        img: null,
        naturalWidth: 0,
        naturalHeight: 0,
      });

      if (!this.currentId) this.currentId = id;

      const loader = new Image();
      loader.onload = () => {
        const entry = this.images.find((it) => it.id === id);
        if (!entry) return; // 読み込み完了前に削除された場合
        entry.img = loader;
        entry.naturalWidth = loader.naturalWidth;
        entry.naturalHeight = loader.naturalHeight;
        // 最初の1枚を基準に、全画像共通の切り抜き位置を初期化する
        if (!this.sharedCrop) {
          this.sharedCrop = this.defaultCrop(
            loader.naturalWidth,
            loader.naturalHeight,
          );
        }
        if (this.currentId === id) this.selectImage(id);
        this.renderThumbList();
        this.updateExportState();
      };
      loader.src = url;
    });

    this.renderThumbList();
    this.updateExportState();
  }

  defaultCrop(naturalWidth, naturalHeight) {
    const size = Math.round(Math.min(naturalWidth, naturalHeight) * 0.35);
    const x = Math.round((naturalWidth - size) / 2);
    const y = Math.round(naturalHeight * 0.03);
    return { x, y, size };
  }

  selectImage(id) {
    const entry = this.images.find((it) => it.id === id);
    if (!entry) return;
    this.currentId = id;

    this.emptyState.style.display = "none";
    this.stageWrap.style.display = "block";
    this.stageHint.style.display = "block";
    this.stageImg.onload = () => this.renderCropBox();
    this.stageImg.src = entry.url;
    this.renderCropBox();

    this.renderThumbList();
  }

  removeImage(id) {
    const idx = this.images.findIndex((it) => it.id === id);
    if (idx === -1) return;
    const [removed] = this.images.splice(idx, 1);
    URL.revokeObjectURL(removed.url);

    if (this.currentId === id) {
      this.currentId = null;
      if (this.images.length > 0) {
        const next = this.images[Math.max(0, idx - 1)];
        this.selectImage(next.id);
      } else {
        this.sharedCrop = null;
        this.showEmptyState();
      }
    }

    this.renderThumbList();
    this.updateExportState();
  }

  showEmptyState() {
    this.emptyState.style.display = "";
    this.stageWrap.style.display = "none";
    this.stageHint.style.display = "none";
    this.stageImg.removeAttribute("src");
  }

  renderThumbList() {
    this.thumbList.innerHTML = "";
    this.images.forEach((entry) => {
      const li = document.createElement("li");
      li.className =
        "icon-thumb-item" + (entry.id === this.currentId ? " active" : "");
      li.addEventListener("click", () => this.selectImage(entry.id));

      const thumb = document.createElement("img");
      thumb.className = "icon-thumb-thumb";
      thumb.src = entry.url;
      thumb.alt = entry.name;

      const name = document.createElement("span");
      name.className = "icon-thumb-name";
      name.textContent = entry.name;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "icon-thumb-remove";
      removeBtn.textContent = "×";
      removeBtn.setAttribute("aria-label", `${entry.name} を削除`);
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.removeImage(entry.id);
      });

      li.append(thumb, name, removeBtn);
      this.thumbList.appendChild(li);
    });
  }

  updateExportState() {
    this.exportBtn.disabled = this.images.length === 0;
  }

  // ---- 切り抜き枠の描画・操作 ----
  renderCropBox() {
    this.updateOutputSizeDisplay();
    const entry = this.currentImage;
    if (!entry || !this.sharedCrop || !this.stageImg.clientWidth) return;
    const scale = this.stageImg.clientWidth / entry.naturalWidth;
    const { x, y, size } = this.sharedCrop;
    this.cropBox.style.left = `${x * scale}px`;
    this.cropBox.style.top = `${y * scale}px`;
    this.cropBox.style.width = `${size * scale}px`;
    this.cropBox.style.height = `${size * scale}px`;
  }

  updateOutputSizeDisplay() {
    if (!this.sharedCrop) {
      this.outputSizeDisplay.textContent = "-";
      return;
    }
    const size = Math.round(this.sharedCrop.size);
    this.outputSizeDisplay.textContent = `${size} × ${size} px`;
  }

  commitBoxPx(leftPx, topPx, sizePx) {
    const entry = this.currentImage;
    if (!entry) return;
    const scale = this.stageImg.clientWidth / entry.naturalWidth;
    if (!scale) return;

    let natSize = sizePx / scale;
    const maxNatSize = Math.min(entry.naturalWidth, entry.naturalHeight);
    natSize = Math.max(this.minBoxPx / scale, Math.min(natSize, maxNatSize));

    let natX = leftPx / scale;
    let natY = topPx / scale;
    natX = Math.max(0, Math.min(natX, entry.naturalWidth - natSize));
    natY = Math.max(0, Math.min(natY, entry.naturalHeight - natSize));

    // 現在表示中の画像を基準に調整するが、この位置は全画像に共通で適用される
    this.sharedCrop = { x: natX, y: natY, size: natSize };
    this.renderCropBox();
  }

  onStageMouseDown(e) {
    if (e.target === this.cropHandle) return;
    if (!this.currentImage) return;
    e.preventDefault();

    const stageRect = this.stageWrap.getBoundingClientRect();
    const boxRect = this.cropBox.getBoundingClientRect();
    const size = boxRect.width;
    let startLeft = boxRect.left - stageRect.left;
    let startTop = boxRect.top - stageRect.top;

    // 枠の外をクリックした場合は、クリック位置を中心に枠を即座に移動する
    const clickX = e.clientX - stageRect.left;
    const clickY = e.clientY - stageRect.top;
    const insideBox =
      clickX >= startLeft &&
      clickX <= startLeft + size &&
      clickY >= startTop &&
      clickY <= startTop + size;
    if (!insideBox) {
      startLeft = Math.max(
        0,
        Math.min(clickX - size / 2, this.stageImg.clientWidth - size),
      );
      startTop = Math.max(
        0,
        Math.min(clickY - size / 2, this.stageImg.clientHeight - size),
      );
      this.cropBox.style.left = `${startLeft}px`;
      this.cropBox.style.top = `${startTop}px`;
    }

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - startMouseX;
      const dy = moveEvent.clientY - startMouseY;
      const newLeft = Math.max(
        0,
        Math.min(startLeft + dx, this.stageImg.clientWidth - size),
      );
      const newTop = Math.max(
        0,
        Math.min(startTop + dy, this.stageImg.clientHeight - size),
      );
      this.cropBox.style.left = `${newLeft}px`;
      this.cropBox.style.top = `${newTop}px`;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      this.commitBoxPx(
        parseFloat(this.cropBox.style.left),
        parseFloat(this.cropBox.style.top),
        size,
      );
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  onHandleMouseDown(e) {
    if (!this.currentImage) return;
    e.preventDefault();
    e.stopPropagation();

    const stageRect = this.stageWrap.getBoundingClientRect();
    const boxRect = this.cropBox.getBoundingClientRect();
    const left = boxRect.left - stageRect.left;
    const top = boxRect.top - stageRect.top;
    const startSize = boxRect.width;
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const maxSize = Math.min(
      this.stageImg.clientWidth - left,
      this.stageImg.clientHeight - top,
    );

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - startMouseX;
      const dy = moveEvent.clientY - startMouseY;
      const delta = (dx + dy) / 2;
      const newSize = Math.max(
        this.minBoxPx,
        Math.min(startSize + delta, maxSize),
      );
      this.cropBox.style.width = `${newSize}px`;
      this.cropBox.style.height = `${newSize}px`;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      this.commitBoxPx(left, top, parseFloat(this.cropBox.style.width));
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  onWheel(e) {
    if (!this.currentImage) return;
    e.preventDefault();

    const stageRect = this.stageWrap.getBoundingClientRect();
    const boxRect = this.cropBox.getBoundingClientRect();
    const left = boxRect.left - stageRect.left;
    const top = boxRect.top - stageRect.top;
    const size = boxRect.width;
    const centerX = left + size / 2;
    const centerY = top + size / 2;

    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const maxPossible = Math.min(
      this.stageImg.clientWidth,
      this.stageImg.clientHeight,
    );
    const newSize = Math.max(
      this.minBoxPx,
      Math.min(size * factor, maxPossible),
    );

    let newLeft = centerX - newSize / 2;
    let newTop = centerY - newSize / 2;
    newLeft = Math.max(
      0,
      Math.min(newLeft, this.stageImg.clientWidth - newSize),
    );
    newTop = Math.max(
      0,
      Math.min(newTop, this.stageImg.clientHeight - newSize),
    );

    this.commitBoxPx(newLeft, newTop, newSize);
  }

  // ---- 書き出し ----
  setStatus(text) {
    this.statusText.textContent = text;
  }

  // 共有の切り抜き位置を、対象画像のサイズに収まるようクランプする
  // (通常は同一サイズの画像セットを想定しているため、クランプが効くのは
  // サイズが異なる画像が混在する場合のみ)
  getSourceCropFor(entry) {
    const { x, y, size } = this.sharedCrop;
    const maxSize = Math.min(entry.naturalWidth, entry.naturalHeight);
    const clampedSize = Math.min(size, maxSize);
    const clampedX = Math.max(0, Math.min(x, entry.naturalWidth - clampedSize));
    const clampedY = Math.max(0, Math.min(y, entry.naturalHeight - clampedSize));
    return { x: clampedX, y: clampedY, size: clampedSize };
  }

  cropToBlob(entry, outputSize) {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const { x, y, size } = this.getSourceCropFor(entry);
      ctx.drawImage(entry.img, x, y, size, size, 0, 0, outputSize, outputSize);
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  uniqueFileName(originalName, usedNames) {
    const base = originalName.replace(/\.[^/.]+$/, "") || "icon";
    let name = `${base}_icon.png`;
    let counter = 2;
    while (usedNames.has(name)) {
      name = `${base}_icon_${counter}.png`;
      counter++;
    }
    usedNames.add(name);
    return name;
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async exportAll() {
    const ready = this.images.filter((it) => it.img);
    if (!this.sharedCrop || ready.length === 0) {
      this.setStatus("書き出せる画像がありません。");
      return;
    }

    this.exportBtn.disabled = true;
    const usedNames = new Set();
    const files = [];
    const outputSize = Math.round(this.sharedCrop.size);

    for (let i = 0; i < ready.length; i++) {
      const entry = ready[i];
      this.setStatus(`書き出し中... (${i + 1}/${ready.length})`);
      const blob = await this.cropToBlob(entry, outputSize);
      const buffer = await blob.arrayBuffer();
      files.push({
        name: this.uniqueFileName(entry.name, usedNames),
        data: new Uint8Array(buffer),
      });
    }

    const zipBlob = createZip(files);
    this.downloadBlob(zipBlob, "icons.zip");
    this.setStatus(
      `完了: ${files.length}件のPNGを icons.zip として保存しました。`,
    );
    this.exportBtn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new IconEditor();
});
