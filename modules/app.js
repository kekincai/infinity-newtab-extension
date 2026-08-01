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
        hdrHighlights: booleanOr(appearance.hdrHighlights, true),
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
          hdrHighlights: true,
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
                <div class="backup-actions"><button class="glass-button primary backup-now" type="button" data-liquid-item>\u7ACB\u5373\u5BFC\u51FA</button><button class="glass-button backup-later" type="button" data-liquid-item>\u7A0D\u540E</button></div>
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
                    <div class="dialog-actions"><button class="glass-button cancel-dialog" type="button" data-liquid-item>\u53D6\u6D88</button><button class="glass-button primary" type="submit" data-liquid-item>\u4FDD\u5B58</button></div>
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
                    <div class="launchpad-actions">
                        <button class="glass-button anime-wallpaper" type="button" data-liquid-item>\u6362\u5F20\u4E8C\u6B21\u5143\u58C1\u7EB8</button>
                        <button class="glass-button primary create-folder" type="button" data-liquid-item>\u65B0\u5EFA\u6587\u4EF6\u5939</button>
                    </div>
                </header>
                <div class="launchpad-grid">
                    ${folderCards}
                    ${this.currentFolder === "\u5168\u90E8" ? this.addFolderTemplate() : ""}
                    ${visible.map((bookmark) => this.bookmarkTemplate(bookmark)).join("")}
                    ${!folderCards && !visible.length ? '<div class="empty-launchpad">\u8FD9\u91CC\u8FD8\u6CA1\u6709\u4E66\u7B7E</div>' : ""}
                </div>
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
                <article class="glass-panel status-panel status-panel-wide" data-liquid-item>
                    <span class="section-kicker">\u6D3B\u52A8</span>
                    <div class="status-pills">
                        <button class="status-chip is-media" type="button" data-liquid-item>\u65E0\u5A92\u4F53\u64AD\u653E</button>
                        <button class="status-chip is-download" type="button" data-liquid-item>\u65E0\u4E0B\u8F7D</button>
                    </div>
                </article>
                <article class="glass-panel status-panel" data-liquid-item>
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

  // src/components/liquid-optics.ts
  function opticalShapeKey(shape) {
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    return `${shape.width}x${shape.height}r${shape.radius}@${ratio}`;
  }
  function convexSquircle(value) {
    return Math.pow(1 - Math.pow(1 - value, 4), 1 / 4);
  }
  function precalculateDisplacements(distanceToBackdrop = DISTANCE_TO_BACKDROP, glassThickness = GLASS_THICKNESS, surface = convexSquircle, refractiveIndex = REFRACTIVE_INDEX, samples = RADIAL_SAMPLE_COUNT) {
    const ratio = 1 / refractiveIndex;
    const refract = (normalX, normalY) => {
      const discriminant = 1 - ratio * ratio * (1 - normalY * normalY);
      if (discriminant < 0) return null;
      const root = Math.sqrt(discriminant);
      return [
        -(ratio * normalY + root) * normalX,
        ratio - (ratio * normalY + root) * normalY
      ];
    };
    return Array.from({ length: samples }, (_, index) => {
      const distanceFromSide = index / samples;
      const height = surface(distanceFromSide);
      const delta = distanceFromSide < 1 ? 1e-4 : -1e-4;
      const derivative = (surface(distanceFromSide + delta) - height) / delta;
      const normalLength = Math.hypot(derivative, 1);
      const refracted = refract(-derivative / normalLength, -1 / normalLength);
      if (!refracted) return 0;
      const depth = height * glassThickness + distanceToBackdrop;
      return refracted[0] * (depth / refracted[1]);
    });
  }
  function createOpticalMaps(shape) {
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const radius = clamp(shape.radius, 2, Math.min(shape.width, shape.height) / 2);
    const bezelWidth = Math.max(2, radius * 0.75);
    const displacements = precalculateDisplacements();
    const maximumDisplacement = Math.max(...displacements.map(Math.abs));
    return {
      magnifying: imageDataUrl(createMagnifyingMap(
        shape.width,
        shape.height,
        pixelRatio
      )),
      displacement: imageDataUrl(createDisplacementMap(
        shape.width,
        shape.height,
        radius,
        bezelWidth,
        maximumDisplacement,
        displacements,
        pixelRatio
      )),
      specular: imageDataUrl(createSpecularMap(
        shape.width,
        shape.height,
        radius,
        bezelWidth,
        SPECULAR_ANGLE,
        pixelRatio
      )),
      maximumDisplacement
    };
  }
  function createMagnifyingMap(width, height, pixelRatio) {
    const canvasWidth = Math.max(1, Math.round(width * pixelRatio));
    const canvasHeight = Math.max(1, Math.round(height * pixelRatio));
    const image = new ImageData(canvasWidth, canvasHeight);
    for (let y = 0; y < canvasHeight; y += 1) {
      for (let x = 0; x < canvasWidth; x += 1) {
        const normalizedX = (x + 0.5) / canvasWidth * 2 - 1;
        const normalizedY = (y + 0.5) / canvasHeight * 2 - 1;
        const distance = Math.hypot(normalizedX, normalizedY);
        const strength = distance < 1 ? 1 - smoothstep(0.08, 0.94, distance) : 0;
        const index = (y * canvasWidth + x) * 4;
        image.data[index] = 128 - normalizedX * strength * 112;
        image.data[index + 1] = 128 - normalizedY * strength * 112;
        image.data[index + 2] = 128;
        image.data[index + 3] = 255;
      }
    }
    return image;
  }
  function createDisplacementMap(width, height, radius, bezelWidth, maximumDisplacement, displacements, pixelRatio) {
    const canvasWidth = Math.max(1, Math.round(width * pixelRatio));
    const canvasHeight = Math.max(1, Math.round(height * pixelRatio));
    const image = new ImageData(canvasWidth, canvasHeight);
    new Uint32Array(image.data.buffer).fill(4278222976);
    const scaledRadius = radius * pixelRatio;
    const scaledBezel = bezelWidth * pixelRatio;
    const radiusSquared = scaledRadius ** 2;
    const outerSquared = (scaledRadius + 1) ** 2;
    const innerSquared = (scaledRadius - scaledBezel) ** 2;
    const middleWidth = canvasWidth - scaledRadius * 2;
    const middleHeight = canvasHeight - scaledRadius * 2;
    for (let y = 0; y < canvasHeight; y += 1) {
      for (let x = 0; x < canvasWidth; x += 1) {
        const left = x < scaledRadius;
        const right = x >= canvasWidth - scaledRadius;
        const top = y < scaledRadius;
        const bottom = y >= canvasHeight - scaledRadius;
        const offsetX = left ? x - scaledRadius : right ? x - scaledRadius - middleWidth : 0;
        const offsetY = top ? y - scaledRadius : bottom ? y - scaledRadius - middleHeight : 0;
        const distanceSquared = offsetX * offsetX + offsetY * offsetY;
        if (distanceSquared > outerSquared || distanceSquared < innerSquared) continue;
        const distance = Math.sqrt(distanceSquared);
        if (!distance) continue;
        const antiAlias = distanceSquared < radiusSquared ? 1 : 1 - (distance - scaledRadius);
        const distanceFromBorder = scaledRadius - distance;
        const sample = Math.floor(distanceFromBorder / scaledBezel * displacements.length);
        const magnitude = displacements[sample] ?? 0;
        const normalizedX = -(offsetX / distance) * magnitude / maximumDisplacement;
        const normalizedY = -(offsetY / distance) * magnitude / maximumDisplacement;
        const index = (y * canvasWidth + x) * 4;
        image.data[index] = 128 + normalizedX * 127 * antiAlias;
        image.data[index + 1] = 128 + normalizedY * 127 * antiAlias;
        image.data[index + 2] = 0;
        image.data[index + 3] = 255;
      }
    }
    return image;
  }
  function createSpecularMap(width, height, radius, bezelWidth, angle, pixelRatio) {
    const canvasWidth = Math.max(1, Math.round(width * pixelRatio));
    const canvasHeight = Math.max(1, Math.round(height * pixelRatio));
    const image = new ImageData(canvasWidth, canvasHeight);
    const scaledRadius = radius * pixelRatio;
    const scaledBezel = bezelWidth * pixelRatio;
    const radiusSquared = scaledRadius ** 2;
    const outerSquared = (scaledRadius + pixelRatio) ** 2;
    const innerSquared = (scaledRadius - scaledBezel) ** 2;
    const middleWidth = canvasWidth - scaledRadius * 2;
    const middleHeight = canvasHeight - scaledRadius * 2;
    const light = [Math.cos(angle), Math.sin(angle)];
    for (let y = 0; y < canvasHeight; y += 1) {
      for (let x = 0; x < canvasWidth; x += 1) {
        const left = x < scaledRadius;
        const right = x >= canvasWidth - scaledRadius;
        const top = y < scaledRadius;
        const bottom = y >= canvasHeight - scaledRadius;
        const offsetX = left ? x - scaledRadius : right ? x - scaledRadius - middleWidth : 0;
        const offsetY = top ? y - scaledRadius : bottom ? y - scaledRadius - middleHeight : 0;
        const distanceSquared = offsetX * offsetX + offsetY * offsetY;
        if (distanceSquared > outerSquared || distanceSquared < innerSquared) continue;
        const distance = Math.sqrt(distanceSquared);
        if (!distance) continue;
        const distanceFromBorder = scaledRadius - distance;
        const antiAlias = distanceSquared < radiusSquared ? 1 : 1 - (distance - scaledRadius) / pixelRatio;
        const normalX = offsetX / distance;
        const normalY = -offsetY / distance;
        const highlight = Math.abs(normalX * light[0] + normalY * light[1]) * Math.sqrt(Math.max(0, 1 - (1 - distanceFromBorder / pixelRatio) ** 2));
        const brightness = 255 * highlight;
        const index = (y * canvasWidth + x) * 4;
        image.data[index] = brightness;
        image.data[index + 1] = brightness;
        image.data[index + 2] = brightness;
        image.data[index + 3] = brightness * highlight * antiAlias;
      }
    }
    return image;
  }
  function imageDataUrl(image) {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) return "";
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  }
  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }
  function smoothstep(start, end, value) {
    const progress = clamp((value - start) / (end - start), 0, 1);
    return progress * progress * (3 - 2 * progress);
  }
  var REFRACTIVE_INDEX, RADIAL_SAMPLE_COUNT, DISTANCE_TO_BACKDROP, GLASS_THICKNESS, SPECULAR_ANGLE;
  var init_liquid_optics = __esm({
    "src/components/liquid-optics.ts"() {
      "use strict";
      REFRACTIVE_INDEX = 1.5;
      RADIAL_SAMPLE_COUNT = 128;
      DISTANCE_TO_BACKDROP = 55;
      GLASS_THICKNESS = 63;
      SPECULAR_ANGLE = -Math.PI / 3;
    }
  });

  // src/components/liquid-glass.ts
  function findItem(target) {
    const item = target instanceof Element ? target.closest(ITEM_SELECTOR) : null;
    return item instanceof HTMLElement && item.getClientRects().length ? item : null;
  }
  function geometryFor(item) {
    const rect = item.getBoundingClientRect();
    const padding = Math.min(14, Math.max(LENS_PADDING, Math.min(rect.width, rect.height) * 0.08));
    const radius = resolveRadius(getComputedStyle(item).borderTopLeftRadius, rect.width, rect.height);
    return normalizeGeometry({
      x: rect.left - padding,
      y: rect.top - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      radius: radius + padding
    });
  }
  function normalizeGeometry(geometry) {
    const width = Math.max(24, geometry.width);
    const height = Math.max(24, geometry.height);
    return {
      x: geometry.x,
      y: geometry.y,
      width,
      height,
      radius: clamp2(geometry.radius, 8, Math.min(width, height) / 2)
    };
  }
  function normalizeShape(geometry) {
    const normalized = normalizeGeometry({ ...geometry, x: 0, y: 0 });
    return {
      width: Math.max(24, Math.round(normalized.width)),
      height: Math.max(24, Math.round(normalized.height)),
      radius: Math.max(8, Math.round(normalized.radius))
    };
  }
  function centerOf(geometry) {
    return { x: geometry.x + geometry.width / 2, y: geometry.y + geometry.height / 2 };
  }
  function directionalItem(source, items, point) {
    const sourceRect = source.getBoundingClientRect();
    const sourceCenter = { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 };
    const pointerDelta = { x: point.x - sourceCenter.x, y: point.y - sourceCenter.y };
    const horizontal = Math.abs(pointerDelta.x) >= Math.abs(pointerDelta.y);
    let nearest = null;
    let distance = Number.POSITIVE_INFINITY;
    items.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const candidateDelta = { x: center.x - sourceCenter.x, y: center.y - sourceCenter.y };
      const sameLane = horizontal ? Math.abs(candidateDelta.y) <= (sourceRect.height + rect.height) * 0.35 : Math.abs(candidateDelta.x) <= (sourceRect.width + rect.width) * 0.35;
      const forward = horizontal ? candidateDelta.x * pointerDelta.x > 0 : candidateDelta.y * pointerDelta.y > 0;
      if (!sameLane || !forward) return;
      const candidateDistance = Math.hypot(point.x - center.x, point.y - center.y);
      if (candidateDistance < distance) {
        nearest = item;
        distance = candidateDistance;
      }
    });
    return nearest;
  }
  function groupBounds(items) {
    if (!items.length) return new DOMRect();
    const rects = items.map((item) => item.getBoundingClientRect());
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return new DOMRect(left, top, right - left, bottom - top);
  }
  function containsPoint(rect, point, margin) {
    return point.x >= rect.left - margin && point.x <= rect.right + margin && point.y >= rect.top - margin && point.y <= rect.bottom + margin;
  }
  function targetName(item) {
    return item.className || item.tagName.toLowerCase();
  }
  function resolveRadius(value, width, height) {
    if (value.endsWith("%")) return Math.min(width, height) * Number.parseFloat(value) / 100;
    return Number.parseFloat(value) || Math.min(width, height) / 2;
  }
  async function decodeOpticalMaps(maps) {
    await Promise.all([maps.magnifying, maps.displacement, maps.specular].map((source) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () => resolve();
      image.src = source;
      if (image.complete) resolve();
    })));
  }
  function clamp2(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }
  function lerp(from, to, progress) {
    return from + (to - from) * progress;
  }
  var ITEM_SELECTOR, LENS_PADDING, GROUP_MARGIN, MAGNIFICATION_SCALE, REFRACTION_LEVEL, MAP_CACHE, MAP_READY_CACHE, nextFilterId, LiquidGlassSystem;
  var init_liquid_glass = __esm({
    "src/components/liquid-glass.ts"() {
      "use strict";
      init_liquid_optics();
      ITEM_SELECTOR = "[data-liquid-item]";
      LENS_PADDING = 8;
      GROUP_MARGIN = 20;
      MAGNIFICATION_SCALE = 26;
      REFRACTION_LEVEL = 0.92;
      MAP_CACHE = /* @__PURE__ */ new Map();
      MAP_READY_CACHE = /* @__PURE__ */ new Map();
      nextFilterId = 0;
      LiquidGlassSystem = class extends HTMLElement {
        lens = document.createElement("span");
        defs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        filterContainer = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        activeItem = null;
        activeGroup = null;
        filter = null;
        filterImages = [];
        filterVersion = 0;
        mapShapeKey = "";
        hideTimer = 0;
        connectedCallback() {
          this.lens.className = "liquid-glass-lens";
          this.lens.setAttribute("aria-hidden", "true");
          this.defs.classList.add("liquid-filter-defs");
          this.defs.setAttribute("aria-hidden", "true");
          this.defs.append(this.filterContainer);
          this.append(this.defs, this.lens);
          document.addEventListener("pointerover", this.onPointerOver, true);
          document.addEventListener("pointermove", this.onPointerMove, { passive: true, capture: true });
          document.addEventListener("pointerdown", this.onPointerDown, true);
          document.addEventListener("focusin", this.onFocusIn, true);
          document.addEventListener("focusout", this.onFocusOut, true);
          window.addEventListener("resize", this.onViewportChange);
          window.addEventListener("scroll", this.onViewportChange, true);
        }
        disconnectedCallback() {
          document.removeEventListener("pointerover", this.onPointerOver, true);
          document.removeEventListener("pointermove", this.onPointerMove, true);
          document.removeEventListener("pointerdown", this.onPointerDown, true);
          document.removeEventListener("focusin", this.onFocusIn, true);
          document.removeEventListener("focusout", this.onFocusOut, true);
          window.removeEventListener("resize", this.onViewportChange);
          window.removeEventListener("scroll", this.onViewportChange, true);
          window.clearTimeout(this.hideTimer);
        }
        onPointerOver = (event) => {
          const item = findItem(event.target);
          if (item) this.activate(item);
        };
        onPointerMove = (event) => {
          const item = findItem(event.target);
          if (item) {
            if (item !== this.activeItem) this.activate(item);
            return;
          }
          if (!this.activeItem || !this.activeGroup) return;
          const point = { x: event.clientX, y: event.clientY };
          if (!containsPoint(groupBounds(this.groupItems()), point, GROUP_MARGIN)) {
            this.scheduleHide();
            return;
          }
          this.cancelHide();
          this.renderBetween(point);
        };
        onPointerDown = (event) => {
          const item = findItem(event.target);
          if (!item) return;
          this.activate(item);
          this.lens.classList.add("is-pressed");
          window.addEventListener("pointerup", this.releasePress, { once: true });
          window.addEventListener("pointercancel", this.releasePress, { once: true });
        };
        releasePress = () => this.lens.classList.remove("is-pressed");
        onFocusIn = (event) => {
          const item = findItem(event.target);
          if (item) this.activate(item);
        };
        onFocusOut = (event) => {
          if (!findItem(event.relatedTarget)) this.scheduleHide(80);
        };
        onViewportChange = () => {
          if (this.activeItem?.isConnected) this.render(geometryFor(this.activeItem));
          else this.hide();
        };
        activate(item) {
          this.cancelHide();
          this.activeItem = item;
          this.activeGroup = item.parentElement;
          this.lens.dataset.liquidTarget = targetName(item);
          this.lens.classList.add("is-visible");
          this.render(geometryFor(item));
        }
        renderBetween(pointer) {
          const source = this.activeItem;
          if (!source) return;
          const candidates = this.groupItems().filter((item) => item !== source);
          const destination = directionalItem(source, candidates, pointer);
          if (!destination) {
            this.scheduleHide(120);
            return;
          }
          const from = geometryFor(source);
          const to = geometryFor(destination);
          const fromCenter = centerOf(from);
          const toCenter = centerOf(to);
          const deltaX = toCenter.x - fromCenter.x;
          const deltaY = toCenter.y - fromCenter.y;
          const distanceSquared = deltaX ** 2 + deltaY ** 2;
          if (!distanceSquared) return;
          const progress = clamp2(
            ((pointer.x - fromCenter.x) * deltaX + (pointer.y - fromCenter.y) * deltaY) / distanceSquared,
            0,
            1
          );
          const bridge = Math.sin(Math.PI * progress);
          const horizontal = Math.abs(deltaX) >= Math.abs(deltaY);
          const travel = Math.sqrt(distanceSquared);
          let width = lerp(from.width, to.width, progress);
          let height = lerp(from.height, to.height, progress);
          const stretch = Math.min(72, travel * 0.27) * bridge;
          if (horizontal) {
            width += stretch;
            height *= 1 - bridge * 0.11;
          } else {
            height += stretch;
            width *= 1 - bridge * 0.11;
          }
          const centerX = lerp(fromCenter.x, toCenter.x, progress);
          const centerY = lerp(fromCenter.y, toCenter.y, progress);
          this.lens.dataset.liquidProgress = progress.toFixed(3);
          this.lens.classList.toggle("is-bridging", progress > 0.01 && progress < 0.99);
          this.render({
            x: centerX - width / 2,
            y: centerY - height / 2,
            width,
            height,
            radius: lerp(from.radius, to.radius, progress) + bridge * 8
          }, false);
        }
        render(geometry, refreshMaps = true) {
          this.lens.style.setProperty("--liquid-x", `${geometry.x}px`);
          this.lens.style.setProperty("--liquid-y", `${geometry.y}px`);
          this.lens.style.setProperty("--liquid-width", `${geometry.width}px`);
          this.lens.style.setProperty("--liquid-height", `${geometry.height}px`);
          this.lens.style.setProperty("--liquid-radius", `${geometry.radius}px`);
          this.sizeFilter(geometry);
          if (refreshMaps) void this.ensureFilter(geometry);
        }
        async ensureFilter(geometry) {
          const shape = normalizeShape(geometry);
          const key = opticalShapeKey(shape);
          if (key === this.mapShapeKey && this.filter) return;
          this.mapShapeKey = key;
          const version = ++this.filterVersion;
          const maps = MAP_CACHE.get(key) ?? createOpticalMaps(shape);
          MAP_CACHE.set(key, maps);
          const ready = MAP_READY_CACHE.get(key) ?? decodeOpticalMaps(maps);
          MAP_READY_CACHE.set(key, ready);
          await ready;
          if (version !== this.filterVersion || !this.isConnected) return;
          this.installFilter(shape, maps);
        }
        installFilter(shape, maps) {
          this.filter?.remove();
          const id = `infinity-liquid-lens-${++nextFilterId}`;
          const template = document.createElement("template");
          template.innerHTML = `
            <filter id="${id}" color-interpolation-filters="sRGB">
                <feImage href="${maps.magnifying}" x="0" y="0" width="${shape.width}" height="${shape.height}" preserveAspectRatio="none" result="magnifying_displacement_map" data-optical-map="magnifying"></feImage>
                <feDisplacementMap in="SourceGraphic" in2="magnifying_displacement_map" scale="${MAGNIFICATION_SCALE}" xChannelSelector="R" yChannelSelector="G" result="magnified_source"></feDisplacementMap>
                <feGaussianBlur in="magnified_source" stdDeviation="0.2" result="blurred_source"></feGaussianBlur>
                <feImage href="${maps.displacement}" x="0" y="0" width="${shape.width}" height="${shape.height}" preserveAspectRatio="none" result="displacement_map" data-optical-map="displacement"></feImage>
                <feDisplacementMap in="blurred_source" in2="displacement_map" scale="${maps.maximumDisplacement * REFRACTION_LEVEL}" xChannelSelector="R" yChannelSelector="G" result="displaced"></feDisplacementMap>
                <feColorMatrix in="displaced" type="saturate" values="5" result="displaced_saturated"></feColorMatrix>
                <feImage href="${maps.specular}" x="0" y="0" width="${shape.width}" height="${shape.height}" preserveAspectRatio="none" result="specular_layer" data-optical-map="specular"></feImage>
                <feComposite in="displaced_saturated" in2="specular_layer" operator="in" result="specular_saturated"></feComposite>
                <feComponentTransfer in="specular_layer" result="specular_faded"><feFuncA type="linear" slope="0.42"></feFuncA></feComponentTransfer>
                <feBlend in="specular_saturated" in2="displaced" mode="normal" result="withSaturation"></feBlend>
                <feBlend in="specular_faded" in2="withSaturation" mode="normal"></feBlend>
            </filter>`;
          const filter = template.content.firstElementChild;
          filter.dataset.maximumDisplacement = String(maps.maximumDisplacement);
          filter.dataset.liquidShape = opticalShapeKey(shape);
          this.filterContainer.append(filter);
          this.filter = filter;
          this.filterImages = Array.from(filter.querySelectorAll("feImage"));
          this.lens.style.setProperty("--liquid-filter", `url("#${id}")`);
          this.lens.dataset.liquidFilterId = id;
          this.sizeFilter(shape);
        }
        sizeFilter(geometry) {
          this.filterImages.forEach((image) => {
            image.setAttribute("width", String(Math.round(geometry.width)));
            image.setAttribute("height", String(Math.round(geometry.height)));
          });
        }
        groupItems() {
          if (!this.activeGroup) return [];
          return Array.from(this.activeGroup.children).filter(
            (child) => child instanceof HTMLElement && child.matches(ITEM_SELECTOR)
          );
        }
        scheduleHide(delay = 150) {
          if (this.hideTimer) return;
          this.hideTimer = window.setTimeout(() => {
            this.hideTimer = 0;
            this.hide();
          }, delay);
        }
        cancelHide() {
          if (!this.hideTimer) return;
          window.clearTimeout(this.hideTimer);
          this.hideTimer = 0;
        }
        hide() {
          this.activeItem = null;
          this.activeGroup = null;
          this.lens.classList.remove("is-visible", "is-bridging", "is-pressed");
          delete this.lens.dataset.liquidProgress;
          delete this.lens.dataset.liquidTarget;
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
            <section class="glass-panel recent-panel" data-liquid-item>
                <header class="recent-header">
                    <div><span class="section-kicker">\u5E38\u8BBF\u95EE</span><h2>\u6700\u8FD1\u5E38\u8BBF\u95EE\u7684\u7F51\u7AD9</h2></div>
                    <div class="recent-actions"><button class="glass-button refresh-recent" type="button" data-liquid-item>\u5237\u65B0</button></div>
                </header>
                <div class="recent-viewport">
                    <div class="recent-track">
                        ${this.contentTemplate()}
                    </div>
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
            <form class="search-shell glass-panel" role="search" data-liquid-item>
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
  function tabButton(tab, label, icon, active) {
    return `<button type="button" role="tab" data-tab="${tab}" data-liquid-item class="settings-tab ${tab === active ? "is-active" : ""}" aria-selected="${tab === active}"><i aria-hidden="true">${icon}</i><span>${label}</span></button>`;
  }
  function paneHeader(title, description) {
    return `<header class="settings-pane-header"><h3>${title}</h3><p>${description}</p></header>`;
  }
  function toggle(name, label, checked, description = "") {
    return `<label class="toggle-row"><span class="toggle-copy"><strong>${label}</strong>${description ? `<small>${description}</small>` : ""}</span><input type="checkbox" data-toggle="${name}" ${checked ? "checked" : ""}><i aria-hidden="true"></i></label>`;
  }
  function hdrDescription() {
    const hdrDisplay = window.matchMedia("(dynamic-range: high)").matches && CSS.supports("dynamic-range-limit", "no-limit");
    if (!hdrDisplay) return "\u5F53\u524D\u4E3A SDR\uFF0C\u8FDE\u63A5 HDR \u5C4F\u5E55\u540E\u81EA\u52A8\u542F\u7528";
    return CSS.supports("color", "color(rec2100-pq 0.64 0.64 0.64)") ? "HDR \u5A92\u4F53\u4E0E Rec.2100 PQ \u73BB\u7483\u9AD8\u5149\u5747\u5DF2\u542F\u7528" : "HDR \u5A92\u4F53\u5DF2\u542F\u7528\uFF0C\u73BB\u7483\u9AD8\u5149\u4F7F\u7528\u6D4F\u89C8\u5668\u517C\u5BB9\u8272";
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
                <header class="settings-header">
                    <span class="settings-brand" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
                    <div><span class="section-kicker">Infinity \u63A7\u5236\u53F0</span><h2>\u8BBE\u7F6E</h2></div>
                    <button class="settings-close" type="button" aria-label="\u5173\u95ED">\xD7</button>
                </header>
                <div class="settings-workspace">
                    <div class="settings-tabs" role="tablist">
                        ${tabButton("appearance", "\u5916\u89C2", "\u25CC", this.activeTab)}
                        ${tabButton("wallpaper", "\u58C1\u7EB8", "\u25C7", this.activeTab)}
                        ${tabButton("layout", "\u5E03\u5C40", "\u229E", this.activeTab)}
                        ${tabButton("data", "\u6570\u636E", "\u21C4", this.activeTab)}
                    </div>
                    <div class="settings-pane">${this.paneTemplate(settings)}</div>
                </div>
            </aside>
            <button class="settings-scrim ${this.openState ? "is-open" : ""}" type="button" aria-label="\u5173\u95ED\u8BBE\u7F6E"></button>
        `;
          this.bind();
        }
        paneTemplate(settings) {
          if (this.activeTab === "appearance") return `
            ${paneHeader("\u5916\u89C2", "\u51B3\u5B9A\u65F6\u95F4\u3001\u641C\u7D22\u548C\u4EA4\u4E92\u5448\u73B0\u65B9\u5F0F\u3002")}
            <section class="settings-group">
                <h3>\u57FA\u7840\u504F\u597D</h3>
                <label class="setting-field"><span>\u65F6\u949F\u683C\u5F0F</span><select data-setting="clockFormat"><option value="24h" ${settings.appearance.clockFormat === "24h" ? "selected" : ""}>24 \u5C0F\u65F6\u5236</option><option value="12h" ${settings.appearance.clockFormat === "12h" ? "selected" : ""}>12 \u5C0F\u65F6\u5236</option></select></label>
                <label class="setting-field"><span>\u641C\u7D22\u5F15\u64CE</span><select data-setting="searchEngine"><option value="google" ${settings.layout.searchEngine === "google" ? "selected" : ""}>Google</option><option value="bing" ${settings.layout.searchEngine === "bing" ? "selected" : ""}>Bing</option><option value="baidu" ${settings.layout.searchEngine === "baidu" ? "selected" : ""}>\u767E\u5EA6</option><option value="duckduckgo" ${settings.layout.searchEngine === "duckduckgo" ? "selected" : ""}>DuckDuckGo</option></select></label>
            </section>
            <section class="settings-group settings-list">
                <h3>\u89C6\u89C9\u4F53\u9A8C</h3>
                ${toggle("enhancedAnimations", "\u589E\u5F3A\u52A8\u753B", settings.appearance.enhancedAnimations, "\u542F\u7528\u8FDB\u573A\u52A8\u753B\u4E0E Liquid Glass \u5F62\u53D8")}
                ${toggle("hdrHighlights", "HDR \u9AD8\u5149", settings.appearance.hdrHighlights, hdrDescription())}
                ${toggle("darkText", "\u4F7F\u7528\u6DF1\u8272\u6587\u5B57", settings.appearance.theme === "light", "\u6D45\u8272\u58C1\u7EB8\u63A8\u8350\u5F00\u542F\uFF0C\u6DF1\u8272\u58C1\u7EB8\u53EF\u5173\u95ED")}
            </section>
        `;
          if (this.activeTab === "wallpaper") return `
            ${paneHeader("\u58C1\u7EB8", "\u8BA9\u542F\u52A8\u53F0\u9002\u914D\u56FE\u7247\u3001\u89C6\u9891\u548C\u4E0D\u540C\u660E\u6697\u80CC\u666F\u3002")}
            <section class="settings-group">
                <h3>\u58C1\u7EB8\u6765\u6E90</h3>
                <div class="settings-button-stack">
                    <button class="settings-action settings-action-featured random-wallpaper" type="button" data-liquid-item><b>\u2726</b><span>\u6362\u4E00\u5F20\u4E8C\u6B21\u5143\u58C1\u7EB8<small>\u4ECE\u5728\u7EBF\u56FE\u6E90\u968F\u673A\u83B7\u53D6</small></span></button>
                    <label class="settings-action upload-wallpaper" data-liquid-item><b>\u2191</b><span>\u4E0A\u4F20\u672C\u5730\u56FE\u7247\u6216\u89C6\u9891<small>\u89C6\u9891\u4F1A\u81EA\u52A8\u9759\u97F3\u5FAA\u73AF\u64AD\u653E</small></span><input type="file" accept="image/*,video/*" hidden></label>
                    <button class="settings-action reset-wallpaper" type="button" data-liquid-item><b>\u21BB</b><span>\u6062\u590D\u9ED8\u8BA4\u80CC\u666F</span></button>
                </div>
            </section>
            <section class="settings-group">
                <h3>\u753B\u9762\u8C03\u8282</h3>
                ${range("blur", "\u6A21\u7CCA\u5EA6", settings.wallpaper.blur, 0, 10, "px")}
                ${range("overlay", "\u6697\u5EA6", settings.wallpaper.overlay, 0, 80, "%")}
            </section>
        `;
          if (this.activeTab === "layout") return `
            ${paneHeader("\u5E03\u5C40", "\u53EA\u4FDD\u7559\u4F60\u6BCF\u5929\u771F\u6B63\u4F1A\u770B\u7684\u533A\u57DF\u3002")}
            <section class="settings-group settings-list">
                <h3>\u684C\u9762\u7EC4\u4EF6</h3>
                ${toggle("showClock", "\u65F6\u949F\u4E0E\u65E5\u671F", settings.layout.showClock, "\u663E\u793A\u5728\u9875\u9762\u9876\u90E8\u5DE6\u4FA7")}
                ${toggle("showSearch", "\u641C\u7D22\u6846", settings.layout.showSearch, "\u4F7F\u7528\u659C\u6760\u952E\u53EF\u5FEB\u901F\u805A\u7126")}
                ${toggle("showBookmarks", "\u4E66\u7B7E\u4E0E\u6587\u4EF6\u5939", settings.layout.showBookmarks, "\u542F\u52A8\u53F0\u7684\u4E3B\u8981\u5DE5\u4F5C\u533A\u57DF")}
                ${toggle("showStatus", "\u6D3B\u52A8\u4E0E\u7CFB\u7EDF\u72B6\u6001", settings.layout.showStatus, "\u5A92\u4F53\u3001\u4E0B\u8F7D\u3001\u7535\u6C60\u548C\u8BBE\u5907\u4FE1\u606F")}
                ${toggle("showRecent", "\u6700\u8FD1\u5E38\u8BBF\u95EE", settings.layout.showRecent, "\u6839\u636E\u672C\u673A\u6D4F\u89C8\u5386\u53F2\u805A\u5408\u7F51\u7AD9")}
            </section>
        `;
          return `
            ${paneHeader("\u6570\u636E", "\u5907\u4EFD\u3001\u8FC1\u79FB\u6216\u6062\u590D\u5F53\u524D\u542F\u52A8\u53F0\u3002")}
            <section class="settings-group">
                <h3>\u5907\u4EFD\u4E0E\u6062\u590D</h3>
                <div class="settings-button-stack">
                    <button class="settings-action export-data" type="button" data-liquid-item><b>\u2193</b><span>\u5BFC\u51FA\u6570\u636E<small>\u4FDD\u5B58\u4E66\u7B7E\u3001\u8BBE\u7F6E\u548C\u672C\u5730\u58C1\u7EB8</small></span></button>
                    <label class="settings-action import-data" data-liquid-item><b>\u2191</b><span>\u5BFC\u5165\u6570\u636E<small>\u517C\u5BB9\u65E7\u7248 1.0 \u4E0E 2.0 \u5907\u4EFD</small></span><input type="file" accept="application/json,.json" hidden></label>
                    <button class="settings-action danger reset-data" type="button" data-liquid-item><b>\u21BB</b><span>\u91CD\u7F6E\u6240\u6709\u8BBE\u7F6E<small>\u6E05\u7A7A\u540E\u65E0\u6CD5\u64A4\u9500</small></span></button>
                </div>
            </section>
            <div class="data-note"><strong>\u5BFC\u5165\u524D\u5EFA\u8BAE\u5148\u5BFC\u51FA</strong><p>\u5BFC\u5165\u64CD\u4F5C\u4F1A\u8986\u76D6\u5F53\u524D\u4E66\u7B7E\u3001\u5E03\u5C40\u4E0E\u58C1\u7EB8\u8BBE\u7F6E\u3002</p></div>
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
          const appearance = ["enhancedAnimations", "hdrHighlights", "darkText"];
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
        hdrMedia = window.matchMedia("(dynamic-range: high)");
        updateClasses = () => {
          const { appearance } = appStore.state.settings;
          const hdrDisplay = this.hasHdrDisplay();
          const hdrCapable = hdrDisplay && this.supportsHdrHighlights();
          document.body.classList.toggle("theme-light", appearance.theme === "light");
          document.body.classList.toggle("theme-dark", appearance.theme === "dark");
          document.body.classList.toggle("enhanced-animations", appearance.enhancedAnimations);
          document.body.classList.toggle("hdr-highlights", appearance.hdrHighlights);
          document.body.classList.toggle("hdr-display", hdrDisplay);
          document.body.classList.toggle("hdr-capable", hdrCapable);
          document.body.dataset.hdrOutput = hdrDisplay ? "high" : "standard";
        };
        async connectedCallback() {
          this.innerHTML = '<div class="app-loading"><span></span><p>\u6B63\u5728\u6574\u7406\u4F60\u7684\u542F\u52A8\u53F0\u2026</p></div>';
          try {
            await appStore.init();
            this.updateClasses();
            appStore.addEventListener("change", this.updateClasses);
            this.hdrMedia.addEventListener("change", this.updateClasses);
            this.render();
            window.addEventListener("keydown", this.onKeyDown);
          } catch (error) {
            this.innerHTML = `<div class="app-error"><h1>\u542F\u52A8\u53F0\u52A0\u8F7D\u5931\u8D25</h1><p>${escapeHtml(error instanceof Error ? error.message : "\u672A\u77E5\u9519\u8BEF")}</p></div>`;
          }
        }
        disconnectedCallback() {
          appStore.removeEventListener("change", this.updateClasses);
          this.hdrMedia.removeEventListener("change", this.updateClasses);
          window.removeEventListener("keydown", this.onKeyDown);
        }
        hasHdrDisplay() {
          return this.hdrMedia.matches && CSS.supports("dynamic-range-limit", "no-limit");
        }
        supportsHdrHighlights() {
          return CSS.supports("color", "color(rec2100-pq 0.64 0.64 0.64)");
        }
        render() {
          this.innerHTML = `
            <wallpaper-surface></wallpaper-surface>
            <div class="ambient-orb orb-one"></div><div class="ambient-orb orb-two"></div>
            <button class="settings-trigger" type="button" data-liquid-item aria-label="\u6253\u5F00\u8BBE\u7F6E" title="\u8BBE\u7F6E"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5"></path><circle cx="16" cy="6" r="2"></circle><circle cx="8" cy="12" r="2"></circle><circle cx="13" cy="18" r="2"></circle></svg></button>
            <main class="app-shell">
                <dashboard-header></dashboard-header>
                <search-command></search-command>
                <bookmark-launchpad></bookmark-launchpad>
                <recent-sites></recent-sites>
            </main>
            <settings-drawer></settings-drawer>
            <bookmark-dialog></bookmark-dialog>
            <backup-toast></backup-toast>
            <liquid-glass-system></liquid-glass-system>
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
        ["liquid-glass-system", LiquidGlassSystem],
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
