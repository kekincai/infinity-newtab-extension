"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // src/core/utils.ts
  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function normalizeUrl(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
    try {
      const url = new URL(candidate);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }
  function sanitizeRemoteUrl(value, allowImageData = false) {
    if (typeof value !== "string") return "";
    if (allowImageData && value.startsWith("data:image/")) return value;
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }
  function cleanText(value, maxLength) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
  }
  function cleanDisplayName(value) {
    return cleanText(value, 160).replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "");
  }
  function truncate(value, maxLength) {
    const text = String(value ?? "");
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}\u2026`;
  }
  function isManagedFavicon(value) {
    const icon = String(value ?? "");
    return /^https:\/\/www\.google\.com\/s2\/favicons/i.test(icon) || /^chrome-extension:\/\/[^/]+\/_favicon\//i.test(icon);
  }
  function faviconUrl(pageUrl) {
    try {
      const favicon = new URL(chrome.runtime.getURL("/_favicon/"));
      favicon.searchParams.set("pageUrl", new URL(pageUrl).href);
      favicon.searchParams.set("size", "64");
      return favicon.toString();
    } catch {
      return DEFAULT_ICON;
    }
  }
  function bookmarkIcon(bookmark) {
    return !bookmark.icon || isManagedFavicon(bookmark.icon) ? faviconUrl(bookmark.url) : bookmark.icon;
  }
  var DEFAULT_ICON;
  var init_utils = __esm({
    "src/core/utils.ts"() {
      "use strict";
      DEFAULT_ICON = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjNjM2NmYxIi8+PHBhdGggZD0iTTE2IDhWMjRNOCAxNkgyNCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=";
    }
  });

  // src/core/backup.ts
  function sanitizeImportedData(value) {
    if (!isRecord(value)) throw new Error("Backup data must be an object");
    const sanitized = {};
    const bookmarks = sanitizeBookmarks(Array.isArray(value.bookmarks) ? value.bookmarks : []);
    sanitized.bookmarks = bookmarks;
    const folders = /* @__PURE__ */ new Set();
    if (Array.isArray(value.folders)) {
      value.folders.forEach((folder) => {
        const name = cleanText(folder, 80);
        if (name) folders.add(name);
      });
    }
    folders.add("\u5168\u90E8");
    bookmarks.forEach((bookmark) => folders.add(bookmark.folder));
    sanitized.folders = Array.from(folders);
    if (value.settings !== void 0) sanitized.settings = sanitizeSettings(value.settings);
    if (Array.isArray(value.todos)) sanitized.todos = value.todos;
    if (Array.isArray(value.recentSearches)) {
      sanitized.recentSearches = value.recentSearches.map((entry) => cleanText(entry, 200)).filter(Boolean).slice(0, 20);
    }
    const backupTime = Number(value.lastBackupPrompt);
    if (Number.isFinite(backupTime)) sanitized.lastBackupPrompt = backupTime;
    return sanitized;
  }
  function sanitizeBookmarks(values) {
    const merged = /* @__PURE__ */ new Map();
    values.forEach((raw, index) => {
      if (!isRecord(raw)) return;
      const url = normalizeUrl(raw.url);
      if (!url) return;
      const folder = cleanText(raw.folder, 80) || "\u5168\u90E8";
      const key = `${folder}|${canonicalUrl(url)}`;
      if (merged.has(key)) return;
      const id = typeof raw.id === "number" || typeof raw.id === "string" ? raw.id : Date.now() + index;
      const icon = sanitizeRemoteUrl(raw.icon, true);
      const order = Number(raw.order);
      merged.set(key, {
        id,
        folder,
        url,
        name: cleanText(raw.name, 160) || new URL(url).hostname,
        icon,
        order: Number.isFinite(order) ? order : index
      });
    });
    const folders = /* @__PURE__ */ new Map();
    merged.forEach((bookmark) => {
      const list = folders.get(bookmark.folder) ?? [];
      list.push(bookmark);
      folders.set(bookmark.folder, list);
    });
    folders.forEach((list) => {
      list.sort((left, right) => left.order - right.order || String(left.id).localeCompare(String(right.id)));
      list.forEach((bookmark, index) => {
        bookmark.order = index;
      });
    });
    return Array.from(merged.values());
  }
  function sanitizeSettings(value) {
    const source = isRecord(value) ? value : {};
    const layout = isRecord(source.layout) ? source.layout : {};
    const wallpaper = isRecord(source.wallpaper) ? source.wallpaper : {};
    const appearance = isRecord(source.appearance) ? source.appearance : {};
    const searchEngines = ["google", "bing", "baidu", "duckduckgo"];
    const wallpaperTypes = ["gradient", "preset", "local", "video"];
    return {
      layout: {
        showClock: booleanOr(layout.showClock, true),
        showSearch: booleanOr(layout.showSearch, true),
        showBookmarks: booleanOr(layout.showBookmarks, true),
        showStatus: booleanOr(layout.showStatus, true),
        showRecent: booleanOr(layout.showRecent, true),
        searchEngine: searchEngines.includes(String(layout.searchEngine)) ? layout.searchEngine : "google"
      },
      wallpaper: {
        type: wallpaperTypes.includes(String(wallpaper.type)) ? wallpaper.type : "gradient",
        value: sanitizeWallpaperValue(wallpaper.value),
        blur: clampNumber(wallpaper.blur, 0, 10, 0),
        overlay: clampNumber(wallpaper.overlay, 0, 80, 30)
      },
      appearance: {
        clockFormat: appearance.clockFormat === "12h" ? "12h" : "24h",
        dateFormat: appearance.dateFormat === "short" ? "short" : "long",
        enhancedAnimations: booleanOr(appearance.enhancedAnimations, true),
        theme: appearance.theme === "dark" ? "dark" : "light"
      }
    };
  }
  function dataUrlToBlob(dataUrl) {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return null;
    const [header, payload] = dataUrl.split(",", 2);
    if (!payload) return null;
    const mime = header.match(/^data:([^;,]+)/)?.[1] ?? "application/octet-stream";
    try {
      const decoded = header.includes(";base64") ? atob(payload) : decodeURIComponent(payload);
      const bytes = new Uint8Array(decoded.length);
      for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
      return new Blob([bytes], { type: mime });
    } catch {
      return null;
    }
  }
  function canonicalUrl(value) {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.toLowerCase();
  }
  function sanitizeWallpaperValue(value) {
    if (value === "local" || value === "") return value;
    return sanitizeRemoteUrl(value, true);
  }
  function booleanOr(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }
  function clampNumber(value, minimum, maximum, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
  }
  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }
  var DEFAULT_SETTINGS;
  var init_backup = __esm({
    "src/core/backup.ts"() {
      "use strict";
      init_utils();
      DEFAULT_SETTINGS = {
        layout: {
          showClock: true,
          showSearch: true,
          showBookmarks: true,
          showStatus: true,
          showRecent: true,
          searchEngine: "google"
        },
        wallpaper: {
          type: "gradient",
          value: "",
          blur: 0,
          overlay: 30
        },
        appearance: {
          clockFormat: "24h",
          dateFormat: "long",
          enhancedAnimations: true,
          theme: "light"
        }
      };
    }
  });

  // src/core/storage.ts
  function area(name) {
    return chrome.storage[name];
  }
  function storageGet(keys, areaName = "sync") {
    return new Promise((resolve, reject) => {
      area(areaName).get(keys, (result) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(result ?? {});
      });
    });
  }
  function storageSet(values, areaName = "sync") {
    return new Promise((resolve, reject) => {
      area(areaName).set(values, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
  }
  function storageRemove(keys, areaName = "sync") {
    return new Promise((resolve, reject) => {
      area(areaName).remove(keys, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
  }
  function storageClear(areaName = "sync") {
    return new Promise((resolve, reject) => {
      area(areaName).clear(() => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
  }
  var init_storage = __esm({
    "src/core/storage.ts"() {
      "use strict";
    }
  });

  // src/core/store.ts
  function initialState() {
    return {
      bookmarks: [],
      folders: ["\u5168\u90E8"],
      settings: structuredClone(DEFAULT_SETTINGS),
      recentSearches: [],
      lastBackupPrompt: 0
    };
  }
  function normalizeBookmarkInput(input, state, id = `${Date.now()}-${crypto.randomUUID()}`) {
    const url = normalizeUrl(input.url);
    if (!url) throw new Error("\u8BF7\u8F93\u5165\u6709\u6548\u7684\u7F51\u5740");
    const folder = state.folders.includes(input.folder) ? input.folder : "\u5168\u90E8";
    return {
      id,
      url,
      folder,
      name: cleanText(input.name, 160) || new URL(url).hostname,
      icon: sanitizeRemoteUrl(input.icon, true),
      order: state.bookmarks.filter((bookmark) => bookmark.folder === folder && String(bookmark.id) !== String(id)).length
    };
  }
  function normalizeFolders(value, bookmarks) {
    const folders = /* @__PURE__ */ new Set(["\u5168\u90E8"]);
    if (Array.isArray(value)) value.forEach((item) => {
      const name = cleanText(item, 80);
      if (name) folders.add(name);
    });
    bookmarks.forEach((bookmark) => folders.add(bookmark.folder));
    return [...folders];
  }
  function normalizeRecentSearches(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => cleanText(item, 200)).filter(Boolean).slice(0, 20);
  }
  function normalizeOrders(bookmarks) {
    new Set(bookmarks.map((bookmark) => bookmark.folder)).forEach((folder) => normalizeFolderOrder(bookmarks, folder));
  }
  function normalizeFolderOrder(bookmarks, folder) {
    bookmarks.filter((bookmark) => bookmark.folder === folder).sort(compareBookmarks).forEach((bookmark, index) => {
      bookmark.order = index;
    });
  }
  function compareBookmarks(left, right) {
    return left.order - right.order || String(left.id).localeCompare(String(right.id));
  }
  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }
  var MANAGED_KEYS, AppStore, appStore;
  var init_store = __esm({
    "src/core/store.ts"() {
      "use strict";
      init_backup();
      init_storage();
      init_utils();
      MANAGED_KEYS = ["bookmarks", "folders", "settings", "recentSearches", "lastBackupPrompt"];
      AppStore = class extends EventTarget {
        stateValue = initialState();
        initialized = false;
        get state() {
          return this.stateValue;
        }
        async init(force = false) {
          if (this.initialized && !force) return;
          const stored = await storageGet([...MANAGED_KEYS]);
          const bookmarks = sanitizeBookmarks(Array.isArray(stored.bookmarks) ? stored.bookmarks : []);
          const folders = normalizeFolders(stored.folders, bookmarks);
          this.stateValue = {
            bookmarks,
            folders,
            settings: sanitizeSettings(stored.settings),
            recentSearches: normalizeRecentSearches(stored.recentSearches),
            lastBackupPrompt: finiteNumber(stored.lastBackupPrompt, 0)
          };
          this.initialized = true;
          this.emit();
        }
        async updateSettings(section, patch) {
          await this.commit((draft) => {
            draft.settings = sanitizeSettings({
              ...draft.settings,
              [section]: { ...draft.settings[section], ...patch }
            });
          }, ["settings"]);
        }
        async addFolder(value) {
          const name = cleanText(value, 80);
          if (!name || this.stateValue.folders.includes(name)) return false;
          await this.commit((draft) => {
            draft.folders.push(name);
          }, ["folders"]);
          return true;
        }
        async renameFolder(from, to) {
          const name = cleanText(to, 80);
          if (!name || from === "\u5168\u90E8" || name !== from && this.stateValue.folders.includes(name)) return false;
          await this.commit((draft) => {
            draft.folders = draft.folders.map((folder) => folder === from ? name : folder);
            draft.bookmarks.forEach((bookmark) => {
              if (bookmark.folder === from) bookmark.folder = name;
            });
            normalizeOrders(draft.bookmarks);
          }, ["folders", "bookmarks"]);
          return true;
        }
        async deleteFolder(folder) {
          if (folder === "\u5168\u90E8") return;
          await this.commit((draft) => {
            draft.folders = draft.folders.filter((item) => item !== folder);
            draft.bookmarks.forEach((bookmark) => {
              if (bookmark.folder === folder) bookmark.folder = "\u5168\u90E8";
            });
            normalizeOrders(draft.bookmarks);
          }, ["folders", "bookmarks"]);
        }
        async addBookmark(input) {
          const bookmark = normalizeBookmarkInput(input, this.stateValue);
          await this.commit((draft) => {
            draft.bookmarks.push(bookmark);
          }, ["bookmarks"]);
          return bookmark;
        }
        async updateBookmark(id, input) {
          await this.commit((draft) => {
            const index = draft.bookmarks.findIndex((bookmark) => String(bookmark.id) === String(id));
            if (index < 0) throw new Error("\u627E\u4E0D\u5230\u8BE5\u4E66\u7B7E");
            const previous = draft.bookmarks[index];
            const next = normalizeBookmarkInput(input, draft, previous.id);
            next.order = previous.folder === next.folder ? previous.order : draft.bookmarks.filter((bookmark) => bookmark.folder === next.folder).length;
            draft.bookmarks[index] = next;
            normalizeOrders(draft.bookmarks);
          }, ["bookmarks"]);
        }
        async deleteBookmark(id) {
          await this.commit((draft) => {
            draft.bookmarks = draft.bookmarks.filter((bookmark) => String(bookmark.id) !== String(id));
            normalizeOrders(draft.bookmarks);
          }, ["bookmarks"]);
        }
        async moveBookmark(id, targetFolder, targetId) {
          await this.commit((draft) => {
            const bookmark = draft.bookmarks.find((item) => String(item.id) === String(id));
            if (!bookmark) throw new Error("\u627E\u4E0D\u5230\u62D6\u52A8\u7684\u4E66\u7B7E");
            const destination = draft.folders.includes(targetFolder) ? targetFolder : "\u5168\u90E8";
            const source = bookmark.folder;
            bookmark.folder = destination;
            const destinationList = draft.bookmarks.filter((item) => item.folder === destination && String(item.id) !== String(id)).sort(compareBookmarks);
            const foundIndex = targetId === void 0 ? destinationList.length : destinationList.findIndex((item) => String(item.id) === String(targetId));
            const targetIndex = foundIndex < 0 ? destinationList.length : foundIndex;
            destinationList.splice(targetIndex, 0, bookmark);
            destinationList.forEach((item, index) => {
              item.order = index;
            });
            if (source !== destination) normalizeFolderOrder(draft.bookmarks, source);
          }, ["bookmarks"]);
        }
        async saveRecentSearch(query) {
          const value = cleanText(query, 200);
          if (!value) return;
          await this.commit((draft) => {
            draft.recentSearches = [value, ...draft.recentSearches.filter((item) => item !== value)].slice(0, 20);
          }, ["recentSearches"]);
        }
        async setLastBackupPrompt(value = Date.now()) {
          await this.commit((draft) => {
            draft.lastBackupPrompt = value;
          }, ["lastBackupPrompt"]);
        }
        async replaceImportedData(data) {
          const next = initialState();
          next.bookmarks = sanitizeBookmarks(Array.isArray(data.bookmarks) ? data.bookmarks : []);
          next.folders = normalizeFolders(data.folders, next.bookmarks);
          next.settings = sanitizeSettings(data.settings);
          next.recentSearches = normalizeRecentSearches(data.recentSearches);
          next.lastBackupPrompt = finiteNumber(data.lastBackupPrompt, 0);
          const values = {
            bookmarks: next.bookmarks,
            folders: next.folders,
            settings: next.settings,
            recentSearches: next.recentSearches,
            lastBackupPrompt: next.lastBackupPrompt,
            ...Array.isArray(data.todos) ? { todos: data.todos } : {}
          };
          await storageSet(values);
          const staleKeys = ["bookmarks", "folders", "settings", "todos", "recentSearches", "lastBackupPrompt"].filter((key) => !(key in values));
          if (staleKeys.length) await storageRemove(staleKeys);
          this.stateValue = next;
          this.initialized = true;
          this.emit();
        }
        async reset() {
          await storageClear("sync");
          this.stateValue = initialState();
          this.emit();
        }
        async commit(mutator, keys) {
          const draft = structuredClone(this.stateValue);
          mutator(draft);
          const values = {};
          keys.forEach((key) => {
            values[key] = draft[key];
          });
          await storageSet(values);
          this.stateValue = draft;
          this.emit();
        }
        emit() {
          this.dispatchEvent(new CustomEvent("change", { detail: this.stateValue }));
        }
      };
      appStore = new AppStore();
    }
  });

  // src/core/chrome-fallback.ts
  function installChromeFallback() {
    if (globalThis.chrome?.storage?.sync) return;
    const makeArea = (name) => ({
      get(keys, callback) {
        const values = JSON.parse(localStorage.getItem(name) || "{}");
        if (keys === null || keys === void 0) callback({ ...values });
        else if (typeof keys === "string") callback({ [keys]: values[keys] });
        else if (Array.isArray(keys)) callback(Object.fromEntries(keys.map((key) => [key, values[key]])));
        else callback({});
      },
      set(next, callback = () => void 0) {
        const values = JSON.parse(localStorage.getItem(name) || "{}");
        localStorage.setItem(name, JSON.stringify({ ...values, ...next }));
        callback();
      },
      remove(keys, callback = () => void 0) {
        const values = JSON.parse(localStorage.getItem(name) || "{}");
        (Array.isArray(keys) ? keys : [keys]).forEach((key) => delete values[key]);
        localStorage.setItem(name, JSON.stringify(values));
        callback();
      },
      clear(callback = () => void 0) {
        localStorage.removeItem(name);
        callback();
      }
    });
    globalThis.chrome = {
      runtime: { id: "preview", lastError: null, getURL: (path) => new URL(path, location.href).href },
      storage: { sync: makeArea("infinity-preview-sync"), local: makeArea("infinity-preview-local") },
      tabs: { query: (_query, done) => done([]), update: () => void 0 },
      downloads: { search: (_query, done) => done([]), show: () => void 0 },
      history: { search: (_query, done) => done([]) }
    };
  }
  var init_chrome_fallback = __esm({
    "src/core/chrome-fallback.ts"() {
      "use strict";
    }
  });

  // src/core/media-store.ts
  function fallbackKey(kind) {
    return kind === "image" ? "localImageWallpaper" : "localVideoWallpaper";
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error("\u65E0\u6CD5\u8BFB\u53D6\u672C\u5730\u58C1\u7EB8"));
      reader.readAsDataURL(blob);
    });
  }
  var DATABASE, STORE, MediaStore, mediaStore;
  var init_media_store = __esm({
    "src/core/media-store.ts"() {
      "use strict";
      init_backup();
      init_storage();
      DATABASE = "infinity-wallpaper";
      STORE = "wallpapers";
      MediaStore = class {
        async get(kind) {
          try {
            const database = await this.open();
            return await new Promise((resolve) => {
              const request = database.transaction(STORE, "readonly").objectStore(STORE).get(kind);
              request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
              request.onerror = () => resolve(null);
            });
          } catch {
            const key = fallbackKey(kind);
            const result = await storageGet([key], "local");
            return result[key] instanceof Blob ? result[key] : null;
          }
        }
        async set(kind, value) {
          try {
            const database = await this.open();
            await new Promise((resolve, reject) => {
              const transaction = database.transaction(STORE, "readwrite");
              transaction.objectStore(STORE).put(value, kind);
              transaction.oncomplete = () => resolve();
              transaction.onerror = () => reject(transaction.error ?? new Error("\u65E0\u6CD5\u4FDD\u5B58\u672C\u5730\u58C1\u7EB8"));
            });
          } catch {
            await storageSet({ [fallbackKey(kind)]: value }, "local");
          }
        }
        async clear(kind) {
          try {
            const database = await this.open();
            await new Promise((resolve) => {
              const transaction = database.transaction(STORE, "readwrite");
              transaction.objectStore(STORE).delete(kind);
              transaction.oncomplete = () => resolve();
              transaction.onerror = () => resolve();
            });
          } catch {
          }
          await storageRemove([fallbackKey(kind)], "local");
        }
        async clearAll() {
          await Promise.all([this.clear("image"), this.clear("video")]);
        }
        async export() {
          const [image, video] = await Promise.all([this.get("image"), this.get("video")]);
          return {
            image: image ? await blobToDataUrl(image) : null,
            video: video ? await blobToDataUrl(video) : null
          };
        }
        async import(value, replace = true) {
          if (!isRecord(value)) {
            if (replace) await this.clearAll();
            return;
          }
          for (const kind of ["image", "video"]) {
            const blob = dataUrlToBlob(value[kind]);
            if (blob) await this.set(kind, blob);
            else if (replace) await this.clear(kind);
          }
        }
        open() {
          return new Promise((resolve, reject) => {
            const request = indexedDB.open(DATABASE, 1);
            request.onupgradeneeded = () => {
              if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error ?? new Error("\u65E0\u6CD5\u6253\u5F00\u58C1\u7EB8\u6570\u636E\u5E93"));
          });
        }
      };
      mediaStore = new MediaStore();
    }
  });

  // src/core/backup-service.ts
  function dateStamp() {
    return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
  var BackupService, backupService;
  var init_backup_service = __esm({
    "src/core/backup-service.ts"() {
      "use strict";
      init_backup();
      init_media_store();
      init_store();
      init_storage();
      BackupService = class {
        async exportData() {
          return {
            version: "2.0",
            exportDate: (/* @__PURE__ */ new Date()).toISOString(),
            data: await storageGet(null),
            localMedia: await mediaStore.export()
          };
        }
        async importData(value) {
          if (!isRecord(value) || !value.version || !isRecord(value.data)) {
            throw new Error("\u5907\u4EFD\u6587\u4EF6\u683C\u5F0F\u65E0\u6548");
          }
          const data = sanitizeImportedData(value.data);
          if (Object.hasOwn(value, "localMedia")) await mediaStore.import(value.localMedia, true);
          const settings = data.settings;
          if (isRecord(settings) && isRecord(settings.wallpaper)) {
            const wallpaper = settings.wallpaper;
            if (wallpaper.type === "local" && typeof wallpaper.value === "string" && wallpaper.value.startsWith("data:image/")) {
              const image = dataUrlToBlob(wallpaper.value);
              if (!image) throw new Error("\u65E7\u5907\u4EFD\u4E2D\u7684\u672C\u5730\u58C1\u7EB8\u65E0\u6548");
              await mediaStore.set("image", image);
              wallpaper.value = "local";
            }
          }
          await appStore.replaceImportedData(data);
        }
        download(data, filename = `infinity-newtab-backup-${dateStamp()}.json`) {
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = filename;
          anchor.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1e3);
        }
        async read(file) {
          try {
            return JSON.parse(await file.text());
          } catch {
            throw new Error("\u65E0\u6CD5\u8BFB\u53D6 JSON \u5907\u4EFD\u6587\u4EF6");
          }
        }
        async createBackup() {
          this.download(await this.exportData());
        }
      };
      backupService = new BackupService();
    }
  });

  // src/components/base.ts
  var StoreElement;
  var init_base = __esm({
    "src/components/base.ts"() {
      "use strict";
      init_store();
      StoreElement = class extends HTMLElement {
        onStoreChange = () => this.render();
        connectedCallback() {
          appStore.addEventListener("change", this.onStoreChange);
          this.render();
        }
        disconnectedCallback() {
          appStore.removeEventListener("change", this.onStoreChange);
        }
      };
    }
  });

  // src/components/backup-toast.ts
  var REMINDER_INTERVAL, BackupToast;
  var init_backup_toast = __esm({
    "src/components/backup-toast.ts"() {
      "use strict";
      init_backup_service();
      init_store();
      init_base();
      REMINDER_INTERVAL = 7 * 24 * 60 * 60 * 1e3;
      BackupToast = class extends StoreElement {
        dismissed = false;
        render() {
          const due = Date.now() - appStore.state.lastBackupPrompt >= REMINDER_INTERVAL;
          this.hidden = !due || this.dismissed;
          this.innerHTML = `
            <div class="backup-toast glass-panel">
                <span>\u5907\u4EFD\u4E00\u4E0B\uFF0C\u4E66\u7B7E\u4F1A\u66F4\u5B89\u5FC3</span>
                <liquid-surface class="backup-actions"><button class="glass-button primary backup-now" type="button" data-liquid-item>\u7ACB\u5373\u5BFC\u51FA</button><button class="glass-button backup-later" type="button" data-liquid-item>\u7A0D\u540E</button></liquid-surface>
            </div>
        `;
          this.querySelector(".backup-now")?.addEventListener("click", () => void this.finish(true));
          this.querySelector(".backup-later")?.addEventListener("click", () => void this.finish(false));
        }
        async finish(exportNow) {
          try {
            if (exportNow) await backupService.createBackup();
            await appStore.setLastBackupPrompt();
            this.dismissed = true;
            this.render();
          } catch (error) {
            alert(error instanceof Error ? error.message : "\u5907\u4EFD\u5931\u8D25");
          }
        }
      };
    }
  });

  // src/components/bookmark-dialog.ts
  var BookmarkDialog;
  var init_bookmark_dialog = __esm({
    "src/components/bookmark-dialog.ts"() {
      "use strict";
      init_store();
      init_utils();
      BookmarkDialog = class extends HTMLElement {
        editing;
        folder = "\u5168\u90E8";
        connectedCallback() {
          document.addEventListener("open-bookmark-dialog", this.onOpen);
          this.render();
        }
        disconnectedCallback() {
          document.removeEventListener("open-bookmark-dialog", this.onOpen);
        }
        onOpen = (event) => {
          this.editing = event.detail.bookmark;
          this.folder = event.detail.folder ?? "\u5168\u90E8";
          this.render(true);
        };
        render(open = false) {
          const bookmark = this.editing;
          const selected = bookmark?.folder ?? this.folder;
          this.innerHTML = `
            <div class="dialog-backdrop ${open ? "is-open" : ""}" role="presentation">
                <form class="bookmark-dialog glass-panel" role="dialog" aria-modal="true" aria-label="${bookmark ? "\u7F16\u8F91\u4E66\u7B7E" : "\u6DFB\u52A0\u4E66\u7B7E"}">
                    <header><div><span class="section-kicker">\u5FEB\u6377\u5165\u53E3</span><h2>${bookmark ? "\u7F16\u8F91\u4E66\u7B7E" : "\u6DFB\u52A0\u4E66\u7B7E"}</h2></div><button class="dialog-close" type="button" aria-label="\u5173\u95ED">\xD7</button></header>
                    <label>\u7F51\u5740<input name="url" type="url" required placeholder="https://example.com" value="${escapeHtml(bookmark?.url ?? "")}"></label>
                    <label>\u540D\u79F0<input name="name" type="text" maxlength="160" placeholder="\u81EA\u52A8\u4F7F\u7528\u7F51\u7AD9\u540D\u79F0" value="${escapeHtml(bookmark?.name ?? "")}"></label>
                    <label>\u6587\u4EF6\u5939<select name="folder">${appStore.state.folders.map((folder) => `<option value="${escapeHtml(folder)}" ${folder === selected ? "selected" : ""}>${escapeHtml(folder)}</option>`).join("")}</select></label>
                    <label>\u56FE\u6807\u5730\u5740\uFF08\u53EF\u9009\uFF09<input name="icon" type="url" placeholder="https://example.com/favicon.ico" value="${escapeHtml(bookmark?.icon ?? "")}"></label>
                    <div class="dialog-preview"><img alt=""><span>\u8F93\u5165\u7F51\u5740\u540E\u9884\u89C8\u56FE\u6807</span></div>
                    <liquid-surface class="dialog-actions"><button class="glass-button cancel-dialog" type="button" data-liquid-item>\u53D6\u6D88</button><button class="glass-button primary" type="submit" data-liquid-item>\u4FDD\u5B58</button></liquid-surface>
                </form>
            </div>
        `;
          if (!open) return;
          const backdrop = this.querySelector(".dialog-backdrop");
          const form = this.querySelector("form");
          const urlInput = this.querySelector('input[name="url"]');
          const preview = this.querySelector(".dialog-preview img");
          const close = () => {
            this.editing = void 0;
            this.render(false);
          };
          const updatePreview = () => {
            const url = normalizeUrl(urlInput?.value);
            if (preview && url) preview.src = faviconUrl(url);
          };
          updatePreview();
          urlInput?.addEventListener("input", updatePreview);
          this.querySelector(".dialog-close")?.addEventListener("click", close);
          this.querySelector(".cancel-dialog")?.addEventListener("click", close);
          backdrop?.addEventListener("click", (event) => {
            if (event.target === backdrop) close();
          });
          form?.addEventListener("submit", async (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const input = {
              url: String(data.get("url") ?? ""),
              name: String(data.get("name") ?? ""),
              folder: String(data.get("folder") ?? "\u5168\u90E8"),
              icon: String(data.get("icon") ?? "")
            };
            try {
              if (this.editing) await appStore.updateBookmark(this.editing.id, input);
              else await appStore.addBookmark(input);
              close();
            } catch (error) {
              alert(error instanceof Error ? error.message : "\u4FDD\u5B58\u5931\u8D25");
            }
          });
          window.setTimeout(() => urlInput?.focus(), 0);
        }
      };
    }
  });

  // src/components/bookmark-launchpad.ts
  function compareBookmarks2(left, right) {
    return left.order - right.order || String(left.id).localeCompare(String(right.id));
  }
  function showError(error) {
    alert(error instanceof Error ? error.message : "\u64CD\u4F5C\u5931\u8D25");
  }
  var FOLDER_COLORS, BookmarkLaunchpad;
  var init_bookmark_launchpad = __esm({
    "src/components/bookmark-launchpad.ts"() {
      "use strict";
      init_store();
      init_utils();
      init_base();
      FOLDER_COLORS = ["#ff92c8", "#80d8ff", "#ffd27d", "#9be7c4", "#b8a6ff"];
      BookmarkLaunchpad = class extends StoreElement {
        currentFolder = "\u5168\u90E8";
        draggingId = null;
        render() {
          const { bookmarks, folders, settings } = appStore.state;
          if (!folders.includes(this.currentFolder)) this.currentFolder = "\u5168\u90E8";
          this.hidden = !settings.layout.showBookmarks;
          const visible = bookmarks.filter((bookmark) => bookmark.folder === this.currentFolder).sort(compareBookmarks2);
          const folderCards = this.currentFolder === "\u5168\u90E8" ? folders.filter((folder) => folder !== "\u5168\u90E8").map((folder, index) => this.folderTemplate(folder, index)).join("") : this.backTemplate();
          this.innerHTML = `
            <section class="launchpad-section">
                <header class="launchpad-header">
                    <div>
                        <span class="section-kicker">\u5F53\u524D\u6587\u4EF6\u5939</span>
                        <h2>${escapeHtml(this.currentFolder)}</h2>
                    </div>
                    <liquid-surface class="launchpad-actions">
                        <button class="glass-button anime-wallpaper" type="button" data-liquid-item>\u6362\u5F20\u4E8C\u6B21\u5143\u58C1\u7EB8</button>
                        <button class="glass-button primary create-folder" type="button" data-liquid-item>\u65B0\u5EFA\u6587\u4EF6\u5939</button>
                    </liquid-surface>
                </header>
                <liquid-surface class="launchpad-grid">
                    ${folderCards}
                    ${this.currentFolder === "\u5168\u90E8" ? this.addFolderTemplate() : ""}
                    ${visible.map((bookmark) => this.bookmarkTemplate(bookmark)).join("")}
                    ${!folderCards && !visible.length ? '<div class="empty-launchpad">\u8FD9\u91CC\u8FD8\u6CA1\u6709\u4E66\u7B7E</div>' : ""}
                </liquid-surface>
                <button class="add-bookmark-fab" type="button" data-liquid-item aria-label="\u6DFB\u52A0\u4E66\u7B7E">+</button>
            </section>
        `;
          this.bindEvents();
        }
        bookmarkTemplate(bookmark) {
          const name = cleanDisplayName(bookmark.name) || cleanDisplayName(new URL(bookmark.url).hostname);
          return `
            <a class="bookmark-tile" href="${escapeHtml(bookmark.url)}" data-bookmark-id="${escapeHtml(bookmark.id)}" data-liquid-item draggable="true" rel="noreferrer">
                <span class="tile-actions">
                    <button class="tile-action edit-bookmark" type="button" aria-label="\u7F16\u8F91\u4E66\u7B7E" title="\u7F16\u8F91">\u270E</button>
                    <button class="tile-action delete-bookmark" type="button" aria-label="\u5220\u9664\u4E66\u7B7E" title="\u5220\u9664">\xD7</button>
                </span>
                <span class="bookmark-icon"><img src="${escapeHtml(bookmarkIcon(bookmark))}" alt=""></span>
                <span class="bookmark-name">${escapeHtml(name)}</span>
            </a>
        `;
        }
        folderTemplate(folder, index) {
          const bookmarks = appStore.state.bookmarks.filter((bookmark) => bookmark.folder === folder).sort(compareBookmarks2);
          const previews = bookmarks.slice(0, 4).map((bookmark) => `<span class="folder-preview-icon"><img src="${escapeHtml(bookmarkIcon(bookmark))}" alt=""></span>`).join("");
          return `
            <article class="folder-tile" tabindex="0" role="button" data-folder="${escapeHtml(folder)}" data-liquid-item style="--folder-color:${FOLDER_COLORS[index % FOLDER_COLORS.length]}">
                <span class="tile-actions folder-actions">
                    <button class="tile-action rename-folder" type="button" aria-label="\u91CD\u547D\u540D\u6587\u4EF6\u5939" title="\u91CD\u547D\u540D">\u270E</button>
                    <button class="tile-action delete-folder" type="button" aria-label="\u5220\u9664\u6587\u4EF6\u5939" title="\u5220\u9664">\xD7</button>
                </span>
                <span class="folder-preview">${previews || '<span class="folder-empty-dot">\u2726</span>'}</span>
                <strong>${escapeHtml(folder)}</strong>
                <small>${bookmarks.length} \u4E2A\u4E66\u7B7E</small>
            </article>
        `;
        }
        addFolderTemplate() {
          return `
            <button class="folder-tile add-folder-tile" type="button" data-liquid-item>
                <span class="add-folder-symbol">+</span>
                <strong>\u65B0\u5EFA\u6587\u4EF6\u5939</strong>
                <small>\u628A\u76F8\u5173\u7AD9\u70B9\u6536\u8FDB\u4E00\u4E2A\u5408\u96C6</small>
            </button>
        `;
        }
        backTemplate() {
          return `
            <button class="folder-tile back-folder-tile" type="button" data-liquid-item>
                <span class="add-folder-symbol">\u2190</span>
                <strong>\u8FD4\u56DE\u5168\u90E8</strong>
                <small>\u56DE\u5230\u6240\u6709\u6587\u4EF6\u5939</small>
            </button>
        `;
        }
        bindEvents() {
          this.querySelector(".anime-wallpaper")?.addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("random-wallpaper", { bubbles: true, composed: true }));
          });
          this.querySelectorAll(".create-folder, .add-folder-tile").forEach((button) => {
            button.addEventListener("click", () => void this.createFolder());
          });
          this.querySelector(".back-folder-tile")?.addEventListener("click", () => {
            this.currentFolder = "\u5168\u90E8";
            this.render();
          });
          this.querySelector(".add-bookmark-fab")?.addEventListener("click", () => this.openDialog());
          this.querySelectorAll(".folder-tile[data-folder]").forEach((card) => {
            const folder = card.dataset.folder ?? "\u5168\u90E8";
            const enter = () => {
              this.currentFolder = folder;
              this.render();
            };
            card.addEventListener("click", (event) => {
              if (!event.target.closest(".tile-action")) enter();
            });
            card.addEventListener("keydown", (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                enter();
              }
            });
            card.addEventListener("dragover", (event) => {
              event.preventDefault();
              card.classList.add("drop-target");
            });
            card.addEventListener("dragleave", () => card.classList.remove("drop-target"));
            card.addEventListener("drop", (event) => {
              event.preventDefault();
              card.classList.remove("drop-target");
              const id = this.dragId(event);
              if (id !== null) void this.moveBookmark(id, folder);
            });
            card.querySelector(".rename-folder")?.addEventListener("click", (event) => {
              event.stopPropagation();
              void this.renameFolder(folder);
            });
            card.querySelector(".delete-folder")?.addEventListener("click", (event) => {
              event.stopPropagation();
              void this.deleteFolder(folder);
            });
          });
          this.querySelectorAll(".bookmark-tile").forEach((card) => {
            const id = card.dataset.bookmarkId ?? "";
            card.querySelector("img")?.addEventListener("error", (event) => {
              event.currentTarget.style.opacity = "0.35";
            });
            card.addEventListener("dragstart", (event) => {
              this.draggingId = id;
              event.dataTransfer?.setData("text/plain", id);
              if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
              card.classList.add("is-dragging");
            });
            card.addEventListener("dragend", () => {
              this.draggingId = null;
              card.classList.remove("is-dragging");
              this.querySelectorAll(".drop-target").forEach((item) => item.classList.remove("drop-target"));
            });
            card.addEventListener("dragover", (event) => {
              event.preventDefault();
              card.classList.add("drop-target");
            });
            card.addEventListener("dragleave", () => card.classList.remove("drop-target"));
            card.addEventListener("drop", (event) => {
              event.preventDefault();
              event.stopPropagation();
              card.classList.remove("drop-target");
              const sourceId = this.dragId(event);
              if (sourceId !== null && sourceId !== id) void this.moveBookmark(sourceId, this.currentFolder, id);
            });
            card.querySelector(".edit-bookmark")?.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              const bookmark = appStore.state.bookmarks.find((item) => String(item.id) === String(id));
              if (bookmark) this.openDialog(bookmark);
            });
            card.querySelector(".delete-bookmark")?.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              if (confirm("\u5220\u9664\u8FD9\u4E2A\u4E66\u7B7E\uFF1F")) void appStore.deleteBookmark(id).catch(showError);
            });
          });
          this.querySelector(".launchpad-grid")?.addEventListener("dragover", (event) => event.preventDefault());
          this.querySelector(".launchpad-grid")?.addEventListener("drop", (event) => {
            if (event.target.closest(".bookmark-tile, .folder-tile[data-folder]")) return;
            event.preventDefault();
            const id = this.dragId(event);
            if (id !== null) void this.moveBookmark(id, this.currentFolder);
          });
        }
        openDialog(bookmark) {
          this.dispatchEvent(new CustomEvent("open-bookmark-dialog", {
            bubbles: true,
            composed: true,
            detail: { bookmark, folder: this.currentFolder }
          }));
        }
        async createFolder() {
          const name = prompt("\u6587\u4EF6\u5939\u540D\u79F0")?.trim();
          if (!name) return;
          try {
            if (!await appStore.addFolder(name)) alert("\u6587\u4EF6\u5939\u540D\u79F0\u4E3A\u7A7A\u6216\u5DF2\u7ECF\u5B58\u5728\u3002");
          } catch (error) {
            showError(error);
          }
        }
        async renameFolder(folder) {
          const name = prompt("\u65B0\u7684\u6587\u4EF6\u5939\u540D\u79F0", folder)?.trim();
          if (!name || name === folder) return;
          try {
            if (!await appStore.renameFolder(folder, name)) alert("\u6587\u4EF6\u5939\u540D\u79F0\u4E3A\u7A7A\u6216\u5DF2\u7ECF\u5B58\u5728\u3002");
          } catch (error) {
            showError(error);
          }
        }
        async deleteFolder(folder) {
          if (!confirm(`\u5220\u9664\u6587\u4EF6\u5939\u201C${folder}\u201D\uFF1F\u5176\u4E2D\u7684\u4E66\u7B7E\u4F1A\u79FB\u56DE\u201C\u5168\u90E8\u201D\u3002`)) return;
          try {
            await appStore.deleteFolder(folder);
          } catch (error) {
            showError(error);
          }
        }
        async moveBookmark(id, folder, targetId) {
          try {
            await appStore.moveBookmark(id, folder, targetId);
          } catch (error) {
            showError(error);
          }
        }
        dragId(event) {
          return event.dataTransfer?.getData("text/plain") || this.draggingId;
        }
      };
    }
  });

  // src/components/dashboard-header.ts
  function callbackResult(start, fallback) {
    return new Promise((resolve) => {
      try {
        start((result) => resolve(chrome.runtime.lastError ? fallback : result));
      } catch {
        resolve(fallback);
      }
    });
  }
  var DashboardHeader;
  var init_dashboard_header = __esm({
    "src/components/dashboard-header.ts"() {
      "use strict";
      init_store();
      init_utils();
      init_base();
      DashboardHeader = class extends StoreElement {
        clockTimer = 0;
        statusTimer = 0;
        connectedCallback() {
          super.connectedCallback();
          this.updateClock();
          this.clockTimer = window.setInterval(() => this.updateClock(), 1e3);
          void this.updateStatus();
          this.statusTimer = window.setInterval(() => void this.updateStatus(), 8e3);
        }
        disconnectedCallback() {
          super.disconnectedCallback();
          window.clearInterval(this.clockTimer);
          window.clearInterval(this.statusTimer);
        }
        render() {
          const { layout } = appStore.state.settings;
          this.innerHTML = `
            <div class="time-row" ${layout.showClock ? "" : "hidden"}>
                <time class="hero-time" id="time">--:--</time>
                <span class="hero-date" id="date">----</span>
            </div>
            <div class="status-grid" ${layout.showStatus ? "" : "hidden"}>
                <article class="glass-panel status-panel status-panel-wide">
                    <span class="section-kicker">\u6D3B\u52A8</span>
                    <liquid-surface class="status-pills">
                        <button class="status-chip is-media" type="button" data-liquid-item>\u65E0\u5A92\u4F53\u64AD\u653E</button>
                        <button class="status-chip is-download" type="button" data-liquid-item>\u65E0\u4E0B\u8F7D</button>
                    </liquid-surface>
                </article>
                <article class="glass-panel status-panel">
                    <span class="section-kicker">\u7CFB\u7EDF</span>
                    <div class="status-pills system-pills">
                        <span class="status-chip cpu-chip">CPU: --</span>
                        <span class="status-chip memory-chip">\u5185\u5B58: --</span>
                        <span class="status-chip battery-chip">\u7535\u6C60: --</span>
                    </div>
                </article>
            </div>
        `;
          this.updateClock();
          void this.updateStatus();
        }
        updateClock() {
          const time = this.querySelector("#time");
          const date = this.querySelector("#date");
          if (!time || !date) return;
          const now = /* @__PURE__ */ new Date();
          const { clockFormat, dateFormat } = appStore.state.settings.appearance;
          time.textContent = now.toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: clockFormat === "12h"
          });
          date.textContent = now.toLocaleDateString("zh-CN", dateFormat === "long" ? { year: "numeric", month: "long", day: "numeric", weekday: "short" } : { month: "numeric", day: "numeric", weekday: "short" });
        }
        async updateStatus() {
          const cpu = this.querySelector(".cpu-chip");
          const memory = this.querySelector(".memory-chip");
          if (cpu) cpu.textContent = `CPU: ${navigator.hardwareConcurrency || "--"} \u7EBF\u7A0B`;
          if (memory) memory.textContent = `\u5185\u5B58: ${navigator.deviceMemory ? `\u2248 ${navigator.deviceMemory} GB` : "\u4E0D\u53EF\u7528"}`;
          await Promise.all([this.updateMedia(), this.updateDownloads(), this.updateBattery()]);
        }
        async updateMedia() {
          const button = this.querySelector(".is-media");
          if (!button || !chrome.tabs?.query) return;
          const tabs = await callbackResult((done) => chrome.tabs.query({ audible: true }, done), []);
          const tab = tabs[0];
          button.textContent = tab ? `\u64AD\u653E\u4E2D\uFF1A${truncate(tab.title || "\u5A92\u4F53", 28)}` : "\u65E0\u5A92\u4F53\u64AD\u653E";
          button.disabled = !tab;
          button.onclick = tab ? () => chrome.tabs.update(tab.id, { active: true }) : null;
        }
        async updateDownloads() {
          const button = this.querySelector(".is-download");
          if (!button || !chrome.downloads?.search) return;
          const downloads = await callbackResult((done) => chrome.downloads.search({ state: "in_progress" }, done), []);
          button.textContent = downloads.length ? `\u4E0B\u8F7D\u4E2D\uFF1A${downloads.length} \u9879` : "\u65E0\u4E0B\u8F7D";
          button.disabled = !downloads.length;
          button.onclick = downloads.length ? () => chrome.downloads.show(downloads[0].id) : null;
        }
        async updateBattery() {
          const chip = this.querySelector(".battery-chip");
          if (!chip) return;
          if (!navigator.getBattery) {
            chip.textContent = "\u7535\u6C60: \u4E0D\u53EF\u7528";
            return;
          }
          try {
            const battery = await navigator.getBattery();
            chip.textContent = `\u7535\u6C60: ${Math.round(battery.level * 100)}%${battery.charging ? " \u26A1" : ""}`;
          } catch {
            chip.textContent = "\u7535\u6C60: \u4E0D\u53EF\u7528";
          }
        }
      };
    }
  });

  // src/components/liquid-glass.ts
  function findSurfaceAtPoint(x, y) {
    const surfaces = [...document.querySelectorAll("liquid-surface")].filter((surface) => {
      const style = getComputedStyle(surface);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = surface.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    });
    return surfaces.sort((left, right) => area2(left) - area2(right))[0] ?? null;
  }
  function area2(element) {
    const rect = element.getBoundingClientRect();
    return rect.width * rect.height;
  }
  function settled(current, desired, velocity) {
    return Object.keys(current).every((key) => Math.abs(current[key] - desired[key]) < 0.08 && Math.abs(velocity[key]) < 0.08);
  }
  function createDisplacementMap() {
    const canvas = document.createElement("canvas");
    canvas.width = MAP_SIZE;
    canvas.height = MAP_SIZE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return "";
    const image = context.createImageData(MAP_SIZE, MAP_SIZE);
    const center = (MAP_SIZE - 1) / 2;
    for (let y = 0; y < MAP_SIZE; y += 1) {
      for (let x = 0; x < MAP_SIZE; x += 1) {
        const nx = (x - center) / center;
        const ny = (y - center) / center;
        const radius = Math.sqrt(nx * nx + ny * ny);
        const edge = smoothStep(0.48, 1, radius);
        const bloom = Math.sin(Math.min(1, radius) * Math.PI) * 0.18;
        const strength = Math.min(0.46, edge * 0.38 + bloom);
        const index = (y * MAP_SIZE + x) * 4;
        image.data[index] = Math.round(128 + nx * strength * 127);
        image.data[index + 1] = Math.round(128 + ny * strength * 127);
        image.data[index + 2] = 128;
        image.data[index + 3] = Math.round(255 * smoothStep(0.1, 0.96, 1 - Math.max(0, radius - 0.94)));
      }
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  }
  function smoothStep(from, to, value) {
    const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
    return t * t * (3 - 2 * t);
  }
  var MAP_SIZE, MIN_WIDTH, MIN_HEIGHT, LiquidSurface, LiquidGlassLayer;
  var init_liquid_glass = __esm({
    "src/components/liquid-glass.ts"() {
      "use strict";
      MAP_SIZE = 160;
      MIN_WIDTH = 58;
      MIN_HEIGHT = 50;
      LiquidSurface = class extends HTMLElement {
      };
      LiquidGlassLayer = class extends HTMLElement {
        lens;
        displacement;
        desired = { x: 0, y: 0, width: MIN_WIDTH, height: MIN_HEIGHT };
        current = { ...this.desired };
        velocity = { x: 0, y: 0, width: 0, height: 0 };
        pointer = { x: 0, y: 0, previousX: 0, previousY: 0, time: 0, speed: 0 };
        active = false;
        activeSurface = null;
        frame = 0;
        previousFrame = 0;
        hideTimer = 0;
        connectedCallback() {
          this.innerHTML = `
            <svg class="liquid-defs" width="0" height="0" aria-hidden="true">
                <defs>
                    <filter id="infinity-liquid-refraction" x="-28%" y="-28%" width="156%" height="156%" color-interpolation-filters="sRGB">
                        <feImage href="${createDisplacementMap()}" preserveAspectRatio="none" result="bezel-map"></feImage>
                        <feGaussianBlur in="SourceGraphic" stdDeviation="0.18" result="soft-source"></feGaussianBlur>
                        <feDisplacementMap in="soft-source" in2="bezel-map" scale="52" xChannelSelector="R" yChannelSelector="G" result="refracted"></feDisplacementMap>
                        <feColorMatrix in="refracted" type="saturate" values="1.22"></feColorMatrix>
                    </filter>
                </defs>
            </svg>
            <div class="liquid-lens" aria-hidden="true"></div>
        `;
          this.lens = this.querySelector(".liquid-lens");
          this.displacement = this.querySelector("feDisplacementMap");
          window.addEventListener("pointermove", this.onPointerMove, { passive: true });
          window.addEventListener("pointerout", this.onPointerOut, { passive: true });
          window.addEventListener("blur", this.hide);
        }
        disconnectedCallback() {
          window.removeEventListener("pointermove", this.onPointerMove);
          window.removeEventListener("pointerout", this.onPointerOut);
          window.removeEventListener("blur", this.hide);
          cancelAnimationFrame(this.frame);
        }
        onPointerMove = (event) => {
          if (event.pointerType === "touch") return;
          const now = performance.now();
          const elapsed = Math.max(8, now - (this.pointer.time || now));
          const dx = event.clientX - this.pointer.x;
          const dy = event.clientY - this.pointer.y;
          const instantaneous = Math.hypot(dx, dy) / elapsed;
          this.pointer = {
            x: event.clientX,
            y: event.clientY,
            previousX: this.pointer.x,
            previousY: this.pointer.y,
            time: now,
            speed: this.pointer.speed * 0.64 + instantaneous * 0.36
          };
          const hit = document.elementFromPoint(event.clientX, event.clientY);
          const item = hit?.closest("[data-liquid-item]") ?? null;
          const surface = item?.closest("liquid-surface") ?? findSurfaceAtPoint(event.clientX, event.clientY);
          if (!surface || surface.closest("[hidden]") || !item && (!this.active || surface !== this.activeSurface)) {
            this.scheduleHide();
            return;
          }
          if (item) this.activeSurface = surface;
          window.clearTimeout(this.hideTimer);
          const itemRect = item?.getBoundingClientRect();
          const speedStretch = Math.min(30, this.pointer.speed * 18);
          const directWidth = itemRect ? Math.min(82, Math.max(MIN_WIDTH, itemRect.height * 1.06)) : MIN_WIDTH;
          const directHeight = itemRect ? Math.min(62, Math.max(MIN_HEIGHT, itemRect.height * 0.82)) : MIN_HEIGHT;
          const width = directWidth + speedStretch;
          const height = Math.max(44, directHeight - Math.min(8, speedStretch * 0.2));
          this.desired = {
            x: event.clientX - width / 2,
            y: event.clientY - height / 2,
            width,
            height
          };
          this.lens.classList.toggle("is-over-item", Boolean(item));
          this.show();
        };
        onPointerOut = (event) => {
          if (!event.relatedTarget) this.hide();
        };
        show() {
          if (!this.active) {
            this.active = true;
            this.current = { ...this.desired };
            this.velocity = { x: 0, y: 0, width: 0, height: 0 };
            this.lens.classList.add("is-visible");
          }
          if (!this.frame) {
            this.previousFrame = performance.now();
            this.frame = requestAnimationFrame(this.tick);
          }
        }
        scheduleHide() {
          window.clearTimeout(this.hideTimer);
          this.hideTimer = window.setTimeout(this.hide, 90);
        }
        hide = () => {
          window.clearTimeout(this.hideTimer);
          this.active = false;
          this.activeSurface = null;
          this.lens?.classList.remove("is-visible");
        };
        tick = (time) => {
          this.frame = 0;
          const dt = Math.min(0.032, Math.max(1e-3, (time - this.previousFrame) / 1e3));
          this.previousFrame = time;
          const enhanced = document.body.classList.contains("enhanced-animations");
          const stiffness = enhanced ? 340 : 520;
          const damping = enhanced ? 31 : 42;
          for (const key of ["x", "y", "width", "height"]) {
            const acceleration = (this.desired[key] - this.current[key]) * stiffness - this.velocity[key] * damping;
            this.velocity[key] += acceleration * dt;
            this.current[key] += this.velocity[key] * dt;
          }
          this.renderLens();
          if (this.active || !settled(this.current, this.desired, this.velocity)) {
            this.frame = requestAnimationFrame(this.tick);
          }
        };
        renderLens() {
          const geometry = this.current;
          this.lens.style.width = `${geometry.width}px`;
          this.lens.style.height = `${geometry.height}px`;
          this.lens.style.transform = `translate3d(${geometry.x}px, ${geometry.y}px, 0)`;
          const opticalSpeed = Math.min(1, Math.hypot(this.velocity.x, this.velocity.y) / 850);
          this.lens.style.setProperty("--liquid-speed", opticalSpeed.toFixed(3));
          this.displacement.setAttribute("scale", String(48 + opticalSpeed * 26));
        }
      };
    }
  });

  // src/core/history.ts
  function rankSites(items) {
    const hosts = /* @__PURE__ */ new Map();
    items.forEach((item) => {
      try {
        const url = new URL(String(item.url ?? ""));
        if (!["http:", "https:"].includes(url.protocol)) return;
        const host = url.hostname.replace(/^www\./, "").toLowerCase();
        if (!host || host === "newtab" || /(^|\.)google\.[a-z.]+$/.test(host)) return;
        const previous = hosts.get(host);
        hosts.set(host, {
          host,
          url: `${url.protocol}//${host}/`,
          title: host.split(".")[0] || host,
          count: (previous?.count ?? 0) + Math.max(1, Number(item.visitCount) || 1),
          lastVisit: Math.max(previous?.lastVisit ?? 0, Number(item.lastVisitTime) || 0)
        });
      } catch {
      }
    });
    return [...hosts.values()].sort((left, right) => right.count - left.count || right.lastVisit - left.lastVisit).slice(0, 20);
  }
  var init_history = __esm({
    "src/core/history.ts"() {
      "use strict";
    }
  });

  // src/components/recent-sites.ts
  var RecentSites;
  var init_recent_sites = __esm({
    "src/components/recent-sites.ts"() {
      "use strict";
      init_store();
      init_history();
      init_utils();
      init_base();
      RecentSites = class extends StoreElement {
        sites = [];
        loading = true;
        error = "";
        loaded = false;
        connectedCallback() {
          super.connectedCallback();
          if (!this.loaded) void this.load();
        }
        render() {
          this.hidden = !appStore.state.settings.layout.showRecent;
          this.innerHTML = `
            <section class="glass-panel recent-panel">
                <header class="recent-header">
                    <div><span class="section-kicker">\u5E38\u8BBF\u95EE</span><h2>\u6700\u8FD1\u5E38\u8BBF\u95EE\u7684\u7F51\u7AD9</h2></div>
                    <liquid-surface class="recent-actions"><button class="glass-button refresh-recent" type="button" data-liquid-item>\u5237\u65B0</button></liquid-surface>
                </header>
                <div class="recent-viewport">
                    <liquid-surface class="recent-track">
                        ${this.contentTemplate()}
                    </liquid-surface>
                </div>
            </section>
        `;
          this.querySelector(".refresh-recent")?.addEventListener("click", () => void this.load());
          this.querySelectorAll("img").forEach((image) => {
            image.addEventListener("error", () => {
              image.style.opacity = "0.3";
            });
          });
        }
        contentTemplate() {
          if (this.loading) return '<div class="recent-message">\u6B63\u5728\u6574\u7406\u6D4F\u89C8\u8BB0\u5F55\u2026</div>';
          if (this.error) return `<div class="recent-message">${escapeHtml(this.error)}</div>`;
          if (!this.sites.length) return '<div class="recent-message">\u6682\u65E0\u53EF\u5C55\u793A\u7684\u5386\u53F2\u8BB0\u5F55</div>';
          return this.sites.map((site) => `
            <a class="recent-card" href="${escapeHtml(site.url)}" data-liquid-item rel="noreferrer">
                <span class="recent-icon"><img src="${escapeHtml(faviconUrl(site.url))}" alt=""></span>
                <span class="recent-copy"><strong>${escapeHtml(truncate(site.title, 20))}</strong><small>${escapeHtml(site.host)}</small></span>
            </a>
        `).join("");
        }
        async load() {
          this.loaded = true;
          this.loading = true;
          this.error = "";
          this.render();
          if (!chrome.history?.search) {
            this.loading = false;
            this.error = "\u6D4F\u89C8\u5668\u672A\u5F00\u653E\u5386\u53F2\u8BB0\u5F55\u8BBF\u95EE";
            this.render();
            return;
          }
          try {
            const items = await new Promise((resolve, reject) => {
              chrome.history.search({
                text: "",
                startTime: Date.now() - 30 * 24 * 60 * 60 * 1e3,
                maxResults: 5e3
              }, (result) => {
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                else resolve(result ?? []);
              });
            });
            this.sites = rankSites(items);
          } catch {
            this.error = "\u8BFB\u53D6\u5386\u53F2\u8BB0\u5F55\u5931\u8D25";
          } finally {
            this.loading = false;
            this.render();
          }
        }
      };
    }
  });

  // src/components/search-command.ts
  var ENGINES, SearchCommand;
  var init_search_command = __esm({
    "src/components/search-command.ts"() {
      "use strict";
      init_store();
      init_utils();
      init_base();
      ENGINES = {
        google: { label: "Google", url: "https://www.google.com/search?q=" },
        bing: { label: "Bing", url: "https://www.bing.com/search?q=" },
        baidu: { label: "\u767E\u5EA6", url: "https://www.baidu.com/s?wd=" },
        duckduckgo: { label: "DuckDuckGo", url: "https://duckduckgo.com/?q=" }
      };
      SearchCommand = class extends StoreElement {
        render() {
          const { layout } = appStore.state.settings;
          const engine = ENGINES[layout.searchEngine];
          this.hidden = !layout.showSearch;
          this.innerHTML = `
            <form class="search-shell glass-panel" role="search">
                <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>
                <input name="query" type="search" autocomplete="off" list="search-history" placeholder="\u641C\u7D22\u7F51\u7EDC..." aria-label="\u641C\u7D22\u7F51\u7EDC">
                <span class="search-engine">${engine.label}</span>
                <datalist id="search-history">${appStore.state.recentSearches.slice(0, 8).map((item) => `<option value="${escapeHtml(item)}"></option>`).join("")}</datalist>
            </form>
        `;
          this.querySelector("form")?.addEventListener("submit", (event) => {
            event.preventDefault();
            const input = this.querySelector('input[name="query"]');
            const query = input?.value.trim() ?? "";
            if (!query) return;
            void appStore.saveRecentSearch(query);
            window.location.href = `${engine.url}${encodeURIComponent(query)}`;
          });
        }
      };
    }
  });

  // src/components/settings-drawer.ts
  function tabButton(tab, label, active) {
    return `<button type="button" role="tab" data-tab="${tab}" data-liquid-item class="settings-tab ${tab === active ? "is-active" : ""}" aria-selected="${tab === active}">${label}</button>`;
  }
  function toggle(name, label, checked) {
    return `<label class="toggle-row"><span>${label}</span><input type="checkbox" data-toggle="${name}" ${checked ? "checked" : ""}><i aria-hidden="true"></i></label>`;
  }
  function range(name, label, value, min, max, unit) {
    return `<label class="range-row"><span>${label}<output>${value}${unit}</output></span><input type="range" name="${name}" min="${min}" max="${max}" value="${value}" data-unit="${unit}"></label>`;
  }
  function showError2(error) {
    alert(error instanceof Error ? error.message : "\u64CD\u4F5C\u5931\u8D25");
  }
  var SettingsDrawer;
  var init_settings_drawer = __esm({
    "src/components/settings-drawer.ts"() {
      "use strict";
      init_backup_service();
      init_media_store();
      init_store();
      init_base();
      SettingsDrawer = class extends StoreElement {
        openState = false;
        activeTab = "appearance";
        open() {
          this.openState = true;
          this.render();
        }
        close() {
          this.openState = false;
          this.render();
        }
        render() {
          const settings = appStore.state.settings;
          this.innerHTML = `
            <aside class="settings-drawer glass-panel ${this.openState ? "is-open" : ""}" aria-hidden="${!this.openState}" ${this.openState ? "" : "inert"}>
                <header class="settings-header"><div><span class="section-kicker">\u4E2A\u6027\u5316\u63A7\u5236\u53F0</span><h2>\u8BBE\u7F6E</h2></div><button class="settings-close" type="button" aria-label="\u5173\u95ED">\xD7</button></header>
                <liquid-surface class="settings-tabs" role="tablist">
                    ${tabButton("appearance", "\u5916\u89C2", this.activeTab)}
                    ${tabButton("wallpaper", "\u58C1\u7EB8", this.activeTab)}
                    ${tabButton("layout", "\u5E03\u5C40", this.activeTab)}
                    ${tabButton("data", "\u6570\u636E", this.activeTab)}
                </liquid-surface>
                <div class="settings-pane">${this.paneTemplate(settings)}</div>
            </aside>
            <button class="settings-scrim ${this.openState ? "is-open" : ""}" type="button" aria-label="\u5173\u95ED\u8BBE\u7F6E"></button>
        `;
          this.bind();
        }
        paneTemplate(settings) {
          if (this.activeTab === "appearance") return `
            <label class="setting-field"><span>\u65F6\u949F\u683C\u5F0F</span><select data-setting="clockFormat"><option value="24h" ${settings.appearance.clockFormat === "24h" ? "selected" : ""}>24 \u5C0F\u65F6\u5236</option><option value="12h" ${settings.appearance.clockFormat === "12h" ? "selected" : ""}>12 \u5C0F\u65F6\u5236</option></select></label>
            <label class="setting-field"><span>\u641C\u7D22\u5F15\u64CE</span><select data-setting="searchEngine"><option value="google" ${settings.layout.searchEngine === "google" ? "selected" : ""}>Google</option><option value="bing" ${settings.layout.searchEngine === "bing" ? "selected" : ""}>Bing</option><option value="baidu" ${settings.layout.searchEngine === "baidu" ? "selected" : ""}>\u767E\u5EA6</option><option value="duckduckgo" ${settings.layout.searchEngine === "duckduckgo" ? "selected" : ""}>DuckDuckGo</option></select></label>
            ${toggle("enhancedAnimations", "\u589E\u5F3A\u52A8\u753B", settings.appearance.enhancedAnimations)}
            ${toggle("darkText", "\u4F7F\u7528\u6DF1\u8272\u6587\u5B57", settings.appearance.theme === "light")}
        `;
          if (this.activeTab === "wallpaper") return `
            <liquid-surface class="settings-button-stack">
                <button class="settings-action random-wallpaper" type="button" data-liquid-item>\u2726 \u4E8C\u6B21\u5143\u968F\u673A\u58C1\u7EB8</button>
                <label class="settings-action upload-wallpaper" data-liquid-item>\u2191 \u4E0A\u4F20\u672C\u5730\u56FE\u7247\u6216\u89C6\u9891<input type="file" accept="image/*,video/*" hidden></label>
                <button class="settings-action reset-wallpaper" type="button" data-liquid-item>\u21BB \u91CD\u7F6E\u9ED8\u8BA4\u58C1\u7EB8</button>
            </liquid-surface>
            ${range("blur", "\u6A21\u7CCA\u5EA6", settings.wallpaper.blur, 0, 10, "px")}
            ${range("overlay", "\u6697\u5EA6", settings.wallpaper.overlay, 0, 80, "%")}
        `;
          if (this.activeTab === "layout") return `
            ${toggle("showClock", "\u663E\u793A\u65F6\u949F\u4E0E\u65E5\u671F", settings.layout.showClock)}
            ${toggle("showSearch", "\u663E\u793A\u641C\u7D22\u6846", settings.layout.showSearch)}
            ${toggle("showBookmarks", "\u663E\u793A\u4E66\u7B7E\u4E0E\u6587\u4EF6\u5939", settings.layout.showBookmarks)}
            ${toggle("showStatus", "\u663E\u793A\u6D3B\u52A8\u4E0E\u7CFB\u7EDF\u72B6\u6001", settings.layout.showStatus)}
            ${toggle("showRecent", "\u663E\u793A\u6700\u8FD1\u5E38\u8BBF\u95EE", settings.layout.showRecent)}
        `;
          return `
            <liquid-surface class="settings-button-stack">
                <button class="settings-action export-data" type="button" data-liquid-item>\u2193 \u5BFC\u51FA\u6570\u636E</button>
                <label class="settings-action import-data" data-liquid-item>\u2191 \u5BFC\u5165\u6570\u636E<input type="file" accept="application/json,.json" hidden></label>
                <button class="settings-action danger reset-data" type="button" data-liquid-item>\u21BB \u91CD\u7F6E\u6240\u6709\u8BBE\u7F6E</button>
            </liquid-surface>
            <div class="data-note"><p>\u5BFC\u51FA\u6587\u4EF6\u5305\u542B\u4E66\u7B7E\u3001\u8BBE\u7F6E\u548C\u672C\u5730\u56FE\u7247/\u89C6\u9891\u58C1\u7EB8\u3002</p><p>\u517C\u5BB9\u65E7\u7248 1.0 \u4E0E 2.0 \u5907\u4EFD\uFF0C\u5BFC\u5165\u4F1A\u8986\u76D6\u5F53\u524D\u6570\u636E\u3002</p></div>
        `;
        }
        bind() {
          this.querySelector(".settings-close")?.addEventListener("click", () => this.close());
          this.querySelector(".settings-scrim")?.addEventListener("click", () => this.close());
          this.querySelectorAll("[data-tab]").forEach((button) => {
            button.addEventListener("click", () => {
              this.activeTab = button.dataset.tab;
              this.render();
            });
          });
          this.querySelector('[data-setting="clockFormat"]')?.addEventListener("change", (event) => {
            void appStore.updateSettings("appearance", { clockFormat: event.target.value });
          });
          this.querySelector('[data-setting="searchEngine"]')?.addEventListener("change", (event) => {
            void appStore.updateSettings("layout", { searchEngine: event.target.value });
          });
          this.querySelectorAll("input[data-toggle]").forEach((input) => {
            input.addEventListener("change", () => void this.applyToggle(input.dataset.toggle ?? "", input.checked));
          });
          this.querySelectorAll('input[type="range"]').forEach((input) => {
            input.addEventListener("input", () => {
              const output = input.closest("label")?.querySelector("output");
              if (output) output.textContent = `${input.value}${input.dataset.unit ?? ""}`;
            });
            input.addEventListener("change", () => void appStore.updateSettings("wallpaper", {
              [input.name]: Number(input.value)
            }));
          });
          this.querySelector(".random-wallpaper")?.addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("random-wallpaper", { bubbles: true, composed: true }));
          });
          this.querySelector(".upload-wallpaper input")?.addEventListener("change", (event) => {
            void this.uploadWallpaper(event.target.files?.[0]);
          });
          this.querySelector(".reset-wallpaper")?.addEventListener("click", () => void this.resetWallpaper());
          this.querySelector(".export-data")?.addEventListener("click", () => void this.exportData());
          this.querySelector(".import-data input")?.addEventListener("change", (event) => {
            void this.importData(event.target.files?.[0]);
          });
          this.querySelector(".reset-data")?.addEventListener("click", () => void this.resetData());
        }
        async applyToggle(name, checked) {
          const appearance = ["enhancedAnimations", "darkText"];
          try {
            if (name === "darkText") await appStore.updateSettings("appearance", { theme: checked ? "light" : "dark" });
            else if (appearance.includes(name)) await appStore.updateSettings("appearance", { [name]: checked });
            else await appStore.updateSettings("layout", { [name]: checked });
          } catch (error) {
            showError2(error);
          }
        }
        async uploadWallpaper(file) {
          if (!file) return;
          const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null;
          if (!kind) {
            alert("\u8BF7\u9009\u62E9\u56FE\u7247\u6216\u89C6\u9891\u6587\u4EF6\u3002");
            return;
          }
          try {
            await mediaStore.set(kind, file);
            await appStore.updateSettings("wallpaper", { type: kind === "video" ? "video" : "local", value: "local" });
          } catch (error) {
            showError2(error);
          }
        }
        async resetWallpaper() {
          try {
            await mediaStore.clearAll();
            await appStore.updateSettings("wallpaper", { type: "gradient", value: "", blur: 0, overlay: 30 });
          } catch (error) {
            showError2(error);
          }
        }
        async exportData() {
          try {
            await backupService.createBackup();
          } catch (error) {
            showError2(error);
          }
        }
        async importData(file) {
          if (!file || !confirm("\u5BFC\u5165\u4F1A\u8986\u76D6\u5F53\u524D\u4E66\u7B7E\u4E0E\u8BBE\u7F6E\uFF0C\u7EE7\u7EED\u5417\uFF1F")) return;
          try {
            await backupService.importData(await backupService.read(file));
            alert("\u5BFC\u5165\u5B8C\u6210\uFF0C\u65E7\u6570\u636E\u5DF2\u7ECF\u8F6C\u6362\u5230\u65B0\u7248\u672C\u3002");
          } catch (error) {
            showError2(error);
          }
        }
        async resetData() {
          if (!confirm("\u786E\u5B9A\u6E05\u7A7A\u6240\u6709\u4E66\u7B7E\u3001\u8BBE\u7F6E\u548C\u672C\u5730\u58C1\u7EB8\u5417\uFF1F\u6B64\u64CD\u4F5C\u65E0\u6CD5\u64A4\u9500\u3002")) return;
          try {
            await mediaStore.clearAll();
            await appStore.reset();
          } catch (error) {
            showError2(error);
          }
        }
      };
    }
  });

  // src/components/wallpaper-surface.ts
  var WallpaperSurface;
  var init_wallpaper_surface = __esm({
    "src/components/wallpaper-surface.ts"() {
      "use strict";
      init_media_store();
      init_store();
      init_base();
      WallpaperSurface = class extends StoreElement {
        objectUrl = "";
        renderToken = 0;
        disconnectedCallback() {
          super.disconnectedCallback();
          this.releaseObjectUrl();
        }
        render() {
          const token = ++this.renderToken;
          const wallpaper = appStore.state.settings.wallpaper;
          this.innerHTML = '<div class="wallpaper-media"></div><div class="wallpaper-tint"></div>';
          this.style.setProperty("--wallpaper-blur", `${wallpaper.blur}px`);
          this.style.setProperty("--wallpaper-overlay", String(wallpaper.overlay / 100));
          void this.applyMedia(token);
        }
        async applyMedia(token) {
          const wallpaper = appStore.state.settings.wallpaper;
          const host = this.querySelector(".wallpaper-media");
          if (!host) return;
          this.releaseObjectUrl();
          if (wallpaper.type === "video") {
            const blob = await mediaStore.get("video");
            if (!blob || token !== this.renderToken) return;
            this.objectUrl = URL.createObjectURL(blob);
            const video = document.createElement("video");
            video.src = this.objectUrl;
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            host.appendChild(video);
            void video.play().catch(() => void 0);
            return;
          }
          if (wallpaper.type === "local") {
            const blob = await mediaStore.get("image");
            if (!blob || token !== this.renderToken) return;
            this.objectUrl = URL.createObjectURL(blob);
            host.style.backgroundImage = `url("${this.objectUrl}")`;
            return;
          }
          if (wallpaper.type === "preset" && wallpaper.value) {
            host.style.backgroundImage = `url("${wallpaper.value.replaceAll('"', "%22")}")`;
          }
        }
        releaseObjectUrl() {
          if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
          this.objectUrl = "";
        }
      };
    }
  });

  // src/app.ts
  var require_app = __commonJS({
    "src/app.ts"() {
      init_store();
      init_chrome_fallback();
      init_utils();
      init_backup_toast();
      init_bookmark_dialog();
      init_bookmark_launchpad();
      init_dashboard_header();
      init_liquid_glass();
      init_recent_sites();
      init_search_command();
      init_settings_drawer();
      init_wallpaper_surface();
      var ANIME_WALLPAPER = "https://www.dmoe.cc/random.php";
      installChromeFallback();
      var InfinityNewTabApp = class extends HTMLElement {
        updateClasses = () => {
          const { appearance } = appStore.state.settings;
          document.body.classList.toggle("theme-light", appearance.theme === "light");
          document.body.classList.toggle("theme-dark", appearance.theme === "dark");
          document.body.classList.toggle("enhanced-animations", appearance.enhancedAnimations);
        };
        async connectedCallback() {
          this.innerHTML = '<div class="app-loading"><span></span><p>\u6B63\u5728\u6574\u7406\u4F60\u7684\u542F\u52A8\u53F0\u2026</p></div>';
          try {
            await appStore.init();
            this.updateClasses();
            appStore.addEventListener("change", this.updateClasses);
            this.render();
            window.addEventListener("keydown", this.onKeyDown);
          } catch (error) {
            this.innerHTML = `<div class="app-error"><h1>\u542F\u52A8\u53F0\u52A0\u8F7D\u5931\u8D25</h1><p>${escapeHtml(error instanceof Error ? error.message : "\u672A\u77E5\u9519\u8BEF")}</p></div>`;
          }
        }
        disconnectedCallback() {
          appStore.removeEventListener("change", this.updateClasses);
          window.removeEventListener("keydown", this.onKeyDown);
        }
        render() {
          this.innerHTML = `
            <wallpaper-surface></wallpaper-surface>
            <div class="ambient-orb orb-one"></div><div class="ambient-orb orb-two"></div>
            <liquid-surface class="floating-settings-surface"><button class="settings-trigger" type="button" data-liquid-item aria-label="\u6253\u5F00\u8BBE\u7F6E" title="\u8BBE\u7F6E"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5"></path><circle cx="16" cy="6" r="2"></circle><circle cx="8" cy="12" r="2"></circle><circle cx="13" cy="18" r="2"></circle></svg></button></liquid-surface>
            <main class="app-shell">
                <dashboard-header></dashboard-header>
                <search-command></search-command>
                <bookmark-launchpad></bookmark-launchpad>
                <recent-sites></recent-sites>
            </main>
            <settings-drawer></settings-drawer>
            <bookmark-dialog></bookmark-dialog>
            <backup-toast></backup-toast>
            <liquid-glass-layer></liquid-glass-layer>
        `;
          this.querySelector(".settings-trigger")?.addEventListener("click", () => {
            this.querySelector("settings-drawer")?.open();
          });
          this.addEventListener("random-wallpaper", () => void appStore.updateSettings("wallpaper", {
            type: "preset",
            value: `${ANIME_WALLPAPER}?t=${Date.now()}`
          }));
        }
        onKeyDown = (event) => {
          if (event.key === "/" && !isTypingTarget(event.target)) {
            event.preventDefault();
            this.querySelector("search-command input")?.focus();
          }
          if (event.key === "Escape") this.querySelector("settings-drawer")?.close();
        };
      };
      function isTypingTarget(target) {
        return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
      }
      var elements = [
        ["liquid-surface", LiquidSurface],
        ["liquid-glass-layer", LiquidGlassLayer],
        ["wallpaper-surface", WallpaperSurface],
        ["dashboard-header", DashboardHeader],
        ["search-command", SearchCommand],
        ["bookmark-launchpad", BookmarkLaunchpad],
        ["recent-sites", RecentSites],
        ["settings-drawer", SettingsDrawer],
        ["bookmark-dialog", BookmarkDialog],
        ["backup-toast", BackupToast],
        ["infinity-newtab-app", InfinityNewTabApp]
      ];
      elements.forEach(([name, constructor]) => {
        if (!customElements.get(name)) customElements.define(name, constructor);
      });
    }
  });
  require_app();
})();
