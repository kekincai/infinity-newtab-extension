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
      return BOOKMARK_PROTOCOLS.has(url.protocol) && url.hostname ? url.href : "";
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
    const icon2 = String(value ?? "");
    return /^https:\/\/www\.google\.com\/s2\/favicons/i.test(icon2) || /^chrome-extension:\/\/[^/]+\/_favicon\//i.test(icon2);
  }
  function faviconUrl(pageUrl, size = 128) {
    try {
      const favicon = new URL(chrome.runtime.getURL("/_favicon/"));
      favicon.searchParams.set("pageUrl", new URL(pageUrl).href);
      favicon.searchParams.set("size", String(size));
      return favicon.toString();
    } catch {
      return DEFAULT_ICON;
    }
  }
  function faviconSrcSet(pageUrl) {
    return [64, 128, 256].map((size) => `${faviconUrl(pageUrl, size)} ${size}w`).join(", ");
  }
  function bookmarkIcon(bookmark) {
    return !bookmark.icon || isManagedFavicon(bookmark.icon) ? faviconUrl(bookmark.url) : bookmark.icon;
  }
  function bookmarkIconSrcSet(bookmark) {
    return !bookmark.icon || isManagedFavicon(bookmark.icon) ? faviconSrcSet(bookmark.url) : "";
  }
  function bookmarkIconCanUpgrade(bookmark) {
    return Boolean(bookmark.icon && !isManagedFavicon(bookmark.icon));
  }
  function bookmarkIconIsRaster(bookmark) {
    const icon2 = bookmarkIcon(bookmark);
    return !/^data:image\/svg\+xml/i.test(icon2) && !/\.svg(?:$|[?#])/i.test(icon2);
  }
  function bookmarkIconFallback(bookmark) {
    return bookmark.icon && !isManagedFavicon(bookmark.icon) ? faviconUrl(bookmark.url) : DEFAULT_ICON;
  }
  var DEFAULT_ICON, BOOKMARK_PROTOCOLS;
  var init_utils = __esm({
    "src/core/utils.ts"() {
      "use strict";
      DEFAULT_ICON = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjNjM2NmYxIi8+PHBhdGggZD0iTTE2IDhWMjRNOCAxNkgyNCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=";
      BOOKMARK_PROTOCOLS = /* @__PURE__ */ new Set(["http:", "https:", "chrome-extension:"]);
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
      const icon2 = sanitizeBookmarkIcon(raw.icon);
      const order = Number(raw.order);
      merged.set(key, {
        id,
        folder,
        url,
        name: cleanText(raw.name, 160) || new URL(url).hostname,
        icon: icon2,
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
        openInNewTab: booleanOr(layout.openInNewTab, false),
        searchEngine: searchEngines.includes(String(layout.searchEngine)) ? layout.searchEngine : "google",
        dockSource: layout.dockSource === "recent" ? "recent" : "bookmarks",
        dockSize: Math.round(clampNumber(layout.dockSize, 40, 72, 56)),
        dockMagnify: booleanOr(layout.dockMagnify, true),
        saveSearches: booleanOr(layout.saveSearches, true),
        backupReminder: booleanOr(layout.backupReminder, true)
      },
      wallpaper: {
        type: wallpaperTypes.includes(String(wallpaper.type)) ? wallpaper.type : "gradient",
        value: sanitizeWallpaperValue(wallpaper.value),
        blur: clampNumber(wallpaper.blur, 0, 40, 0),
        overlay: clampNumber(wallpaper.overlay, 0, 60, 12),
        idleHide: booleanOr(wallpaper.idleHide, true),
        pauseOnBattery: booleanOr(wallpaper.pauseOnBattery, true),
        pauseWhenHidden: booleanOr(wallpaper.pauseWhenHidden, true),
        sound: booleanOr(wallpaper.sound, false)
      },
      appearance: {
        clockFormat: appearance.clockFormat === "12h" ? "12h" : "24h",
        dateFormat: appearance.dateFormat === "short" ? "short" : "long",
        enhancedAnimations: booleanOr(appearance.enhancedAnimations, true),
        hdrHighlights: booleanOr(appearance.hdrHighlights, true),
        theme: sanitizeTheme(appearance.theme, layout),
        glass: appearance.glass === "tinted" ? "tinted" : "clear",
        reduceTransparency: booleanOr(appearance.reduceTransparency, false)
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
  function sanitizeTheme(theme, layout) {
    if (theme === "dark") return "dark";
    if (theme === "light") return typeof layout.openInNewTab === "boolean" ? "light" : "auto";
    return "auto";
  }
  function sanitizeBookmarkIcon(value) {
    const icon2 = sanitizeRemoteUrl(value, true);
    return icon2.startsWith("data:") && icon2.length > MAX_INLINE_ICON_LENGTH ? "" : icon2;
  }
  function sanitizeWallpaperValue(value) {
    if (typeof value === "string" && (value === "" || /^(local|online)(-\d+)?$/.test(value))) return value;
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
  var DEFAULT_SETTINGS, MAX_INLINE_ICON_LENGTH;
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
          openInNewTab: false,
          searchEngine: "google",
          dockSource: "bookmarks",
          dockSize: 56,
          dockMagnify: true,
          saveSearches: true,
          backupReminder: true
        },
        wallpaper: {
          type: "gradient",
          value: "",
          blur: 0,
          overlay: 12,
          idleHide: true,
          pauseOnBattery: true,
          pauseWhenHidden: true,
          sound: false
        },
        appearance: {
          clockFormat: "24h",
          dateFormat: "long",
          enhancedAnimations: true,
          hdrHighlights: true,
          theme: "auto",
          glass: "clear",
          reduceTransparency: false
        }
      };
      MAX_INLINE_ICON_LENGTH = 4096;
    }
  });

  // src/core/bookmark-storage.ts
  function bookmarkChunkKey(index) {
    return `${CHUNK_PREFIX}${index}`;
  }
  function encodeBookmarks(bookmarks) {
    const encoder = new TextEncoder();
    const chunks = [];
    let current = [];
    let size = 2;
    bookmarks.forEach((bookmark) => {
      const bytes = encoder.encode(JSON.stringify(bookmark)).length + 1;
      if (bytes + 2 > ITEM_BUDGET) throw new Error(`\u4E66\u7B7E\u201C${bookmark.name}\u201D\u6570\u636E\u8FC7\u5927\uFF0C\u65E0\u6CD5\u540C\u6B65`);
      if (current.length && size + bytes > ITEM_BUDGET) {
        chunks.push(current);
        current = [];
        size = 2;
      }
      current.push(bookmark);
      size += bytes;
    });
    if (current.length) chunks.push(current);
    const values = { [BOOKMARK_CHUNKS_KEY]: chunks.length };
    chunks.forEach((chunk, index) => {
      values[bookmarkChunkKey(index)] = chunk;
    });
    return { values, count: chunks.length };
  }
  function decodeBookmarks(stored) {
    const count = stored[BOOKMARK_CHUNKS_KEY];
    if (typeof count === "number" && Number.isInteger(count) && count >= 0) {
      return Array.from({ length: count }, (_, index) => stored[bookmarkChunkKey(index)]).flatMap((chunk) => Array.isArray(chunk) ? chunk : []);
    }
    const legacy = stored[LEGACY_BOOKMARKS_KEY];
    return Array.isArray(legacy) ? legacy : [];
  }
  function storedChunkCount(stored) {
    const count = stored[BOOKMARK_CHUNKS_KEY];
    return typeof count === "number" && Number.isInteger(count) && count >= 0 ? count : 0;
  }
  function staleBookmarkKeys(previousCount, nextCount, hasLegacy) {
    const keys = hasLegacy ? [LEGACY_BOOKMARKS_KEY] : [];
    for (let index = nextCount; index < previousCount; index += 1) keys.push(bookmarkChunkKey(index));
    return keys;
  }
  var LEGACY_BOOKMARKS_KEY, BOOKMARK_CHUNKS_KEY, CHUNK_PREFIX, ITEM_BUDGET;
  var init_bookmark_storage = __esm({
    "src/core/bookmark-storage.ts"() {
      "use strict";
      LEGACY_BOOKMARKS_KEY = "bookmarks";
      BOOKMARK_CHUNKS_KEY = "bookmarkChunks";
      CHUNK_PREFIX = "bookmarks.";
      ITEM_BUDGET = 7600;
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
        if (chrome.runtime.lastError) reject(new Error(describeWriteError(chrome.runtime.lastError.message)));
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
  function describeWriteError(message = "") {
    if (/QUOTA_BYTES/i.test(message)) return "Chrome \u540C\u6B65\u7A7A\u95F4\u5DF2\u6EE1\uFF08\u4E0A\u9650\u7EA6 100 KB\uFF09\uFF0C\u8BF7\u5220\u9664\u90E8\u5206\u4E66\u7B7E\u6216\u81EA\u5B9A\u4E49\u56FE\u6807\u540E\u91CD\u8BD5";
    if (/MAX_WRITE_OPERATIONS/i.test(message)) return "\u64CD\u4F5C\u592A\u9891\u7E41\uFF0CChrome \u6682\u65F6\u9650\u5236\u4E86\u540C\u6B65\u5199\u5165\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5";
    return message || "\u4FDD\u5B58\u5931\u8D25";
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
    if (url.length > 2048) throw new Error("\u7F51\u5740\u8FC7\u957F\uFF0C\u65E0\u6CD5\u540C\u6B65\u4FDD\u5B58");
    const icon2 = sanitizeRemoteUrl(input.icon, true);
    if (icon2.startsWith("data:") && icon2.length > MAX_INLINE_ICON_LENGTH) {
      throw new Error("\u5185\u5D4C\u56FE\u6807\u8FC7\u5927\uFF0C\u8BF7\u6539\u7528\u56FE\u6807\u7F51\u5740");
    }
    const folder = state.folders.includes(input.folder) ? input.folder : "\u5168\u90E8";
    return {
      id,
      url,
      folder,
      name: cleanText(input.name, 160) || new URL(url).hostname,
      icon: icon2,
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
  var ALL_CHANGES, AppStore, appStore;
  var init_store = __esm({
    "src/core/store.ts"() {
      "use strict";
      init_backup();
      init_bookmark_storage();
      init_storage();
      init_utils();
      ALL_CHANGES = [
        "bookmarks",
        "folders",
        "recentSearches",
        "lastBackupPrompt",
        "settings.appearance",
        "settings.wallpaper",
        "settings.layout"
      ];
      AppStore = class extends EventTarget {
        stateValue = initialState();
        initialized = false;
        bookmarkChunks = 0;
        hasLegacyBookmarks = false;
        get state() {
          return this.stateValue;
        }
        async init(force = false) {
          if (this.initialized && !force) return;
          const stored = await storageGet(null);
          this.bookmarkChunks = storedChunkCount(stored);
          this.hasLegacyBookmarks = LEGACY_BOOKMARKS_KEY in stored;
          const bookmarks = sanitizeBookmarks(decodeBookmarks(stored));
          const folders = normalizeFolders(stored.folders, bookmarks);
          this.stateValue = {
            bookmarks,
            folders,
            settings: sanitizeSettings(stored.settings),
            recentSearches: normalizeRecentSearches(stored.recentSearches),
            lastBackupPrompt: finiteNumber(stored.lastBackupPrompt, 0)
          };
          this.initialized = true;
          this.emit(ALL_CHANGES);
        }
        async updateSettings(section, patch) {
          await this.commit((draft) => {
            draft.settings = sanitizeSettings({
              ...draft.settings,
              [section]: { ...draft.settings[section], ...patch }
            });
          }, ["settings"], [`settings.${section}`]);
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
        async removeRecentSearch(query) {
          await this.commit((draft) => {
            draft.recentSearches = draft.recentSearches.filter((item) => item !== query);
          }, ["recentSearches"]);
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
          const encoded = encodeBookmarks(next.bookmarks);
          const values = {
            ...encoded.values,
            folders: next.folders,
            settings: next.settings,
            recentSearches: next.recentSearches,
            lastBackupPrompt: next.lastBackupPrompt,
            ...Array.isArray(data.todos) ? { todos: data.todos } : {}
          };
          await storageSet(values);
          const staleKeys = [
            ...["todos"].filter((key) => !(key in values)),
            ...staleBookmarkKeys(this.bookmarkChunks, encoded.count, this.hasLegacyBookmarks)
          ];
          if (staleKeys.length) await storageRemove(staleKeys);
          this.bookmarkChunks = encoded.count;
          this.hasLegacyBookmarks = false;
          this.stateValue = next;
          this.initialized = true;
          this.emit(ALL_CHANGES);
        }
        async reset() {
          await storageClear("sync");
          this.bookmarkChunks = 0;
          this.hasLegacyBookmarks = false;
          this.stateValue = initialState();
          this.emit(ALL_CHANGES);
        }
        async commit(mutator, keys, changes = keys) {
          const draft = structuredClone(this.stateValue);
          mutator(draft);
          const values = {};
          let bookmarkChunks = null;
          keys.forEach((key) => {
            if (key !== "bookmarks") {
              values[key] = draft[key];
              return;
            }
            const encoded = encodeBookmarks(draft.bookmarks);
            Object.assign(values, encoded.values);
            bookmarkChunks = encoded.count;
          });
          await storageSet(values);
          this.stateValue = draft;
          if (bookmarkChunks !== null) await this.dropStaleBookmarkKeys(bookmarkChunks);
          this.emit(changes);
        }
        /** Stale chunks are harmless to readers, so a failed cleanup never rolls back a save. */
        async dropStaleBookmarkKeys(nextCount) {
          const stale = staleBookmarkKeys(this.bookmarkChunks, nextCount, this.hasLegacyBookmarks);
          this.bookmarkChunks = nextCount;
          if (!stale.length) return;
          try {
            await storageRemove(stale);
            this.hasLegacyBookmarks = false;
          } catch {
          }
        }
        emit(changes) {
          this.dispatchEvent(new CustomEvent("change", { detail: { state: this.stateValue, changes } }));
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
      tabs: {
        query: (_query, done) => done([]),
        update: () => void 0,
        create: ({ url }) => url ? window.open(url, "_blank", "noopener") : void 0
      },
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
      DATABASE = "infinity-wallpaper";
      STORE = "wallpapers";
      MediaStore = class {
        async get(kind) {
          const database = await this.open();
          try {
            return await new Promise((resolve, reject) => {
              const request = database.transaction(STORE, "readonly").objectStore(STORE).get(kind);
              request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
              request.onerror = () => reject(request.error ?? new Error("\u65E0\u6CD5\u8BFB\u53D6\u672C\u5730\u58C1\u7EB8"));
            });
          } finally {
            database.close();
          }
        }
        async set(kind, value) {
          const database = await this.open();
          try {
            await new Promise((resolve, reject) => {
              const transaction = database.transaction(STORE, "readwrite");
              transaction.objectStore(STORE).put(value, kind);
              transaction.oncomplete = () => resolve();
              transaction.onerror = () => reject(transaction.error ?? new Error("\u65E0\u6CD5\u4FDD\u5B58\u672C\u5730\u58C1\u7EB8"));
              transaction.onabort = () => reject(transaction.error ?? new Error("\u672C\u5730\u58C1\u7EB8\u5B58\u50A8\u5DF2\u4E2D\u6B62"));
            });
          } finally {
            database.close();
          }
        }
        async clear(kind) {
          const database = await this.open();
          try {
            await new Promise((resolve, reject) => {
              const transaction = database.transaction(STORE, "readwrite");
              transaction.objectStore(STORE).delete(kind);
              transaction.oncomplete = () => resolve();
              transaction.onerror = () => reject(transaction.error ?? new Error("\u65E0\u6CD5\u5220\u9664\u672C\u5730\u58C1\u7EB8"));
              transaction.onabort = () => reject(transaction.error ?? new Error("\u672C\u5730\u58C1\u7EB8\u5220\u9664\u5DF2\u4E2D\u6B62"));
            });
          } finally {
            database.close();
          }
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

  // src/core/wallpaper-service.ts
  async function useOnlineWallpaper() {
    let response;
    try {
      response = await fetch(`${ONLINE_WALLPAPER}?t=${Date.now()}`, { cache: "no-store" });
    } catch {
      throw new Error("\u65E0\u6CD5\u8FDE\u63A5\u5728\u7EBF\u58C1\u7EB8\u670D\u52A1\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC");
    }
    if (!response.ok) throw new Error(`\u5728\u7EBF\u58C1\u7EB8\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF08${response.status}\uFF09`);
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) throw new Error("\u5728\u7EBF\u58C1\u7EB8\u670D\u52A1\u8FD4\u56DE\u7684\u4E0D\u662F\u56FE\u7247");
    await validateLocalMedia(blob, "image");
    await storeWallpaper(blob, "image", "online");
  }
  async function migrateLegacyWallpaper() {
    const { type, value } = appStore.state.settings.wallpaper;
    if (type !== "preset" || !value.startsWith(ONLINE_WALLPAPER)) return;
    try {
      await useOnlineWallpaper();
    } catch {
    }
  }
  async function useLocalWallpaper(file) {
    const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null;
    if (!kind) throw new Error("\u8BF7\u9009\u62E9\u56FE\u7247\u6216\u89C6\u9891\u6587\u4EF6");
    await validateLocalMedia(file, kind);
    await storeWallpaper(file, kind, "local");
  }
  async function resetWallpaper() {
    await appStore.updateSettings("wallpaper", { type: "gradient", value: "", blur: 0, overlay: 30 });
    await mediaStore.clearAll();
  }
  function wallpaperLabel(wallpaper) {
    if (wallpaper.type === "video") return "\u672C\u5730\u89C6\u9891";
    if (wallpaper.type === "local") return wallpaper.value.startsWith("online") ? "\u5728\u7EBF\u58C1\u7EB8" : "\u672C\u5730\u56FE\u7247";
    if (wallpaper.type === "preset") return "\u5728\u7EBF\u56FE\u7247";
    return "\u9ED8\u8BA4\u6E10\u53D8";
  }
  async function storeWallpaper(blob, kind, source) {
    const previous = await mediaStore.get(kind);
    await mediaStore.set(kind, blob);
    try {
      await appStore.updateSettings("wallpaper", {
        type: kind === "video" ? "video" : "local",
        value: `${source}-${Date.now()}`
      });
    } catch (error) {
      try {
        if (previous) await mediaStore.set(kind, previous);
        else await mediaStore.clear(kind);
      } catch (rollbackError) {
        throw new Error(`${errorMessage(error)}\uFF1B\u6062\u590D\u539F\u80CC\u666F\u4E5F\u5931\u8D25\uFF1A${errorMessage(rollbackError)}`);
      }
      throw error;
    }
  }
  async function toneOfBlob(blob) {
    const bitmap = await createImageBitmap(blob, { resizeWidth: SAMPLE_SIZE, resizeHeight: SAMPLE_SIZE });
    try {
      return toneOf(bitmap);
    } finally {
      bitmap.close();
    }
  }
  function toneOf(source) {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return "dark";
    context.drawImage(source, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const { data } = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    let total = 0;
    for (let index = 0; index < data.length; index += 4) {
      total += (0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255;
    }
    return total / (data.length / 4) > LIGHT_THRESHOLD ? "light" : "dark";
  }
  async function validateLocalMedia(file, kind) {
    const url = URL.createObjectURL(file);
    let video = null;
    try {
      if (kind === "image") {
        const image = new Image();
        image.src = url;
        await image.decode().catch(() => {
          throw new Error("\u56FE\u7247\u6587\u4EF6\u65E0\u6CD5\u89E3\u7801\uFF0C\u80CC\u666F\u6CA1\u6709\u66F4\u6539");
        });
        return;
      }
      video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.src = url;
      await waitForVideo(video);
      await video.play().catch(() => {
        throw new Error("\u89C6\u9891\u65E0\u6CD5\u64AD\u653E\uFF0C\u80CC\u666F\u6CA1\u6709\u66F4\u6539");
      });
    } finally {
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      URL.revokeObjectURL(url);
    }
  }
  function waitForVideo(video) {
    return new Promise((resolve, reject) => {
      let timeout = 0;
      const finish = (error) => {
        window.clearTimeout(timeout);
        video.removeEventListener("canplay", onReady);
        video.removeEventListener("error", onError);
        if (error) reject(error);
        else resolve();
      };
      const onReady = () => finish();
      const onError = () => finish(new Error("\u89C6\u9891\u6587\u4EF6\u65E0\u6CD5\u89E3\u7801\uFF0C\u80CC\u666F\u6CA1\u6709\u66F4\u6539"));
      video.addEventListener("canplay", onReady, { once: true });
      video.addEventListener("error", onError, { once: true });
      timeout = window.setTimeout(() => finish(new Error("\u8BFB\u53D6\u89C6\u9891\u8D85\u65F6\uFF0C\u80CC\u666F\u6CA1\u6709\u66F4\u6539")), 1e4);
      video.load();
    });
  }
  function errorMessage(error) {
    return error instanceof Error ? error.message : "\u64CD\u4F5C\u5931\u8D25";
  }
  var ONLINE_WALLPAPER, SAMPLE_SIZE, LIGHT_THRESHOLD;
  var init_wallpaper_service = __esm({
    "src/core/wallpaper-service.ts"() {
      "use strict";
      init_media_store();
      init_store();
      ONLINE_WALLPAPER = "https://www.dmoe.cc/random.php";
      SAMPLE_SIZE = 32;
      LIGHT_THRESHOLD = 0.58;
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
            data: await this.collectData(),
            localMedia: await mediaStore.export()
          };
        }
        /** Backups keep the flat 2.0 layout even though sync storage now chunks bookmarks. */
        async collectData() {
          const { todos } = await storageGet(["todos"]);
          return {
            ...structuredClone(appStore.state),
            ...Array.isArray(todos) ? { todos } : {}
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
        observedChanges = null;
        onStoreChange = (event) => {
          const changes = event.detail?.changes;
          if (this.observedChanges && changes && !changes.some((change) => this.observedChanges?.includes(change))) return;
          this.handleStoreChange();
        };
        connectedCallback() {
          appStore.addEventListener("change", this.onStoreChange);
          this.render();
        }
        disconnectedCallback() {
          appStore.removeEventListener("change", this.onStoreChange);
        }
        handleStoreChange() {
          this.render();
        }
      };
    }
  });

  // src/components/ui-layer.ts
  function pushLayer(element, close) {
    const layer = {
      element,
      close,
      restoreFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null
    };
    layers.push(layer);
    return () => {
      const index = layers.indexOf(layer);
      if (index < 0) return;
      layers.splice(index, 1);
      if (layer.restoreFocus?.isConnected && element.contains(document.activeElement)) layer.restoreFocus.focus();
      else if (layer.restoreFocus?.isConnected && document.activeElement === document.body) layer.restoreFocus.focus();
    };
  }
  function hasOpenLayer() {
    return layers.length > 0;
  }
  function trapFocus(container, event) {
    const focusable = [...container.querySelectorAll(FOCUSABLE)].filter((element) => element.getClientRects().length);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    const active = document.activeElement;
    if (!container.contains(active)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
  function openModal(options) {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop is-open";
      backdrop.innerHTML = `
            <form class="modal glass glass-thick" role="alertdialog" aria-modal="true" aria-labelledby="modal-title">
                <header class="modal-header">
                    <h2 id="modal-title">${escapeHtml(options.title)}</h2>
                    <button class="icon-close" type="button" aria-label="\u5173\u95ED" data-action="cancel">${CLOSE_ICON}</button>
                </header>
                ${options.body ? `<p class="modal-body">${escapeHtml(options.body)}</p>` : ""}
                ${options.input ? `<label class="field"><span>${escapeHtml(options.input.label)}</span><input name="value" type="text" autocomplete="off" maxlength="${options.input.maxLength ?? 80}" placeholder="${escapeHtml(options.input.placeholder ?? "")}" value="${escapeHtml(options.input.value ?? "")}"></label>` : ""}
                <footer class="modal-actions">
                    <button class="pill-button" type="button" data-action="cancel" data-liquid-item>${escapeHtml(options.cancelText ?? "\u53D6\u6D88")}</button>
                    <button class="pill-button ${options.danger ? "danger" : "primary"}" type="submit" data-liquid-item>${escapeHtml(options.confirmText ?? "\u786E\u5B9A")}</button>
                </footer>
            </form>`;
      document.body.append(backdrop);
      const form = backdrop.querySelector("form");
      const input = form.querySelector('input[name="value"]');
      let release = () => {
      };
      const finish = (value) => {
        release();
        backdrop.remove();
        resolve(value);
      };
      release = pushLayer(form, () => finish(null));
      form.querySelectorAll('[data-action="cancel"]').forEach((button) => button.addEventListener("click", () => finish(null)));
      backdrop.addEventListener("pointerdown", (event) => {
        if (event.target === backdrop) finish(null);
      });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        finish(input ? input.value.trim() : "");
      });
      requestAnimationFrame(() => {
        if (input) {
          input.focus();
          input.select();
        } else {
          form.querySelector('button[type="submit"]')?.focus();
        }
      });
    });
  }
  async function confirmAction(options) {
    return await openModal(options) !== null;
  }
  async function promptText(title, input, confirmText = "\u4FDD\u5B58") {
    const value = await openModal({ title, input, confirmText });
    return value || null;
  }
  function notify(message, kind = "info", timeout = kind === "error" ? 7e3 : 3200) {
    let region = document.querySelector(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.append(region);
    }
    const toast = document.createElement("div");
    toast.className = `toast glass glass-thick app-notice is-${kind}`;
    toast.textContent = message;
    region.append(toast);
    window.setTimeout(() => {
      toast.classList.add("is-leaving");
      window.setTimeout(() => toast.remove(), 220);
    }, timeout);
  }
  function notifyError(error, fallback = "\u64CD\u4F5C\u5931\u8D25") {
    notify(error instanceof Error && error.message ? error.message : fallback, "error");
  }
  function openMenu(items, at) {
    document.querySelector(".context-menu")?.dispatchEvent(new Event("menu-close"));
    const menu = document.createElement("div");
    menu.className = "context-menu glass glass-thick";
    menu.setAttribute("role", "menu");
    menu.innerHTML = items.map((item, index) => {
      if ("separator" in item) return "<hr>";
      if ("heading" in item) return `<span class="menu-heading">${escapeHtml(item.heading)}</span>`;
      return `<button type="button" role="menuitem" data-index="${index}" class="${item.danger ? "danger" : ""}" ${item.disabled ? "disabled" : ""}>${item.icon ? `<i aria-hidden="true">${item.icon}</i>` : "<i></i>"}<span>${escapeHtml(item.label)}</span></button>`;
    }).join("");
    document.body.append(menu);
    const anchor = at instanceof HTMLElement ? at.getBoundingClientRect() : null;
    const point = anchor ? { x: anchor.left, y: anchor.bottom + 6 } : at;
    const { width, height } = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(point.x, innerWidth - width - 8))}px`;
    menu.style.top = `${point.y + height > innerHeight - 8 ? Math.max(8, point.y - height - (anchor ? anchor.height + 12 : 0)) : point.y}px`;
    let release = () => {
    };
    const close = () => {
      document.removeEventListener("pointerdown", onOutside, true);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
      release();
      menu.remove();
    };
    const onOutside = (event) => {
      if (!menu.contains(event.target)) close();
    };
    release = pushLayer(menu, close);
    menu.addEventListener("menu-close", close);
    document.addEventListener("pointerdown", onOutside, true);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    const buttons = [...menu.querySelectorAll("button:not([disabled])")];
    menu.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-index]");
      const item = button ? items[Number(button.dataset.index)] : null;
      if (!item || !("action" in item)) return;
      close();
      item.action();
    });
    menu.addEventListener("keydown", (event) => {
      const index = buttons.indexOf(document.activeElement);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        buttons[(index + step + buttons.length) % buttons.length]?.focus();
      }
    });
    buttons[0]?.focus({ preventScroll: true });
  }
  function afterMotion(element, run) {
    requestAnimationFrame(() => {
      const running = element.getAnimations({ subtree: true });
      if (!running.length) {
        run();
        return;
      }
      void Promise.all(running.map((animation) => animation.finished.catch(() => void 0))).then(run);
    });
  }
  var layers, FOCUSABLE, CLOSE_ICON;
  var init_ui_layer = __esm({
    "src/components/ui-layer.ts"() {
      "use strict";
      init_utils();
      layers = [];
      FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      document.addEventListener("keydown", (event) => {
        const top = layers.at(-1);
        if (!top) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          top.close();
          return;
        }
        if (event.key === "Tab") trapFocus(top.element, event);
      }, true);
      CLOSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>';
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
      init_ui_layer();
      REMINDER_INTERVAL = 30 * 24 * 60 * 60 * 1e3;
      BackupToast = class extends StoreElement {
        observedChanges = ["lastBackupPrompt", "bookmarks", "settings.layout"];
        dismissed = false;
        render() {
          const due = Date.now() - appStore.state.lastBackupPrompt >= REMINDER_INTERVAL;
          this.hidden = !due || this.dismissed || !appStore.state.bookmarks.length || !appStore.state.settings.layout.backupReminder;
          if (this.hidden) {
            this.innerHTML = "";
            return;
          }
          this.innerHTML = `
            <div class="backup-toast glass glass-thick" role="status">
                <span>\u5DF2\u7ECF\u4E00\u4E2A\u6708\u6CA1\u5907\u4EFD\u4E86\uFF0C\u5BFC\u51FA\u4E00\u4EFD\u4E66\u7B7E\u66F4\u5B89\u5FC3</span>
                <div class="backup-actions">
                    <button class="pill-button backup-later" type="button" data-liquid-item>\u7A0D\u540E</button>
                    <button class="pill-button primary backup-now" type="button" data-liquid-item>\u7ACB\u5373\u5BFC\u51FA</button>
                </div>
            </div>
        `;
          this.querySelector(".backup-now")?.addEventListener("click", () => void this.finish(true));
          this.querySelector(".backup-later")?.addEventListener("click", () => void this.finish(false));
        }
        async finish(exportNow) {
          try {
            if (exportNow) await backupService.createBackup();
            this.dismissed = true;
            await appStore.setLastBackupPrompt();
          } catch (error) {
            notifyError(error, "\u5907\u4EFD\u5931\u8D25");
          }
        }
      };
    }
  });

  // src/components/icons.ts
  var icon, solid, ICONS;
  var init_icons = __esm({
    "src/components/icons.ts"() {
      "use strict";
      icon = (paths) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
      solid = (paths) => `<svg class="icon icon-solid" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
      ICONS = {
        settings: icon('<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path>'),
        sparkle: icon('<path d="M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8z"></path><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"></path>'),
        search: icon('<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path>'),
        plus: icon('<path d="M12 5v14M5 12h14"></path>'),
        folder: icon('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2l2 2h7.8A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"></path>'),
        folderPlus: icon('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2l2 2h7.8A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"></path><path d="M12 11v5M9.5 13.5h5"></path>'),
        more: icon('<circle cx="6" cy="12" r="1.2"></circle><circle cx="12" cy="12" r="1.2"></circle><circle cx="18" cy="12" r="1.2"></circle>'),
        edit: icon('<path d="M4 20h4L19 9l-4-4L4 16z"></path><path d="m13.5 6.5 4 4"></path>'),
        trash: icon('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"></path>'),
        open: icon('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path>'),
        move: icon('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2l2 2h7.8A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"></path><path d="M10 13.5h6M13.5 11l2.5 2.5-2.5 2.5"></path>'),
        refresh: icon('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"></path>'),
        download: icon('<path d="M12 4v12M7 11l5 5 5-5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"></path>'),
        pause: solid('<rect x="6" y="4.5" width="4" height="15" rx="1.3"></rect><rect x="14" y="4.5" width="4" height="15" rx="1.3"></rect>'),
        play: solid('<path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z"></path>'),
        speaker: icon('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"></path><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"></path>'),
        muted: icon('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"></path><path d="m16 9.5 5 5M21 9.5l-5 5"></path>'),
        battery: icon('<rect x="3" y="7.5" width="16" height="9" rx="2"></rect><path d="M21 11v2"></path>'),
        bolt: icon('<path d="m13 3-7 10h5l-1 8 7-10h-5z"></path>'),
        clock: icon('<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path>'),
        grid: solid('<rect x="4" y="4" width="4" height="4" rx="1.2"></rect><rect x="10" y="4" width="4" height="4" rx="1.2"></rect><rect x="16" y="4" width="4" height="4" rx="1.2"></rect><rect x="4" y="10" width="4" height="4" rx="1.2"></rect><rect x="10" y="10" width="4" height="4" rx="1.2"></rect><rect x="16" y="10" width="4" height="4" rx="1.2"></rect><rect x="4" y="16" width="4" height="4" rx="1.2"></rect><rect x="10" y="16" width="4" height="4" rx="1.2"></rect><rect x="16" y="16" width="4" height="4" rx="1.2"></rect>'),
        look: icon('<circle cx="12" cy="12" r="8"></circle><path class="icon-fill" d="M12 4a8 8 0 0 0 0 16z"></path>'),
        widgets: solid('<rect x="4" y="4" width="7" height="7" rx="2"></rect><rect x="13" y="4" width="7" height="7" rx="2"></rect><rect x="4" y="13" width="7" height="7" rx="2"></rect><rect x="13" y="13" width="7" height="7" rx="2"></rect>'),
        wallpaper: icon('<rect x="3" y="5" width="18" height="14" rx="3"></rect><path class="icon-fill" d="M10 9.5v5l4.5-2.5z"></path>'),
        database: icon('<ellipse cx="12" cy="6" rx="7" ry="2.5"></ellipse><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"></path>'),
        close: icon('<path d="M6 6l12 12M18 6 6 18"></path>')
      };
    }
  });

  // src/components/bookmark-dialog.ts
  function previewSource(href) {
    return encodeURI(href).replace(/%25([0-9a-f]{2})/gi, "%$1");
  }
  var BookmarkDialog;
  var init_bookmark_dialog = __esm({
    "src/components/bookmark-dialog.ts"() {
      "use strict";
      init_store();
      init_utils();
      init_icons();
      init_ui_layer();
      BookmarkDialog = class extends HTMLElement {
        editing;
        releaseLayer = null;
        connectedCallback() {
          document.addEventListener("open-bookmark-dialog", this.onOpen);
        }
        disconnectedCallback() {
          document.removeEventListener("open-bookmark-dialog", this.onOpen);
          this.close();
        }
        onOpen = (event) => {
          this.editing = event.detail.bookmark;
          this.open(event.detail);
        };
        open({ bookmark, folder = "\u5168\u90E8", draft }) {
          this.close();
          const selected = bookmark?.folder ?? folder;
          const title = bookmark ? "\u7F16\u8F91\u4E66\u7B7E" : "\u6DFB\u52A0\u4E66\u7B7E";
          this.innerHTML = `
            <div class="modal-backdrop dialog-backdrop is-open">
                <form class="modal bookmark-dialog glass glass-thick" role="dialog" aria-modal="true" aria-label="${title}" novalidate>
                    <header class="modal-header">
                        <h2>${title}</h2>
                        <button class="icon-close dialog-close" type="button" aria-label="\u5173\u95ED">${ICONS.close}</button>
                    </header>
                    <label class="field">
                        <span>\u7F51\u5740</span>
                        <span class="field-with-icon">
                            <img class="url-preview" src="${DEFAULT_ICON}" alt="">
                            <input name="url" type="text" inputmode="url" required autocomplete="off" spellcheck="false" placeholder="example.com" value="${escapeHtml(bookmark?.url ?? draft?.url ?? "")}">
                        </span>
                    </label>
                    <label class="field">
                        <span>\u540D\u79F0</span>
                        <input name="name" type="text" maxlength="160" autocomplete="off" placeholder="\u7559\u7A7A\u5219\u4F7F\u7528\u7F51\u7AD9\u57DF\u540D" value="${escapeHtml(bookmark?.name ?? draft?.name ?? "")}">
                    </label>
                    <label class="field">
                        <span>\u6587\u4EF6\u5939</span>
                        <span class="select-wrap"><select name="folder">${appStore.state.folders.map((item) => `<option value="${escapeHtml(item)}" ${item === selected ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select></span>
                    </label>
                    <details class="field-advanced" ${bookmark?.icon ? "open" : ""}>
                        <summary>\u81EA\u5B9A\u4E49\u56FE\u6807</summary>
                        <label class="field">
                            <span>\u56FE\u6807\u7F51\u5740\uFF08\u7559\u7A7A\u81EA\u52A8\u83B7\u53D6\uFF09</span>
                            <input name="icon" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://example.com/icon.png" value="${escapeHtml(bookmark?.icon ?? "")}">
                        </label>
                    </details>
                    <p class="field-error" role="alert" hidden></p>
                    <footer class="modal-actions">
                        <button class="pill-button cancel-dialog" type="button" data-liquid-item>\u53D6\u6D88</button>
                        <button class="pill-button primary" type="submit" data-liquid-item>\u4FDD\u5B58</button>
                    </footer>
                </form>
            </div>
        `;
          const backdrop = this.querySelector(".dialog-backdrop");
          const form = this.querySelector("form");
          const urlInput = form.querySelector('input[name="url"]');
          const iconInput = form.querySelector('input[name="icon"]');
          const preview = form.querySelector(".url-preview");
          const error = form.querySelector(".field-error");
          const updatePreview = () => {
            const custom = sanitizeRemoteUrl(iconInput.value.trim(), true);
            const url = normalizeUrl(urlInput.value);
            preview.src = custom ? previewSource(custom) : url ? faviconUrl(url, 64) : DEFAULT_ICON;
          };
          preview.addEventListener("error", () => {
            preview.src = DEFAULT_ICON;
          });
          updatePreview();
          urlInput.addEventListener("input", () => {
            error.hidden = true;
            urlInput.removeAttribute("aria-invalid");
            updatePreview();
          });
          iconInput.addEventListener("change", updatePreview);
          this.querySelector(".dialog-close")?.addEventListener("click", () => this.close());
          this.querySelector(".cancel-dialog")?.addEventListener("click", () => this.close());
          backdrop.addEventListener("pointerdown", (event) => {
            if (event.target === backdrop) this.close();
          });
          form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const input = {
              url: String(data.get("url") ?? ""),
              name: String(data.get("name") ?? ""),
              folder: String(data.get("folder") ?? "\u5168\u90E8"),
              icon: String(data.get("icon") ?? "").trim()
            };
            if (!normalizeUrl(input.url)) {
              error.textContent = "\u8BF7\u8F93\u5165\u6709\u6548\u7684\u7F51\u5740\uFF0C\u4F8B\u5982 github.com";
              error.hidden = false;
              urlInput.setAttribute("aria-invalid", "true");
              urlInput.focus();
              return;
            }
            try {
              if (this.editing) await appStore.updateBookmark(this.editing.id, input);
              else await appStore.addBookmark(input);
              this.close();
            } catch (saveError) {
              notifyError(saveError, "\u4FDD\u5B58\u5931\u8D25");
            }
          });
          this.releaseLayer = pushLayer(form, () => this.close());
          requestAnimationFrame(() => (bookmark ? form.querySelector('input[name="name"]') : urlInput)?.focus());
        }
        close() {
          this.editing = void 0;
          this.innerHTML = "";
          const release = this.releaseLayer;
          this.releaseLayer = null;
          release?.();
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
        const hostname = url.hostname.toLowerCase();
        const host = hostname.replace(/^www\./, "");
        if (!host || host === "newtab" || /(^|\.)google\.[a-z.]+$/.test(host)) return;
        const visits = Math.max(1, Number(item.visitCount) || 1);
        const stats = hosts.get(host) ?? {
          host,
          url: "",
          title: "",
          count: 0,
          lastVisit: 0,
          hostnames: /* @__PURE__ */ new Map(),
          rootTitle: ""
        };
        stats.count += visits;
        stats.lastVisit = Math.max(stats.lastVisit, Number(item.lastVisitTime) || 0);
        stats.hostnames.set(`${url.protocol}//${hostname}`, (stats.hostnames.get(`${url.protocol}//${hostname}`) ?? 0) + visits);
        const title = typeof item.title === "string" ? item.title.trim() : "";
        if (url.pathname === "/" && !url.search && title && !stats.rootTitle) stats.rootTitle = title;
        hosts.set(host, stats);
      } catch {
      }
    });
    return [...hosts.values()].sort((left, right) => right.count - left.count || right.lastVisit - left.lastVisit).slice(0, 20).map(({ hostnames, rootTitle, ...site }) => {
      const origin = [...hostnames.entries()].sort((left, right) => right[1] - left[1])[0][0];
      return { ...site, url: `${origin}/`, title: siteName(site.host, rootTitle) };
    });
  }
  function siteName(host, rootTitle) {
    const cleaned = rootTitle.replace(/^\(\d+\+?\)\s*/, "").split(/\s+[-|–—·]\s+/)[0].trim();
    if (cleaned && cleaned.length <= 18) return cleaned;
    return host;
  }
  function loadRecentSites(refresh = false) {
    if (!recentSites || refresh) {
      recentSites = new Promise((resolve, reject) => {
        if (!chrome.history?.search) {
          reject(new Error("\u6D4F\u89C8\u5668\u672A\u5F00\u653E\u5386\u53F2\u8BB0\u5F55\u8BBF\u95EE"));
          return;
        }
        chrome.history.search({ text: "", startTime: Date.now() - 30 * 24 * 60 * 60 * 1e3, maxResults: 3e3 }, (items) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(rankSites(items ?? []));
        });
      });
      recentSites.catch(() => {
        recentSites = null;
      });
    }
    return recentSites;
  }
  var recentSites;
  var init_history = __esm({
    "src/core/history.ts"() {
      "use strict";
      recentSites = null;
    }
  });

  // src/components/bookmark-actions.ts
  function findBookmark(id) {
    return appStore.state.bookmarks.find((item) => String(item.id) === String(id));
  }
  function compareBookmarks2(left, right) {
    return left.order - right.order || String(left.id).localeCompare(String(right.id));
  }
  function bookmarksIn(folder) {
    return appStore.state.bookmarks.filter((bookmark) => bookmark.folder === folder).sort(compareBookmarks2);
  }
  function bookmarkName(bookmark) {
    return cleanDisplayName(bookmark.name) || cleanDisplayName(new URL(bookmark.url).hostname);
  }
  function interceptExtensionLink(event, url) {
    if (event.defaultPrevented || new URL(url).protocol !== "chrome-extension:") return;
    event.preventDefault();
    void Promise.resolve(chrome.tabs.create({ url })).catch(notifyError);
  }
  function openInNewTab(url) {
    void Promise.resolve(chrome.tabs.create({ url })).catch(notifyError);
  }
  function openBookmarkDialog(source, detail) {
    source.dispatchEvent(new CustomEvent("open-bookmark-dialog", { bubbles: true, composed: true, detail }));
  }
  function bookmarkMenu(source, bookmark, at) {
    const destinations = appStore.state.folders.filter((folder) => folder !== bookmark.folder);
    openMenu([
      { label: "\u5728\u65B0\u6807\u7B7E\u9875\u6253\u5F00", icon: ICONS.open, action: () => openInNewTab(bookmark.url) },
      { label: "\u7F16\u8F91\u2026", icon: ICONS.edit, action: () => openBookmarkDialog(source, { bookmark }) },
      ...destinations.length ? [
        { separator: true },
        { heading: "\u79FB\u52A8\u5230\u6587\u4EF6\u5939" },
        ...destinations.map((folder) => ({ label: folder, icon: ICONS.move, action: () => void moveBookmark(bookmark.id, folder) }))
      ] : [],
      { separator: true },
      { label: "\u5220\u9664\u4E66\u7B7E", icon: ICONS.trash, danger: true, action: () => void deleteBookmark(bookmark) }
    ], at);
  }
  function siteMenu(source, site, at) {
    openMenu([
      { label: "\u5728\u65B0\u6807\u7B7E\u9875\u6253\u5F00", icon: ICONS.open, action: () => openInNewTab(site.url) },
      { label: "\u6DFB\u52A0\u5230\u4E66\u7B7E", icon: ICONS.plus, action: () => openBookmarkDialog(source, { draft: { url: site.url, name: site.title } }) }
    ], at);
  }
  async function moveBookmark(id, folder, targetId) {
    try {
      await appStore.moveBookmark(id, folder, targetId);
    } catch (error) {
      notifyError(error);
    }
  }
  async function deleteBookmark(bookmark) {
    const confirmed = await confirmAction({
      title: `\u5220\u9664\u201C${bookmarkName(bookmark) || bookmark.url}\u201D\uFF1F`,
      confirmText: "\u5220\u9664",
      danger: true
    });
    if (confirmed) await appStore.deleteBookmark(bookmark.id).catch(notifyError);
  }
  async function createFolder() {
    const name = await promptText("\u65B0\u5EFA\u6587\u4EF6\u5939", { label: "\u540D\u79F0", placeholder: "\u4F8B\u5982\uFF1A\u5DE5\u4F5C\u3001\u5A31\u4E50" }, "\u521B\u5EFA");
    if (!name) return null;
    try {
      if (await appStore.addFolder(name)) return name;
      notifyError(new Error(`\u5DF2\u7ECF\u6709\u540D\u4E3A\u201C${name}\u201D\u7684\u6587\u4EF6\u5939`));
    } catch (error) {
      notifyError(error);
    }
    return null;
  }
  async function renameFolder(folder, follow = () => void 0) {
    const name = await promptText("\u91CD\u547D\u540D\u6587\u4EF6\u5939", { label: "\u540D\u79F0", value: folder });
    if (!name || name === folder) return;
    follow(name);
    try {
      if (await appStore.renameFolder(folder, name)) return;
      follow(folder);
      notifyError(new Error(`\u5DF2\u7ECF\u6709\u540D\u4E3A\u201C${name}\u201D\u7684\u6587\u4EF6\u5939`));
    } catch (error) {
      follow(folder);
      notifyError(error);
    }
  }
  async function deleteFolder(folder) {
    const count = bookmarksIn(folder).length;
    const confirmed = await confirmAction({
      title: `\u5220\u9664\u6587\u4EF6\u5939\u201C${folder}\u201D\uFF1F`,
      body: count ? `\u5176\u4E2D\u7684 ${count} \u4E2A\u4E66\u7B7E\u4F1A\u79FB\u56DE\u201C${ROOT_FOLDER}\u201D\uFF0C\u4E0D\u4F1A\u88AB\u5220\u9664\u3002` : "\u8FD9\u4E2A\u6587\u4EF6\u5939\u662F\u7A7A\u7684\u3002",
      confirmText: "\u5220\u9664",
      danger: true
    });
    if (!confirmed) return false;
    try {
      await appStore.deleteFolder(folder);
      return true;
    } catch (error) {
      notifyError(error);
      return false;
    }
  }
  var ROOT_FOLDER;
  var init_bookmark_actions = __esm({
    "src/components/bookmark-actions.ts"() {
      "use strict";
      init_store();
      init_utils();
      init_icons();
      init_ui_layer();
      ROOT_FOLDER = "\u5168\u90E8";
    }
  });

  // src/components/site-icon.ts
  function siteIcon({ url, name, bookmark }, className = "") {
    const host = hostOf(url);
    const letter = Array.from(cleanDisplayName(name) || host || "?")[0]?.toUpperCase() ?? "?";
    const [from, to, ink] = TILE_COLORS[hash(host) % TILE_COLORS.length];
    const image = bookmark ? `<img src="${escapeHtml(bookmarkIcon(bookmark))}" srcset="${escapeHtml(bookmarkIconSrcSet(bookmark))}" sizes="96px" data-icon-fallback="${escapeHtml(bookmarkIconFallback(bookmark))}" data-icon-can-upgrade="${bookmarkIconCanUpgrade(bookmark)}" data-icon-raster="${bookmarkIconIsRaster(bookmark)}" alt="" decoding="async" draggable="false">` : `<img src="${escapeHtml(faviconUrl(url))}" srcset="${escapeHtml(faviconSrcSet(url))}" sizes="96px" alt="" loading="lazy" decoding="async" draggable="false">`;
    return `<span class="app-icon ${className}" style="--tile-from:${from};--tile-to:${to};--tile-ink:${ink}">${image}<span class="app-letter" aria-hidden="true">${escapeHtml(letter)}</span></span>`;
  }
  function bindSiteIcons(root) {
    root.querySelectorAll(".app-icon > img").forEach((image) => {
      if (image.dataset.bound) return;
      image.dataset.bound = "true";
      const tile = image.parentElement;
      const fallback = image.dataset.iconFallback;
      const useFallback = () => {
        if (!fallback || image.dataset.fallbackUsed === "true" || fallback.startsWith("data:")) {
          tile.classList.add("is-letter");
          return;
        }
        image.dataset.fallbackUsed = "true";
        image.removeAttribute("srcset");
        image.src = fallback;
      };
      image.addEventListener("load", () => {
        if (image.dataset.iconCanUpgrade === "true" && image.dataset.fallbackUsed !== "true" && image.naturalWidth > 0 && image.naturalWidth < 64) {
          useFallback();
        }
      });
      image.addEventListener("error", useFallback);
      if (image.complete && image.naturalWidth === 0 && image.getAttribute("src")) useFallback();
    });
  }
  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }
  function hash(value) {
    let result = 0;
    for (const character of value) result = result * 31 + character.charCodeAt(0) >>> 0;
    return result;
  }
  var TILE_COLORS;
  var init_site_icon = __esm({
    "src/components/site-icon.ts"() {
      "use strict";
      init_utils();
      TILE_COLORS = [
        ["#3a414a", "#0d1117", "#ffffff"],
        ["#ff5f57", "#d42a22", "#ffffff"],
        ["#ffd76a", "#f4a320", "#5a3800"],
        ["#ff8db8", "#e0447c", "#ffffff"],
        ["#b9a2ff", "#7446f5", "#ffffff"],
        ["#4fb0ff", "#0a68ec", "#ffffff"],
        ["#53d891", "#169a55", "#ffffff"],
        ["#ffa35c", "#f06a12", "#ffffff"],
        ["#8b8ff8", "#5056d8", "#ffffff"]
      ];
    }
  });

  // src/components/bookmark-launchpad.ts
  var BookmarkLaunchpad;
  var init_bookmark_launchpad = __esm({
    "src/components/bookmark-launchpad.ts"() {
      "use strict";
      init_history();
      init_store();
      init_utils();
      init_base();
      init_bookmark_actions();
      init_icons();
      init_site_icon();
      init_ui_layer();
      BookmarkLaunchpad = class extends StoreElement {
        observedChanges = ["bookmarks", "folders", "settings.layout"];
        view = "bookmarks";
        folder = ROOT_FOLDER;
        query = "";
        draggingId = null;
        recent = { sites: [], state: "idle", error: "" };
        releaseLayer = null;
        connectedCallback() {
          this.hidden = true;
          super.connectedCallback();
        }
        disconnectedCallback() {
          super.disconnectedCallback();
          this.close();
        }
        get isOpen() {
          return !this.hidden;
        }
        open(view = "bookmarks", folder = ROOT_FOLDER) {
          this.view = view;
          this.folder = folder;
          this.query = "";
          this.innerHTML = "";
          if (!this.isOpen) {
            this.hidden = false;
            document.body.classList.add("launchpad-open");
            this.releaseLayer = pushLayer(this, () => this.close());
          }
          this.render();
          afterMotion(this, () => {
            if (this.isOpen && !this.contains(document.activeElement)) this.querySelector(".launchpad-tab.is-active")?.focus({ preventScroll: true });
          });
        }
        close() {
          if (!this.isOpen) return;
          this.hidden = true;
          document.body.classList.remove("launchpad-open");
          this.innerHTML = "";
          const release = this.releaseLayer;
          this.releaseLayer = null;
          release?.();
        }
        render() {
          if (!this.isOpen) return;
          if (!appStore.state.folders.includes(this.folder)) this.folder = ROOT_FOLDER;
          if (this.view === "recent" && this.recent.state === "idle") void this.loadRecent();
          if (!this.querySelector(".launchpad")) this.renderShell();
          const grid = this.querySelector(".launchpad-grid");
          const scroll = grid.scrollTop;
          this.querySelector(".launchpad-tabs").innerHTML = this.tabsTemplate();
          grid.dataset.view = this.query ? "search" : this.view;
          grid.innerHTML = this.gridTemplate();
          grid.scrollTop = scroll;
          bindSiteIcons(this);
          this.querySelectorAll(".bookmark-tile").forEach((card) => this.bindBookmark(card));
          this.querySelectorAll("[data-drop-folder]").forEach((target) => this.bindFolderDrop(target));
        }
        /** The shell (and its search field) is built once per opening so typing, including IME input, is never interrupted. */
        renderShell() {
          this.innerHTML = `
            <div class="launchpad-backdrop" aria-hidden="true"></div>
            <section class="launchpad" role="dialog" aria-modal="true" aria-label="\u542F\u52A8\u53F0">
                <header class="launchpad-top">
                    <label class="glass launchpad-search">
                        ${ICONS.search}
                        <input type="search" placeholder="\u5728\u4E66\u7B7E\u4E2D\u641C\u7D22" aria-label="\u5728\u4E66\u7B7E\u4E2D\u641C\u7D22" autocomplete="off" spellcheck="false">
                    </label>
                    <div class="glass launchpad-tabs" role="tablist" aria-label="\u4E66\u7B7E\u5206\u7EC4"></div>
                </header>
                <button class="glass launchpad-done" type="button" data-liquid-item>\u5B8C\u6210</button>
                <div class="launchpad-grid"></div>
            </section>`;
          this.bindShell();
        }
        tabsTemplate() {
          const { bookmarks, folders } = appStore.state;
          const tab = (label, active, attributes) => `
            <button class="launchpad-tab ${active ? "is-active" : ""}" type="button" role="tab" aria-selected="${active}" tabindex="${active ? 0 : -1}" data-liquid-item ${attributes}>${label}</button>`;
          const browsing = !this.query;
          return `
                ${tab(`\u5168\u90E8 \xB7 ${bookmarks.length}`, browsing && this.view === "bookmarks" && this.folder === ROOT_FOLDER, `data-folder="${ROOT_FOLDER}" data-drop-folder="${ROOT_FOLDER}"`)}
                ${tab("\u5E38\u8BBF\u95EE", browsing && this.view === "recent", 'data-view="recent"')}
                ${folders.filter((folder) => folder !== ROOT_FOLDER).map((folder) => tab(
            escapeHtml(folder),
            browsing && this.view === "bookmarks" && this.folder === folder,
            `data-folder="${escapeHtml(folder)}" data-drop-folder="${escapeHtml(folder)}"`
          )).join("")}
                <button class="launchpad-tab create-folder" type="button" data-liquid-item aria-label="\u65B0\u5EFA\u6587\u4EF6\u5939" title="\u65B0\u5EFA\u6587\u4EF6\u5939">${ICONS.plus}</button>`;
        }
        gridTemplate() {
          if (this.query) {
            const query = this.query.toLowerCase();
            const matches = [...appStore.state.bookmarks].sort(compareBookmarks2).filter((bookmark) => bookmarkName(bookmark).toLowerCase().includes(query) || bookmark.url.toLowerCase().includes(query));
            return matches.map((bookmark) => this.bookmarkTemplate(bookmark)).join("") || `<p class="launchpad-message">\u6CA1\u6709\u627E\u5230\u201C${escapeHtml(this.query)}\u201D</p>`;
          }
          if (this.view === "recent") return this.recentTemplate();
          const folders = this.folder === ROOT_FOLDER ? appStore.state.folders.filter((folder) => folder !== ROOT_FOLDER).map((folder) => this.folderTemplate(folder)).join("") : "";
          const bookmarks = bookmarksIn(this.folder);
          const empty = !bookmarks.length && !folders ? `<p class="launchpad-message">${this.folder === ROOT_FOLDER ? "\u8FD8\u6CA1\u6709\u4E66\u7B7E\uFF0C\u70B9\u51FB\u52A0\u53F7\u6DFB\u52A0\u7B2C\u4E00\u4E2A" : "\u8FD9\u4E2A\u6587\u4EF6\u5939\u662F\u7A7A\u7684\uFF0C\u53EF\u4EE5\u628A\u4E66\u7B7E\u62D6\u5230\u4E0A\u65B9\u7684\u6587\u4EF6\u5939\u6807\u7B7E\u4E0A"}</p>` : "";
          return `
            ${folders}
            ${bookmarks.map((bookmark) => this.bookmarkTemplate(bookmark)).join("")}
            <button class="tile add-tile add-bookmark" type="button" data-liquid-item>
                <span class="app-icon app-icon-glass">${ICONS.plus}</span>
                <span class="tile-name">\u6DFB\u52A0\u4E66\u7B7E</span>
            </button>
            ${empty}`;
        }
        folderTemplate(folder) {
          const items = bookmarksIn(folder);
          const minis = items.slice(0, 4).map((bookmark) => siteIcon({ url: bookmark.url, name: bookmark.name, bookmark }, "mini-icon")).join("");
          return `
            <button class="tile folder-tile" type="button" data-folder="${escapeHtml(folder)}" data-drop-folder="${escapeHtml(folder)}" data-liquid-item title="${escapeHtml(folder)} \xB7 ${items.length} \u4E2A\u4E66\u7B7E">
                <span class="app-icon app-icon-glass folder-icon">${minis || ICONS.folder}</span>
                <span class="tile-name">${escapeHtml(folder)}</span>
            </button>`;
        }
        bookmarkTemplate(bookmark) {
          const name = bookmarkName(bookmark);
          const newTab = appStore.state.settings.layout.openInNewTab;
          return `
            <a class="tile bookmark-tile" href="${escapeHtml(bookmark.url)}" ${newTab ? 'target="_blank"' : ""} rel="noopener noreferrer"
                data-bookmark-id="${escapeHtml(bookmark.id)}" data-liquid-item draggable="true" title="${escapeHtml(name)}&#10;${escapeHtml(bookmark.url)}">
                ${siteIcon({ url: bookmark.url, name: bookmark.name, bookmark })}
                <span class="tile-name">${escapeHtml(name)}</span>
                <button class="tile-more" type="button" tabindex="-1" aria-label="\u4E66\u7B7E\u64CD\u4F5C">${ICONS.more}</button>
            </a>`;
        }
        recentTemplate() {
          if (this.recent.state === "loading" || this.recent.state === "idle") return '<p class="launchpad-message">\u6B63\u5728\u6574\u7406\u6D4F\u89C8\u8BB0\u5F55\u2026</p>';
          if (this.recent.state === "error") return `<p class="launchpad-message">${escapeHtml(this.recent.error)}</p>`;
          if (!this.recent.sites.length) return '<p class="launchpad-message">\u6700\u8FD1 30 \u5929\u8FD8\u6CA1\u6709\u53EF\u5C55\u793A\u7684\u7F51\u7AD9</p>';
          const newTab = appStore.state.settings.layout.openInNewTab;
          return this.recent.sites.map((site, index) => `
            <a class="tile recent-tile" href="${escapeHtml(site.url)}" ${newTab ? 'target="_blank"' : ""} rel="noopener noreferrer" data-recent-index="${index}" data-liquid-item title="${escapeHtml(hostOf(site.url))}">
                ${siteIcon({ url: site.url, name: site.title })}
                <span class="tile-name">${escapeHtml(site.title)}</span>
            </a>`).join("");
        }
        bindShell() {
          this.querySelector(".launchpad-done")?.addEventListener("click", () => this.close());
          this.querySelector(".launchpad-backdrop")?.addEventListener("click", () => this.close());
          this.querySelector(".launchpad")?.addEventListener("click", (event) => {
            if (event.target.matches(".launchpad, .launchpad-top")) this.close();
          });
          const search = this.querySelector(".launchpad-search input");
          search.addEventListener("input", () => {
            this.query = search.value.trim();
            this.render();
          });
          const tabs = this.querySelector(".launchpad-tabs");
          tabs.addEventListener("click", (event) => {
            const button = event.target.closest(".launchpad-tab");
            if (!button) return;
            if (button.classList.contains("create-folder")) void createFolder();
            else if (button.dataset.view === "recent") this.show("recent", ROOT_FOLDER);
            else this.show("bookmarks", button.dataset.folder ?? ROOT_FOLDER);
          });
          tabs.addEventListener("keydown", (event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            const items = [...tabs.querySelectorAll(".launchpad-tab")];
            const index = items.indexOf(document.activeElement);
            if (index < 0) return;
            event.preventDefault();
            items[(index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length].focus();
          });
          const grid = this.querySelector(".launchpad-grid");
          grid.addEventListener("click", (event) => {
            const target = event.target;
            if (target === grid) {
              this.close();
              return;
            }
            const more = target.closest(".tile-more");
            if (more) {
              event.preventDefault();
              event.stopPropagation();
              this.openTileMenu(more.closest(".tile"), more);
              return;
            }
            const folder = target.closest(".folder-tile");
            if (folder) this.show("bookmarks", folder.dataset.folder ?? ROOT_FOLDER);
            else if (target.closest(".add-bookmark")) openBookmarkDialog(this, { folder: this.folder });
          });
          grid.addEventListener("dragover", (event) => {
            if (this.draggingId !== null) event.preventDefault();
          });
          grid.addEventListener("drop", (event) => {
            if (event.target.closest(".bookmark-tile, [data-drop-folder]")) return;
            event.preventDefault();
            const id = this.dragId(event);
            if (id !== null) void moveBookmark(id, this.folder);
          });
          this.querySelector(".launchpad")?.addEventListener("contextmenu", (event) => {
            const mouse = event;
            const target = mouse.target;
            const tile = target.closest(".tile:not(.add-tile), .launchpad-tab[data-folder]");
            if (!tile && !target.closest(".launchpad-grid")) return;
            event.preventDefault();
            const at = mouse.clientX || mouse.clientY ? { x: mouse.clientX, y: mouse.clientY } : tile ?? target;
            if (tile) this.openTileMenu(tile, at);
            else if (this.view === "bookmarks" && !this.query) openMenu([
              { label: "\u6DFB\u52A0\u4E66\u7B7E", icon: ICONS.plus, action: () => openBookmarkDialog(this, { folder: this.folder }) },
              { label: "\u65B0\u5EFA\u6587\u4EF6\u5939", icon: ICONS.folderPlus, action: () => void createFolder() }
            ], at);
          });
        }
        bindBookmark(card) {
          const id = card.dataset.bookmarkId ?? "";
          card.addEventListener("click", (event) => interceptExtensionLink(event, card.href));
          card.addEventListener("dragstart", (event) => {
            this.draggingId = id;
            event.dataTransfer?.setData("text/plain", id);
            if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
            card.classList.add("is-dragging");
            this.classList.add("is-dragging");
          });
          card.addEventListener("dragend", () => {
            this.draggingId = null;
            card.classList.remove("is-dragging");
            this.classList.remove("is-dragging");
            this.querySelectorAll(".drop-target").forEach((item) => item.classList.remove("drop-target"));
          });
          card.addEventListener("dragover", (event) => {
            if (this.draggingId === null || this.draggingId === id) return;
            event.preventDefault();
            card.classList.add("drop-target");
          });
          card.addEventListener("dragleave", () => card.classList.remove("drop-target"));
          card.addEventListener("drop", (event) => {
            event.preventDefault();
            event.stopPropagation();
            card.classList.remove("drop-target");
            const sourceId = this.dragId(event);
            const target = findBookmark(id);
            if (sourceId !== null && sourceId !== id && target) void moveBookmark(sourceId, target.folder, id);
          });
        }
        bindFolderDrop(target) {
          const folder = target.dataset.dropFolder ?? ROOT_FOLDER;
          target.addEventListener("dragover", (event) => {
            if (this.draggingId === null) return;
            event.preventDefault();
            target.classList.add("drop-target");
          });
          target.addEventListener("dragleave", () => target.classList.remove("drop-target"));
          target.addEventListener("drop", (event) => {
            event.preventDefault();
            event.stopPropagation();
            target.classList.remove("drop-target");
            const id = this.dragId(event);
            if (id !== null) void moveBookmark(id, folder);
          });
        }
        openTileMenu(tile, at) {
          const folder = tile.dataset.folder;
          if (folder !== void 0) {
            if (folder === ROOT_FOLDER) return;
            openMenu([
              { label: "\u6253\u5F00", icon: ICONS.open, action: () => this.show("bookmarks", folder) },
              { label: "\u91CD\u547D\u540D\u2026", icon: ICONS.edit, action: () => void renameFolder(folder, (name) => {
                if (this.folder === folder || this.folder === name) this.folder = name;
              }) },
              { separator: true },
              { label: "\u5220\u9664\u6587\u4EF6\u5939", icon: ICONS.trash, danger: true, action: () => void deleteFolder(folder) }
            ], at);
            return;
          }
          if (tile.dataset.recentIndex !== void 0) {
            const site = this.recent.sites[Number(tile.dataset.recentIndex)];
            if (site) siteMenu(this, site, at);
            return;
          }
          const bookmark = findBookmark(tile.dataset.bookmarkId ?? "");
          if (bookmark) bookmarkMenu(this, bookmark, at);
        }
        show(view, folder) {
          if (view === this.view && folder === this.folder && !this.query) return;
          this.view = view;
          this.folder = folder;
          this.query = "";
          const search = this.querySelector(".launchpad-search input");
          if (search) search.value = "";
          this.render();
          this.querySelector(".launchpad-tab.is-active")?.focus({ preventScroll: true });
        }
        async loadRecent() {
          this.recent = { ...this.recent, state: "loading", error: "" };
          try {
            this.recent = { sites: await loadRecentSites(), state: "ready", error: "" };
          } catch (error) {
            this.recent = { sites: [], state: "error", error: error instanceof Error && error.message ? error.message : "\u8BFB\u53D6\u6D4F\u89C8\u8BB0\u5F55\u5931\u8D25" };
          }
          if (this.view === "recent") this.render();
        }
        dragId(event) {
          return event.dataTransfer?.getData("text/plain") || this.draggingId;
        }
      };
    }
  });

  // src/components/dashboard-header.ts
  function formatDate(date, format) {
    const weekday = date.toLocaleDateString("zh-CN", { weekday: format === "long" ? "long" : "short" });
    const month = date.getMonth() + 1;
    return format === "long" ? `${month}\u6708${date.getDate()}\u65E5 ${weekday}` : `${month}/${date.getDate()} ${weekday}`;
  }
  var DashboardHeader;
  var init_dashboard_header = __esm({
    "src/components/dashboard-header.ts"() {
      "use strict";
      init_store();
      init_base();
      DashboardHeader = class extends StoreElement {
        observedChanges = ["settings.layout", "settings.appearance"];
        clockTimer = 0;
        connectedCallback() {
          super.connectedCallback();
          this.scheduleTick();
        }
        disconnectedCallback() {
          super.disconnectedCallback();
          window.clearTimeout(this.clockTimer);
        }
        render() {
          this.hidden = !appStore.state.settings.layout.showClock;
          if (!this.querySelector(".hero-time")) {
            this.innerHTML = '<p class="hero-date" id="date"></p><time class="hero-time" id="time">--:--</time>';
          }
          this.updateClock();
        }
        /** Wakes up on the minute boundary instead of polling every second. */
        scheduleTick() {
          window.clearTimeout(this.clockTimer);
          const now = /* @__PURE__ */ new Date();
          const delay = 6e4 - (now.getSeconds() * 1e3 + now.getMilliseconds()) + 20;
          this.clockTimer = window.setTimeout(() => {
            this.updateClock();
            this.scheduleTick();
          }, delay);
        }
        updateClock() {
          const time = this.querySelector("#time");
          const date = this.querySelector("#date");
          if (!time || !date) return;
          const now = /* @__PURE__ */ new Date();
          const { clockFormat, dateFormat } = appStore.state.settings.appearance;
          time.dateTime = now.toISOString();
          time.textContent = now.toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: clockFormat === "12h"
          });
          date.textContent = formatDate(now, dateFormat);
        }
      };
    }
  });

  // src/components/home-dock.ts
  var MAX_ITEMS, HomeDock;
  var init_home_dock = __esm({
    "src/components/home-dock.ts"() {
      "use strict";
      init_history();
      init_store();
      init_utils();
      init_base();
      init_bookmark_actions();
      init_icons();
      init_site_icon();
      MAX_ITEMS = 12;
      HomeDock = class extends StoreElement {
        observedChanges = ["bookmarks", "settings.layout"];
        sites = null;
        render() {
          const { showBookmarks, dockSource, dockSize, dockMagnify, openInNewTab: openInNewTab2 } = appStore.state.settings.layout;
          this.hidden = !showBookmarks;
          if (this.hidden) {
            this.innerHTML = "";
            return;
          }
          this.style.setProperty("--dock-size", `${dockSize}px`);
          this.classList.toggle("is-magnifying", dockMagnify);
          const target = openInNewTab2 ? 'target="_blank"' : "";
          let items = "";
          if (dockSource === "recent") {
            if (!this.sites) void this.loadSites();
            items = (this.sites ?? []).slice(0, MAX_ITEMS).map((site, index) => `
                <a class="dock-item" href="${escapeHtml(site.url)}" ${target} rel="noopener noreferrer" data-site-index="${index}" data-liquid-item aria-label="${escapeHtml(site.title)}" draggable="false">
                    ${siteIcon({ url: site.url, name: site.title })}
                    <span class="dock-label glass glass-dark" aria-hidden="true">${escapeHtml(site.title)}</span>
                </a>`).join("");
          } else {
            const bookmarks = bookmarksIn(ROOT_FOLDER).slice(0, MAX_ITEMS);
            items = bookmarks.map((bookmark) => `
                <a class="dock-item" href="${escapeHtml(bookmark.url)}" ${target} rel="noopener noreferrer" data-bookmark-id="${escapeHtml(bookmark.id)}" data-liquid-item aria-label="${escapeHtml(bookmarkName(bookmark))}" draggable="false">
                    ${siteIcon({ url: bookmark.url, name: bookmark.name, bookmark })}
                    <span class="dock-label glass glass-dark" aria-hidden="true">${escapeHtml(bookmarkName(bookmark))}</span>
                </a>`).join("");
            if (!bookmarks.length) items = `
                <button class="dock-item dock-add" type="button" data-liquid-item aria-label="\u6DFB\u52A0\u4E66\u7B7E">
                    <span class="app-icon app-icon-glass">${ICONS.plus}</span>
                    <span class="dock-label glass glass-dark" aria-hidden="true">\u6DFB\u52A0\u4E66\u7B7E</span>
                </button>`;
          }
          this.innerHTML = `
            <nav class="glass dock" aria-label="\u5E38\u7528\u4E66\u7B7E">
                ${items}
                <span class="dock-divider" aria-hidden="true"></span>
                    <button class="dock-item dock-recent" type="button" data-liquid-item aria-label="\u5E38\u8BBF\u95EE">
                        <span class="app-icon app-icon-glass">${ICONS.clock}</span>
                        <span class="dock-label glass glass-dark" aria-hidden="true">\u5E38\u8BBF\u95EE</span>
                    </button>
                    <button class="dock-item dock-all" type="button" data-liquid-item aria-label="\u5168\u90E8\u4E66\u7B7E">
                        <span class="app-icon app-icon-glass">${ICONS.grid}</span>
                        <span class="dock-label glass glass-dark" aria-hidden="true">\u5168\u90E8\u4E66\u7B7E</span>
                    </button>
            </nav>`;
          bindSiteIcons(this);
          this.bindEvents();
        }
        bindEvents() {
          this.querySelector(".dock-recent")?.addEventListener("click", () => this.openLaunchpad("recent"));
          this.querySelector(".dock-all")?.addEventListener("click", () => this.openLaunchpad("bookmarks"));
          this.querySelector(".dock-add")?.addEventListener("click", (event) => openBookmarkDialog(event.currentTarget, { folder: ROOT_FOLDER }));
          this.querySelectorAll(".dock-item[data-bookmark-id]").forEach((item) => {
            item.addEventListener("click", (event) => interceptExtensionLink(event, item.href));
          });
          this.querySelector(".dock")?.addEventListener("contextmenu", (event) => {
            const mouse = event;
            const item = mouse.target.closest(".dock-item");
            const at = mouse.clientX || mouse.clientY ? { x: mouse.clientX, y: mouse.clientY } : item;
            if (!item || !at) return;
            const bookmark = item.dataset.bookmarkId ? findBookmark(item.dataset.bookmarkId) : void 0;
            const site = item.dataset.siteIndex !== void 0 ? this.sites?.[Number(item.dataset.siteIndex)] : void 0;
            if (!bookmark && !site) return;
            event.preventDefault();
            if (bookmark) bookmarkMenu(this, bookmark, at);
            else if (site) siteMenu(this, site, at);
          });
        }
        openLaunchpad(view) {
          this.dispatchEvent(new CustomEvent("open-launchpad", { bubbles: true, composed: true, detail: { view } }));
        }
        async loadSites() {
          this.sites = [];
          try {
            this.sites = await loadRecentSites();
          } catch {
            this.sites = [];
          }
          this.render();
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
  function lipSquircle(value) {
    const convex = convexSquircle(value);
    const concave = 1 - convex;
    const blend = smootherstep(value);
    return convex * (1 - blend) + concave * blend;
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
  function createOpticalMaps(shape, profile = "convex") {
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const radius = clamp(shape.radius, 2, Math.min(shape.width, shape.height) / 2);
    const bezelWidth = Math.max(2, radius * 0.75);
    const surface = profile === "lip" ? lipSquircle : convexSquircle;
    const displacements = precalculateDisplacements(DISTANCE_TO_BACKDROP, GLASS_THICKNESS, surface);
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
  function smootherstep(value) {
    const progress = clamp(value, 0, 1);
    return progress ** 3 * (progress * (progress * 6 - 15) + 10);
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

  // src/components/hdr-glass.ts
  function quantizeResolution(value) {
    return Math.max(1, Math.min(HDR_MAX_EDGE, Math.ceil(value / HDR_RESOLUTION_STEP) * HDR_RESOLUTION_STEP));
  }
  var HDR_MAX_EDGE, HDR_RESOLUTION_STEP, HDR_SHADER, HdrGlassRenderer;
  var init_hdr_glass = __esm({
    "src/components/hdr-glass.ts"() {
      "use strict";
      HDR_MAX_EDGE = 512;
      HDR_RESOLUTION_STEP = 32;
      HDR_SHADER = `
struct GlassUniforms {
    size: vec2f,
    radius: f32,
    bridge: f32,
    resolution: vec2f,
    padding: vec2f,
}

@group(0) @binding(0) var<uniform> glass: GlassUniforms;

@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    var positions = array<vec2f, 3>(
        vec2f(-1.0, -1.0),
        vec2f(3.0, -1.0),
        vec2f(-1.0, 3.0)
    );
    return vec4f(positions[index], 0.0, 1.0);
}

fn roundedRectDistance(point: vec2f, halfSize: vec2f, radius: f32) -> f32 {
    let corner = abs(point) - (halfSize - vec2f(radius));
    return length(max(corner, vec2f(0.0))) + min(max(corner.x, corner.y), 0.0) - radius;
}

@fragment
fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
    let uv = position.xy / glass.resolution;
    let point = (uv - vec2f(0.5)) * glass.size;
    let halfSize = max(glass.size * 0.5 - vec2f(2.0), vec2f(1.0));
    let radius = min(glass.radius, min(halfSize.x, halfSize.y));
    let sdf = roundedRectDistance(point, halfSize, radius);
    let inside = 1.0 - smoothstep(0.0, 2.0, sdf);
    let rim = exp(-abs(sdf) * 0.58) * inside;

    let gradient = vec2f(dpdx(sdf), dpdy(sdf));
    let normal = gradient / max(length(gradient), 0.0001);
    let light = normalize(vec2f(0.5, -0.8660254));
    let tangent = vec2f(-light.y, light.x);
    let facing = abs(dot(normal, light));
    let specular = pow(facing, 3.2);
    let dispersion = dot(normal, tangent);
    let cyanEdge = pow(max(dispersion, 0.0), 2.4);
    let pinkEdge = pow(max(-dispersion, 0.0), 2.4);
    let innerCaustic = exp(-abs(sdf + 4.2) * 0.42) * inside;
    let motionGain = 1.0 + glass.bridge * 0.42;

    let whiteSpecular = vec3f(3.25) * rim * (0.16 + specular * 1.12);
    let skyDispersion = vec3f(0.16, 1.05, 2.8) * rim * cyanEdge * 0.52;
    let pinkDispersion = vec3f(2.35, 0.22, 0.82) * rim * pinkEdge * 0.4;
    let caustic = vec3f(0.52, 0.82, 1.35) * innerCaustic * (0.08 + glass.bridge * 0.12);
    let radiance = (whiteSpecular + skyDispersion + pinkDispersion + caustic) * motionGain;
    let alpha = clamp(rim * (0.2 + specular * 0.7 + (cyanEdge + pinkEdge) * 0.12) + innerCaustic * 0.08, 0.0, 0.96);

    return vec4f(radiance * alpha, alpha);
}`;
      HdrGlassRenderer = class {
        canvas = document.createElement("canvas");
        device = null;
        context = null;
        pipeline = null;
        uniformBuffer = null;
        bindGroup = null;
        geometry = null;
        bridge = 0;
        wantsVisible = false;
        initializing = false;
        drawFrame = 0;
        hdrMedia = window.matchMedia("(dynamic-range: high)");
        classObserver = new MutationObserver(() => this.syncVisibility());
        constructor() {
          this.canvas.className = "hdr-glass-layer";
          this.canvas.width = HDR_MAX_EDGE;
          this.canvas.height = HDR_MAX_EDGE;
          this.canvas.setAttribute("aria-hidden", "true");
        }
        connect() {
          this.classObserver.observe(document.body, { attributeFilter: ["class"] });
          this.hdrMedia.addEventListener("change", this.onDisplayChange);
          void this.initialize();
        }
        disconnect() {
          this.classObserver.disconnect();
          this.hdrMedia.removeEventListener("change", this.onDisplayChange);
          this.device?.destroy?.();
          this.device = null;
          this.canvas.classList.remove("is-visible");
          cancelAnimationFrame(this.drawFrame);
          this.drawFrame = 0;
        }
        show() {
          this.wantsVisible = true;
          this.syncVisibility();
        }
        hide() {
          this.wantsVisible = false;
          this.canvas.classList.remove("is-visible");
        }
        render(geometry, bridge) {
          this.geometry = geometry;
          this.bridge = bridge;
          this.resizeRenderTarget(geometry);
          this.canvas.style.setProperty("--hdr-glass-x", `${geometry.x}px`);
          this.canvas.style.setProperty("--hdr-glass-y", `${geometry.y}px`);
          this.canvas.style.setProperty("--hdr-glass-width", `${geometry.width}px`);
          this.canvas.style.setProperty("--hdr-glass-height", `${geometry.height}px`);
          this.canvas.style.setProperty("--hdr-glass-radius", `${geometry.radius}px`);
          this.scheduleDraw();
        }
        onDisplayChange = () => {
          if (this.hdrMedia.matches) void this.initialize();
          this.syncVisibility();
        };
        async initialize() {
          if (this.device || this.initializing || !this.hdrMedia.matches || !("gpu" in navigator)) return;
          this.initializing = true;
          try {
            const gpu = navigator.gpu;
            const adapter = await gpu?.requestAdapter();
            if (!adapter) return;
            const device = await adapter.requestDevice();
            const context = this.canvas.getContext("webgpu");
            if (!context) return;
            context.configure({
              device,
              format: "rgba16float",
              alphaMode: "premultiplied",
              toneMapping: { mode: "extended" }
            });
            const shader = device.createShaderModule({ code: HDR_SHADER });
            const pipeline = device.createRenderPipeline({
              layout: "auto",
              vertex: { module: shader, entryPoint: "vertexMain" },
              fragment: {
                module: shader,
                entryPoint: "fragmentMain",
                targets: [{
                  format: "rgba16float",
                  blend: {
                    color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
                    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
                  }
                }]
              },
              primitive: { topology: "triangle-list" }
            });
            const uniformBuffer = device.createBuffer({
              size: 32,
              usage: 64 | 8
            });
            const bindGroup = device.createBindGroup({
              layout: pipeline.getBindGroupLayout(0),
              entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
            });
            this.device = device;
            this.context = context;
            this.pipeline = pipeline;
            this.uniformBuffer = uniformBuffer;
            this.bindGroup = bindGroup;
            this.canvas.dataset.hdrRenderer = "webgpu";
            void device.lost.then(() => {
              this.device = null;
              this.canvas.classList.remove("is-visible");
              this.canvas.dataset.hdrRenderer = "lost";
            });
            this.scheduleDraw();
            this.syncVisibility();
          } catch {
            this.canvas.dataset.hdrRenderer = "unavailable";
          } finally {
            this.initializing = false;
          }
        }
        syncVisibility() {
          const enabled = this.wantsVisible && Boolean(this.device) && this.hdrMedia.matches && document.body.classList.contains("hdr-highlights");
          this.canvas.classList.toggle("is-visible", enabled);
        }
        draw() {
          if (!this.device || !this.context || !this.pipeline || !this.uniformBuffer || !this.bindGroup || !this.geometry) return;
          const values = new Float32Array([
            this.geometry.width,
            this.geometry.height,
            this.geometry.radius,
            this.bridge,
            this.canvas.width,
            this.canvas.height,
            0,
            0
          ]);
          this.device.queue.writeBuffer(this.uniformBuffer, 0, values);
          const encoder = this.device.createCommandEncoder();
          const pass = encoder.beginRenderPass({
            colorAttachments: [{
              view: this.context.getCurrentTexture().createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: "clear",
              storeOp: "store"
            }]
          });
          pass.setPipeline(this.pipeline);
          pass.setBindGroup(0, this.bindGroup);
          pass.draw(3);
          pass.end();
          this.device.queue.submit([encoder.finish()]);
        }
        scheduleDraw() {
          if (this.drawFrame) return;
          this.drawFrame = requestAnimationFrame(() => {
            this.drawFrame = 0;
            this.draw();
          });
        }
        resizeRenderTarget(geometry) {
          const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
          const longestEdge = Math.max(geometry.width, geometry.height) * pixelRatio;
          const scale = Math.min(1, HDR_MAX_EDGE / Math.max(1, longestEdge));
          const width = quantizeResolution(geometry.width * pixelRatio * scale);
          const height = quantizeResolution(geometry.height * pixelRatio * scale);
          if (this.canvas.width === width && this.canvas.height === height) return;
          this.canvas.width = width;
          this.canvas.height = height;
        }
      };
    }
  });

  // src/components/liquid-glass.ts
  function findControl(target) {
    const control = target instanceof Element ? target.closest(CONTROL_SELECTOR) : null;
    return control instanceof HTMLElement && control.getClientRects().length ? control : null;
  }
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
  function controlGeometry(control) {
    const surface = control.querySelector(
      control.matches("liquid-range") ? ".liquid-range-thumb" : ".liquid-toggle-thumb"
    );
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const padding = 2;
    return normalizeGeometry({
      x: rect.left - padding,
      y: rect.top - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      radius: Math.min(rect.width, rect.height) / 2 + padding
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
  var ITEM_SELECTOR, CONTROL_SELECTOR, LENS_PADDING, GROUP_MARGIN, MAGNIFICATION_SCALE, REFRACTION_LEVEL, MAP_CACHE, MAP_READY_CACHE, nextFilterId, LiquidGlassSystem;
  var init_liquid_glass = __esm({
    "src/components/liquid-glass.ts"() {
      "use strict";
      init_liquid_optics();
      init_hdr_glass();
      ITEM_SELECTOR = "[data-liquid-item]";
      CONTROL_SELECTOR = "liquid-toggle, liquid-range";
      LENS_PADDING = 8;
      GROUP_MARGIN = 20;
      MAGNIFICATION_SCALE = 24;
      REFRACTION_LEVEL = 1;
      MAP_CACHE = /* @__PURE__ */ new Map();
      MAP_READY_CACHE = /* @__PURE__ */ new Map();
      nextFilterId = 0;
      LiquidGlassSystem = class extends HTMLElement {
        lens = document.createElement("span");
        defs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        filterContainer = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        hdrGlass = new HdrGlassRenderer();
        activeItem = null;
        activeGroup = null;
        activeControl = null;
        filter = null;
        filterImages = [];
        filterVersion = 0;
        mapShapeKey = "";
        hideTimer = 0;
        controlFrame = 0;
        controlTrackUntil = 0;
        pointerFrame = 0;
        pendingPointer = null;
        connectedCallback() {
          this.lens.className = "liquid-glass-lens";
          this.lens.setAttribute("aria-hidden", "true");
          this.defs.classList.add("liquid-filter-defs");
          this.defs.setAttribute("aria-hidden", "true");
          this.defs.append(this.filterContainer);
          this.append(this.defs, this.lens, this.hdrGlass.canvas);
          this.hdrGlass.connect();
          document.addEventListener("pointerover", this.onPointerOver, true);
          document.addEventListener("pointermove", this.onPointerMove, { passive: true, capture: true });
          document.addEventListener("pointerdown", this.onPointerDown, true);
          document.addEventListener("input", this.onControlInput, true);
          document.addEventListener("focusin", this.onFocusIn, true);
          document.addEventListener("focusout", this.onFocusOut, true);
          window.addEventListener("resize", this.onViewportChange);
          window.addEventListener("scroll", this.onViewportChange, true);
        }
        disconnectedCallback() {
          document.removeEventListener("pointerover", this.onPointerOver, true);
          document.removeEventListener("pointermove", this.onPointerMove, true);
          document.removeEventListener("pointerdown", this.onPointerDown, true);
          document.removeEventListener("input", this.onControlInput, true);
          document.removeEventListener("focusin", this.onFocusIn, true);
          document.removeEventListener("focusout", this.onFocusOut, true);
          window.removeEventListener("resize", this.onViewportChange);
          window.removeEventListener("scroll", this.onViewportChange, true);
          window.clearTimeout(this.hideTimer);
          cancelAnimationFrame(this.controlFrame);
          cancelAnimationFrame(this.pointerFrame);
          this.hdrGlass.disconnect();
        }
        onPointerOver = (event) => {
          const control = findControl(event.target);
          if (control) {
            this.activateControl(control);
            return;
          }
          const item = findItem(event.target);
          if (item) this.activate(item);
        };
        onPointerMove = (event) => {
          const control = findControl(event.target);
          if (control) {
            this.pendingPointer = null;
            if (control !== this.activeControl) this.activateControl(control);
            else this.trackControl(control, 220);
            return;
          }
          if (this.activeControl) this.deactivateControl();
          const item = findItem(event.target);
          if (item) {
            if (item !== this.activeItem) this.activate(item);
            else this.pendingPointer = null;
            return;
          }
          if (!this.activeItem || !this.activeGroup) return;
          this.pendingPointer = { x: event.clientX, y: event.clientY };
          this.schedulePointerRender();
        };
        onPointerDown = (event) => {
          const control = findControl(event.target);
          if (control) {
            this.activateControl(control, 320);
            return;
          }
          const item = findItem(event.target);
          if (!item) return;
          this.activate(item);
          this.lens.classList.add("is-pressed");
          window.addEventListener("pointerup", this.releasePress, { once: true });
          window.addEventListener("pointercancel", this.releasePress, { once: true });
        };
        releasePress = () => this.lens.classList.remove("is-pressed");
        onFocusIn = (event) => {
          const control = findControl(event.target);
          if (control) {
            this.activateControl(control);
            return;
          }
          const item = findItem(event.target);
          if (item) this.activate(item);
        };
        onFocusOut = (event) => {
          if (this.activeControl && !findControl(event.relatedTarget)) {
            this.deactivateControl();
            return;
          }
          if (!findItem(event.relatedTarget)) this.scheduleHide(80);
        };
        onControlInput = (event) => {
          const control = findControl(event.target);
          if (control && control === this.activeControl) this.trackControl(control, 220);
        };
        onViewportChange = () => {
          if (this.activeControl?.isConnected) this.renderControl(this.activeControl);
          else if (this.activeItem?.isConnected) this.render(geometryFor(this.activeItem));
          else this.hide();
        };
        activate(item) {
          this.cancelHide();
          this.pendingPointer = null;
          this.activeControl = null;
          this.controlTrackUntil = 0;
          delete this.hdrGlass.canvas.dataset.hdrTarget;
          this.activeItem = item;
          this.activeGroup = item.parentElement;
          this.lens.dataset.liquidTarget = targetName(item);
          this.lens.classList.add("is-visible");
          this.hdrGlass.show();
          this.render(geometryFor(item));
        }
        activateControl(control, duration = 180) {
          this.cancelHide();
          this.activeItem = null;
          this.activeGroup = null;
          this.activeControl = control;
          this.lens.classList.remove("is-visible", "is-bridging", "is-pressed");
          this.hdrGlass.canvas.dataset.hdrTarget = control.tagName.toLowerCase();
          this.hdrGlass.show();
          this.trackControl(control, duration);
        }
        deactivateControl() {
          this.activeControl = null;
          this.controlTrackUntil = 0;
          cancelAnimationFrame(this.controlFrame);
          this.controlFrame = 0;
          delete this.hdrGlass.canvas.dataset.hdrTarget;
          this.hdrGlass.hide();
        }
        schedulePointerRender() {
          if (this.pointerFrame) return;
          this.pointerFrame = requestAnimationFrame(() => {
            this.pointerFrame = 0;
            const point = this.pendingPointer;
            this.pendingPointer = null;
            if (!point || !this.activeItem || !this.activeGroup) return;
            if (!containsPoint(groupBounds(this.groupItems()), point, GROUP_MARGIN)) {
              this.scheduleHide();
              return;
            }
            this.cancelHide();
            this.renderBetween(point);
          });
        }
        trackControl(control, duration) {
          this.controlTrackUntil = Math.max(this.controlTrackUntil, performance.now() + duration);
          if (this.controlFrame) return;
          const tick = (time) => {
            this.controlFrame = 0;
            if (this.activeControl !== control || !control.isConnected) return;
            this.renderControl(control);
            if (time < this.controlTrackUntil) this.controlFrame = requestAnimationFrame(tick);
          };
          this.controlFrame = requestAnimationFrame(tick);
        }
        renderControl(control) {
          const geometry = controlGeometry(control);
          if (!geometry) return;
          this.hdrGlass.render(geometry, control.classList.contains("is-active") ? 0.55 : 0.12);
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
          const progress = Number(this.lens.dataset.liquidProgress ?? 0);
          this.hdrGlass.render(geometry, this.lens.classList.contains("is-bridging") ? Math.sin(Math.PI * progress) : 0);
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
                <feGaussianBlur in="magnified_source" stdDeviation="0" result="blurred_source"></feGaussianBlur>
                <feImage href="${maps.displacement}" x="0" y="0" width="${shape.width}" height="${shape.height}" preserveAspectRatio="none" result="displacement_map" data-optical-map="displacement"></feImage>
                <feDisplacementMap in="blurred_source" in2="displacement_map" scale="${maps.maximumDisplacement * REFRACTION_LEVEL}" xChannelSelector="R" yChannelSelector="G" result="displaced"></feDisplacementMap>
                <feColorMatrix in="displaced" type="saturate" values="9" result="displaced_saturated"></feColorMatrix>
                <feImage href="${maps.specular}" x="0" y="0" width="${shape.width}" height="${shape.height}" preserveAspectRatio="none" result="specular_layer" data-optical-map="specular"></feImage>
                <feComposite in="displaced_saturated" in2="specular_layer" operator="in" result="specular_saturated"></feComposite>
                <feComponentTransfer in="specular_layer" result="specular_faded"><feFuncA type="linear" slope="0.5"></feFuncA></feComponentTransfer>
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
          this.activeControl = null;
          this.controlTrackUntil = 0;
          cancelAnimationFrame(this.controlFrame);
          this.controlFrame = 0;
          cancelAnimationFrame(this.pointerFrame);
          this.pointerFrame = 0;
          this.pendingPointer = null;
          this.lens.classList.remove("is-visible", "is-bridging", "is-pressed");
          delete this.hdrGlass.canvas.dataset.hdrTarget;
          this.hdrGlass.hide();
          delete this.lens.dataset.liquidProgress;
          delete this.lens.dataset.liquidTarget;
        }
      };
    }
  });

  // src/components/liquid-controls.ts
  var nextControlFilterId, controlMapCache, LiquidControlElement, LiquidRange, LiquidToggle;
  var init_liquid_controls = __esm({
    "src/components/liquid-controls.ts"() {
      "use strict";
      init_liquid_optics();
      nextControlFilterId = 0;
      controlMapCache = /* @__PURE__ */ new Map();
      LiquidControlElement = class extends HTMLElement {
        input = null;
        filterDefs = null;
        displacement = null;
        tuning = null;
        disconnectedCallback() {
          this.input?.removeEventListener("input", this.onValueChange);
          this.input?.removeEventListener("change", this.onValueChange);
          this.input?.removeEventListener("focus", this.onFocus);
          this.input?.removeEventListener("blur", this.onBlur);
          this.input?.removeEventListener("pointerdown", this.onPointerDown);
          window.removeEventListener("pointerup", this.onPointerUp);
          window.removeEventListener("pointercancel", this.onPointerUp);
        }
        connectInput(selector) {
          this.input = this.querySelector(selector);
          this.input?.addEventListener("input", this.onValueChange);
          this.input?.addEventListener("change", this.onValueChange);
          this.input?.addEventListener("focus", this.onFocus);
          this.input?.addEventListener("blur", this.onBlur);
          this.input?.addEventListener("pointerdown", this.onPointerDown);
          this.update();
        }
        installFilter(target, shape, tuning) {
          this.filterDefs?.remove();
          const cacheKey = `${tuning.profile}:${opticalShapeKey(shape)}`;
          const maps = controlMapCache.get(cacheKey) ?? createOpticalMaps(shape, tuning.profile);
          controlMapCache.set(cacheKey, maps);
          const id = `infinity-liquid-control-${++nextControlFilterId}`;
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.classList.add("liquid-control-defs");
          svg.setAttribute("aria-hidden", "true");
          svg.innerHTML = `
            <defs>
                <filter id="${id}" color-interpolation-filters="sRGB">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="${tuning.blur}" result="blurred_source"></feGaussianBlur>
                    <feImage href="${maps.displacement}" x="0" y="0" width="${shape.width}" height="${shape.height}" preserveAspectRatio="none" result="displacement_map"></feImage>
                    <feDisplacementMap in="blurred_source" in2="displacement_map" scale="${tuning.maximumDisplacement * tuning.restingRefraction}" xChannelSelector="R" yChannelSelector="G" result="displaced"></feDisplacementMap>
                    <feColorMatrix in="displaced" type="saturate" values="${tuning.saturation}" result="displaced_saturated"></feColorMatrix>
                    <feImage href="${maps.specular}" x="0" y="0" width="${shape.width}" height="${shape.height}" preserveAspectRatio="none" result="specular_layer"></feImage>
                    <feComposite in="displaced_saturated" in2="specular_layer" operator="in" result="specular_saturated"></feComposite>
                    <feComponentTransfer in="specular_layer" result="specular_faded"><feFuncA type="linear" slope="${tuning.specularOpacity}"></feFuncA></feComponentTransfer>
                    <feBlend in="specular_saturated" in2="displaced" mode="normal" result="with_saturation"></feBlend>
                    <feBlend in="specular_faded" in2="with_saturation" mode="normal"></feBlend>
                </filter>
            </defs>`;
          this.prepend(svg);
          this.filterDefs = svg;
          this.displacement = svg.querySelector("feDisplacementMap");
          this.tuning = tuning;
          target.style.setProperty("--liquid-control-filter", `url("#${id}")`);
          target.dataset.liquidProfile = tuning.profile;
        }
        onValueChange = () => this.update();
        onFocus = () => this.classList.add("is-focused");
        onBlur = () => {
          this.classList.remove("is-focused");
          this.setActive(false);
        };
        onPointerDown = () => {
          this.setActive(true);
          window.addEventListener("pointerup", this.onPointerUp, { once: true });
          window.addEventListener("pointercancel", this.onPointerUp, { once: true });
        };
        onPointerUp = () => this.setActive(false);
        setActive(active) {
          this.classList.toggle("is-active", active);
          if (!this.displacement || !this.tuning) return;
          const ratio = active ? this.tuning.activeRefraction : this.tuning.restingRefraction;
          this.displacement.setAttribute("scale", String(this.tuning.maximumDisplacement * ratio));
        }
      };
      LiquidRange = class extends LiquidControlElement {
        connectedCallback() {
          this.connectInput('input[type="range"]');
          const thumb = this.querySelector(".liquid-range-thumb");
          if (thumb) this.installFilter(thumb, { width: 90, height: 60, radius: 30 }, {
            profile: "convex",
            blur: 0,
            maximumDisplacement: 83.88118841653394,
            restingRefraction: 0.4,
            activeRefraction: 0.9,
            saturation: 7,
            specularOpacity: 0.4
          });
        }
        update() {
          if (!this.input) return;
          const minimum = Number(this.input.min) || 0;
          const maximum = Number(this.input.max) || 100;
          const progress = maximum === minimum ? 0 : (Number(this.input.value) - minimum) / (maximum - minimum);
          const clamped = Math.max(0, Math.min(1, progress));
          this.style.setProperty("--liquid-progress", `${clamped * 100}%`);
          this.style.setProperty("--liquid-thumb-left", `calc(${clamped * 100}% - ${clamped * 54}px - 18px)`);
        }
      };
      LiquidToggle = class extends LiquidControlElement {
        connectedCallback() {
          this.connectInput('input[type="checkbox"]');
          const thumb = this.querySelector(".liquid-toggle-thumb");
          if (thumb) this.installFilter(thumb, { width: 146, height: 92, radius: 46 }, {
            profile: "lip",
            blur: 0.2,
            maximumDisplacement: 55.65161904498752,
            restingRefraction: 0.4,
            activeRefraction: 0.9,
            saturation: 6,
            specularOpacity: 0.5
          });
        }
        update() {
          this.classList.toggle("is-checked", Boolean(this.input?.checked));
        }
      };
    }
  });

  // src/components/spotlight-search.ts
  function siteRow(site) {
    return { kind: "site", title: site.title, subtitle: `${site.host} \xB7 \u8FD1 30 \u5929 ${site.count} \u6B21`, url: site.url, site };
  }
  function rowIcon(row) {
    if (row.kind === "web") return `<span class="row-icon row-icon-plain">${ICONS.search}</span>`;
    if (row.kind === "recent") return `<span class="row-icon row-icon-plain">${ICONS.clock}</span>`;
    if (row.kind === "url") return `<span class="row-icon row-icon-plain">${ICONS.open}</span>`;
    if (row.kind === "bookmark") return siteIcon({ url: row.url, name: row.title, bookmark: row.bookmark }, "row-icon");
    return siteIcon({ url: row.url, name: row.title }, "row-icon");
  }
  function matchScore(query, name, url) {
    const host = hostOf(url).toLowerCase();
    const title = name.toLowerCase();
    if (host.startsWith(query) || title.startsWith(query)) return 3;
    if (host.includes(query) || title.includes(query)) return 2;
    return url.toLowerCase().includes(query) ? 1 : 0;
  }
  function looksLikeUrl(value) {
    if (/\s/.test(value)) return false;
    return /^[a-z][a-z\d+.-]*:\/\//i.test(value) || /^localhost(:\d+)?(\/|$)/i.test(value) || /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(value);
  }
  var ENGINES, SHORTCUT_LABEL, ENGINE_ORDER, GROUP_TITLES, SpotlightSearch;
  var init_spotlight_search = __esm({
    "src/components/spotlight-search.ts"() {
      "use strict";
      init_history();
      init_store();
      init_utils();
      init_bookmark_actions();
      init_icons();
      init_site_icon();
      init_ui_layer();
      ENGINES = {
        google: { label: "Google", url: "https://www.google.com/search?q=" },
        bing: { label: "Bing", url: "https://www.bing.com/search?q=" },
        baidu: { label: "\u767E\u5EA6", url: "https://www.baidu.com/s?wd=" },
        duckduckgo: { label: "DuckDuckGo", url: "https://duckduckgo.com/?q=" }
      };
      SHORTCUT_LABEL = /Mac|iPhone|iPad/.test(navigator.platform) ? "\u2318K" : "Ctrl K";
      ENGINE_ORDER = Object.keys(ENGINES);
      GROUP_TITLES = { url: "\u7F51\u5740", bookmark: "\u4E66\u7B7E", site: "\u5E38\u8BBF\u95EE", web: "\u641C\u7D22\u7F51\u7EDC", recent: "\u6700\u8FD1\u641C\u7D22" };
      SpotlightSearch = class extends HTMLElement {
        engine = "google";
        rows = [];
        selected = 0;
        sites = [];
        releaseLayer = null;
        connectedCallback() {
          this.hidden = true;
          this.innerHTML = `
            <div class="spotlight-backdrop" aria-hidden="true"></div>
            <section class="glass glass-thick spotlight" role="dialog" aria-modal="true" aria-label="\u641C\u7D22">
                <div class="spotlight-field">
                    ${ICONS.search}
                    <div class="spotlight-input">
                        <span class="spotlight-ghost" aria-hidden="true"><span class="ghost-typed"></span><span class="ghost-rest"></span></span>
                        <input type="text" autocomplete="off" spellcheck="false" placeholder="\u641C\u7D22\u6216\u8F93\u5165\u7F51\u5740" aria-label="\u641C\u7D22\u6216\u8F93\u5165\u7F51\u5740"
                            role="combobox" aria-expanded="true" aria-controls="spotlight-results" aria-autocomplete="list">
                    </div>
                    <span class="spotlight-scope"></span>
                </div>
                <div class="spotlight-results" id="spotlight-results" role="listbox" aria-label="\u641C\u7D22\u7ED3\u679C"></div>
                <footer class="spotlight-footer">
                    <div class="segmented spotlight-engines" role="radiogroup" aria-label="\u641C\u7D22\u5F15\u64CE">
                        ${ENGINE_ORDER.map((key) => `<button type="button" role="radio" data-engine="${key}" data-liquid-item>${ENGINES[key].label}</button>`).join("")}
                    </div>
                    <div class="spotlight-hints" aria-hidden="true">
                        <span><kbd>\u2191</kbd><kbd>\u2193</kbd> \u9009\u62E9</span>
                        <span><kbd>\u21E5</kbd> \u5207\u6362\u5F15\u64CE</span>
                        <span><kbd>esc</kbd> \u5173\u95ED</span>
                    </div>
                </footer>
            </section>`;
          const input = this.input;
          input.addEventListener("input", () => {
            this.selected = 0;
            this.renderResults();
          });
          input.addEventListener("keydown", this.onKeyDown);
          this.querySelector(".spotlight-backdrop")?.addEventListener("pointerdown", () => this.close());
          const results = this.querySelector(".spotlight-results");
          results.addEventListener("pointerdown", (event) => event.preventDefault());
          results.addEventListener("click", (event) => {
            const target = event.target;
            const row = target.closest("[data-index]");
            if (!row) return;
            const item = this.rows[Number(row.dataset.index)];
            if (target.closest(".row-remove") && item?.kind === "recent") {
              void appStore.removeRecentSearch(item.query).then(() => this.renderResults());
              return;
            }
            this.activate(Number(row.dataset.index), event.metaKey || event.ctrlKey);
          });
          results.addEventListener("pointermove", (event) => {
            const row = event.target.closest("[data-index]");
            const index = row ? Number(row.dataset.index) : -1;
            if (index >= 0 && index !== this.selected) this.select(index);
          });
          const engines = this.querySelector(".spotlight-engines");
          engines.addEventListener("pointerdown", (event) => event.preventDefault());
          engines.addEventListener("click", (event) => {
            const button = event.target.closest("[data-engine]");
            if (button) this.setEngine(button.dataset.engine);
          });
          engines.addEventListener("keydown", (event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            this.cycleEngine(event.key === "ArrowRight" ? 1 : -1);
            this.querySelector(`[data-engine="${this.engine}"]`)?.focus();
          });
        }
        disconnectedCallback() {
          this.close();
        }
        get isOpen() {
          return !this.hidden;
        }
        open() {
          if (this.isOpen) return;
          this.engine = appStore.state.settings.layout.searchEngine;
          this.input.value = "";
          this.selected = 0;
          this.hidden = false;
          document.body.classList.add("spotlight-open");
          this.releaseLayer = pushLayer(this.querySelector(".spotlight"), () => this.close());
          this.syncEngines();
          this.renderResults();
          requestAnimationFrame(() => this.input.focus());
          void loadRecentSites().then((sites) => {
            this.sites = sites;
            if (this.isOpen) this.renderResults();
          }).catch(() => void 0);
        }
        close() {
          if (!this.isOpen) return;
          this.hidden = true;
          document.body.classList.remove("spotlight-open");
          const release = this.releaseLayer;
          this.releaseLayer = null;
          release?.();
        }
        get input() {
          return this.querySelector(".spotlight-field input");
        }
        onKeyDown = (event) => {
          if (event.isComposing) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (this.rows.length) this.select((this.selected + (event.key === "ArrowDown" ? 1 : -1) + this.rows.length) % this.rows.length);
          } else if (event.key === "Enter") {
            event.preventDefault();
            this.activate(this.selected, event.metaKey || event.ctrlKey);
          } else if (event.key === "Tab" && !event.shiftKey) {
            event.preventDefault();
            this.cycleEngine(1);
          } else if (event.key === "ArrowRight" && this.ghostRest() && this.input.selectionStart === this.input.value.length) {
            event.preventDefault();
            this.input.value += this.ghostRest();
            this.selected = 0;
            this.renderResults();
          }
        };
        buildRows() {
          const raw = this.input.value.trim();
          const query = raw.toLowerCase();
          const rows = [];
          const engine = ENGINES[this.engine].label;
          if (!query) {
            this.sites.slice(0, 4).forEach((site) => rows.push(siteRow(site)));
            appStore.state.recentSearches.slice(0, 5).forEach((item) => rows.push({ kind: "recent", title: item, subtitle: "", query: item }));
            return rows;
          }
          if (looksLikeUrl(raw)) {
            const url = normalizeUrl(raw);
            if (url) rows.push({ kind: "url", title: hostOf(url) || url, subtitle: url, url });
          }
          const bookmarks = appStore.state.bookmarks.map((bookmark) => ({ bookmark, score: matchScore(query, bookmarkName(bookmark), bookmark.url) })).filter((item) => item.score > 0).sort((left, right) => right.score - left.score).slice(0, 5);
          bookmarks.forEach(({ bookmark }) => rows.push({
            kind: "bookmark",
            title: bookmarkName(bookmark),
            subtitle: `${hostOf(bookmark.url)}${bookmark.folder !== "\u5168\u90E8" ? ` \xB7 ${bookmark.folder} \u6587\u4EF6\u5939` : ""}`,
            url: bookmark.url,
            bookmark
          }));
          const bookmarkedHosts = new Set(bookmarks.map(({ bookmark }) => hostOf(bookmark.url)));
          this.sites.filter((site) => !bookmarkedHosts.has(site.host) && matchScore(query, site.title, site.url) > 0).slice(0, 3).forEach((site) => rows.push(siteRow(site)));
          rows.push({ kind: "web", title: raw, subtitle: `\u5728 ${engine} \u4E2D\u641C\u7D22`, query: raw });
          appStore.state.recentSearches.filter((item) => item.toLowerCase().includes(query) && item.toLowerCase() !== query).slice(0, 4).forEach((item) => rows.push({ kind: "recent", title: item, subtitle: "", query: item }));
          return rows;
        }
        renderResults() {
          this.rows = this.buildRows();
          this.selected = Math.min(this.selected, Math.max(0, this.rows.length - 1));
          const results = this.querySelector(".spotlight-results");
          let previous = "";
          results.innerHTML = this.rows.map((row, index) => {
            const heading = row.kind !== previous ? `<h3 class="spotlight-heading" role="presentation">${GROUP_TITLES[row.kind]}</h3>` : "";
            previous = row.kind;
            return `${heading}
                <div class="spotlight-row" role="option" id="spotlight-option-${index}" data-index="${index}" aria-selected="false">
                    ${rowIcon(row)}
                    <span class="row-text"><strong>${escapeHtml(row.title)}</strong>${row.subtitle ? `<small>${escapeHtml(row.subtitle)}</small>` : ""}</span>
                    <span class="row-hint">${row.kind === "web" || row.kind === "recent" ? "\u641C\u7D22" : "\u6253\u5F00"} <kbd>\u21B5</kbd></span>
                    ${row.kind === "recent" ? '<button class="row-remove" type="button" tabindex="-1" aria-label="\u5220\u9664\u8FD9\u6761\u8BB0\u5F55">\u5220\u9664</button>' : ""}
                </div>`;
          }).join("") || '<p class="spotlight-empty">\u8F93\u5165\u5173\u952E\u8BCD\u641C\u7D22\u4E66\u7B7E\u4E0E\u7F51\u9875</p>';
          results.hidden = false;
          bindSiteIcons(results);
          this.select(this.selected);
        }
        select(index) {
          this.selected = index;
          this.querySelectorAll(".spotlight-row").forEach((row2) => {
            const active = Number(row2.dataset.index) === index;
            row2.classList.toggle("is-selected", active);
            row2.setAttribute("aria-selected", String(active));
            if (active) row2.scrollIntoView({ block: "nearest" });
          });
          const row = this.rows[index];
          if (row) this.input.setAttribute("aria-activedescendant", `spotlight-option-${index}`);
          else this.input.removeAttribute("aria-activedescendant");
          const scope = this.querySelector(".spotlight-scope");
          scope.textContent = row && this.input.value.trim() ? GROUP_TITLES[row.kind] : "";
          scope.hidden = !scope.textContent;
          const typed = this.input.value;
          const rest = this.ghostRest();
          this.querySelector(".ghost-typed").textContent = rest ? typed : "";
          this.querySelector(".ghost-rest").textContent = rest;
        }
        /** Inline completion of the top hit's host name, accepted with →. */
        ghostRest() {
          const typed = this.input.value;
          const row = this.rows[this.selected];
          if (this.selected !== 0 || !typed || /\s/.test(typed) || !row || row.kind !== "bookmark" && row.kind !== "site") return "";
          const host = hostOf(row.url);
          return host.toLowerCase().startsWith(typed.toLowerCase()) && host.length > typed.length ? host.slice(typed.length) : "";
        }
        activate(index, background) {
          const row = this.rows[index];
          if (!row) {
            const query = this.input.value.trim();
            if (query) this.search(query);
            return;
          }
          if (row.kind === "web" || row.kind === "recent") {
            this.search(row.query);
            return;
          }
          const { openInNewTab: newTab } = appStore.state.settings.layout;
          if (background || newTab || new URL(row.url).protocol === "chrome-extension:") {
            openInNewTab(row.url);
            this.close();
          } else {
            window.location.href = row.url;
          }
        }
        search(query) {
          const target = `${ENGINES[this.engine].url}${encodeURIComponent(query)}`;
          const save = appStore.state.settings.layout.saveSearches ? appStore.saveRecentSearch(query) : Promise.resolve();
          void save.finally(() => {
            window.location.href = target;
          });
        }
        setEngine(engine) {
          this.engine = engine;
          this.syncEngines();
          this.renderResults();
        }
        cycleEngine(step) {
          const index = ENGINE_ORDER.indexOf(this.engine);
          this.setEngine(ENGINE_ORDER[(index + step + ENGINE_ORDER.length) % ENGINE_ORDER.length]);
        }
        syncEngines() {
          this.querySelectorAll("[data-engine]").forEach((button) => {
            const checked = button.dataset.engine === this.engine;
            button.classList.toggle("is-active", checked);
            button.setAttribute("aria-checked", String(checked));
            button.tabIndex = checked ? 0 : -1;
          });
        }
      };
    }
  });

  // src/components/search-pill.ts
  var SearchPill;
  var init_search_pill = __esm({
    "src/components/search-pill.ts"() {
      "use strict";
      init_store();
      init_base();
      init_icons();
      init_spotlight_search();
      SearchPill = class extends StoreElement {
        observedChanges = ["settings.layout"];
        render() {
          const { showSearch, searchEngine } = appStore.state.settings.layout;
          this.hidden = !showSearch;
          this.innerHTML = `
            <button class="glass search-pill" type="button" data-liquid-item aria-label="\u641C\u7D22\u6216\u8F93\u5165\u7F51\u5740" aria-keyshortcuts="${SHORTCUT_LABEL === "\u2318K" ? "Meta+K" : "Control+K"} /">
                ${ICONS.search}
                <span class="search-pill-text">\u641C\u7D22\u6216\u8F93\u5165\u7F51\u5740</span>
                <span class="pill-chip">${ENGINES[searchEngine].label}</span>
                <span class="pill-chip">${SHORTCUT_LABEL}</span>
            </button>`;
          this.querySelector("button")?.addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("open-spotlight", { bubbles: true, composed: true }));
          });
        }
      };
    }
  });

  // src/components/settings-panel.ts
  function pane(name, title, body) {
    return `<section class="settings-pane" data-pane="${name}" aria-label="${title}" hidden><h2 class="settings-pane-title">${title}</h2>${body}</section>`;
  }
  function group(title, body) {
    return `${title ? `<h3 class="settings-heading">${title}</h3>` : ""}<div class="settings-group">${body}</div>`;
  }
  function rowLabel(label, sub) {
    return `<span class="row-label"><span class="row-title">${label}</span>${sub ? `<span class="row-sub">${sub}</span>` : ""}</span>`;
  }
  function depends(on) {
    return on ? `data-depends="${on}"` : "";
  }
  function infoRow(label, sub, control) {
    return `<div class="setting-row">${rowLabel(label, sub)}${control}</div>`;
  }
  function segmentRow(name, label, value, options, sub = "", dependsOn = "") {
    return `
        <div class="setting-row segment-row" ${depends(dependsOn)}>
            <span class="row-label"><span class="row-title" id="segment-${name}">${label}</span>${sub ? `<span class="row-sub">${sub}</span>` : ""}</span>
            <div class="segmented" role="radiogroup" aria-labelledby="segment-${name}" data-segment="${name}">
                ${options.map(([optionValue, optionLabel]) => {
      const checked = optionValue === value;
      return `<button type="button" role="radio" aria-checked="${checked}" tabindex="${checked ? 0 : -1}" class="${checked ? "is-active" : ""}" data-value="${optionValue}" data-liquid-item>${escapeHtml(optionLabel)}</button>`;
    }).join("")}
            </div>
        </div>`;
  }
  function toggleRow(name, label, sub = "", dependsOn = "") {
    return `<label class="setting-row toggle-row" ${depends(dependsOn)}>${rowLabel(label, sub)}<liquid-toggle><input type="checkbox" role="switch" data-toggle="${name}"><span class="liquid-toggle-track" aria-hidden="true"><span class="liquid-toggle-thumb"></span></span></liquid-toggle></label>`;
  }
  function rangeRow(name, label, value, min, max, unit, dependsOn = "", sub = "") {
    return `
        <div class="setting-row" ${depends(dependsOn)}>
            ${rowLabel(label, sub)}
            <span class="range-control">
                <span class="range-row"><liquid-range><span class="liquid-range-track" aria-hidden="true"><span class="liquid-range-fill"></span></span><span class="liquid-range-thumb" aria-hidden="true"></span><input type="range" name="${name}" min="${min}" max="${max}" value="${value}" data-unit="${unit}" aria-label="${label}"></liquid-range></span>
                <output>${value}${unit}</output>
            </span>
        </div>`;
  }
  function wallpaperKind({ type, value }) {
    if (type === "video") return "video";
    if (type === "preset" || type === "local" && value.startsWith("online")) return "online";
    return type === "local" ? "image" : "";
  }
  function hdrDescription() {
    const hdrDisplay = window.matchMedia("(dynamic-range: high)").matches && CSS.supports("dynamic-range-limit", "no-limit");
    if (!hdrDisplay) return "\u5F53\u524D\u4E3A SDR \u5C4F\u5E55\uFF0C\u8FDE\u63A5 HDR \u5C4F\u5E55\u540E\u81EA\u52A8\u751F\u6548";
    return "gpu" in navigator ? "\u5F53\u524D\u5C4F\u5E55\u652F\u6301 HDR \xB7 WebGPU \u5DF2\u542F\u7528" : "\u5F53\u524D\u5C4F\u5E55\u652F\u6301 HDR \xB7 \u6D4F\u89C8\u5668\u672A\u5F00\u653E WebGPU \u9AD8\u5149";
  }
  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  }
  function formatDuration(seconds) {
    const total = Math.round(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }
  var PANES, SettingsPanel;
  var init_settings_panel = __esm({
    "src/components/settings-panel.ts"() {
      "use strict";
      init_backup_service();
      init_media_store();
      init_store();
      init_utils();
      init_wallpaper_service();
      init_base();
      init_dashboard_header();
      init_icons();
      init_spotlight_search();
      init_ui_layer();
      PANES = [
        ["appearance", "\u5916\u89C2", ICONS.look, "#0a84ff"],
        ["widgets", "\u7EC4\u4EF6", ICONS.widgets, "#ff9f0a"],
        ["wallpaper", "\u58C1\u7EB8", ICONS.wallpaper, "#30b0c7"],
        ["data", "\u6570\u636E", ICONS.database, "#8e8e93"]
      ];
      SettingsPanel = class extends StoreElement {
        observedChanges = ["settings.appearance", "settings.wallpaper", "settings.layout", "bookmarks", "folders"];
        openState = false;
        activePane = "appearance";
        releaseLayer = null;
        previewUrl = "";
        previewToken = 0;
        open(pane2) {
          if (pane2) this.selectPane(pane2);
          if (this.openState) return;
          this.openState = true;
          this.syncOpenState();
          this.releaseLayer = pushLayer(this.querySelector(".settings-window"), () => this.close());
          void this.refreshPreview();
          void this.refreshData();
          const windowElement = this.querySelector(".settings-window");
          afterMotion(windowElement, () => {
            if (this.openState && !windowElement.contains(document.activeElement)) this.querySelector(".settings-nav-item.is-active")?.focus();
          });
        }
        close() {
          if (!this.openState) return;
          this.openState = false;
          this.syncOpenState();
          const release = this.releaseLayer;
          this.releaseLayer = null;
          release?.();
        }
        disconnectedCallback() {
          super.disconnectedCallback();
          if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
        }
        handleStoreChange() {
          this.syncControls(appStore.state.settings);
          if (this.openState) void this.refreshData();
        }
        render() {
          const settings = appStore.state.settings;
          this.innerHTML = `
            <div class="settings-scrim" aria-hidden="true"></div>
            <section class="glass glass-window settings-window" role="dialog" aria-modal="true" aria-label="\u8BBE\u7F6E" aria-hidden="true" inert>
                <aside class="settings-sidebar">
                    <div class="settings-title">
                        <button class="settings-close" type="button" aria-label="\u5173\u95ED\u8BBE\u7F6E">${ICONS.close}</button>
                        <h2>\u8BBE\u7F6E</h2>
                    </div>
                    <label class="settings-search">
                        ${ICONS.search}
                        <input type="search" placeholder="\u641C\u7D22" aria-label="\u641C\u7D22\u8BBE\u7F6E" autocomplete="off">
                    </label>
                    <nav class="settings-nav" aria-label="\u8BBE\u7F6E\u5206\u7C7B">
                        ${PANES.map(([pane2, label, icon2, color]) => `
                            <button class="settings-nav-item" type="button" data-pane="${pane2}" data-liquid-item>
                                <span class="nav-glyph" style="background:${color}">${icon2}</span><span>${label}</span>
                            </button>`).join("")}
                    </nav>
                    <span class="settings-version">Infinity New Tab ${escapeHtml(chrome.runtime?.getManifest?.().version ?? "")}</span>
                </aside>
                <div class="settings-content">
                    ${this.appearancePane(settings)}
                    ${this.widgetsPane(settings)}
                    ${this.wallpaperPane(settings)}
                    ${this.dataPane(settings)}
                    <p class="settings-empty" hidden></p>
                </div>
            </section>`;
          this.bindChrome();
          this.bindControls();
          this.syncControls(settings);
          this.selectPane(this.activePane);
          this.syncOpenState();
        }
        appearancePane({ appearance }) {
          const now = /* @__PURE__ */ new Date();
          return pane("appearance", "\u5916\u89C2", `
            ${group("", `
                ${segmentRow("theme", "\u6587\u5B57\u989C\u8272", appearance.theme, [["auto", "\u81EA\u52A8"], ["dark", "\u6D45\u8272"], ["light", "\u6DF1\u8272"]], "\u81EA\u52A8\uFF1A\u6839\u636E\u58C1\u7EB8\u660E\u6697\u9009\u62E9")}
                ${segmentRow("glass", "\u73BB\u7483\u6750\u8D28", appearance.glass, [["clear", "\u6E05\u900F"], ["tinted", "\u7740\u8272"]])}
                ${toggleRow("hdrHighlights", "HDR \u9AD8\u5149", hdrDescription())}
                ${toggleRow("reduceTransparency", "\u964D\u4F4E\u900F\u660E\u5EA6", "\u73BB\u7483\u6539\u4E3A\u4E0D\u900F\u660E\u5E95\u8272\uFF0C\u6587\u5B57\u66F4\u6613\u8BFB")}
            `)}
            ${group("\u65F6\u95F4", `
                ${segmentRow("clockFormat", "\u65F6\u949F", appearance.clockFormat, [["24h", "24 \u5C0F\u65F6"], ["12h", "12 \u5C0F\u65F6"]])}
                ${segmentRow("dateFormat", "\u65E5\u671F", appearance.dateFormat, [["long", formatDate(now, "long")], ["short", formatDate(now, "short")]])}
            `)}
        `);
        }
        widgetsPane({ layout }) {
          return pane("widgets", "\u7EC4\u4EF6", `
            ${group("", `
                ${toggleRow("showClock", "\u65F6\u95F4\u4E0E\u65E5\u671F")}
                ${toggleRow("showSearch", "\u641C\u7D22\u680F", `\u5173\u95ED\u540E\u4ECD\u53EF\u7528 ${SHORTCUT_LABEL} \u547C\u51FA`)}
                ${toggleRow("showBookmarks", "Dock")}
                ${toggleRow("showStatus", "\u72B6\u6001\u80F6\u56CA", "\u53EA\u5728\u64AD\u653E\u5A92\u4F53\u3001\u4E0B\u8F7D\u6216\u4F7F\u7528\u7535\u6C60\u65F6\u51FA\u73B0")}
            `)}
            ${group("Dock", `
                ${segmentRow("dockSource", "\u663E\u793A\u7684\u4E66\u7B7E", layout.dockSource, [["bookmarks", "\u56FA\u5B9A\u7684\u4E66\u7B7E"], ["recent", "\u5E38\u8BBF\u95EE"]], "\u56FA\u5B9A\u7684\u4E66\u7B7E\u5C31\u662F\u201C\u5168\u90E8\u201D\u91CC\u7684\u4E66\u7B7E\uFF0C\u53EF\u5728\u542F\u52A8\u53F0\u4E2D\u62D6\u52A8\u6392\u5E8F", "showBookmarks")}
                ${rangeRow("dockSize", "\u56FE\u6807\u5927\u5C0F", layout.dockSize, 40, 72, "", "showBookmarks")}
                ${toggleRow("dockMagnify", "\u60AC\u505C\u653E\u5927", "", "showBookmarks")}
                ${toggleRow("openInNewTab", "\u5728\u65B0\u6807\u7B7E\u9875\u6253\u5F00\u4E66\u7B7E")}
            `)}
            ${group("\u641C\u7D22", `
                ${segmentRow("searchEngine", "\u9ED8\u8BA4\u641C\u7D22\u5F15\u64CE", layout.searchEngine, Object.entries(ENGINES).map(([key, engine]) => [key, engine.label]))}
                ${toggleRow("saveSearches", "\u4FDD\u5B58\u6700\u8FD1\u641C\u7D22")}
            `)}
        `);
        }
        wallpaperPane({ wallpaper }) {
          return pane("wallpaper", "\u58C1\u7EB8", `
            <div class="settings-group wallpaper-card setting-row" data-search="\u58C1\u7EB8 \u89C6\u9891 \u56FE\u7247 \u5728\u7EBF \u9009\u62E9 \u6062\u590D\u9ED8\u8BA4">
                <div class="wallpaper-preview" aria-hidden="true"><div class="wallpaper-preview-media"></div><span class="wallpaper-duration" hidden></span></div>
                <div class="wallpaper-info">
                    <strong class="wallpaper-name"></strong>
                    <span class="row-sub wallpaper-meta"></span>
                    <div class="wallpaper-actions">
                        <label class="pill-button primary upload-wallpaper" data-liquid-item>\u9009\u62E9\u89C6\u9891\u6216\u56FE\u7247\u2026<input type="file" accept="image/*,video/*" hidden></label>
                        <button class="pill-button random-wallpaper" type="button" data-liquid-item>\u6362\u4E00\u4E2A\u5728\u7EBF\u58C1\u7EB8</button>
                        <button class="pill-button reset-wallpaper" type="button" data-liquid-item>\u6062\u590D\u9ED8\u8BA4</button>
                    </div>
                </div>
            </div>
            ${group("\u663E\u793A", `
                ${segmentRow("wallpaperKind", "\u7C7B\u578B", wallpaperKind(wallpaper), [["video", "\u89C6\u9891"], ["image", "\u56FE\u7247"], ["online", "\u5728\u7EBF"]], "\u9ED8\u8BA4\u662F\u5185\u7F6E\u7684\u52A8\u6001\u573A\u666F Twilight Bay")}
                ${rangeRow("blur", "\u6A21\u7CCA", wallpaper.blur, 0, 40, "px")}
                ${rangeRow("overlay", "\u6697\u5316", wallpaper.overlay, 0, 60, "%", "", "\u8BA9\u767D\u8272\u6587\u5B57\u5728\u4EAE\u58C1\u7EB8\u4E0A\u4E5F\u6E05\u695A")}
            `)}
            ${group("\u64AD\u653E", `
                ${toggleRow("idleHide", "\u9759\u6B62\u65F6\u9690\u85CF\u754C\u9762", "8 \u79D2\u65E0\u64CD\u4F5C\u540E\u53EA\u4FDD\u7559\u65F6\u95F4\uFF0C\u79FB\u52A8\u9F20\u6807\u5373\u6062\u590D")}
                ${toggleRow("pauseOnBattery", "\u4F7F\u7528\u7535\u6C60\u65F6\u6682\u505C\u52A8\u6001\u58C1\u7EB8")}
                ${toggleRow("pauseWhenHidden", "\u6807\u7B7E\u9875\u4E0D\u53EF\u89C1\u65F6\u6682\u505C")}
                ${toggleRow("sound", "\u64AD\u653E\u89C6\u9891\u58F0\u97F3")}
            `)}
        `);
        }
        dataPane(_settings) {
          return pane("data", "\u6570\u636E", `
            ${group("", `
                ${infoRow("Chrome \u540C\u6B65", '<span class="sync-summary"></span>', '<span class="row-value sync-usage"></span>')}
                ${infoRow("\u672C\u5730\u5A92\u4F53", "\u89C6\u9891\u4E0E\u56FE\u7247\u58C1\u7EB8\u4FDD\u5B58\u5728\u672C\u673A\uFF0C\u4E0D\u5360\u7528\u540C\u6B65\u7A7A\u95F4", '<span class="row-value media-usage"></span>')}
            `)}
            ${group("\u5907\u4EFD", `
                ${infoRow("\u5BFC\u51FA\u5907\u4EFD", "\u4E66\u7B7E\u3001\u8BBE\u7F6E\u548C\u672C\u5730\u58C1\u7EB8\uFF0C\u4E00\u4E2A JSON \u6587\u4EF6", '<button class="pill-button export-data" type="button" data-liquid-item>\u5BFC\u51FA\u2026</button>')}
                ${infoRow("\u4ECE\u5907\u4EFD\u6062\u590D", "\u652F\u6301 1.0 / 2.0 \u5907\u4EFD\uFF0C\u4F1A\u8986\u76D6\u5F53\u524D\u6570\u636E", '<label class="pill-button import-data" data-liquid-item>\u5BFC\u5165\u2026<input type="file" accept="application/json,.json" hidden></label>')}
                ${toggleRow("backupReminder", "\u6BCF\u6708\u63D0\u9192\u6211\u5907\u4EFD")}
            `)}
            ${group("", `
                ${infoRow("\u6E05\u7A7A\u6240\u6709\u6570\u636E", "\u5220\u9664\u4E66\u7B7E\u3001\u8BBE\u7F6E\u4E0E\u672C\u5730\u58C1\u7EB8\uFF0C\u65E0\u6CD5\u64A4\u9500", '<button class="pill-button danger reset-data" type="button" data-liquid-item>\u6E05\u7A7A\u2026</button>')}
            `)}
        `);
        }
        bindChrome() {
          this.querySelector(".settings-close")?.addEventListener("click", () => this.close());
          this.querySelector(".settings-scrim")?.addEventListener("click", () => this.close());
          const nav = this.querySelector(".settings-nav");
          nav.addEventListener("click", (event) => {
            const button = event.target.closest("[data-pane]");
            if (!button) return;
            this.clearSearch();
            this.selectPane(button.dataset.pane);
          });
          nav.addEventListener("keydown", (event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            const index = PANES.findIndex(([pane2]) => pane2 === this.activePane);
            const next = PANES[(index + (event.key === "ArrowDown" ? 1 : -1) + PANES.length) % PANES.length][0];
            this.clearSearch();
            this.selectPane(next);
            this.querySelector(`[data-pane="${next}"]`)?.focus();
          });
          this.querySelector(".settings-search input")?.addEventListener("input", (event) => {
            this.filter(event.target.value);
          });
        }
        bindControls() {
          this.querySelectorAll("[data-segment]").forEach((groupElement) => {
            const buttons = [...groupElement.querySelectorAll("[data-value]")];
            buttons.forEach((button) => button.addEventListener("click", () => {
              void this.applySegment(groupElement.dataset.segment ?? "", button.dataset.value ?? "");
            }));
            groupElement.addEventListener("keydown", (event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              const index = buttons.findIndex((button) => button.classList.contains("is-active"));
              const next = buttons[(index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length];
              next.focus();
              next.click();
            });
          });
          this.querySelectorAll("input[data-toggle]").forEach((input) => {
            input.addEventListener("change", () => void this.applyToggle(input.dataset.toggle ?? "", input.checked));
          });
          this.querySelectorAll('input[type="range"]').forEach((input) => {
            input.addEventListener("input", () => {
              const output = input.closest(".setting-row")?.querySelector("output");
              if (output) output.textContent = `${input.value}${input.dataset.unit ?? ""}`;
              const [selector, property, value] = input.name === "dockSize" ? ["home-dock", "--dock-size", `${input.value}px`] : input.name === "blur" ? ["wallpaper-surface", "--wallpaper-blur", `${input.value}px`] : ["wallpaper-surface", "--wallpaper-overlay", String(Number(input.value) / 100)];
              document.querySelector(selector)?.style.setProperty(property, value);
            });
            input.addEventListener("change", () => {
              const section = input.name === "dockSize" ? "layout" : "wallpaper";
              void appStore.updateSettings(section, { [input.name]: Number(input.value) }).catch(notifyError);
            });
          });
          const upload = this.querySelector(".upload-wallpaper input");
          upload.addEventListener("change", () => {
            const file = upload.files?.[0];
            upload.value = "";
            if (file) void this.withBusy(upload.closest("label"), () => useLocalWallpaper(file));
          });
          this.querySelector(".random-wallpaper")?.addEventListener("click", (event) => void this.withBusy(event.currentTarget, useOnlineWallpaper));
          this.querySelector(".reset-wallpaper")?.addEventListener("click", () => void resetWallpaper().catch(notifyError));
          this.querySelector(".export-data")?.addEventListener("click", () => void backupService.createBackup().catch(notifyError));
          this.querySelector(".import-data input")?.addEventListener("change", (event) => {
            const input = event.target;
            const file = input.files?.[0];
            input.value = "";
            if (file) void this.importData(file);
          });
          this.querySelector(".reset-data")?.addEventListener("click", () => void this.resetData());
        }
        selectPane(target) {
          this.activePane = target;
          this.querySelectorAll(".settings-nav-item").forEach((button) => {
            const active = button.dataset.pane === target;
            button.classList.toggle("is-active", active);
            if (active) button.setAttribute("aria-current", "page");
            else button.removeAttribute("aria-current");
          });
          this.querySelectorAll(".settings-pane").forEach((element) => {
            element.hidden = element.dataset.pane !== target;
          });
          const content = this.querySelector(".settings-content");
          if (content) content.scrollTop = 0;
          if (target === "wallpaper") void this.refreshPreview();
        }
        /** Searching shows matching rows from every pane at once. */
        filter(value) {
          const query = value.trim().toLowerCase();
          if (!query) {
            this.querySelectorAll(".setting-row, .settings-group, .settings-heading").forEach((element) => {
              element.hidden = false;
            });
            this.querySelector(".settings-empty").hidden = true;
            this.selectPane(this.activePane);
            return;
          }
          this.querySelectorAll(".settings-nav-item").forEach((button) => {
            button.classList.remove("is-active");
            button.removeAttribute("aria-current");
          });
          let total = 0;
          this.querySelectorAll(".settings-pane").forEach((paneElement) => {
            let paneMatches = 0;
            paneElement.querySelectorAll(".setting-row").forEach((row) => {
              const match = (row.dataset.search ?? row.textContent ?? "").toLowerCase().includes(query);
              row.hidden = !match;
              if (match) paneMatches += 1;
            });
            paneElement.querySelectorAll(".settings-group").forEach((groupElement) => {
              const visible = groupElement.matches(".setting-row") ? !groupElement.hidden : Boolean(groupElement.querySelector(".setting-row:not([hidden])"));
              groupElement.hidden = !visible;
              const heading = groupElement.previousElementSibling;
              if (heading instanceof HTMLElement && heading.matches(".settings-heading")) heading.hidden = !visible;
            });
            paneElement.hidden = !paneMatches;
            total += paneMatches;
          });
          const empty = this.querySelector(".settings-empty");
          empty.hidden = total > 0;
          empty.textContent = `\u6CA1\u6709\u627E\u5230\u201C${value.trim()}\u201D`;
        }
        clearSearch() {
          const input = this.querySelector(".settings-search input");
          if (!input?.value) return;
          input.value = "";
          this.filter("");
        }
        syncOpenState() {
          const windowElement = this.querySelector(".settings-window");
          windowElement?.classList.toggle("is-open", this.openState);
          windowElement?.setAttribute("aria-hidden", String(!this.openState));
          windowElement?.toggleAttribute("inert", !this.openState);
          this.querySelector(".settings-scrim")?.classList.toggle("is-open", this.openState);
          document.body.classList.toggle("settings-open", this.openState);
        }
        syncControls(settings) {
          const { appearance, layout, wallpaper } = settings;
          const segments = {
            theme: appearance.theme,
            glass: appearance.glass,
            clockFormat: appearance.clockFormat,
            dateFormat: appearance.dateFormat,
            dockSource: layout.dockSource,
            searchEngine: layout.searchEngine,
            wallpaperKind: wallpaperKind(wallpaper)
          };
          this.querySelectorAll("[data-segment]").forEach((groupElement) => {
            const value = segments[groupElement.dataset.segment ?? ""];
            const buttons = [...groupElement.querySelectorAll("[data-value]")];
            const hasValue = buttons.some((button) => button.dataset.value === value);
            buttons.forEach((button, index) => {
              const checked = button.dataset.value === value;
              button.classList.toggle("is-active", checked);
              button.setAttribute("aria-checked", String(checked));
              button.tabIndex = checked || !hasValue && index === 0 ? 0 : -1;
            });
          });
          const toggles = {
            hdrHighlights: appearance.hdrHighlights,
            reduceTransparency: appearance.reduceTransparency,
            showClock: layout.showClock,
            showSearch: layout.showSearch,
            showBookmarks: layout.showBookmarks,
            showStatus: layout.showStatus,
            dockMagnify: layout.dockMagnify,
            openInNewTab: layout.openInNewTab,
            saveSearches: layout.saveSearches,
            backupReminder: layout.backupReminder,
            idleHide: wallpaper.idleHide,
            pauseOnBattery: wallpaper.pauseOnBattery,
            pauseWhenHidden: wallpaper.pauseWhenHidden,
            sound: wallpaper.sound
          };
          this.querySelectorAll("input[data-toggle]").forEach((input) => {
            input.checked = toggles[input.dataset.toggle ?? ""] ?? input.checked;
            input.closest("liquid-toggle")?.classList.toggle("is-checked", input.checked);
          });
          this.querySelectorAll("[data-depends]").forEach((row) => {
            row.classList.toggle("is-disabled", !toggles[row.dataset.depends ?? ""]);
          });
          const ranges = { blur: wallpaper.blur, overlay: wallpaper.overlay, dockSize: layout.dockSize };
          this.querySelectorAll('input[type="range"]').forEach((input) => {
            const value = ranges[input.name];
            if (!Number.isFinite(value) || Number(input.value) === value) return;
            input.value = String(value);
            input.dispatchEvent(new Event("input", { bubbles: false }));
          });
          const reset = this.querySelector(".reset-wallpaper");
          if (reset) reset.hidden = wallpaper.type === "gradient";
          if (this.openState) void this.refreshPreview();
        }
        async withBusy(control, task) {
          if (control.classList.contains("is-busy")) return;
          control.classList.add("is-busy");
          control.setAttribute("aria-busy", "true");
          try {
            await task();
          } catch (error) {
            notifyError(error);
          } finally {
            control.classList.remove("is-busy");
            control.removeAttribute("aria-busy");
          }
        }
        async applySegment(name, value) {
          try {
            if (name === "theme") await appStore.updateSettings("appearance", { theme: value });
            else if (name === "glass") await appStore.updateSettings("appearance", { glass: value });
            else if (name === "clockFormat") await appStore.updateSettings("appearance", { clockFormat: value });
            else if (name === "dateFormat") await appStore.updateSettings("appearance", { dateFormat: value });
            else if (name === "dockSource") await appStore.updateSettings("layout", { dockSource: value });
            else if (name === "searchEngine") await appStore.updateSettings("layout", { searchEngine: value });
            else if (name === "wallpaperKind") this.pickWallpaper(value);
          } catch (error) {
            notifyError(error);
          }
        }
        /** The type control is a shortcut: video and image open the file picker, online fetches a new picture. */
        pickWallpaper(kind) {
          if (kind === "online") {
            void this.withBusy(this.querySelector(".random-wallpaper"), useOnlineWallpaper);
            return;
          }
          const input = this.querySelector(".upload-wallpaper input");
          input.accept = kind === "video" ? "video/*" : "image/*";
          input.click();
          input.accept = "image/*,video/*";
        }
        async applyToggle(name, checked) {
          try {
            if (name === "hdrHighlights" || name === "reduceTransparency") await appStore.updateSettings("appearance", { [name]: checked });
            else if (["idleHide", "pauseOnBattery", "pauseWhenHidden", "sound"].includes(name)) await appStore.updateSettings("wallpaper", { [name]: checked });
            else await appStore.updateSettings("layout", { [name]: checked });
          } catch (error) {
            notifyError(error);
          }
        }
        /** Mirrors the live wallpaper into the preview card without re-downloading anything. */
        async refreshPreview() {
          const host = this.querySelector(".wallpaper-preview-media");
          if (!host || !this.openState) return;
          const wallpaper = appStore.state.settings.wallpaper;
          const { type, value } = wallpaper;
          const key = `${type}:${value}`;
          if (host.dataset.key === key) return;
          const token = ++this.previewToken;
          let blob = null;
          try {
            if (type === "local" || type === "video") blob = await mediaStore.get(type === "video" ? "video" : "image");
          } catch {
          }
          if (token !== this.previewToken) return;
          if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
          this.previewUrl = blob ? URL.createObjectURL(blob) : "";
          host.dataset.key = key;
          host.replaceChildren();
          host.style.backgroundImage = "";
          host.classList.toggle("is-scene", type === "gradient");
          const name = this.querySelector(".wallpaper-name");
          const meta = this.querySelector(".wallpaper-meta");
          const duration = this.querySelector(".wallpaper-duration");
          duration.hidden = true;
          name.textContent = type === "gradient" ? "Twilight Bay" : wallpaperLabel(wallpaper);
          const size = blob ? ` \xB7 ${formatBytes(blob.size)}` : "";
          meta.textContent = type === "gradient" ? "\u5185\u7F6E\u52A8\u6001\u573A\u666F \xB7 \u4E0D\u5360\u7528\u4EFB\u4F55\u5B58\u50A8" : type === "preset" ? "\u5728\u7EBF\u56FE\u7247 \xB7 \u6BCF\u6B21\u6253\u5F00\u65F6\u4ECE\u7F51\u7EDC\u52A0\u8F7D" : `${type === "video" ? "\u89C6\u9891" : "\u56FE\u7247"}${size} \xB7 \u5DF2\u4FDD\u5B58\u5230\u672C\u673A`;
          if (type === "video" && this.previewUrl) {
            const video = document.createElement("video");
            Object.assign(video, { src: this.previewUrl, muted: true, loop: true, autoplay: true, playsInline: true });
            video.addEventListener("loadedmetadata", () => {
              meta.textContent = `\u89C6\u9891 \xB7 ${video.videoWidth}\xD7${video.videoHeight}${size} \xB7 \u5DF2\u4FDD\u5B58\u5230\u672C\u673A`;
              duration.textContent = `${formatDuration(video.duration)} \u5FAA\u73AF`;
              duration.hidden = !Number.isFinite(video.duration);
            }, { once: true });
            host.append(video);
          } else if (type === "local" && this.previewUrl) {
            host.style.backgroundImage = `url("${this.previewUrl}")`;
            const image = new Image();
            image.onload = () => {
              meta.textContent = `${wallpaperLabel(wallpaper)} \xB7 ${image.naturalWidth}\xD7${image.naturalHeight}${size} \xB7 \u5DF2\u4FDD\u5B58\u5230\u672C\u673A`;
            };
            image.src = this.previewUrl;
          } else if (type === "preset" && value) {
            host.style.backgroundImage = `url("${value.replaceAll('"', "%22")}")`;
          }
        }
        async refreshData() {
          const { bookmarks, folders } = appStore.state;
          const summary = this.querySelector(".sync-summary");
          if (summary) summary.textContent = `${bookmarks.length} \u4E2A\u4E66\u7B7E \xB7 ${folders.length - 1} \u4E2A\u6587\u4EF6\u5939`;
          const [bytes, media] = await Promise.all([
            new Promise((resolve) => {
              try {
                if (!chrome.storage.sync.getBytesInUse) resolve(null);
                else chrome.storage.sync.getBytesInUse(null, (value) => resolve(chrome.runtime.lastError ? null : value));
              } catch {
                resolve(null);
              }
            }),
            Promise.all([mediaStore.get("image"), mediaStore.get("video")]).catch(() => [null, null])
          ]);
          const usage = this.querySelector(".sync-usage");
          if (usage) usage.textContent = bytes === null ? "" : `\u5DF2\u7528 ${formatBytes(bytes)} / 100 KB`;
          const mediaUsage = this.querySelector(".media-usage");
          if (mediaUsage) {
            const total = media.reduce((sum, blob) => sum + (blob?.size ?? 0), 0);
            mediaUsage.textContent = total ? formatBytes(total) : "\u65E0";
          }
        }
        async importData(file) {
          const confirmed = await confirmAction({
            title: "\u4ECE\u5907\u4EFD\u6062\u590D\uFF1F",
            body: "\u5F53\u524D\u7684\u4E66\u7B7E\u3001\u6587\u4EF6\u5939\u3001\u8BBE\u7F6E\u548C\u672C\u5730\u58C1\u7EB8\u4F1A\u88AB\u5907\u4EFD\u4E2D\u7684\u5185\u5BB9\u66FF\u6362\u3002\u5EFA\u8BAE\u5148\u5BFC\u51FA\u4E00\u4EFD\u5F53\u524D\u6570\u636E\u3002",
            confirmText: "\u6062\u590D"
          });
          if (!confirmed) return;
          try {
            await backupService.importData(await backupService.read(file));
            notify("\u5DF2\u4ECE\u5907\u4EFD\u6062\u590D", "success");
          } catch (error) {
            notifyError(error);
          }
        }
        async resetData() {
          const confirmed = await confirmAction({
            title: "\u6E05\u7A7A\u6240\u6709\u6570\u636E\uFF1F",
            body: `\u5C06\u5220\u9664 ${appStore.state.bookmarks.length} \u4E2A\u4E66\u7B7E\u3001\u5168\u90E8\u6587\u4EF6\u5939\u3001\u8BBE\u7F6E\u548C\u672C\u5730\u58C1\u7EB8\uFF0C\u4E14\u65E0\u6CD5\u64A4\u9500\u3002`,
            confirmText: "\u6E05\u7A7A",
            danger: true
          });
          if (!confirmed) return;
          try {
            await mediaStore.clearAll();
            await appStore.reset();
            notify("\u5DF2\u6E05\u7A7A\u6240\u6709\u6570\u636E", "success");
          } catch (error) {
            notifyError(error);
          }
        }
      };
    }
  });

  // src/components/status-strip.ts
  async function readBattery() {
    try {
      const battery = await navigator.getBattery?.();
      if (!battery || !Number.isFinite(battery.level)) return null;
      if (battery.charging && battery.level >= 1) return null;
      return { level: battery.level, charging: battery.charging };
    } catch {
      return null;
    }
  }
  function callbackResult(start, fallback) {
    return new Promise((resolve) => {
      try {
        start((result) => resolve(chrome.runtime.lastError ? fallback : result));
      } catch {
        resolve(fallback);
      }
    });
  }
  var StatusStrip;
  var init_status_strip = __esm({
    "src/components/status-strip.ts"() {
      "use strict";
      init_store();
      init_utils();
      init_base();
      init_icons();
      init_site_icon();
      StatusStrip = class extends StoreElement {
        observedChanges = ["settings.layout"];
        timer = 0;
        status = { media: null, downloads: [], battery: null };
        connectedCallback() {
          super.connectedCallback();
          void this.refresh();
          this.timer = window.setInterval(() => void this.refresh(), 5e3);
          document.addEventListener("visibilitychange", this.onVisibility);
        }
        disconnectedCallback() {
          super.disconnectedCallback();
          window.clearInterval(this.timer);
          document.removeEventListener("visibilitychange", this.onVisibility);
        }
        onVisibility = () => {
          if (document.visibilityState === "visible") void this.refresh();
        };
        handleStoreChange() {
          this.render();
          void this.refresh();
        }
        render() {
          this.hidden = !appStore.state.settings.layout.showStatus;
          const { media, downloads, battery } = this.status;
          const muteLabel = media?.muted ? "\u53D6\u6D88\u9759\u97F3" : "\u9759\u97F3";
          this.innerHTML = [
            media ? `
                <div class="glass glass-dark capsule media-capsule">
                    <button class="media-open" type="button" title="\u5207\u6362\u5230\u6B63\u5728\u64AD\u653E\u7684\u6807\u7B7E\u9875">
                        <img class="media-art" src="${escapeHtml(media.icon)}" alt="" draggable="false">
                        <span class="capsule-text">
                            <strong>${escapeHtml(truncate(media.title, 28))}</strong>
                            <small>${escapeHtml(media.host)} \u6807\u7B7E\u9875${media.muted ? "\u5DF2\u9759\u97F3" : "\u6B63\u5728\u64AD\u653E"}</small>
                        </span>
                        ${media.muted ? "" : '<span class="equalizer" aria-hidden="true"><span></span><span></span><span></span><span></span></span>'}
                    </button>
                    <button class="media-mute" type="button" data-liquid-item aria-label="${muteLabel}" title="${muteLabel}">${media.muted ? ICONS.muted : ICONS.speaker}</button>
                </div>` : "",
            downloads.length ? `<button class="glass glass-dark capsule download-capsule" type="button" data-liquid-item title="\u5728\u6587\u4EF6\u5939\u4E2D\u663E\u793A">${ICONS.download}<span>${downloads.length} \u9879\u4E0B\u8F7D\u4E2D</span></button>` : "",
            battery ? `<span class="glass glass-dark capsule battery-capsule ${battery.level <= 0.2 && !battery.charging ? "is-low" : ""}" title="${battery.charging ? "\u6B63\u5728\u5145\u7535" : "\u6B63\u5728\u4F7F\u7528\u7535\u6C60"}">${battery.charging ? ICONS.bolt : ICONS.battery}<span>${Math.round(battery.level * 100)}%</span></span>` : ""
          ].join("");
          this.querySelector(".media-open")?.addEventListener("click", () => {
            if (media) chrome.tabs.update(media.id, { active: true });
          });
          this.querySelector(".media-mute")?.addEventListener("click", () => {
            if (!media) return;
            void Promise.resolve(chrome.tabs.update(media.id, { muted: !media.muted })).finally(() => void this.refresh());
          });
          this.querySelector(".download-capsule")?.addEventListener("click", () => {
            if (downloads[0] !== void 0) chrome.downloads.show(downloads[0]);
          });
        }
        async refresh() {
          if (document.visibilityState === "hidden" || this.hidden) return;
          const [tabs, downloads, battery] = await Promise.all([
            chrome.tabs?.query ? callbackResult((done) => chrome.tabs.query({ audible: true }, done), []) : [],
            chrome.downloads?.search ? callbackResult((done) => chrome.downloads.search({ state: "in_progress" }, done), []) : [],
            readBattery()
          ]);
          const tab = tabs[0];
          const next = {
            media: tab ? {
              id: tab.id,
              title: tab.title || "\u6B63\u5728\u64AD\u653E",
              host: hostOf(tab.url ?? "") || "\u5176\u4ED6",
              icon: tab.url ? faviconUrl(tab.url, 64) : "",
              muted: Boolean(tab.mutedInfo?.muted)
            } : null,
            downloads: downloads.map((item) => item.id),
            battery
          };
          if (JSON.stringify(next) === JSON.stringify(this.status)) return;
          this.status = next;
          this.render();
        }
      };
    }
  });

  // src/components/wallpaper-badge.ts
  var WallpaperBadge;
  var init_wallpaper_badge = __esm({
    "src/components/wallpaper-badge.ts"() {
      "use strict";
      init_icons();
      WallpaperBadge = class extends HTMLElement {
        connectedCallback() {
          document.addEventListener("wallpaper-state", this.onState);
          this.addEventListener("click", this.onClick);
          const surface = document.querySelector("wallpaper-surface");
          if (surface?.state) this.update(surface.state);
        }
        disconnectedCallback() {
          document.removeEventListener("wallpaper-state", this.onState);
          this.removeEventListener("click", this.onClick);
        }
        onState = (event) => this.update(event.detail);
        onClick = (event) => {
          if (!event.target.closest(".wallpaper-pause")) return;
          document.querySelector("wallpaper-surface")?.togglePaused();
        };
        /** Updates in place so a keyboard user keeps focus on the pause button. */
        update({ label, animated, paused }) {
          if (!this.querySelector(".wallpaper-label")) {
            this.innerHTML = `<span class="wallpaper-label"></span><button class="glass round-button wallpaper-pause" type="button" data-liquid-item></button>`;
          }
          const action = paused ? "\u64AD\u653E\u52A8\u6001\u58C1\u7EB8" : "\u6682\u505C\u52A8\u6001\u58C1\u7EB8";
          const button = this.querySelector(".wallpaper-pause");
          this.querySelector(".wallpaper-label").textContent = label;
          button.hidden = !animated;
          button.setAttribute("aria-label", action);
          button.title = action;
          button.setAttribute("aria-pressed", String(paused));
          button.innerHTML = paused ? ICONS.play : ICONS.pause;
        }
      };
    }
  });

  // src/components/wallpaper-surface.ts
  function applySound(video, sound) {
    if (!sound) {
      video.muted = true;
      return;
    }
    if (navigator.userActivation?.hasBeenActive) {
      video.muted = false;
      return;
    }
    const unmute = () => {
      window.removeEventListener("pointerdown", unmute, true);
      window.removeEventListener("keydown", unmute, true);
      if (video.isConnected && appStore.state.settings.wallpaper.sound) video.muted = false;
    };
    window.addEventListener("pointerdown", unmute, true);
    window.addEventListener("keydown", unmute, true);
  }
  function safeTone(sample) {
    try {
      return sample();
    } catch {
      return "dark";
    }
  }
  var WallpaperSurface, SCENE;
  var init_wallpaper_surface = __esm({
    "src/components/wallpaper-surface.ts"() {
      "use strict";
      init_media_store();
      init_store();
      init_wallpaper_service();
      init_base();
      WallpaperSurface = class extends StoreElement {
        observedChanges = ["settings.wallpaper"];
        objectUrl = "";
        renderToken = 0;
        appliedMediaKey = "";
        pendingMediaKey = "";
        userPaused = false;
        battery = null;
        connectedCallback() {
          super.connectedCallback();
          document.addEventListener("visibilitychange", this.syncPlayback);
          void navigator.getBattery?.().then((battery) => {
            this.battery = battery;
            this.battery.addEventListener?.("chargingchange", this.syncPlayback);
            this.syncPlayback();
          }).catch(() => void 0);
        }
        disconnectedCallback() {
          super.disconnectedCallback();
          document.removeEventListener("visibilitychange", this.syncPlayback);
          this.battery?.removeEventListener?.("chargingchange", this.syncPlayback);
          this.releaseObjectUrl();
        }
        get state() {
          const { type, value } = appStore.state.settings.wallpaper;
          const label = type === "gradient" ? "Twilight Bay \xB7 \u52A8\u6001" : type === "video" ? "\u672C\u5730\u89C6\u9891 \xB7 \u52A8\u6001" : type === "local" ? value.startsWith("online") ? "\u5728\u7EBF\u58C1\u7EB8" : "\u672C\u5730\u56FE\u7247" : "\u5728\u7EBF\u56FE\u7247";
          return { label, animated: type === "gradient" || type === "video", paused: this.userPaused };
        }
        togglePaused() {
          this.userPaused = !this.userPaused;
          this.syncPlayback();
          this.reportState();
        }
        render() {
          const wallpaper = appStore.state.settings.wallpaper;
          if (!this.querySelector(".wallpaper-media")) {
            this.innerHTML = '<div class="wallpaper-media"></div><div class="wallpaper-tint"></div>';
          }
          this.style.setProperty("--wallpaper-blur", `${wallpaper.blur}px`);
          this.style.setProperty("--wallpaper-overlay", String(wallpaper.overlay / 100));
          this.syncPlayback();
          const mediaKey = `${wallpaper.type}:${wallpaper.value}`;
          if (mediaKey === this.appliedMediaKey || mediaKey === this.pendingMediaKey) return;
          this.pendingMediaKey = mediaKey;
          void this.applyMedia(++this.renderToken, mediaKey);
        }
        syncPlayback = () => {
          const { type, pauseOnBattery, pauseWhenHidden, sound } = appStore.state.settings.wallpaper;
          const paused = this.userPaused || pauseWhenHidden && document.visibilityState === "hidden" || pauseOnBattery && this.battery !== null && !this.battery.charging;
          this.classList.toggle("is-paused", paused);
          const video = this.querySelector(".wallpaper-media video");
          if (!video || type !== "video") return;
          applySound(video, sound);
          if (paused) video.pause();
          else if (video.paused) void video.play().catch(() => void 0);
        };
        async applyMedia(token, mediaKey) {
          const wallpaper = appStore.state.settings.wallpaper;
          const host = this.querySelector(".wallpaper-media");
          if (!host) return;
          let candidateUrl = "";
          let candidateVideo = null;
          let tone = Promise.resolve("dark");
          try {
            if (wallpaper.type === "video") {
              const blob = await mediaStore.get("video");
              if (!blob) throw new Error("\u627E\u4E0D\u5230\u5DF2\u4FDD\u5B58\u7684\u89C6\u9891\u80CC\u666F");
              candidateUrl = URL.createObjectURL(blob);
              candidateVideo = document.createElement("video");
              candidateVideo.src = candidateUrl;
              candidateVideo.autoplay = true;
              candidateVideo.loop = true;
              candidateVideo.muted = true;
              candidateVideo.defaultMuted = true;
              candidateVideo.playsInline = true;
              candidateVideo.style.visibility = "hidden";
              host.appendChild(candidateVideo);
              await candidateVideo.play();
              if (token !== this.renderToken) return;
              candidateVideo.style.removeProperty("visibility");
              tone = Promise.resolve(safeTone(() => toneOf(candidateVideo)));
              this.commitMedia(host, candidateVideo, candidateUrl, "");
              candidateUrl = "";
              candidateVideo = null;
            } else if (wallpaper.type === "local") {
              const blob = await mediaStore.get("image");
              if (!blob) throw new Error("\u627E\u4E0D\u5230\u5DF2\u4FDD\u5B58\u7684\u56FE\u7247\u80CC\u666F");
              candidateUrl = URL.createObjectURL(blob);
              if (token !== this.renderToken) return;
              tone = toneOfBlob(blob).catch(() => "dark");
              this.commitMedia(host, null, candidateUrl, `url("${candidateUrl}")`);
              candidateUrl = "";
            } else {
              if (token !== this.renderToken) return;
              const preset = wallpaper.type === "preset" && wallpaper.value;
              const background = preset ? `url("${wallpaper.value.replaceAll('"', "%22")}")` : "";
              this.commitMedia(host, null, "", background);
              if (!preset) host.innerHTML = SCENE;
            }
            this.appliedMediaKey = mediaKey;
            this.syncPlayback();
            this.reportState();
            const resolved = await tone;
            if (token === this.renderToken) this.reportTone(resolved);
          } catch (error) {
            if (token === this.renderToken) this.reportError(error);
          } finally {
            if (candidateVideo) this.disposeVideo(candidateVideo);
            if (candidateUrl) URL.revokeObjectURL(candidateUrl);
            if (this.pendingMediaKey === mediaKey) this.pendingMediaKey = "";
          }
        }
        commitMedia(host, video, objectUrl, background) {
          const previousUrl = this.objectUrl;
          host.querySelectorAll("video").forEach((item) => {
            if (item !== video) this.disposeVideo(item);
          });
          host.replaceChildren(...video ? [video] : []);
          host.style.backgroundImage = background;
          this.objectUrl = objectUrl;
          if (previousUrl && previousUrl !== objectUrl) URL.revokeObjectURL(previousUrl);
        }
        reportState() {
          this.dispatchEvent(new CustomEvent("wallpaper-state", { bubbles: true, composed: true, detail: this.state }));
        }
        reportTone(tone) {
          this.dispatchEvent(new CustomEvent("wallpaper-tone", { bubbles: true, composed: true, detail: { tone } }));
        }
        reportError(error) {
          this.dispatchEvent(new CustomEvent("wallpaper-error", {
            bubbles: true,
            composed: true,
            detail: { message: error instanceof Error ? error.message : "\u80CC\u666F\u5A92\u4F53\u52A0\u8F7D\u5931\u8D25" }
          }));
        }
        releaseObjectUrl() {
          this.querySelectorAll(".wallpaper-media video").forEach((video) => this.disposeVideo(video));
          if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
          this.objectUrl = "";
        }
        disposeVideo(video) {
          video.pause();
          video.removeAttribute("src");
          video.load();
          video.remove();
        }
      };
      SCENE = `
<svg class="scene" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
        <linearGradient id="scene-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#121a3a"></stop>
            <stop offset="0.32" stop-color="#3a3f74"></stop>
            <stop offset="0.55" stop-color="#9a6390"></stop>
            <stop offset="0.7" stop-color="#e48b7f"></stop>
            <stop offset="0.8" stop-color="#ffc08e"></stop>
        </linearGradient>
        <radialGradient id="scene-sun-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stop-color="#fff1d6" stop-opacity="1"></stop>
            <stop offset="0.25" stop-color="#ffd7a3" stop-opacity="0.8"></stop>
            <stop offset="1" stop-color="#ff9f7a" stop-opacity="0"></stop>
        </radialGradient>
        <linearGradient id="scene-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#e9997f"></stop>
            <stop offset="0.35" stop-color="#8a5a82"></stop>
            <stop offset="1" stop-color="#1a1c3d"></stop>
        </linearGradient>
        <linearGradient id="scene-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#8b6a9a"></stop>
            <stop offset="1" stop-color="#b47a8e"></stop>
        </linearGradient>
    </defs>
    <g class="scene-kb">
        <rect width="1440" height="720" fill="url(#scene-sky)"></rect>
        <g fill="#fff">
            <circle class="scene-star" cx="180" cy="80" r="1.4"></circle>
            <circle class="scene-star" cx="340" cy="150" r="1"></circle>
            <circle class="scene-star" cx="520" cy="60" r="1.2"></circle>
            <circle class="scene-star" cx="760" cy="110" r="0.9"></circle>
            <circle class="scene-star" cx="1010" cy="70" r="1.3"></circle>
            <circle class="scene-star" cx="1180" cy="160" r="1"></circle>
            <circle class="scene-star" cx="1320" cy="90" r="1.4"></circle>
            <circle class="scene-star" cx="90" cy="210" r="0.8"></circle>
            <circle class="scene-star" cx="1260" cy="240" r="0.8"></circle>
        </g>
        <circle class="scene-halo" cx="930" cy="612" r="260" fill="url(#scene-sun-glow)" opacity="0.7"></circle>
        <circle cx="930" cy="640" r="64" fill="#fff0d2"></circle>
        <g class="scene-cloud-a" fill="#ffd9c4" opacity="0.32">
            <ellipse cx="300" cy="380" rx="220" ry="16"></ellipse>
            <ellipse cx="420" cy="366" rx="140" ry="12"></ellipse>
            <ellipse cx="1100" cy="430" rx="260" ry="14"></ellipse>
        </g>
        <g class="scene-cloud-b" fill="#f6b9b0" opacity="0.28">
            <ellipse cx="700" cy="300" rx="300" ry="11"></ellipse>
            <ellipse cx="1240" cy="520" rx="200" ry="10"></ellipse>
            <ellipse cx="160" cy="520" rx="180" ry="9"></ellipse>
        </g>
        <path d="M0 600 L120 560 L230 585 L360 520 L470 566 L600 540 L720 590 L840 560 L980 600 L1100 548 L1230 580 L1340 540 L1440 572 L1440 700 L0 700 Z" fill="url(#scene-far)" opacity="0.75"></path>
        <path d="M0 640 L90 612 L210 650 L330 596 L440 640 L560 618 L680 664 L780 640 L900 676 L1040 630 L1160 668 L1290 620 L1440 650 L1440 712 L0 712 Z" fill="#4a3b6a"></path>
        <path d="M0 690 L140 660 L260 684 L400 650 L520 690 L1000 694 L1120 662 L1260 684 L1440 664 L1440 720 L0 720 Z" fill="#26234a"></path>
        <rect y="712" width="1440" height="188" fill="url(#scene-water)"></rect>
        <g fill="#fff3dc">
            <rect class="scene-glint" x="870" y="726" width="120" height="3" rx="1.5"></rect>
            <rect class="scene-glint" x="890" y="744" width="84" height="2.5" rx="1.2"></rect>
            <rect class="scene-glint" x="850" y="764" width="160" height="2" rx="1"></rect>
            <rect class="scene-glint" x="900" y="786" width="62" height="2" rx="1"></rect>
            <rect class="scene-glint" x="866" y="810" width="128" height="1.6" rx="0.8"></rect>
            <rect class="scene-glint" x="910" y="838" width="44" height="1.6" rx="0.8"></rect>
            <rect class="scene-glint" x="820" y="866" width="210" height="1.4" rx="0.7"></rect>
        </g>
        <path d="M0 760 C200 748 360 772 560 760 C760 748 980 776 1180 760 C1300 752 1380 756 1440 760" stroke="#ffd2b8" stroke-opacity="0.18" stroke-width="1.2" fill="none"></path>
        <path d="M0 820 C240 808 420 832 660 820 C880 808 1080 836 1300 820 C1360 816 1410 818 1440 820" stroke="#ffd2b8" stroke-opacity="0.12" stroke-width="1" fill="none"></path>
    </g>
</svg>`;
    }
  });

  // src/app.ts
  var require_app = __commonJS({
    "src/app.ts"() {
      init_store();
      init_chrome_fallback();
      init_utils();
      init_wallpaper_service();
      init_backup_toast();
      init_bookmark_dialog();
      init_bookmark_launchpad();
      init_dashboard_header();
      init_home_dock();
      init_icons();
      init_liquid_glass();
      init_liquid_controls();
      init_search_pill();
      init_settings_panel();
      init_spotlight_search();
      init_status_strip();
      init_ui_layer();
      init_wallpaper_badge();
      init_wallpaper_surface();
      installChromeFallback();
      var IDLE_DELAY = 8e3;
      var InfinityNewTabApp = class extends HTMLElement {
        hdrMedia = window.matchMedia("(dynamic-range: high)");
        wallpaperTone = "dark";
        idleTimer = 0;
        updateClasses = () => {
          const { appearance } = appStore.state.settings;
          const hdrDisplay = this.hasHdrDisplay();
          const hdrCapable = hdrDisplay && "gpu" in navigator;
          const theme = appearance.theme === "auto" ? this.wallpaperTone : appearance.theme;
          document.body.classList.toggle("theme-light", theme === "light");
          document.body.classList.toggle("theme-dark", theme === "dark");
          document.body.classList.toggle("glass-tinted", appearance.glass === "tinted");
          document.body.classList.toggle("reduce-transparency", appearance.reduceTransparency);
          document.body.classList.toggle("enhanced-animations", appearance.enhancedAnimations);
          document.body.classList.toggle("hdr-highlights", appearance.hdrHighlights);
          document.body.classList.toggle("hdr-display", hdrDisplay);
          document.body.classList.toggle("hdr-capable", hdrCapable);
          document.body.dataset.hdrOutput = hdrDisplay ? "high" : "standard";
        };
        onStoreChange = (event) => {
          const changes = event.detail?.changes;
          if (!changes || changes.includes("settings.appearance")) this.updateClasses();
          if (!changes || changes.includes("settings.wallpaper")) this.wake();
        };
        async connectedCallback() {
          this.innerHTML = '<div class="app-loading" role="status"><span></span><p>\u6B63\u5728\u6574\u7406\u4F60\u7684\u542F\u52A8\u53F0\u2026</p></div>';
          try {
            await appStore.init();
            this.updateClasses();
            appStore.addEventListener("change", this.onStoreChange);
            this.hdrMedia.addEventListener("change", this.updateClasses);
            this.render();
            window.addEventListener("keydown", this.onKeyDown);
            ["pointermove", "pointerdown", "keydown", "wheel", "focusin"].forEach((type) => {
              window.addEventListener(type, this.wake, { passive: true, capture: true });
            });
            this.wake();
            void migrateLegacyWallpaper();
          } catch (error) {
            this.innerHTML = `<div class="app-error"><h1>\u542F\u52A8\u53F0\u52A0\u8F7D\u5931\u8D25</h1><p>${escapeHtml(error instanceof Error ? error.message : "\u672A\u77E5\u9519\u8BEF")}</p></div>`;
          }
        }
        disconnectedCallback() {
          appStore.removeEventListener("change", this.onStoreChange);
          this.hdrMedia.removeEventListener("change", this.updateClasses);
          window.removeEventListener("keydown", this.onKeyDown);
          ["pointermove", "pointerdown", "keydown", "wheel", "focusin"].forEach((type) => {
            window.removeEventListener(type, this.wake, true);
          });
          window.clearTimeout(this.idleTimer);
        }
        hasHdrDisplay() {
          return this.hdrMedia.matches && CSS.supports("dynamic-range-limit", "no-limit");
        }
        render() {
          this.innerHTML = `
            <wallpaper-surface></wallpaper-surface>
            <div class="home">
                <header class="top-bar">
                    <status-strip></status-strip>
                    <div class="top-actions">
                        <button class="glass round-button shuffle-wallpaper" type="button" data-liquid-item aria-label="\u6362\u4E00\u4E2A\u5728\u7EBF\u58C1\u7EB8" title="\u6362\u4E00\u4E2A\u5728\u7EBF\u58C1\u7EB8">${ICONS.sparkle}</button>
                        <button class="glass round-button settings-trigger" type="button" data-liquid-item aria-label="\u8BBE\u7F6E" title="\u8BBE\u7F6E">${ICONS.settings}</button>
                    </div>
                </header>
                <main class="hero">
                    <dashboard-header></dashboard-header>
                    <search-pill></search-pill>
                </main>
                <home-dock></home-dock>
                <wallpaper-badge></wallpaper-badge>
            </div>
            <spotlight-search></spotlight-search>
            <bookmark-launchpad></bookmark-launchpad>
            <settings-panel></settings-panel>
            <bookmark-dialog></bookmark-dialog>
            <backup-toast></backup-toast>
            <liquid-glass-system></liquid-glass-system>
        `;
          this.querySelector(".settings-trigger")?.addEventListener("click", () => this.settings?.open());
          this.querySelector(".shuffle-wallpaper")?.addEventListener("click", (event) => void this.shuffleWallpaper(event.currentTarget));
          this.addEventListener("wallpaper-error", this.onWallpaperError);
          this.addEventListener("wallpaper-tone", this.onWallpaperTone);
          this.addEventListener("open-spotlight", () => this.spotlight?.open());
          this.addEventListener("open-launchpad", ((event) => {
            this.launchpad?.open(event.detail?.view ?? "bookmarks");
          }));
        }
        get spotlight() {
          return this.querySelector("spotlight-search");
        }
        get launchpad() {
          return this.querySelector("bookmark-launchpad");
        }
        get settings() {
          return this.querySelector("settings-panel");
        }
        async shuffleWallpaper(button) {
          if (button.classList.contains("is-busy")) return;
          button.classList.add("is-busy");
          button.setAttribute("aria-busy", "true");
          try {
            await useOnlineWallpaper();
          } catch (error) {
            notifyError(error);
          } finally {
            button.classList.remove("is-busy");
            button.removeAttribute("aria-busy");
          }
        }
        /** Any input brings the interface back and restarts the idle countdown. */
        wake = () => {
          document.body.classList.remove("is-idle");
          window.clearTimeout(this.idleTimer);
          if (!appStore.state.settings.wallpaper.idleHide) return;
          this.idleTimer = window.setTimeout(this.goIdle, IDLE_DELAY);
        };
        goIdle = () => {
          if (hasOpenLayer() || isTypingTarget(document.activeElement) || document.querySelector(".liquid-glass-lens.is-visible, .context-menu, .modal-backdrop")) {
            this.wake();
            return;
          }
          document.body.classList.add("is-idle");
        };
        onWallpaperTone = (event) => {
          this.wallpaperTone = event.detail.tone;
          this.updateClasses();
        };
        onWallpaperError = (event) => {
          notify(`\u80CC\u666F\u52A0\u8F7D\u5931\u8D25\uFF1A${event.detail?.message || "\u672A\u77E5\u9519\u8BEF"}\u3002\u5DF2\u4FDD\u7559\u539F\u80CC\u666F\u3002`, "error", 8e3);
        };
        onKeyDown = (event) => {
          const commandK = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
          if (commandK && this.spotlight?.isOpen) {
            event.preventDefault();
            this.spotlight.close();
            return;
          }
          if (hasOpenLayer()) return;
          if (commandK || event.key === "/" && !isTypingTarget(event.target)) {
            event.preventDefault();
            this.spotlight?.open();
          }
        };
      };
      function isTypingTarget(target) {
        return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target instanceof HTMLElement && target.isContentEditable;
      }
      var elements = [
        ["liquid-glass-system", LiquidGlassSystem],
        ["liquid-range", LiquidRange],
        ["liquid-toggle", LiquidToggle],
        ["wallpaper-surface", WallpaperSurface],
        ["wallpaper-badge", WallpaperBadge],
        ["status-strip", StatusStrip],
        ["dashboard-header", DashboardHeader],
        ["search-pill", SearchPill],
        ["home-dock", HomeDock],
        ["spotlight-search", SpotlightSearch],
        ["bookmark-launchpad", BookmarkLaunchpad],
        ["settings-panel", SettingsPanel],
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
