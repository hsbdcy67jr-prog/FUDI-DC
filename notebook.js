(() => {
  const DB_NAME = "fudi-dc-notebook";
  const DB_VERSION = 1;
  const STORE_NAME = "pages";
  const FALLBACK_KEY = "fudi-dc-notebook-fallback-v1";
  let dbPromise;

  function openDatabase() {
    if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB is not available"));
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Could not open notebook storage"));
        request.onblocked = () => reject(new Error("Notebook storage is busy in another tab"));
      });
    }
    return dbPromise;
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Notebook storage failed"));
    });
  }

  async function readAllPages() {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, "readonly");
    return requestResult(tx.objectStore(STORE_NAME).getAll());
  }

  async function writePage(page) {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(page);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Could not save this page"));
      tx.onabort = () => reject(tx.error || new Error("Page save was cancelled"));
    });
  }

  async function removePage(id) {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Could not delete this page"));
      tx.onabort = () => reject(tx.error || new Error("Page deletion was cancelled"));
    });
  }

  function fallbackPages() {
    try { return JSON.parse(localStorage.getItem(FALLBACK_KEY) || "[]"); } catch { return []; }
  }

  function localId() {
    return window.crypto && crypto.randomUUID ? crypto.randomUUID() : `page-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function makePage(title = "Page 1") {
    return { id: localId(), title, createdAt: Date.now(), updatedAt: Date.now(), strokes: [] };
  }

  function safePageTitle(title) {
    const clean = String(title || "").replace(/[<>\r\n]/g, " ").trim().slice(0, 40);
    return clean || "Untitled page";
  }

  function makeCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    paintBackground(context, width, height, width, height);
    return { canvas, context };
  }

  function paintBackground(context, cssWidth, cssHeight, pixelWidth, pixelHeight) {
    context.save();
    context.setTransform(pixelWidth / cssWidth, 0, 0, pixelHeight / cssHeight, 0, 0);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, cssWidth, cssHeight);
    const gap = Math.max(24, Math.round(cssWidth / 36));
    context.strokeStyle = "#eff2ed";
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x <= cssWidth; x += gap) { context.moveTo(x, 0); context.lineTo(x, cssHeight); }
    for (let y = 0; y <= cssHeight; y += gap) { context.moveTo(0, y); context.lineTo(cssWidth, y); }
    context.stroke();
    context.restore();
  }

  function drawStroke(context, stroke, width, height) {
    const points = stroke.points || [];
    if (!points.length) return;
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    context.globalAlpha = stroke.tool === "highlighter" ? 0.25 : 1;
    context.strokeStyle = stroke.tool === "eraser" ? "#fff" : stroke.color;
    context.fillStyle = stroke.tool === "eraser" ? "#fff" : stroke.color;
    context.lineWidth = stroke.tool === "highlighter" ? stroke.width * 3 : (stroke.tool === "eraser" ? stroke.width * 4 : stroke.width);
    if (points.length === 1) {
      context.beginPath();
      context.arc(points[0].x * width, points[0].y * height, context.lineWidth / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.beginPath();
      context.moveTo(points[0].x * width, points[0].y * height);
      for (let index = 1; index < points.length; index += 1) context.lineTo(points[index].x * width, points[index].y * height);
      context.stroke();
    }
    context.restore();
  }

  function drawPage(context, page, width, height) {
    paintBackground(context, width, height, context.canvas.width, context.canvas.height);
    (page?.strokes || []).forEach(stroke => drawStroke(context, stroke, width, height));
  }

  function saveBlob(blob, filename) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function jpegBytes(dataUrl) {
    const binary = atob(dataUrl.split(",")[1]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function ascii(value) { return new TextEncoder().encode(value); }
  function joinBytes(chunks) {
    const size = chunks.reduce((total, part) => total + part.length, 0);
    const result = new Uint8Array(size);
    let offset = 0;
    chunks.forEach(part => { result.set(part, offset); offset += part.length; });
    return result;
  }

  function createPdf(images) {
    const objects = [];
    const pageRefs = images.map((_, index) => `${3 + index * 3} 0 R`).join(" ");
    objects[1] = ascii("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    objects[2] = ascii(`2 0 obj\n<< /Type /Pages /Kids [${pageRefs}] /Count ${images.length} >>\nendobj\n`);
    images.forEach((image, index) => {
      const pageId = 3 + index * 3;
      const imageId = pageId + 1;
      const contentsId = pageId + 2;
      const pageContent = ascii("q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n");
      objects[pageId] = ascii(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentsId} 0 R >>\nendobj\n`);
      objects[imageId] = joinBytes([
        ascii(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`),
        image.bytes,
        ascii("\nendstream\nendobj\n"),
      ]);
      objects[contentsId] = joinBytes([
        ascii(`${contentsId} 0 obj\n<< /Length ${pageContent.length} >>\nstream\n`),
        pageContent,
        ascii("endstream\nendobj\n"),
      ]);
    });
    const header = ascii("%PDF-1.4\n%FUDI notebook\n");
    const chunks = [header];
    const offsets = [0];
    let position = header.length;
    for (let id = 1; id < objects.length; id += 1) {
      offsets[id] = position;
      chunks.push(objects[id]);
      position += objects[id].length;
    }
    const xrefOffset = position;
    const xref = [
      `xref\n0 ${objects.length}\n`,
      "0000000000 65535 f \n",
      ...offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`),
      `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    ].join("");
    chunks.push(ascii(xref));
    return new Blob([joinBytes(chunks)], { type: "application/pdf" });
  }

  async function mount(root) {
    const canvas = root.querySelector("#notebook-canvas");
    const context = canvas.getContext("2d");
    const pagesElement = root.querySelector("#notebook-pages");
    const statusElement = root.querySelector("#notebook-save-status");
    const pageCountElement = root.querySelector("#notebook-page-count");
    let pages = [];
    let activePageId = "";
    try { activePageId = localStorage.getItem("fudi-dc-current-notebook-page") || ""; } catch { /* A blocked preference does not prevent notebook use. */ }
    let activeTool = "pen";
    let inkColor = "#34463b";
    let strokeWidth = 3;
    let currentStroke = null;
    let redoStack = [];
    let saveTimer;
    let fallbackMode = false;
    let cssWidth = 0;
    let cssHeight = 0;
    let disposed = false;

    function activePage() { return pages.find(page => page.id === activePageId); }

    function setStatus(text) {
      if (statusElement) statusElement.textContent = text;
    }

    async function persistNow() {
      if (disposed || !activePage()) return;
      activePage().updatedAt = Date.now();
      try {
        if (fallbackMode) {
          localStorage.setItem(FALLBACK_KEY, JSON.stringify(pages));
        } else {
          await Promise.all(pages.map(writePage));
        }
        setStatus("Saved on this device");
      } catch (error) {
        fallbackMode = true;
        try {
          localStorage.setItem(FALLBACK_KEY, JSON.stringify(pages));
          setStatus("Saved in browser storage");
        } catch {
          setStatus("Storage is full — export a copy");
          console.warn("FUDI notebook could not be saved", error);
        }
      }
    }

    function scheduleSave() {
      setStatus("Saving…");
      clearTimeout(saveTimer);
      saveTimer = setTimeout(persistNow, 300);
    }

    function resizeCanvas() {
      const rectangle = canvas.getBoundingClientRect();
      if (!rectangle.width || !rectangle.height) return;
      cssWidth = rectangle.width;
      cssHeight = rectangle.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssWidth * ratio);
      canvas.height = Math.round(cssHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawPage(context, activePage(), cssWidth, cssHeight);
    }

    function renderTabs() {
      pagesElement.innerHTML = pages.map(page => `<button class="page-tab ${page.id === activePageId ? "is-active" : ""}" role="tab" aria-selected="${page.id === activePageId}" data-page-id="${escapeHtml(page.id)}">${escapeHtml(page.title)}</button>`).join("");
      pageCountElement.textContent = `${pages.length} page${pages.length === 1 ? "" : "s"}`;
    }

    function showPage(id) {
      if (!pages.some(page => page.id === id)) return;
      activePageId = id;
      try { localStorage.setItem("fudi-dc-current-notebook-page", activePageId); } catch { /* Local preference is optional. */ }
      redoStack = [];
      renderTabs();
      resizeCanvas();
    }

    function pointFromEvent(event) {
      const rectangle = canvas.getBoundingClientRect();
      return { x: Math.max(0, Math.min(1, (event.clientX - rectangle.left) / rectangle.width)), y: Math.max(0, Math.min(1, (event.clientY - rectangle.top) / rectangle.height)) };
    }

    function drawSegment(stroke, from, to) {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.save();
      context.lineCap = "round";
      context.lineJoin = "round";
      context.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
      context.globalAlpha = stroke.tool === "highlighter" ? .25 : 1;
      context.strokeStyle = stroke.tool === "eraser" ? "#fff" : stroke.color;
      context.fillStyle = stroke.tool === "eraser" ? "#fff" : stroke.color;
      context.lineWidth = stroke.tool === "highlighter" ? stroke.width * 3 : (stroke.tool === "eraser" ? stroke.width * 4 : stroke.width);
      if (!to) {
        context.beginPath();
        context.arc(from.x * cssWidth, from.y * cssHeight, context.lineWidth / 2, 0, Math.PI * 2);
        context.fill();
      } else {
        context.beginPath();
        context.moveTo(from.x * cssWidth, from.y * cssHeight);
        context.lineTo(to.x * cssWidth, to.y * cssHeight);
        context.stroke();
      }
      context.restore();
    }

    canvas.addEventListener("pointerdown", event => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      const point = pointFromEvent(event);
      currentStroke = { id: localId(), tool: activeTool, color: inkColor, width: strokeWidth, points: [point] };
      activePage().strokes.push(currentStroke);
      drawSegment(currentStroke, point, null);
    });

    canvas.addEventListener("pointermove", event => {
      if (!currentStroke) return;
      event.preventDefault();
      const next = pointFromEvent(event);
      const previous = currentStroke.points[currentStroke.points.length - 1];
      currentStroke.points.push(next);
      drawSegment(currentStroke, previous, next);
    });

    function finishStroke() {
      if (!currentStroke) return;
      currentStroke = null;
      redoStack = [];
      scheduleSave();
    }
    canvas.addEventListener("pointerup", finishStroke);
    canvas.addEventListener("pointercancel", finishStroke);
    canvas.addEventListener("lostpointercapture", finishStroke);

    pagesElement.addEventListener("click", event => {
      const button = event.target.closest("[data-page-id]");
      if (button) { finishStroke(); showPage(button.dataset.pageId); }
    });

    root.querySelectorAll("[data-tool]").forEach(button => button.addEventListener("click", () => {
      activeTool = button.dataset.tool;
      root.querySelectorAll("[data-tool]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
      canvas.classList.toggle("tool-eraser", activeTool === "eraser");
    }));

    root.querySelectorAll("[data-color]").forEach(button => button.addEventListener("click", () => {
      inkColor = button.dataset.color;
      root.querySelectorAll("[data-color]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
      root.querySelector("#custom-color").value = inkColor;
    }));
    root.querySelector("#custom-color").addEventListener("input", event => {
      inkColor = event.target.value;
      root.querySelectorAll("[data-color]").forEach(item => item.setAttribute("aria-pressed", "false"));
    });
    root.querySelector("#stroke-size").addEventListener("input", event => {
      strokeWidth = Number(event.target.value);
      root.querySelector("#width-sample").style.width = `${Math.max(4, strokeWidth)}px`;
      root.querySelector("#width-sample").style.height = `${Math.max(4, strokeWidth)}px`;
    });

    root.querySelector("#undo-stroke").addEventListener("click", () => {
      finishStroke();
      const page = activePage();
      if (!page?.strokes.length) return;
      redoStack.push(page.strokes.pop());
      resizeCanvas();
      scheduleSave();
    });
    root.querySelector("#redo-stroke").addEventListener("click", () => {
      finishStroke();
      const page = activePage();
      const stroke = redoStack.pop();
      if (!stroke || !page) return;
      page.strokes.push(stroke);
      resizeCanvas();
      scheduleSave();
    });

    root.querySelector("#add-notebook-page").addEventListener("click", async () => {
      finishStroke();
      await persistNow();
      const nextNumber = pages.length + 1;
      const page = makePage(`Page ${nextNumber}`);
      pages.push(page);
      activePageId = page.id;
      redoStack = [];
      renderTabs();
      resizeCanvas();
      scheduleSave();
    });
    root.querySelector("#rename-notebook-page").addEventListener("click", async () => {
      const page = activePage();
      if (!page) return;
      const proposed = window.prompt("Name this page", page.title);
      if (proposed === null) return;
      page.title = safePageTitle(proposed);
      renderTabs();
      await persistNow();
    });
    root.querySelector("#delete-notebook-page").addEventListener("click", async () => {
      const page = activePage();
      if (!page || !window.confirm(`Delete “${page.title}”? This removes the drawing from this browser.`)) return;
      finishStroke();
      if (pages.length === 1) {
        page.strokes = [];
        page.title = "Page 1";
        redoStack = [];
        resizeCanvas();
        renderTabs();
        await persistNow();
        return;
      }
      const oldId = page.id;
      pages = pages.filter(item => item.id !== oldId);
      try { if (!fallbackMode) await removePage(oldId); } catch { fallbackMode = true; }
      activePageId = pages[0].id;
      redoStack = [];
      renderTabs();
      resizeCanvas();
      await persistNow();
    });

    root.querySelector("#export-notebook-png").addEventListener("click", () => {
      const page = activePage();
      if (!page) return;
      const { canvas: exportCanvas, context: exportContext } = makeCanvas(1400, 1800);
      drawPage(exportContext, page, 1400, 1800);
      exportCanvas.toBlob(blob => saveBlob(blob, `${slugify(page.title)}.png`), "image/png");
    });
    root.querySelector("#export-notebook-pdf").addEventListener("click", async () => {
      finishStroke();
      await persistNow();
      setStatus("Preparing PDF…");
      const images = pages.map(page => {
        const { canvas: exportCanvas, context: exportContext } = makeCanvas(1200, 1697);
        drawPage(exportContext, page, 1200, 1697);
        return { width: exportCanvas.width, height: exportCanvas.height, bytes: jpegBytes(exportCanvas.toDataURL("image/jpeg", .88)) };
      });
      saveBlob(createPdf(images), "fudi-notebook.pdf");
      setStatus("Saved on this device");
    });

    let observer;
    if ("ResizeObserver" in window) {
      observer = new ResizeObserver(resizeCanvas);
      observer.observe(canvas);
    } else window.addEventListener("resize", resizeCanvas);

    try {
      pages = await readAllPages();
    } catch {
      fallbackMode = true;
      pages = fallbackPages();
    }
    if (!pages.length) pages = [makePage("Page 1")];
    pages.sort((left, right) => left.createdAt - right.createdAt);
    if (!pages.some(page => page.id === activePageId)) activePageId = pages[0].id;
    renderTabs();
    requestAnimationFrame(resizeCanvas);
    try { localStorage.setItem("fudi-dc-current-notebook-page", activePageId); } catch { /* Optional. */ }
    if (fallbackMode) setStatus("Saved in browser storage");
    else setStatus("Saved on this device");

    return () => {
      disposed = true;
      clearTimeout(saveTimer);
      observer?.disconnect();
    };
  }

  function slugify(value) {
    return String(value || "page").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  window.FudiNotebook = { mount };
})();
