import { readRomMetadata } from "./rom-utils.js";

const DB_NAME = "makyo-toitsusen-local";
const STORE_NAME = "roms";
const ROM_KEY = "active";
const EMULATOR_DATA_URL = new URL("./vendor/emulatorjs/4.2.3/data/", location.href).href;
const EMULATOR_READY_TIMEOUT = 45_000;
const EMULATOR_START_TIMEOUT = 90_000;

const importView = document.querySelector("#import-view");
const playerView = document.querySelector("#player-view");
const fileInput = document.querySelector("#rom-file");
const chooseButton = document.querySelector("#choose-rom");
const replaceButton = document.querySelector("#replace-rom");
const fullscreenButton = document.querySelector("#fullscreen");
const toolbar = document.querySelector("#toolbar");
const status = document.querySelector("#status");
const game = document.querySelector("#game");
const playerOverlay = document.querySelector("#player-overlay");
const playerMessage = document.querySelector("#player-message");
const retryButton = document.querySelector("#retry-player");

let dbPromise;
let activeObjectUrl;
let emulatorStarted = false;
let emulatorReady = false;
let emulatorReadyTimer;
let emulatorStartTimer;
let emulatorErrorObserver;

function setStatus(message, kind = "") {
  status.textContent = message;
  if (kind) status.dataset.kind = kind;
  else delete status.dataset.kind;
}

function showPlayerMessage(message, kind = "loading") {
  playerMessage.textContent = message;
  playerOverlay.dataset.kind = kind;
  playerOverlay.hidden = false;
  retryButton.hidden = kind !== "error";
  playerView.setAttribute("aria-busy", kind === "loading" ? "true" : "false");
}

function hidePlayerMessage() {
  playerOverlay.hidden = true;
  playerView.setAttribute("aria-busy", "false");
}

function failEmulator(message, error) {
  clearTimeout(emulatorReadyTimer);
  clearTimeout(emulatorStartTimer);
  emulatorReady = false;
  playerView.dataset.state = "error";
  showPlayerMessage(message, "error");
  if (error) console.error(error);
}

function observeEmulatorErrors() {
  emulatorErrorObserver = new MutationObserver(() => {
    const errorText = game.querySelector(".ejs_error_text");
    if (!errorText) return;

    const detail = errorText.textContent?.trim();
    failEmulator(detail ? `启动失败：${detail}` : "游戏启动失败，请重新加载");
  });

  emulatorErrorObserver.observe(game, {
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
    subtree: true,
  });
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
    script.src = `${EMULATOR_DATA_URL}loader.js`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("模拟器组件载入失败"));
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
  playerView.dataset.state = "preparing";
  showPlayerMessage("正在准备本地模拟器");

  activeObjectUrl = URL.createObjectURL(record.blob);
  window.EJS_player = "#game";
  window.EJS_core = "segaMD";
  window.EJS_gameUrl = activeObjectUrl;
  window.EJS_gameName = "幽游白书 魔强统一战";
  window.EJS_pathtodata = EMULATOR_DATA_URL;
  window.EJS_DEBUG_XX = true;
  window.EJS_language = "zh-CN";
  window.EJS_startOnLoaded = false;
  window.EJS_startButtonName = "开始游戏";
  window.EJS_alignStartButton = "center";
  window.EJS_threads = false;
  window.EJS_color = "#e63f36";
  window.EJS_backgroundColor = "#000000";
  window.EJS_ready = () => {
    clearTimeout(emulatorReadyTimer);
    emulatorReady = true;
    playerView.dataset.state = "ready";
    hidePlayerMessage();
  };
  window.EJS_onGameStart = () => {
    clearTimeout(emulatorStartTimer);
    emulatorReady = true;
    playerView.dataset.state = "running";
    hidePlayerMessage();
  };

  observeEmulatorErrors();
  emulatorReadyTimer = setTimeout(() => {
    if (!emulatorReady) {
      failEmulator("模拟器准备超时，请重新加载");
    }
  }, EMULATOR_READY_TIMEOUT);

  try {
    await loadEmulatorScript();
  } catch (error) {
    failEmulator("模拟器组件载入失败，请重新加载", error);
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

function openRomPicker() {
  try {
    if (typeof fileInput.showPicker === "function") {
      fileInput.showPicker();
      return;
    }
  } catch {
    // Safari versions without showPicker still support a synchronous click.
  }
  fileInput.click();
}

chooseButton.addEventListener("click", openRomPicker);
replaceButton.addEventListener("click", openRomPicker);
fileInput.addEventListener("change", () => handleFile(fileInput.files?.[0]));
game.addEventListener(
  "click",
  (event) => {
    if (!(event.target instanceof Element) || !event.target.closest(".ejs_start_button")) return;
    playerView.dataset.state = "starting";
    clearTimeout(emulatorStartTimer);
    emulatorStartTimer = setTimeout(() => {
      failEmulator("游戏启动超时，请重新加载");
    }, EMULATOR_START_TIMEOUT);
  },
  { capture: true }
);
retryButton.addEventListener("click", () => {
  retryButton.disabled = true;
  location.reload();
});

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
  clearTimeout(emulatorReadyTimer);
  clearTimeout(emulatorStartTimer);
  emulatorErrorObserver?.disconnect();
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
