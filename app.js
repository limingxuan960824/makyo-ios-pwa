import { readRomMetadata } from "./rom-utils.js";

const DB_NAME = "makyo-toitsusen-local";
const STORE_NAME = "roms";
const ROM_KEY = "active";
const CORE_DATA_URL = "https://cdn.emulatorjs.org/stable/data/";

const importView = document.querySelector("#import-view");
const playerView = document.querySelector("#player-view");
const fileInput = document.querySelector("#rom-file");
const chooseButton = document.querySelector("#choose-rom");
const replaceButton = document.querySelector("#replace-rom");
const fullscreenButton = document.querySelector("#fullscreen");
const toolbar = document.querySelector("#toolbar");
const status = document.querySelector("#status");

let dbPromise;
let activeObjectUrl;
let emulatorStarted = false;

function setStatus(message, kind = "") {
  status.textContent = message;
  if (kind) status.dataset.kind = kind;
  else delete status.dataset.kind;
}

function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

async function getStoredRom() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(ROM_KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function storeRom(file, metadata) {
  const db = await openDatabase();
  const record = {
    id: ROM_KEY,
    blob: file,
    name: file.name,
    size: file.size,
    metadata,
    savedAt: Date.now(),
  };

  await new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  return record;
}

async function inspectRom(file) {
  const header = await file.slice(0, 512).arrayBuffer();
  return readRomMetadata(header, file.size);
}

function loadEmulatorScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${CORE_DATA_URL}loader.js`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("模拟核心载入失败"));
    document.body.appendChild(script);
  });
}

async function launchRom(record) {
  if (emulatorStarted) return;
  emulatorStarted = true;

  importView.hidden = true;
  playerView.hidden = false;
  toolbar.hidden = false;
  document.body.dataset.mode = "playing";

  activeObjectUrl = URL.createObjectURL(record.blob);
  window.EJS_player = "#game";
  window.EJS_core = "segaMD";
  window.EJS_gameUrl = activeObjectUrl;
  window.EJS_gameName = "幽游白书 魔强统一战";
  window.EJS_pathtodata = CORE_DATA_URL;
  window.EJS_startOnLoaded = true;
  window.EJS_color = "#e63f36";
  window.EJS_backgroundColor = "#000000";

  try {
    await loadEmulatorScript();
  } catch (error) {
    emulatorStarted = false;
    playerView.hidden = true;
    toolbar.hidden = true;
    importView.hidden = false;
    setStatus("模拟核心载入失败，请联网后重试", "error");
    chooseButton.textContent = "重试";
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

async function handleFile(file) {
  if (!file) return;
  chooseButton.disabled = true;
  setStatus("正在校验 ROM");

  try {
    const metadata = await inspectRom(file);
    if (!metadata.valid) {
      setStatus(metadata.reason, "error");
      return;
    }

    setStatus("ROM 已保存到本机", "ok");
    const record = await storeRom(file, metadata);
    await navigator.storage?.persist?.();

    if (emulatorStarted) {
      location.reload();
      return;
    }

    await launchRom(record);
  } catch (error) {
    console.error(error);
    setStatus("无法读取 ROM，请重新选择", "error");
  } finally {
    chooseButton.disabled = false;
    fileInput.value = "";
  }
}

chooseButton.addEventListener("click", async () => {
  const stored = await getStoredRom().catch(() => null);
  if (stored && chooseButton.textContent === "重试") {
    await launchRom(stored);
    return;
  }
  fileInput.click();
});

replaceButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => handleFile(fileInput.files?.[0]));

fullscreenButton.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
      await screen.orientation?.lock?.("landscape");
    }
  } catch (error) {
    console.info("Fullscreen is managed by iOS standalone mode.", error);
  }
});

window.addEventListener("beforeunload", () => {
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
});

async function boot() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(console.error);
  }

  try {
    const stored = await getStoredRom();
    if (stored?.blob) {
      setStatus("已读取本机 ROM", "ok");
      await launchRom(stored);
    }
  } catch (error) {
    console.error(error);
    setStatus("本机存储不可用，请重新打开", "error");
  }
}

boot();
