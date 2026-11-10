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
    const text = value.trim();
    const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(text);
    try {
      let url = new URL(hasScheme ? text : `https://${text}`);
      if (!hasScheme && LOCAL_HOST.test(url.hostname)) url = new URL(`http://${text}`);
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
  function siteLabel(hostname) {
    const host = hostname.toLowerCase().replace(/^www\./, "");
    if (HOST_NAMES[host]) return HOST_NAMES[host];
    if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":")) return host;
    const parts = host.split(".");
    const suffix = parts.length > 2 && TWO_LEVEL_SUFFIXES.has(parts.slice(-2).join(".")) ? 2 : 1;
    const label = parts[parts.length - suffix - 1] ?? host;
    return BRAND_NAMES[label] ?? label.charAt(0).toUpperCase() + label.slice(1);
  }
  function isAddressLike(value) {
    return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/i.test(value.trim());
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
  function bookmarkIconFallback(bookmark) {
    return bookmark.icon && !isManagedFavicon(bookmark.icon) ? faviconUrl(bookmark.url) : DEFAULT_ICON;
  }
  function compareBookmarks(left, right) {
    return left.order - right.order || String(left.id).localeCompare(String(right.id));
  }
  var DEFAULT_ICON, BOOKMARK_PROTOCOLS, LOCAL_HOST, ROOT_FOLDER, TWO_LEVEL_SUFFIXES, HOST_NAMES, BRAND_NAMES;
  var init_utils = __esm({
    "src/core/utils.ts"() {
      "use strict";
      DEFAULT_ICON = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjNjM2NmYxIi8+PHBhdGggZD0iTTE2IDhWMjRNOCAxNkgyNCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=";
      BOOKMARK_PROTOCOLS = /* @__PURE__ */ new Set(["http:", "https:", "chrome-extension:"]);
      LOCAL_HOST = /^(localhost|.+\.localhost|.+\.local|\d{1,3}(\.\d{1,3}){3}|\[[\da-f:.]+\])$/i;
      ROOT_FOLDER = "\u5168\u90E8";
      TWO_LEVEL_SUFFIXES = /* @__PURE__ */ new Set([
        "com.cn",
        "net.cn",
        "org.cn",
        "gov.cn",
        "edu.cn",
        "com.hk",
        "com.tw",
        "co.jp",
        "ne.jp",
        "or.jp",
        "co.kr",
        "co.uk",
        "org.uk",
        "ac.uk",
        "com.au",
        "co.nz",
        "com.br",
        "co.in",
        "com.sg"
      ]);
      HOST_NAMES = {
        "mail.google.com": "Gmail",
        "docs.google.com": "Google \u6587\u6863",
        "drive.google.com": "Google \u4E91\u7AEF\u786C\u76D8",
        "translate.google.com": "Google \u7FFB\u8BD1",
        "maps.google.com": "Google \u5730\u56FE",
        "music.youtube.com": "YouTube Music",
        "news.ycombinator.com": "Hacker News",
        "developer.mozilla.org": "MDN",
        "chat.openai.com": "ChatGPT"
      };
      BRAND_NAMES = {
        "163": "\u7F51\u6613",
        baidu: "\u767E\u5EA6",
        bgm: "Bangumi",
        bilibili: "Bilibili",
        chatgpt: "ChatGPT",
        douban: "\u8C46\u74E3",
        github: "GitHub",
        icloud: "iCloud",
        jd: "\u4EAC\u4E1C",
        linkedin: "LinkedIn",
        moegirl: "\u840C\u5A18\u767E\u79D1",
        myanimelist: "MyAnimeList",
        npmjs: "npm",
        openai: "OpenAI",
        pixiv: "pixiv",
        qq: "QQ",
        sspai: "\u5C11\u6570\u6D3E",
        stackoverflow: "Stack Overflow",
        taobao: "\u6DD8\u5B9D",
        v2ex: "V2EX",
        weibo: "\u5FAE\u535A",
        youtube: "YouTube",
        zhihu: "\u77E5\u4E4E"
      };
    }
  });

  // src/core/backup.ts
  function sanitizeImportedData(value) {
    if (!isRecord(value)) throw new Error("Backup data must be an object");
    const bookmarks = sanitizeBookmarks(Array.isArray(value.bookmarks) ? value.bookmarks : [], true);
    return {
      bookmarks,
      folders: normalizeFolders(value.folders, bookmarks),
      settings: sanitizeSettings(value.settings),
      recentSearches: normalizeRecentSearches(value.recentSearches),
      lastBackupPrompt: finiteNumber(value.lastBackupPrompt, 0)
    };
  }
  function sanitizeBookmarks(values, mergeDuplicates = false) {
    const bookmarks = [];
    const seen = /* @__PURE__ */ new Set();
    values.forEach((raw, index) => {
      if (!isRecord(raw)) return;
      const url = normalizeUrl(raw.url);
      if (!url) return;
      const folder = cleanText(raw.folder, 80) || ROOT_FOLDER;
      const key = `${folder}|${url}`;
      if (mergeDuplicates && seen.has(key)) return;
      seen.add(key);
      const id = typeof raw.id === "number" || typeof raw.id === "string" ? raw.id : Date.now() + index;
      const order = Number(raw.order);
      bookmarks.push({
        id,
        folder,
        url,
        name: cleanText(raw.name, 160) || new URL(url).hostname,
        icon: sanitizeBookmarkIcon(raw.icon),
        order: Number.isFinite(order) ? order : index
      });
    });
    const folders = /* @__PURE__ */ new Map();
    bookmarks.forEach((bookmark) => {
      const list = folders.get(bookmark.folder) ?? [];
      list.push(bookmark);
      folders.set(bookmark.folder, list);
    });
    folders.forEach((list) => {
      list.sort(compareBookmarks);
      list.forEach((bookmark, index) => {
        bookmark.order = index;
      });
    });
    return bookmarks;
  }
  function normalizeFolders(value, bookmarks) {
    const folders = /* @__PURE__ */ new Set([ROOT_FOLDER]);
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
  function sanitizeSettings(value) {
    const source = isRecord(value) ? value : {};
    const layout = isRecord(source.layout) ? source.layout : {};
    const wallpaper = isRecord(source.wallpaper) ? source.wallpaper : {};
    const appearance = isRecord(source.appearance) ? source.appearance : {};
    const defaults = DEFAULT_SETTINGS;
    const searchEngines = ["google", "bing", "baidu", "duckduckgo"];
    const wallpaperTypes = ["gradient", "local", "video"];
    const wallpaperType = wallpaperTypes.includes(String(wallpaper.type)) ? wallpaper.type : defaults.wallpaper.type;
    return {
      layout: {
        showClock: booleanOr(layout.showClock, defaults.layout.showClock),
        showSearch: booleanOr(layout.showSearch, defaults.layout.showSearch),
        showBookmarks: booleanOr(layout.showBookmarks, defaults.layout.showBookmarks),
        showStatus: booleanOr(layout.showStatus, defaults.layout.showStatus),
        showRecent: booleanOr(layout.showRecent, defaults.layout.showRecent),
        openInNewTab: booleanOr(layout.openInNewTab, defaults.layout.openInNewTab),
        searchEngine: searchEngines.includes(String(layout.searchEngine)) ? layout.searchEngine : defaults.layout.searchEngine,
        saveSearches: booleanOr(layout.saveSearches, defaults.layout.saveSearches),
        backupReminder: booleanOr(layout.backupReminder, defaults.layout.backupReminder)
      },
      wallpaper: {
        type: wallpaperType,
        value: wallpaperType === "gradient" ? "" : sanitizeWallpaperValue(wallpaper.value),
        blur: clampNumber(wallpaper.blur, 0, 40, defaults.wallpaper.blur),
        overlay: clampNumber(wallpaper.overlay, 0, 60, defaults.wallpaper.overlay),
        idleHide: booleanOr(wallpaper.idleHide, defaults.wallpaper.idleHide),
        pauseOnBattery: booleanOr(wallpaper.pauseOnBattery, defaults.wallpaper.pauseOnBattery),
        pauseWhenHidden: booleanOr(wallpaper.pauseWhenHidden, defaults.wallpaper.pauseWhenHidden),
        sound: booleanOr(wallpaper.sound, defaults.wallpaper.sound)
      },
      appearance: {
        clockFormat: appearance.clockFormat === "12h" ? "12h" : "24h",
        dateFormat: appearance.dateFormat === "short" ? "short" : "long",
        hdrHighlights: booleanOr(appearance.hdrHighlights, defaults.appearance.hdrHighlights),
        theme: appearance.theme === "light" || appearance.theme === "dark" ? appearance.theme : "auto",
        glass: appearance.glass === "tinted" ? "tinted" : "clear",
        reduceTransparency: booleanOr(appearance.reduceTransparency, defaults.appearance.reduceTransparency)
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
  function sanitizeBookmarkIcon(value) {
    const icon2 = sanitizeRemoteUrl(value, true);
    return icon2.startsWith("data:") && icon2.length > MAX_INLINE_ICON_LENGTH ? "" : icon2;
  }
  function sanitizeWallpaperValue(value) {
    return typeof value === "string" && /^(local|online)-\d+$/.test(value) ? value : "";
  }
  function booleanOr(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }
  function clampNumber(value, minimum, maximum, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
  }
  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
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
    return Array.from({ length: storedChunkCount(stored) }, (_, index) => stored[bookmarkChunkKey(index)]).flatMap((chunk) => Array.isArray(chunk) ? chunk : []);
  }
  function storedChunkCount(stored) {
    const count = stored[BOOKMARK_CHUNKS_KEY];
    return typeof count === "number" && Number.isInteger(count) && count >= 0 ? count : 0;
  }
  function staleBookmarkKeys(previousCount, nextCount) {
    const keys = [];
    for (let index = nextCount; index < previousCount; index += 1) keys.push(bookmarkChunkKey(index));
    return keys;
  }
  var BOOKMARK_CHUNKS_KEY, CHUNK_PREFIX, ITEM_BUDGET;
  var init_bookmark_storage = __esm({
    "src/core/bookmark-storage.ts"() {
      "use strict";
      BOOKMARK_CHUNKS_KEY = "bookmarkChunks";
      CHUNK_PREFIX = "bookmarks.";
      ITEM_BUDGET = 7600;
    }
  });

  // src/core/storage.ts
  function sync() {
    return chrome.storage.sync;
  }
  function storageGet(keys) {
    return new Promise((resolve, reject) => {
      sync().get(keys, (result) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(result ?? {});
      });
    });
  }
  function storageSet(values) {
    return new Promise((resolve, reject) => {
      sync().set(values, () => {
        if (chrome.runtime.lastError) reject(new Error(describeWriteError(chrome.runtime.lastError.message)));
        else resolve();
      });
    });
  }
  function storageRemove(keys) {
    return new Promise((resolve, reject) => {
      sync().remove(keys, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
  }
  function storageClear() {
    return new Promise((resolve, reject) => {
      sync().clear(() => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
  }
  function onSyncChanged(callback) {
    chrome.storage.onChanged?.addListener?.((_changes, areaName) => {
      if (areaName === "sync") callback();
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
      folders: [ROOT_FOLDER],
      settings: structuredClone(DEFAULT_SETTINGS),
      recentSearches: [],
      lastBackupPrompt: 0
    };
  }
  function diff(previous, next) {
    const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
    return ALL_CHANGES.filter((change) => {
      if (!change.startsWith("settings.")) return !same(previous[change], next[change]);
      const section = change.slice("settings.".length);
      return !same(previous.settings[section], next.settings[section]);
    });
  }
  function normalizeBookmarkInput(input, state, id = `${Date.now()}-${crypto.randomUUID()}`) {
    const url = normalizeUrl(input.url);
    if (!url) throw new Error("\u8BF7\u8F93\u5165\u6709\u6548\u7684\u7F51\u5740");
    if (url.length > 2048) throw new Error("\u7F51\u5740\u8FC7\u957F\uFF0C\u65E0\u6CD5\u540C\u6B65\u4FDD\u5B58");
    const icon2 = sanitizeRemoteUrl(input.icon, true);
    if (icon2.startsWith("data:") && icon2.length > MAX_INLINE_ICON_LENGTH) {
      throw new Error("\u5185\u5D4C\u56FE\u6807\u8FC7\u5927\uFF0C\u8BF7\u6539\u7528\u56FE\u6807\u7F51\u5740");
    }
    const folder = state.folders.includes(input.folder) ? input.folder : ROOT_FOLDER;
    return {
      id,
      url,
      folder,
      name: cleanText(input.name, 160) || new URL(url).hostname,
      icon: icon2,
      order: state.bookmarks.filter((bookmark) => bookmark.folder === folder && String(bookmark.id) !== String(id)).length
    };
  }
  function normalizeOrders(bookmarks) {
    new Set(bookmarks.map((bookmark) => bookmark.folder)).forEach((folder) => normalizeFolderOrder(bookmarks, folder));
  }
  function normalizeFolderOrder(bookmarks, folder) {
    bookmarks.filter((bookmark) => bookmark.folder === folder).sort(compareBookmarks).forEach((bookmark, index) => {
      bookmark.order = index;
    });
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
        initialized = null;
        bookmarkChunks = 0;
        queue = Promise.resolve();
        reloadQueued = false;
        get state() {
          return this.stateValue;
        }
        init() {
          this.initialized ??= this.serial(async () => {
            this.stateValue = await this.read();
            this.emit(ALL_CHANGES);
            onSyncChanged(this.queueReload);
          });
          this.initialized.catch(() => {
            this.initialized = null;
          });
          return this.initialized;
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
          let added = false;
          await this.commit((draft) => {
            if (!name || draft.folders.includes(name)) return false;
            draft.folders.push(name);
            added = true;
          }, ["folders"]);
          return added;
        }
        async renameFolder(from, to) {
          const name = cleanText(to, 80);
          let renamed = false;
          await this.commit((draft) => {
            if (!name || from === ROOT_FOLDER || name !== from && draft.folders.includes(name)) return false;
            draft.folders = draft.folders.map((folder) => folder === from ? name : folder);
            draft.bookmarks.forEach((bookmark) => {
              if (bookmark.folder === from) bookmark.folder = name;
            });
            normalizeOrders(draft.bookmarks);
            renamed = true;
          }, ["folders", "bookmarks"]);
          return renamed;
        }
        async deleteFolder(folder) {
          if (folder === ROOT_FOLDER) return;
          await this.commit((draft) => {
            draft.folders = draft.folders.filter((item) => item !== folder);
            draft.bookmarks.forEach((bookmark) => {
              if (bookmark.folder === folder) bookmark.folder = ROOT_FOLDER;
            });
            normalizeOrders(draft.bookmarks);
          }, ["folders", "bookmarks"]);
        }
        async addBookmark(input) {
          let bookmark = null;
          await this.commit((draft) => {
            bookmark = normalizeBookmarkInput(input, draft);
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
            const destination = draft.folders.includes(targetFolder) ? targetFolder : ROOT_FOLDER;
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
        /** Replaces everything with an already sanitized backup (see `sanitizeImportedData`). */
        replaceImportedData(next) {
          return this.serial(async () => {
            const encoded = encodeBookmarks(next.bookmarks);
            await storageSet({
              ...encoded.values,
              folders: next.folders,
              settings: next.settings,
              recentSearches: next.recentSearches,
              lastBackupPrompt: next.lastBackupPrompt
            });
            const staleKeys = staleBookmarkKeys(this.bookmarkChunks, encoded.count);
            if (staleKeys.length) await storageRemove(staleKeys);
            this.bookmarkChunks = encoded.count;
            this.stateValue = structuredClone(next);
            this.emit(ALL_CHANGES);
          });
        }
        reset() {
          return this.serial(async () => {
            await storageClear();
            this.bookmarkChunks = 0;
            this.stateValue = initialState();
            this.emit(ALL_CHANGES);
          });
        }
        /** Runs tasks one after another, so a write always starts from the latest state. */
        serial(task) {
          const run = this.queue.then(task, task);
          this.queue = run.catch(() => void 0);
          return run;
        }
        async read() {
          const stored = await storageGet(null);
          this.bookmarkChunks = storedChunkCount(stored);
          const bookmarks = sanitizeBookmarks(decodeBookmarks(stored));
          return {
            bookmarks,
            folders: normalizeFolders(stored.folders, bookmarks),
            settings: sanitizeSettings(stored.settings),
            recentSearches: normalizeRecentSearches(stored.recentSearches),
            lastBackupPrompt: finiteNumber(stored.lastBackupPrompt, 0)
          };
        }
        /** Several change events (a save and its chunk cleanup) collapse into one reload. */
        queueReload = () => {
          if (this.reloadQueued) return;
          this.reloadQueued = true;
          void this.serial(async () => {
            this.reloadQueued = false;
            const next = await this.read();
            const changes = diff(this.stateValue, next);
            if (!changes.length) return;
            this.stateValue = next;
            this.emit(changes);
          }).catch(() => void 0);
        };
        /** A mutator may return `false` to make no change at all. */
        commit(mutator, keys, changes = keys) {
          return this.serial(async () => {
            const draft = structuredClone(this.stateValue);
            if (mutator(draft) === false) return;
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
          });
        }
        /** Stale chunks are harmless to readers, so a failed cleanup never rolls back a save. */
        async dropStaleBookmarkKeys(nextCount) {
          const stale = staleBookmarkKeys(this.bookmarkChunks, nextCount);
          this.bookmarkChunks = nextCount;
          if (!stale.length) return;
          try {
            await storageRemove(stale);
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
    const syncKey = "infinity-preview-sync";
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
      storage: {
        sync: makeArea(syncKey),
        // Other preview tabs writing to localStorage stand in for other tabs and devices.
        onChanged: {
          addListener(listener) {
            window.addEventListener("storage", (event) => {
              if (event.key === syncKey) listener({}, "sync");
            });
          }
        }
      },
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
  var DATABASE, STORE, KINDS, MediaStore, mediaStore;
  var init_media_store = __esm({
    "src/core/media-store.ts"() {
      "use strict";
      init_backup();
      DATABASE = "infinity-wallpaper";
      STORE = "wallpapers";
      KINDS = ["image", "video"];
      MediaStore = class {
        database = null;
        async get(kind) {
          const database = await this.open();
          return new Promise((resolve, reject) => {
            const request = database.transaction(STORE, "readonly").objectStore(STORE).get(kind);
            request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
            request.onerror = () => reject(request.error ?? new Error("\u65E0\u6CD5\u8BFB\u53D6\u672C\u5730\u58C1\u7EB8"));
          });
        }
        async set(kind, value) {
          await this.write((store) => store.put(value, kind), "\u65E0\u6CD5\u4FDD\u5B58\u672C\u5730\u58C1\u7EB8", "\u672C\u5730\u58C1\u7EB8\u5B58\u50A8\u5DF2\u4E2D\u6B62");
        }
        async clear(kind) {
          await this.write((store) => store.delete(kind), "\u65E0\u6CD5\u5220\u9664\u672C\u5730\u58C1\u7EB8", "\u672C\u5730\u58C1\u7EB8\u5220\u9664\u5DF2\u4E2D\u6B62");
        }
        async clearAll() {
          await Promise.all(KINDS.map((kind) => this.clear(kind)));
        }
        async snapshot() {
          const [image, video] = await Promise.all(KINDS.map((kind) => this.get(kind)));
          return { image, video };
        }
        async restore(snapshot) {
          for (const kind of KINDS) {
            const blob = snapshot[kind];
            if (blob) await this.set(kind, blob);
            else await this.clear(kind);
          }
        }
        async export() {
          const { image, video } = await this.snapshot();
          return {
            image: image ? await blobToDataUrl(image) : null,
            video: video ? await blobToDataUrl(video) : null
          };
        }
        async import(value) {
          if (!isRecord(value)) {
            await this.clearAll();
            return;
          }
          for (const kind of KINDS) {
            const blob = dataUrlToBlob(value[kind]);
            if (blob) await this.set(kind, blob);
            else await this.clear(kind);
          }
        }
        async write(run, failed, aborted) {
          const database = await this.open();
          await new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE, "readwrite");
            run(transaction.objectStore(STORE));
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error ?? new Error(failed));
            transaction.onabort = () => reject(transaction.error ?? new Error(aborted));
          });
        }
        /** One connection for the page; it is dropped if it fails or another page upgrades the database. */
        open() {
          this.database ??= new Promise((resolve, reject) => {
            const request = indexedDB.open(DATABASE, 1);
            request.onupgradeneeded = () => {
              if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
            };
            request.onsuccess = () => {
              const database = request.result;
              database.onversionchange = () => {
                database.close();
                this.database = null;
              };
              database.onclose = () => {
                this.database = null;
              };
              resolve(database);
            };
            request.onerror = () => reject(request.error ?? new Error("\u65E0\u6CD5\u6253\u5F00\u58C1\u7EB8\u6570\u636E\u5E93"));
          });
          this.database.catch(() => {
            this.database = null;
          });
          return this.database;
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
  function mediaKindOf(file) {
    if (file.type.startsWith("video/") || !file.type && VIDEO_EXTENSIONS.test(file.name)) return "video";
    if (file.type.startsWith("image/") || !file.type && (IMAGE_EXTENSIONS.test(file.name) || HEIC_EXTENSIONS.test(file.name))) return "image";
    return null;
  }
  async function useLocalWallpaper(file) {
    if (HEIC.test(file.type) || HEIC_EXTENSIONS.test(file.name)) {
      throw new Error("Chrome \u65E0\u6CD5\u663E\u793A HEIC \u683C\u5F0F\u7684\u7167\u7247\u3002\u8BF7\u5728\u201C\u7167\u7247\u201D\u4E2D\u9009\u4E2D\u5B83\uFF0C\u6309 \u2318C \u590D\u5236\u540E\u5728\u8FD9\u91CC\u7C98\u8D34\uFF0C\u6216\u7528\u201C\u6587\u4EF6 \u2192 \u5BFC\u51FA\u201D\u5B58\u4E3A JPEG");
    }
    const kind = mediaKindOf(file);
    if (!kind) throw new Error("\u8BF7\u9009\u62E9\u56FE\u7247\u6216\u89C6\u9891\u6587\u4EF6");
    await validateLocalMedia(file, kind);
    await storeWallpaper(file, kind, "local");
  }
  async function resetWallpaper() {
    const { type, value, blur, overlay } = DEFAULT_SETTINGS.wallpaper;
    await appStore.updateSettings("wallpaper", { type, value, blur, overlay });
    await mediaStore.clearAll();
  }
  function wallpaperLabel(wallpaper) {
    if (wallpaper.type === "video") return "\u672C\u5730\u89C6\u9891";
    if (wallpaper.type === "local") return wallpaper.value.startsWith("online") ? "\u5728\u7EBF\u58C1\u7EB8" : "\u672C\u5730\u56FE\u7247";
    return "Twilight Bay";
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
    await mediaStore.clear(kind === "video" ? "image" : "video").catch(() => void 0);
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
  var ONLINE_WALLPAPER, SAMPLE_SIZE, LIGHT_THRESHOLD, IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, HEIC, HEIC_EXTENSIONS;
  var init_wallpaper_service = __esm({
    "src/core/wallpaper-service.ts"() {
      "use strict";
      init_backup();
      init_media_store();
      init_store();
      ONLINE_WALLPAPER = "https://www.dmoe.cc/random.php";
      SAMPLE_SIZE = 32;
      LIGHT_THRESHOLD = 0.58;
      IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?)$/i;
      VIDEO_EXTENSIONS = /\.(mp4|m4v|mov|webm|ogv)$/i;
      HEIC = /^image\/hei[cf]/i;
      HEIC_EXTENSIONS = /\.hei[cf]$/i;
    }
  });

  // src/core/backup-service.ts
  function dateStamp() {
    return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
  var BACKUP_VERSION, BackupService, backupService;
  var init_backup_service = __esm({
    "src/core/backup-service.ts"() {
      "use strict";
      init_backup();
      init_media_store();
      init_store();
      BACKUP_VERSION = "2.0";
      BackupService = class {
        /** Backups keep the flat 2.0 layout even though sync storage now chunks bookmarks. */
        async exportData() {
          return {
            version: BACKUP_VERSION,
            exportDate: (/* @__PURE__ */ new Date()).toISOString(),
            data: structuredClone(appStore.state),
            localMedia: await mediaStore.export()
          };
        }
        /** Media is replaced first; if saving the synced data then fails, the previous media comes back. */
        async importData(value) {
          if (!isRecord(value) || !isRecord(value.data)) throw new Error("\u5907\u4EFD\u6587\u4EF6\u683C\u5F0F\u65E0\u6548");
          if (value.version !== BACKUP_VERSION) throw new Error(`\u53EA\u652F\u6301 ${BACKUP_VERSION} \u683C\u5F0F\u7684\u5907\u4EFD\uFF08\u8FD9\u4E2A\u6587\u4EF6\u662F ${String(value.version ?? "\u672A\u77E5")}\uFF09`);
          const data = sanitizeImportedData(value.data);
          const previous = await mediaStore.snapshot().catch(() => null);
          try {
            if (Object.hasOwn(value, "localMedia")) await mediaStore.import(value.localMedia);
            await appStore.replaceImportedData(data);
          } catch (error) {
            if (previous) await mediaStore.restore(previous).catch(() => void 0);
            throw error;
          }
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
            <form class="modal glass-panel" role="alertdialog" aria-modal="true" aria-labelledby="modal-title">
                <header class="modal-header">
                    <h2 id="modal-title">${escapeHtml(options.title)}</h2>
                </header>
                ${options.body ? `<p class="modal-body">${escapeHtml(options.body)}</p>` : ""}
                ${options.input ? `<label class="field"><span>${escapeHtml(options.input.label)}</span><input name="value" type="text" autocomplete="off" maxlength="${options.input.maxLength ?? 80}" placeholder="${escapeHtml(options.input.placeholder ?? "")}" value="${escapeHtml(options.input.value ?? "")}"></label>` : ""}
                <footer class="modal-actions">
                    <button class="pill-button" type="button" data-action="cancel">${escapeHtml(options.cancelText ?? "\u53D6\u6D88")}</button>
                    <button class="pill-button ${options.danger ? "danger" : "primary"}" type="submit">${escapeHtml(options.confirmText ?? "\u786E\u5B9A")}</button>
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
    toast.className = `toast glass-panel app-notice is-${kind}`;
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
    menu.className = "context-menu glass-panel";
    menu.setAttribute("role", "menu");
    menu.innerHTML = items.map((item, index) => {
      if ("separator" in item) return "<hr>";
      if ("heading" in item) return `<span class="menu-heading">${escapeHtml(item.heading)}</span>`;
      return `<button type="button" role="menuitem" data-index="${index}" class="${item.danger ? "danger" : ""}">${item.icon ? `<i aria-hidden="true">${item.icon}</i>` : "<i></i>"}<span>${escapeHtml(item.label)}</span></button>`;
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
    const buttons = [...menu.querySelectorAll("button")];
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
  var layers, FOCUSABLE;
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
            <div class="backup-toast glass-panel" role="status">
                <span>\u5DF2\u7ECF\u4E00\u4E2A\u6708\u6CA1\u5907\u4EFD\u4E86\uFF0C\u5BFC\u51FA\u4E00\u4EFD\u4E66\u7B7E\u66F4\u5B89\u5FC3</span>
                <div class="backup-actions">
                    <button class="pill-button backup-later" type="button">\u7A0D\u540E</button>
                    <button class="pill-button primary backup-now" type="button">\u7ACB\u5373\u5BFC\u51FA</button>
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
  var icon, solid, ICONS, SETTINGS_GLYPHS;
  var init_icons = __esm({
    "src/components/icons.ts"() {
      "use strict";
      icon = (paths) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
      solid = (paths) => `<svg class="icon icon-solid" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
      ICONS = {
        settings: icon('<path d="M10.02 4.87L10.45 2.73A9.4 9.4 0 0 1 13.55 2.73L13.98 4.87A7.4 7.4 0 0 1 15.64 5.56L17.46 4.35A9.4 9.4 0 0 1 19.65 6.54L18.44 8.36A7.4 7.4 0 0 1 19.13 10.02L21.27 10.45A9.4 9.4 0 0 1 21.27 13.55L19.13 13.98A7.4 7.4 0 0 1 18.44 15.64L19.65 17.46A9.4 9.4 0 0 1 17.46 19.65L15.64 18.44A7.4 7.4 0 0 1 13.98 19.13L13.55 21.27A9.4 9.4 0 0 1 10.45 21.27L10.02 19.13A7.4 7.4 0 0 1 8.36 18.44L6.54 19.65A9.4 9.4 0 0 1 4.35 17.46L5.56 15.64A7.4 7.4 0 0 1 4.87 13.98L2.73 13.55A9.4 9.4 0 0 1 2.73 10.45L4.87 10.02A7.4 7.4 0 0 1 5.56 8.36L4.35 6.54A9.4 9.4 0 0 1 6.54 4.35L8.36 5.56A7.4 7.4 0 0 1 10.02 4.87Z"></path><circle cx="12" cy="12" r="3.1"></circle>'),
        shuffle: icon('<path d="M3 17h3.4c1.6 0 2.6-.7 3.5-2l4.2-6c.9-1.3 1.9-2 3.5-2H21"></path><path d="M3 7h3.4c1.6 0 2.6.7 3.5 2l.6.9M13.5 14.1l.6.9c.9 1.3 1.9 2 3.5 2H21"></path><path d="m18.5 4.5 2.5 2.5-2.5 2.5M18.5 14.5l2.5 2.5-2.5 2.5"></path>'),
        search: icon('<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path>'),
        plus: icon('<path d="M12 5v14M5 12h14"></path>'),
        folderPlus: icon('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2l2 2h7.8A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"></path><path d="M12 11v5M9.5 13.5h5"></path>'),
        more: icon('<circle cx="6" cy="12" r="1.2"></circle><circle cx="12" cy="12" r="1.2"></circle><circle cx="18" cy="12" r="1.2"></circle>'),
        edit: icon('<path d="M4 20h4L19 9l-4-4L4 16z"></path><path d="m13.5 6.5 4 4"></path>'),
        trash: icon('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"></path>'),
        open: icon('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path>'),
        move: icon('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2l2 2h7.8A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"></path><path d="M10 13.5h6M13.5 11l2.5 2.5-2.5 2.5"></path>'),
        download: icon('<path d="M12 4v12M7 11l5 5 5-5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"></path>'),
        pause: solid('<rect x="6" y="4.5" width="4" height="15" rx="1.3"></rect><rect x="14" y="4.5" width="4" height="15" rx="1.3"></rect>'),
        play: solid('<path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z"></path>'),
        speaker: icon('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"></path><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"></path>'),
        muted: icon('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"></path><path d="m16 9.5 5 5M21 9.5l-5 5"></path>'),
        battery: icon('<rect x="3" y="7.5" width="16" height="9" rx="2"></rect><path d="M21 11v2"></path>'),
        bolt: icon('<path d="m13 3-7 10h5l-1 8 7-10h-5z"></path>'),
        clock: icon('<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path>'),
        close: icon('<path d="M6 6l12 12M18 6 6 18"></path>')
      };
      SETTINGS_GLYPHS = {
        appearance: icon('<circle cx="12" cy="12" r="7.6"></circle><path class="icon-fill" d="M12 4.4a7.6 7.6 0 0 0 0 15.2z"></path>'),
        widgets: solid('<rect x="4.5" y="4.5" width="6.4" height="6.4" rx="1.8"></rect><rect x="13.1" y="4.5" width="6.4" height="6.4" rx="1.8"></rect><rect x="4.5" y="13.1" width="6.4" height="6.4" rx="1.8"></rect><rect x="13.1" y="13.1" width="6.4" height="6.4" rx="1.8"></rect>'),
        wallpaper: icon('<rect x="3.8" y="5.3" width="16.4" height="13.4" rx="2.8"></rect><path class="icon-fill" stroke="none" d="M5.6 16.9l4-4.9 2.9 3.2 2.1-2.2 3.8 3.9z"></path><circle class="icon-fill" stroke="none" cx="15.4" cy="9.4" r="1.5"></circle>'),
        data: icon('<path d="M3.8 12.6 6.2 6.5A2 2 0 0 1 8.1 5.2h7.8a2 2 0 0 1 1.9 1.3l2.4 6.1"></path><rect x="3.8" y="12.6" width="16.4" height="6.2" rx="2"></rect><circle class="icon-fill" stroke="none" cx="16.6" cy="15.7" r="1"></circle>')
      };
    }
  });

  // src/components/bookmark-actions.ts
  function folderLabel(folder) {
    return folder === ROOT_FOLDER ? "\u4E66\u7B7E" : folder;
  }
  function findBookmark(id) {
    return appStore.state.bookmarks.find((item) => String(item.id) === String(id));
  }
  function bookmarksIn(folder) {
    return appStore.state.bookmarks.filter((bookmark) => bookmark.folder === folder).sort(compareBookmarks);
  }
  function bookmarkName(bookmark) {
    const name = cleanText(bookmark.name, 160);
    return name && !isAddressLike(name) ? name : siteLabel(new URL(bookmark.url).hostname);
  }
  function interceptExtensionLink(event, url) {
    if (event.defaultPrevented || new URL(url).protocol !== "chrome-extension:") return;
    event.preventDefault();
    openInNewTab(url);
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
        ...destinations.map((folder) => ({ label: folderLabel(folder), icon: ICONS.move, action: () => void moveBookmark(bookmark.id, folder) }))
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
      body: count ? `\u5176\u4E2D\u7684 ${count} \u4E2A\u4E66\u7B7E\u4F1A\u79FB\u5230\u201C${folderLabel(ROOT_FOLDER)}\u201D\uFF0C\u4E0D\u4F1A\u88AB\u5220\u9664\u3002` : "\u8FD9\u4E2A\u6587\u4EF6\u5939\u662F\u7A7A\u7684\u3002",
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
  var init_bookmark_actions = __esm({
    "src/components/bookmark-actions.ts"() {
      "use strict";
      init_store();
      init_utils();
      init_icons();
      init_ui_layer();
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
      init_bookmark_actions();
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
        open({ bookmark, folder = ROOT_FOLDER, draft }) {
          this.close();
          const selected = bookmark?.folder ?? folder;
          const title = bookmark ? "\u7F16\u8F91\u4E66\u7B7E" : "\u6DFB\u52A0\u4E66\u7B7E";
          this.innerHTML = `
            <div class="modal-backdrop dialog-backdrop is-open">
                <form class="modal bookmark-dialog glass-panel" role="dialog" aria-modal="true" aria-label="${title}" novalidate>
                    <header class="modal-header">
                        <h2>${title}</h2>
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
                        <input name="name" type="text" maxlength="160" autocomplete="off" placeholder="\u7559\u7A7A\u5219\u4F7F\u7528\u7F51\u7AD9\u540D" value="${escapeHtml(bookmark?.name ?? draft?.name ?? "")}">
                    </label>
                    <label class="field">
                        <span>\u6587\u4EF6\u5939</span>
                        <span class="select-wrap"><select name="folder">${appStore.state.folders.map((item) => `<option value="${escapeHtml(item)}" ${item === selected ? "selected" : ""}>${escapeHtml(folderLabel(item))}</option>`).join("")}</select></span>
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
                        <button class="pill-button cancel-dialog" type="button">\u53D6\u6D88</button>
                        <button class="pill-button primary" type="submit">\u4FDD\u5B58</button>
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
              folder: String(data.get("folder") ?? ROOT_FOLDER),
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
    if (cleaned && cleaned.length <= 18 && !isAddressLike(cleaned)) return cleaned;
    return siteLabel(host);
  }
  function loadRecentSites() {
    if (!recentSites) {
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
      init_utils();
      recentSites = null;
    }
  });

  // src/components/site-icon.ts
  function siteIcon({ url, name, bookmark }, className, size) {
    const host = hostOf(url);
    const letter = Array.from(cleanDisplayName(name) || host || "?")[0]?.toUpperCase() ?? "?";
    const [from, to, ink] = TILE_COLORS[hash(host) % TILE_COLORS.length];
    const image = bookmark ? `<img src="${escapeHtml(bookmarkIcon(bookmark))}" srcset="${escapeHtml(bookmarkIconSrcSet(bookmark))}" sizes="${size}px" data-icon-fallback="${escapeHtml(bookmarkIconFallback(bookmark))}" data-icon-can-upgrade="${bookmarkIconCanUpgrade(bookmark)}" alt="" decoding="async" draggable="false">` : `<img src="${escapeHtml(faviconUrl(url))}" srcset="${escapeHtml(faviconSrcSet(url))}" sizes="${size}px" alt="" loading="lazy" decoding="async" draggable="false">`;
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

  // src/components/bookmark-index.ts
  var MIN_ROWS, ROW_HEIGHT, MAX_HEIGHT_SHARE, RECENT_LIMIT, ICON_SIZE, BookmarkIndex;
  var init_bookmark_index = __esm({
    "src/components/bookmark-index.ts"() {
      "use strict";
      init_history();
      init_store();
      init_utils();
      init_base();
      init_bookmark_actions();
      init_icons();
      init_site_icon();
      init_ui_layer();
      MIN_ROWS = 4;
      ROW_HEIGHT = 28;
      MAX_HEIGHT_SHARE = 0.4;
      RECENT_LIMIT = 8;
      ICON_SIZE = 16;
      BookmarkIndex = class extends StoreElement {
        observedChanges = ["bookmarks", "folders", "settings.layout"];
        draggingId = null;
        /** Refits when the footer gives the index a different width, e.g. once the pause button appears. */
        resizeObserver = new ResizeObserver(() => this.refit());
        /** The width and window height the rows were last fitted to. */
        fittedSize = "";
        recent = { sites: [], state: "idle", error: "" };
        connectedCallback() {
          this.addEventListener("click", this.onClick);
          this.addEventListener("contextmenu", this.onContextMenu);
          this.addEventListener("dragstart", this.onDragStart);
          this.addEventListener("dragover", this.onDragOver);
          this.addEventListener("dragleave", this.onDragLeave);
          this.addEventListener("drop", this.onDrop);
          this.addEventListener("dragend", this.onDragEnd);
          this.addEventListener("wheel", this.onWheel, { passive: false });
          window.addEventListener("resize", this.refit);
          this.resizeObserver.observe(this);
          super.connectedCallback();
        }
        disconnectedCallback() {
          super.disconnectedCallback();
          window.removeEventListener("resize", this.refit);
          this.resizeObserver.disconnect();
        }
        render() {
          const { showBookmarks, showRecent } = appStore.state.settings.layout;
          this.hidden = !showBookmarks;
          if (this.hidden) return;
          if (showRecent && this.recent.state === "idle") void this.loadRecent();
          const folders = appStore.state.folders.filter((folder) => folder !== ROOT_FOLDER);
          this.innerHTML = `
            <nav class="index" aria-label="\u4E66\u7B7E">
                ${this.groupTemplate(ROOT_FOLDER)}
                ${folders.map((folder) => this.groupTemplate(folder)).join("")}
                ${showRecent ? this.recentTemplate() : ""}
            </nav>`;
          bindSiteIcons(this);
          this.querySelector(".index")?.addEventListener("scroll", this.syncEdges, { passive: true });
          this.fit();
        }
        groupTemplate(folder) {
          const bookmarks = bookmarksIn(folder);
          const label = escapeHtml(folderLabel(folder));
          const empty = bookmarks.length ? "" : folder === ROOT_FOLDER && !appStore.state.bookmarks.length ? `<li><button class="index-link index-first" type="button" data-add-folder="${escapeHtml(folder)}">${ICONS.plus}\u6DFB\u52A0\u7B2C\u4E00\u4E2A\u4E66\u7B7E</button></li>` : '<li class="index-note">\u62D6\u4E66\u7B7E\u5230\u8FD9\u91CC</li>';
          return `
            <section class="index-group" data-folder="${escapeHtml(folder)}" aria-label="${label}">
                <h2 class="index-heading">
                    <span class="index-title">${label}</span>
                    <button class="index-action" type="button" data-add-folder="${escapeHtml(folder)}" aria-label="\u6DFB\u52A0\u4E66\u7B7E\u5230\u201C${label}\u201D" title="\u6DFB\u52A0\u4E66\u7B7E">${ICONS.plus}</button>
                    <button class="index-action index-more" type="button" aria-label="\u201C${label}\u201D\u7684\u66F4\u591A\u64CD\u4F5C" title="\u66F4\u591A\u64CD\u4F5C">${ICONS.more}</button>
                </h2>
                <ul class="index-list">
                    ${bookmarks.map((bookmark) => this.bookmarkTemplate(bookmark)).join("")}
                    ${empty}
                </ul>
            </section>`;
        }
        bookmarkTemplate(bookmark) {
          const name = bookmarkName(bookmark);
          return `
            <li><a class="index-link" href="${escapeHtml(bookmark.url)}" ${this.target()} rel="noopener noreferrer"
                data-bookmark-id="${escapeHtml(bookmark.id)}" draggable="true" title="${escapeHtml(name)}&#10;${escapeHtml(bookmark.url)}">
                ${siteIcon({ url: bookmark.url, name: bookmark.name, bookmark }, "index-icon", ICON_SIZE)}<span class="index-name">${escapeHtml(name)}</span>
            </a></li>`;
        }
        recentTemplate() {
          const { sites, state } = this.recent;
          const items = state === "ready" ? sites.slice(0, RECENT_LIMIT).map((site, index) => `
                <li><a class="index-link" href="${escapeHtml(site.url)}" ${this.target()} rel="noopener noreferrer" data-recent-index="${index}" title="${escapeHtml(hostOf(site.url))}">
                    ${siteIcon({ url: site.url, name: site.title }, "index-icon", ICON_SIZE)}<span class="index-name">${escapeHtml(site.title)}</span>
                </a></li>`).join("") : "";
          const note = state === "error" ? escapeHtml(this.recent.error) : state === "ready" && !items ? "\u6700\u8FD1 30 \u5929\u6CA1\u6709\u8BB0\u5F55" : state === "ready" ? "" : "\u6B63\u5728\u6574\u7406\u2026";
          return `
            <section class="index-group is-recent" aria-label="\u5E38\u8BBF\u95EE">
                <h2 class="index-heading"><span class="index-title">\u5E38\u8BBF\u95EE</span></h2>
                <ul class="index-list">${items}${note ? `<li class="index-note">${note}</li>` : ""}</ul>
            </section>`;
        }
        target() {
          return appStore.state.settings.layout.openInNewTab ? 'target="_blank"' : "";
        }
        sizeKey() {
          return `${this.getBoundingClientRect().width}x${window.innerHeight}`;
        }
        /** A window resize and the resize observer both land here; only a real size change refits. */
        refit = () => {
          if (this.sizeKey() !== this.fittedSize) this.fit();
        };
        /** Adds rows until every column fits the width, up to a share of the window; past that the index scrolls sideways. */
        fit() {
          const index = this.querySelector(".index");
          if (!index) return;
          this.fittedSize = this.sizeKey();
          const longest = Math.max(MIN_ROWS, ...[...index.querySelectorAll(".index-list")].map((list) => list.childElementCount));
          const maxRows = Math.min(longest, Math.max(MIN_ROWS, Math.floor(window.innerHeight * MAX_HEIGHT_SHARE / ROW_HEIGHT)));
          let rows = MIN_ROWS;
          index.style.setProperty("--rows", String(rows));
          while (rows < maxRows && index.scrollWidth > index.clientWidth + 1) {
            rows += 1;
            index.style.setProperty("--rows", String(rows));
          }
          this.syncEdges();
        }
        /** Fades only the edges that have columns scrolled past them. */
        syncEdges = () => {
          const index = this.querySelector(".index");
          if (!index) return;
          index.classList.toggle("can-scroll-left", index.scrollLeft > 1);
          index.classList.toggle("can-scroll-right", index.scrollLeft + index.clientWidth < index.scrollWidth - 1);
        };
        /** A mouse wheel scrolls an overflowing index sideways. */
        onWheel = (event) => {
          const index = this.querySelector(".index");
          if (!index || index.scrollWidth <= index.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
          event.preventDefault();
          index.scrollLeft += event.deltaY;
        };
        onClick = (event) => {
          const target = event.target;
          const add = target.closest("[data-add-folder]");
          if (add) {
            openBookmarkDialog(this, { folder: add.dataset.addFolder ?? ROOT_FOLDER });
            return;
          }
          const more = target.closest(".index-more");
          if (more) {
            this.openFolderMenu(more.closest(".index-group")?.dataset.folder ?? ROOT_FOLDER, more);
            return;
          }
          const link = target.closest("a.index-link");
          if (link) interceptExtensionLink(event, link.href);
        };
        onContextMenu = (event) => {
          const target = event.target;
          if (!target.closest(".index")) return;
          event.preventDefault();
          const link = target.closest(".index-link");
          const group2 = target.closest(".index-group");
          const at = event.clientX || event.clientY ? { x: event.clientX, y: event.clientY } : link ?? group2 ?? target;
          if (link?.dataset.recentIndex !== void 0) {
            const site = this.recent.sites[Number(link.dataset.recentIndex)];
            if (site) siteMenu(this, site, at);
            return;
          }
          const bookmark = link?.dataset.bookmarkId ? findBookmark(link.dataset.bookmarkId) : void 0;
          if (bookmark) bookmarkMenu(this, bookmark, at);
          else if (group2 && !group2.classList.contains("is-recent")) this.openFolderMenu(group2.dataset.folder ?? ROOT_FOLDER, at);
        };
        openFolderMenu(folder, at) {
          const add = { label: "\u6DFB\u52A0\u4E66\u7B7E\u2026", icon: ICONS.plus, action: () => openBookmarkDialog(this, { folder }) };
          const create = { label: "\u65B0\u5EFA\u6587\u4EF6\u5939\u2026", icon: ICONS.folderPlus, action: () => void createFolder() };
          if (folder === ROOT_FOLDER) {
            openMenu([add, create], at);
            return;
          }
          openMenu([
            add,
            { label: "\u91CD\u547D\u540D\u2026", icon: ICONS.edit, action: () => void renameFolder(folder) },
            create,
            { separator: true },
            { label: "\u5220\u9664\u6587\u4EF6\u5939", icon: ICONS.trash, danger: true, action: () => void deleteFolder(folder) }
          ], at);
        }
        onDragStart = (event) => {
          const link = event.target.closest("[data-bookmark-id]");
          if (!link) return;
          this.draggingId = link.dataset.bookmarkId ?? null;
          event.dataTransfer?.setData("text/plain", this.draggingId ?? "");
          if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
          link.classList.add("is-dragging");
          this.classList.add("is-dragging");
        };
        /** A bookmark under the pointer takes the drop (reorder); otherwise its whole folder group does (move). */
        onDragOver = (event) => {
          if (this.draggingId === null) return;
          const target = this.dropTarget(event);
          if (!target) return;
          event.preventDefault();
          if (target.classList.contains("drop-target")) return;
          this.clearDropTargets();
          target.classList.add("drop-target");
        };
        onDragLeave = (event) => {
          if (!this.contains(event.relatedTarget)) this.clearDropTargets();
        };
        onDrop = (event) => {
          const target = this.dropTarget(event);
          const id = event.dataTransfer?.getData("text/plain") || this.draggingId;
          this.clearDropTargets();
          if (!target || id === null) return;
          event.preventDefault();
          const folder = target.closest(".index-group")?.dataset.folder ?? ROOT_FOLDER;
          const before = target.dataset.bookmarkId;
          void moveBookmark(id, before ? findBookmark(before)?.folder ?? folder : folder, before);
        };
        onDragEnd = () => {
          this.draggingId = null;
          this.classList.remove("is-dragging");
          this.querySelectorAll(".is-dragging").forEach((item) => item.classList.remove("is-dragging"));
          this.clearDropTargets();
        };
        dropTarget(event) {
          const target = event.target;
          const link = target.closest("[data-bookmark-id]");
          if (link) return String(link.dataset.bookmarkId) === String(this.draggingId) ? null : link;
          return target.closest(".index-group[data-folder]");
        }
        clearDropTargets() {
          this.querySelectorAll(".drop-target").forEach((item) => item.classList.remove("drop-target"));
        }
        async loadRecent() {
          this.recent = { ...this.recent, state: "loading", error: "" };
          try {
            this.recent = { sites: await loadRecentSites(), state: "ready", error: "" };
          } catch (error) {
            this.recent = { sites: [], state: "error", error: error instanceof Error && error.message ? error.message : "\u8BFB\u53D6\u6D4F\u89C8\u8BB0\u5F55\u5931\u8D25" };
          }
          if (this.isConnected) this.render();
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
          document.addEventListener("visibilitychange", this.onVisibility);
        }
        disconnectedCallback() {
          super.disconnectedCallback();
          window.clearTimeout(this.clockTimer);
          document.removeEventListener("visibilitychange", this.onVisibility);
        }
        /** Background tabs and sleep delay timers, so a tab coming back corrects the time at once. */
        onVisibility = () => {
          if (document.visibilityState !== "visible") return;
          this.updateClock();
          this.scheduleTick();
        };
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

  // src/components/hdr-glass.ts
  function isHdrDisplay() {
    return hdrMedia.matches;
  }
  function onHdrDisplayChange(listener) {
    hdrMedia.addEventListener("change", listener);
    return () => hdrMedia.removeEventListener("change", listener);
  }
  var MAX_RIMS, PEAK, MAX_PIXELS, FRAME_FLOATS, RIM_FLOATS, HDR_SHADER, hdrMedia, HdrRimLayer;
  var init_hdr_glass = __esm({
    "src/components/hdr-glass.ts"() {
      "use strict";
      MAX_RIMS = 16;
      PEAK = 2.2;
      MAX_PIXELS = 3840 * 2400;
      FRAME_FLOATS = 8;
      RIM_FLOATS = 8;
      HDR_SHADER = `
struct Frame {
    pointer: vec2f,
    count: f32,
    scale: f32,
    peak: f32,
    unused0: f32,
    unused1: f32,
    unused2: f32,
}

struct Rim {
    rect: vec4f,
    shape: vec4f,
}

@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<uniform> rims: array<Rim, ${MAX_RIMS}>;

@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    var positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
    return vec4f(positions[index], 0.0, 1.0);
}

fn roundedRect(point: vec2f, half: vec2f, radius: f32) -> f32 {
    let corner = abs(point) - half + vec2f(radius);
    return length(max(corner, vec2f(0.0))) + min(max(corner.x, corner.y), 0.0) - radius;
}

@fragment
fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
    let point = position.xy / frame.scale;
    let pixel = 1.0 / frame.scale;
    let light = normalize(vec2f(-0.55, -0.85));
    var radiance = 0.0;
    var coverage = 0.0;
    for (var index = 0u; index < u32(frame.count); index = index + 1u) {
        let rim = rims[index];
        let half = rim.rect.zw * 0.5;
        let local = point - rim.rect.xy - half;
        let radius = min(rim.shape.x, min(half.x, half.y));
        let distance = roundedRect(local, half, radius);
        if (distance > pixel || distance < -4.0) {
            continue;
        }
        // A 1.25 px band just inside the edge, anti-aliased to the device pixel on both sides.
        let band = smoothstep(-1.25 - pixel, -1.25, distance) * (1.0 - smoothstep(-pixel, pixel * 0.5, distance));
        let step = 0.5;
        let normal = normalize(vec2f(
            roundedRect(local + vec2f(step, 0.0), half, radius) - roundedRect(local - vec2f(step, 0.0), half, radius),
            roundedRect(local + vec2f(0.0, step), half, radius) - roundedRect(local - vec2f(0.0, step), half, radius)
        ));
        let facing = max(dot(normal, light), 0.0);
        let away = max(-dot(normal, light), 0.0);
        let toPointer = point - frame.pointer;
        let glint = rim.shape.z * exp(-dot(toPointer, toPointer) / 1800.0);
        let brightness = 0.12 + pow(facing, 2.0) * 0.6 + pow(away, 3.0) * 0.18 + glint * 1.3;
        radiance = radiance + band * brightness * rim.shape.y;
        coverage = max(coverage, band * rim.shape.y);
    }
    // Premultiplied light that may exceed its alpha: it adds to what is below, past SDR white on HDR screens.
    return vec4f(vec3f(radiance * frame.peak), coverage * 0.3);
}`;
      hdrMedia = window.matchMedia("(dynamic-range: high)");
      HdrRimLayer = class {
        /** `onActivate` runs whenever the layer starts drawing, so its owner can measure the rims for it. */
        constructor(onActivate = () => void 0) {
          this.onActivate = onActivate;
          this.canvas.className = "hdr-glass-layer";
          this.canvas.setAttribute("aria-hidden", "true");
        }
        onActivate;
        canvas = document.createElement("canvas");
        device = null;
        context = null;
        pipeline = null;
        frameBuffer = null;
        rimBuffer = null;
        bindGroup = null;
        rims = [];
        pointer = { x: -1e4, y: -1e4 };
        initializing = false;
        drawFrame = 0;
        stopWatchingDisplay = null;
        classObserver = new MutationObserver(() => this.syncVisibility());
        /** Ready to draw: HDR screen, the setting on and a WebGPU device. */
        get active() {
          return Boolean(this.device) && isHdrDisplay() && document.body.classList.contains("hdr-highlights");
        }
        connect() {
          this.classObserver.observe(document.body, { attributeFilter: ["class"] });
          this.stopWatchingDisplay = onHdrDisplayChange(this.onDisplayChange);
          window.addEventListener("resize", this.onResize);
          this.onResize();
          void this.initialize();
        }
        disconnect() {
          this.classObserver.disconnect();
          this.stopWatchingDisplay?.();
          this.stopWatchingDisplay = null;
          window.removeEventListener("resize", this.onResize);
          cancelAnimationFrame(this.drawFrame);
          this.drawFrame = 0;
          this.device?.destroy?.();
          this.device = null;
          this.canvas.classList.remove("is-visible");
        }
        update(rims, pointer) {
          this.rims = rims.slice(0, MAX_RIMS);
          this.pointer = pointer;
          this.canvas.dataset.hdrCount = String(this.rims.length);
          this.scheduleDraw();
        }
        onDisplayChange = () => {
          if (isHdrDisplay()) void this.initialize();
          this.syncVisibility();
        };
        onResize = () => {
          const ratio = Math.max(1, window.devicePixelRatio || 1);
          const scale = Math.min(ratio, Math.sqrt(MAX_PIXELS / Math.max(1, innerWidth * innerHeight)));
          this.canvas.width = Math.max(1, Math.round(innerWidth * scale));
          this.canvas.height = Math.max(1, Math.round(innerHeight * scale));
          this.scheduleDraw();
        };
        async initialize() {
          if (this.device || this.initializing || !isHdrDisplay()) return;
          if (!("gpu" in navigator)) {
            this.canvas.dataset.hdrRenderer = "unavailable";
            return;
          }
          this.initializing = true;
          try {
            const gpu = navigator.gpu;
            const adapter = await gpu?.requestAdapter();
            if (!adapter) {
              this.canvas.dataset.hdrRenderer = "unavailable";
              return;
            }
            const device = await adapter.requestDevice();
            const context = this.canvas.getContext("webgpu");
            if (!context) {
              this.canvas.dataset.hdrRenderer = "unavailable";
              return;
            }
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
                targets: [{ format: "rgba16float" }]
              },
              primitive: { topology: "triangle-list" }
            });
            const frameBuffer = device.createBuffer({ size: FRAME_FLOATS * 4, usage: 64 | 8 });
            const rimBuffer = device.createBuffer({ size: MAX_RIMS * RIM_FLOATS * 4, usage: 64 | 8 });
            this.bindGroup = device.createBindGroup({
              layout: pipeline.getBindGroupLayout(0),
              entries: [
                { binding: 0, resource: { buffer: frameBuffer } },
                { binding: 1, resource: { buffer: rimBuffer } }
              ]
            });
            this.device = device;
            this.context = context;
            this.pipeline = pipeline;
            this.frameBuffer = frameBuffer;
            this.rimBuffer = rimBuffer;
            this.canvas.dataset.hdrRenderer = "webgpu";
            void device.lost.then(() => {
              this.device = null;
              this.canvas.dataset.hdrRenderer = "lost";
              this.syncVisibility();
            });
            this.syncVisibility();
          } catch {
            this.canvas.dataset.hdrRenderer = "unavailable";
          } finally {
            this.initializing = false;
          }
        }
        syncVisibility() {
          const active = this.active;
          const activated = active && !this.canvas.classList.contains("is-visible");
          this.canvas.classList.toggle("is-visible", active);
          if (!active) return;
          this.scheduleDraw();
          if (activated) this.onActivate();
        }
        scheduleDraw() {
          if (this.drawFrame || !this.active) return;
          this.drawFrame = requestAnimationFrame(() => {
            this.drawFrame = 0;
            this.draw();
          });
        }
        draw() {
          if (!this.active) return;
          const scale = this.canvas.width / Math.max(1, innerWidth);
          this.device.queue.writeBuffer(this.frameBuffer, 0, new Float32Array([
            this.pointer.x,
            this.pointer.y,
            this.rims.length,
            scale,
            PEAK,
            0,
            0,
            0
          ]));
          const rims = new Float32Array(MAX_RIMS * RIM_FLOATS);
          this.rims.forEach((rim, index) => rims.set(
            [rim.x, rim.y, rim.width, rim.height, rim.radius, rim.opacity, rim.glint, 0],
            index * RIM_FLOATS
          ));
          this.device.queue.writeBuffer(this.rimBuffer, 0, rims);
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
  function createRefractionMap(shape) {
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const radius = clamp(shape.radius, 2, Math.min(shape.width, shape.height) / 2);
    const bezelWidth = Math.max(2, radius * 0.75);
    const displacements = precalculateDisplacements();
    const maximumDisplacement = Math.max(...displacements.map(Math.abs));
    return {
      displacement: imageDataUrl(createDisplacementMap(
        shape.width,
        shape.height,
        radius,
        bezelWidth,
        maximumDisplacement,
        displacements,
        pixelRatio
      )),
      maximumDisplacement
    };
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
  var REFRACTIVE_INDEX, RADIAL_SAMPLE_COUNT, DISTANCE_TO_BACKDROP, GLASS_THICKNESS;
  var init_liquid_optics = __esm({
    "src/components/liquid-optics.ts"() {
      "use strict";
      REFRACTIVE_INDEX = 1.5;
      RADIAL_SAMPLE_COUNT = 128;
      DISTANCE_TO_BACKDROP = 55;
      GLASS_THICKNESS = 63;
    }
  });

  // src/components/glass.ts
  function measure(element) {
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1 || rect.bottom < 0 || rect.top > innerHeight) return null;
    let opacity = 1;
    for (let node = element; node && opacity > 0.02; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.visibility === "hidden" || style.display === "none") return null;
      opacity *= Number(style.opacity);
    }
    if (opacity <= 0.02) return null;
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (!top || !(element.contains(top) || top.contains(element))) return null;
    const scale = rect.width / Math.max(1, element.offsetWidth);
    const radius = cornerRadius(getComputedStyle(element).borderTopLeftRadius, element.offsetWidth, element.offsetHeight) * scale;
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height, radius, opacity, glint: 0 };
  }
  function cornerRadius(value, width, height) {
    const radius = value.endsWith("%") ? Math.min(width, height) * Number.parseFloat(value) / 100 : Number.parseFloat(value) || 0;
    return Math.min(radius, width / 2, height / 2);
  }
  var GLASS_SELECTOR, REFRACTION, FROST, SATURATION, SETTLE_MS, GlassSystem;
  var init_glass = __esm({
    "src/components/glass.ts"() {
      "use strict";
      init_hdr_glass();
      init_liquid_optics();
      GLASS_SELECTOR = "[data-glass]";
      REFRACTION = 0.5;
      FROST = 1.2;
      SATURATION = 1.6;
      SETTLE_MS = 700;
      GlassSystem = class extends HTMLElement {
        defs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        /** Filters by shape, removed again once no control has that shape. */
        filters = /* @__PURE__ */ new Map();
        tracked = /* @__PURE__ */ new Map();
        hdr = new HdrRimLayer(() => this.wake());
        resizeObserver = new ResizeObserver((entries) => {
          entries.forEach((entry) => this.refract(entry.target));
          this.wake();
        });
        /** Added or removed controls are picked up here; class and visibility changes only re-measure. */
        mutationObserver = new MutationObserver((records) => {
          if (records.some((record) => record.type === "childList")) this.scan();
          this.wake();
        });
        hovered = null;
        pointer = { x: -1e4, y: -1e4 };
        smoothPointer = { x: -1e4, y: -1e4 };
        /** Until then the pointer light keeps easing. */
        settleUntil = 0;
        /** Until then every frame re-measures where the controls are. */
        measureUntil = 0;
        frame = 0;
        nextFilterId = 1;
        connectedCallback() {
          this.defs.classList.add("glass-filters");
          this.defs.setAttribute("aria-hidden", "true");
          this.defs.innerHTML = "<defs></defs>";
          this.append(this.defs, this.hdr.canvas);
          this.hdr.connect();
          this.scan();
          this.mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
          document.addEventListener("pointermove", this.onPointerMove, { passive: true, capture: true });
          document.addEventListener("pointerdown", this.wake, { passive: true, capture: true });
          document.addEventListener("pointerup", this.wake, { passive: true, capture: true });
          document.addEventListener("pointerleave", this.onPointerLeave);
          window.addEventListener("scroll", this.wake, { passive: true, capture: true });
          window.addEventListener("resize", this.wake);
          this.wake();
        }
        disconnectedCallback() {
          this.resizeObserver.disconnect();
          this.mutationObserver.disconnect();
          document.removeEventListener("pointermove", this.onPointerMove, true);
          document.removeEventListener("pointerdown", this.wake, true);
          document.removeEventListener("pointerup", this.wake, true);
          document.removeEventListener("pointerleave", this.onPointerLeave);
          window.removeEventListener("scroll", this.wake, true);
          window.removeEventListener("resize", this.wake);
          cancelAnimationFrame(this.frame);
          this.frame = 0;
          this.hdr.disconnect();
        }
        /** Picks up glass controls added since the last look and forgets removed ones. */
        scan() {
          document.querySelectorAll(GLASS_SELECTOR).forEach((element) => {
            if (this.tracked.has(element)) return;
            this.tracked.set(element, { shapeKey: "", glint: 0 });
            this.resizeObserver.observe(element);
          });
          this.tracked.forEach((state, element) => {
            if (element.isConnected) return;
            this.tracked.delete(element);
            this.resizeObserver.unobserve(element);
            this.release(state.shapeKey);
          });
        }
        /** Points the control's backdrop at a filter built for its exact size and corner radius. */
        refract(element) {
          const state = this.tracked.get(element);
          const width = element.offsetWidth;
          const height = element.offsetHeight;
          if (!state || !width || !height) return;
          const radius = cornerRadius(getComputedStyle(element).borderTopLeftRadius, width, height);
          const shape = { width, height, radius };
          const key = opticalShapeKey(shape);
          if (state.shapeKey === key) return;
          const filter = this.filters.get(key) ?? this.createFilter(shape, key);
          filter.uses += 1;
          this.release(state.shapeKey);
          state.shapeKey = key;
          element.style.setProperty("--glass-backdrop", `url("#${filter.id}") saturate(${SATURATION}) brightness(1.04)`);
          element.dataset.glassFilter = filter.id;
        }
        createFilter(shape, key) {
          const map = createRefractionMap(shape);
          const id = `glass-refraction-${this.nextFilterId++}`;
          const bend = Math.min(map.maximumDisplacement, shape.radius * 3) * REFRACTION;
          this.defs.firstElementChild.insertAdjacentHTML("beforeend", `
            <filter id="${id}" color-interpolation-filters="sRGB" data-shape="${key}">
                <feGaussianBlur in="SourceGraphic" stdDeviation="${FROST}" result="frost"></feGaussianBlur>
                <feImage href="${map.displacement}" x="0" y="0" width="${shape.width}" height="${shape.height}" preserveAspectRatio="none" result="bend"></feImage>
                <feDisplacementMap in="frost" in2="bend" scale="${bend.toFixed(2)}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>
            </filter>`);
          const filter = { id, element: this.defs.firstElementChild.lastElementChild, uses: 0 };
          this.filters.set(key, filter);
          return filter;
        }
        /** Drops a filter (and its displacement map) once no control uses its shape. */
        release(key) {
          const filter = key ? this.filters.get(key) : void 0;
          if (!filter) return;
          filter.uses -= 1;
          if (filter.uses > 0) return;
          filter.element.remove();
          this.filters.delete(key);
        }
        onPointerMove = (event) => {
          this.pointer = { x: event.clientX, y: event.clientY };
          const element = event.target instanceof Element ? event.target.closest(GLASS_SELECTOR) : null;
          if (element !== this.hovered) {
            this.hovered = element;
            if (this.smoothPointer.x < -1e3) this.smoothPointer = { ...this.pointer };
            this.wake();
          }
          if (element) {
            const rect = element.getBoundingClientRect();
            element.style.setProperty("--glint-x", `${event.clientX - rect.left}px`);
            element.style.setProperty("--glint-y", `${event.clientY - rect.top}px`);
          }
          this.ease();
        };
        onPointerLeave = () => {
          this.hovered = null;
          this.wake();
        };
        /** The layout may have changed: re-measure for a moment; the loop stops by itself once nothing moves. */
        wake = () => {
          this.measureUntil = performance.now() + SETTLE_MS;
          this.ease();
        };
        /** Only the pointer moved: the light eases towards it over rims already measured. */
        ease() {
          this.settleUntil = performance.now() + SETTLE_MS;
          if (!this.frame) this.frame = requestAnimationFrame(this.tick);
        }
        tick = (time) => {
          this.frame = 0;
          if (!this.hdr.active) return;
          this.smoothPointer.x += (this.pointer.x - this.smoothPointer.x) * 0.35;
          this.smoothPointer.y += (this.pointer.y - this.smoothPointer.y) * 0.35;
          let moving = Math.abs(this.pointer.x - this.smoothPointer.x) + Math.abs(this.pointer.y - this.smoothPointer.y) > 0.5;
          const remeasure = time < this.measureUntil;
          const rims = [];
          this.tracked.forEach((state, element) => {
            const target = element === this.hovered ? 1 : 0;
            state.glint += (target - state.glint) * 0.2;
            if (Math.abs(target - state.glint) > 0.01) moving = true;
            if (rims.length >= MAX_RIMS) return;
            if (remeasure || state.rim === void 0) state.rim = measure(element);
            if (state.rim) rims.push({ ...state.rim, glint: state.glint });
          });
          this.hdr.update(rims, this.smoothPointer);
          if (moving || time < this.settleUntil || remeasure) this.frame = requestAnimationFrame(this.tick);
        };
      };
    }
  });

  // src/components/search-box.ts
  function siteRow(site) {
    return { kind: "site", title: site.title, subtitle: `${site.host} \xB7 \u8FD1 30 \u5929 ${site.count} \u6B21`, url: site.url };
  }
  function rowIcon(row) {
    if (row.kind === "web") return `<span class="row-icon row-icon-plain">${ICONS.search}</span>`;
    if (row.kind === "recent") return `<span class="row-icon row-icon-plain">${ICONS.clock}</span>`;
    if (row.kind === "url") return `<span class="row-icon row-icon-plain">${ICONS.open}</span>`;
    if (row.kind === "bookmark") return siteIcon({ url: row.url, name: row.title, bookmark: row.bookmark }, "row-icon", ROW_ICON_SIZE);
    return siteIcon({ url: row.url, name: row.title }, "row-icon", ROW_ICON_SIZE);
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
    return /^[a-z][a-z\d+.-]*:\/\//i.test(value) || /^localhost(:\d+)?(\/|$)/i.test(value) || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/\S*)?$/.test(value) || /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(value);
  }
  var ENGINES, SHORTCUT_LABEL, ENGINE_ORDER, GROUP_TITLES, ROW_ICON_SIZE, SearchBox;
  var init_search_box = __esm({
    "src/components/search-box.ts"() {
      "use strict";
      init_history();
      init_store();
      init_utils();
      init_bookmark_actions();
      init_base();
      init_icons();
      init_site_icon();
      ENGINES = {
        google: { label: "Google", url: "https://www.google.com/search?q=" },
        bing: { label: "Bing", url: "https://www.bing.com/search?q=" },
        baidu: { label: "\u767E\u5EA6", url: "https://www.baidu.com/s?wd=" },
        duckduckgo: { label: "DuckDuckGo", url: "https://duckduckgo.com/?q=" }
      };
      SHORTCUT_LABEL = /Mac|iPhone|iPad/.test(navigator.platform) ? "\u2318K" : "Ctrl K";
      ENGINE_ORDER = Object.keys(ENGINES);
      GROUP_TITLES = { url: "\u7F51\u5740", bookmark: "\u4E66\u7B7E", site: "\u5E38\u8BBF\u95EE", web: "\u641C\u7D22\u7F51\u7EDC", recent: "\u6700\u8FD1\u641C\u7D22" };
      ROW_ICON_SIZE = 20;
      SearchBox = class extends StoreElement {
        observedChanges = ["settings.layout"];
        engine = "google";
        rows = [];
        selected = 0;
        sites = [];
        /** Shown by the keyboard shortcut while the setting keeps the field hidden. */
        summoned = false;
        render() {
          const { showSearch } = appStore.state.settings.layout;
          this.hidden = !showSearch && !this.summoned;
          if (this.querySelector(".search-field")) return;
          this.innerHTML = `
            <div class="search-box" role="search">
                <label class="glass search-field" data-glass>
                    ${ICONS.search}
                    <span class="search-input">
                        <span class="search-ghost" aria-hidden="true"><span class="ghost-typed"></span><span class="ghost-rest"></span></span>
                        <input type="text" autocomplete="off" spellcheck="false" placeholder="\u641C\u7D22\u6216\u8F93\u5165\u7F51\u5740" aria-label="\u641C\u7D22\u6216\u8F93\u5165\u7F51\u5740"
                            role="combobox" aria-expanded="false" aria-controls="search-results" aria-autocomplete="list"
                            aria-keyshortcuts="${SHORTCUT_LABEL === "\u2318K" ? "Meta+K" : "Control+K"} /">
                    </span>
                    <button class="search-engine" type="button" tabindex="-1" title="\u5207\u6362\u641C\u7D22\u5F15\u64CE\uFF08Tab\uFF09"></button>
                    <kbd class="search-shortcut">${SHORTCUT_LABEL}</kbd>
                </label>
                <div class="glass-panel search-results" id="search-results" role="listbox" aria-label="\u641C\u7D22\u5EFA\u8BAE" hidden></div>
            </div>`;
          this.bind();
        }
        /** Puts the caret in the field, showing it first when the setting hides it. */
        focusField() {
          if (this.hidden) {
            this.summoned = true;
            this.hidden = false;
          }
          this.input.focus();
        }
        get hasFocus() {
          return this.contains(document.activeElement);
        }
        get input() {
          return this.querySelector(".search-field input");
        }
        get results() {
          return this.querySelector(".search-results");
        }
        bind() {
          const input = this.input;
          input.addEventListener("focus", this.onFocus);
          input.addEventListener("input", () => {
            this.selected = 0;
            this.renderResults();
          });
          input.addEventListener("keydown", this.onKeyDown);
          this.addEventListener("focusout", (event) => {
            if (this.contains(event.relatedTarget)) return;
            this.closeResults();
            if (this.summoned && !input.value) {
              this.summoned = false;
              this.render();
            }
          });
          this.results.addEventListener("pointerdown", (event) => event.preventDefault());
          this.results.addEventListener("click", (event) => {
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
          this.results.addEventListener("pointermove", (event) => {
            const row = event.target.closest("[data-index]");
            const index = row ? Number(row.dataset.index) : -1;
            if (index >= 0 && index !== this.selected) this.select(index);
          });
          const engine = this.querySelector(".search-engine");
          engine.addEventListener("pointerdown", (event) => event.preventDefault());
          engine.addEventListener("click", () => this.cycleEngine(1));
        }
        onFocus = () => {
          this.engine = appStore.state.settings.layout.searchEngine;
          this.selected = 0;
          this.renderResults();
          if (!appStore.state.settings.layout.showRecent || this.sites.length) return;
          void loadRecentSites().then((sites) => {
            this.sites = sites;
            if (this.hasFocus) this.renderResults();
          }).catch(() => void 0);
        };
        onKeyDown = (event) => {
          if (event.isComposing) return;
          const input = this.input;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (this.rows.length) this.select((this.selected + (event.key === "ArrowDown" ? 1 : -1) + this.rows.length) % this.rows.length);
          } else if (event.key === "Enter") {
            event.preventDefault();
            this.activate(this.selected, event.metaKey || event.ctrlKey);
          } else if (event.key === "Tab" && !event.shiftKey && input.value.trim()) {
            event.preventDefault();
            this.cycleEngine(1);
          } else if (event.key === "ArrowRight" && this.ghostRest() && input.selectionStart === input.value.length) {
            event.preventDefault();
            input.value += this.ghostRest();
            this.selected = 0;
            this.renderResults();
          } else if (event.key === "Escape") {
            event.preventDefault();
            if (input.value) {
              input.value = "";
              this.renderResults();
            } else {
              input.blur();
            }
          }
        };
        buildRows() {
          const raw = this.input.value.trim();
          const query = raw.toLowerCase();
          const rows = [];
          const engine = ENGINES[this.engine].label;
          const showSites = appStore.state.settings.layout.showRecent;
          if (!query) {
            if (showSites) this.sites.slice(0, 4).forEach((site) => rows.push(siteRow(site)));
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
            subtitle: `${hostOf(bookmark.url)}${bookmark.folder !== ROOT_FOLDER ? ` \xB7 ${folderLabel(bookmark.folder)}` : ""}`,
            url: bookmark.url,
            bookmark
          }));
          if (showSites) {
            const bookmarkedHosts = new Set(bookmarks.map(({ bookmark }) => hostOf(bookmark.url)));
            this.sites.filter((site) => !bookmarkedHosts.has(site.host) && matchScore(query, site.title, site.url) > 0).slice(0, 3).forEach((site) => rows.push(siteRow(site)));
          }
          rows.push({ kind: "web", title: raw, subtitle: `\u5728 ${engine} \u4E2D\u641C\u7D22`, query: raw });
          appStore.state.recentSearches.filter((item) => item.toLowerCase().includes(query) && item.toLowerCase() !== query).slice(0, 4).forEach((item) => rows.push({ kind: "recent", title: item, subtitle: "", query: item }));
          return rows;
        }
        renderResults() {
          if (!this.hasFocus) return;
          this.rows = this.buildRows();
          this.selected = Math.min(this.selected, Math.max(0, this.rows.length - 1));
          let previous = "";
          this.results.innerHTML = this.rows.map((row, index) => {
            const heading = row.kind !== previous ? `<h3 class="search-heading" role="presentation">${GROUP_TITLES[row.kind]}</h3>` : "";
            previous = row.kind;
            return `${heading}
                <div class="search-row" role="option" id="search-option-${index}" data-index="${index}" aria-selected="false">
                    ${rowIcon(row)}
                    <span class="row-text"><strong>${escapeHtml(row.title)}</strong>${row.subtitle ? `<small>${escapeHtml(row.subtitle)}</small>` : ""}</span>
                    ${row.kind === "recent" ? '<button class="row-remove" type="button" tabindex="-1" aria-label="\u5220\u9664\u8FD9\u6761\u8BB0\u5F55">\u5220\u9664</button>' : ""}
                </div>`;
          }).join("");
          this.results.hidden = !this.rows.length;
          this.input.setAttribute("aria-expanded", String(!this.results.hidden));
          this.classList.toggle("is-open", !this.results.hidden);
          bindSiteIcons(this.results);
          this.syncEngine();
          this.select(this.selected);
        }
        closeResults() {
          this.results.hidden = true;
          this.classList.remove("is-open");
          this.input.setAttribute("aria-expanded", "false");
          this.input.removeAttribute("aria-activedescendant");
          this.querySelector(".ghost-typed").textContent = "";
          this.querySelector(".ghost-rest").textContent = "";
        }
        select(index) {
          this.selected = index;
          this.results.querySelectorAll(".search-row").forEach((row) => {
            const active = Number(row.dataset.index) === index;
            row.classList.toggle("is-selected", active);
            row.setAttribute("aria-selected", String(active));
            if (active) row.scrollIntoView({ block: "nearest" });
          });
          if (this.rows[index]) this.input.setAttribute("aria-activedescendant", `search-option-${index}`);
          else this.input.removeAttribute("aria-activedescendant");
          const rest = this.ghostRest();
          this.querySelector(".ghost-typed").textContent = rest ? this.input.value : "";
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
            if (query) this.search(query, background);
            return;
          }
          if (row.kind === "web" || row.kind === "recent") {
            this.search(row.query, background);
            return;
          }
          this.go(row.url, background || appStore.state.settings.layout.openInNewTab || new URL(row.url).protocol === "chrome-extension:");
        }
        /** ⌘/Ctrl+Enter or ⌘/Ctrl-click opens the result in a background tab and keeps this page. */
        go(url, newTab) {
          if (!newTab) {
            window.location.href = url;
            return;
          }
          openInNewTab(url);
          this.input.value = "";
          this.input.blur();
        }
        /** A failed save of the recent search never stops the search itself. */
        search(query, newTab = false) {
          const target = `${ENGINES[this.engine].url}${encodeURIComponent(query)}`;
          const save = appStore.state.settings.layout.saveSearches ? appStore.saveRecentSearch(query) : Promise.resolve();
          void save.catch(() => void 0).then(() => this.go(target, newTab));
        }
        cycleEngine(step) {
          const index = ENGINE_ORDER.indexOf(this.engine);
          this.engine = ENGINE_ORDER[(index + step + ENGINE_ORDER.length) % ENGINE_ORDER.length];
          this.renderResults();
        }
        syncEngine() {
          const button = this.querySelector(".search-engine");
          button.textContent = ENGINES[this.engine].label;
          button.setAttribute("aria-label", `\u641C\u7D22\u5F15\u64CE\uFF1A${ENGINES[this.engine].label}\uFF0C\u70B9\u6309\u6216\u6309 Tab \u5207\u6362`);
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
  function infoRow(label, sub, control) {
    return `<div class="setting-row">${rowLabel(label, sub)}${control}</div>`;
  }
  function segmentRow(name, label, value, options, sub = "", kind = "radio") {
    const radio = kind === "radio";
    return `
        <div class="setting-row segment-row">
            <span class="row-label"><span class="row-title" id="segment-${name}">${label}</span>${sub ? `<span class="row-sub">${sub}</span>` : ""}</span>
            <div class="segmented" role="${radio ? "radiogroup" : "group"}" aria-labelledby="segment-${name}" data-segment="${name}" data-kind="${kind}">
                ${options.map(([optionValue, optionLabel], index) => {
      const checked = optionValue === value;
      const focusable = checked || index === 0 && !options.some(([option]) => option === value);
      const state = radio ? `role="radio" aria-checked="${checked}"` : `aria-pressed="${checked}"`;
      return `<button type="button" ${state} tabindex="${focusable ? 0 : -1}" class="${checked ? "is-active" : ""}" data-value="${optionValue}">${escapeHtml(optionLabel)}</button>`;
    }).join("")}
            </div>
        </div>`;
  }
  function toggleRow(name, label, sub = "") {
    return `<label class="setting-row toggle-row">${rowLabel(label, sub)}<span class="switch"><input type="checkbox" role="switch" data-toggle="${name}"><span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span></span></label>`;
  }
  function rangeRow(name, label, value, min, max, unit, sub = "") {
    return `
        <div class="setting-row">
            ${rowLabel(label, sub)}
            <span class="range-control">
                <input class="slider" type="range" name="${name}" min="${min}" max="${max}" value="${value}" data-unit="${unit}" aria-label="${label}">
                <output>${value}${unit}</output>
            </span>
        </div>`;
  }
  function syncSlider(input) {
    const minimum = Number(input.min) || 0;
    const maximum = Number(input.max) || 100;
    const progress = maximum === minimum ? 0 : (Number(input.value) - minimum) / (maximum - minimum);
    input.style.setProperty("--progress", `${Math.max(0, Math.min(1, progress)) * 100}%`);
  }
  function wallpaperKind({ type, value }) {
    if (type === "video") return "video";
    if (type === "local") return value.startsWith("online") ? "online" : "image";
    return "";
  }
  function hdrDescription() {
    if (!isHdrDisplay()) return "\u5F53\u524D\u4E3A SDR \u5C4F\u5E55\uFF0C\u8FDE\u63A5 HDR \u5C4F\u5E55\u540E\u81EA\u52A8\u751F\u6548";
    const renderer = document.querySelector(".hdr-glass-layer")?.dataset.hdrRenderer;
    if (renderer === "webgpu") return "\u5F53\u524D\u5C4F\u5E55\u652F\u6301 HDR \xB7 WebGPU \u5DF2\u542F\u7528";
    if (renderer === "unavailable" || renderer === "lost") return "\u5F53\u524D\u5C4F\u5E55\u652F\u6301 HDR \xB7 \u6D4F\u89C8\u5668\u672A\u5F00\u653E WebGPU \u9AD8\u5149";
    return "\u5F53\u524D\u5C4F\u5E55\u652F\u6301 HDR";
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
  var PASTE_LABEL, PANES, SettingsPanel;
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
      init_hdr_glass();
      init_icons();
      init_search_box();
      init_ui_layer();
      PASTE_LABEL = SHORTCUT_LABEL === "\u2318K" ? "\u2318V" : "Ctrl+V";
      PANES = [
        ["appearance", "\u5916\u89C2"],
        ["widgets", "\u7EC4\u4EF6"],
        ["wallpaper", "\u58C1\u7EB8"],
        ["data", "\u6570\u636E"]
      ];
      SettingsPanel = class extends StoreElement {
        observedChanges = ["settings.appearance", "settings.wallpaper", "settings.layout", "bookmarks", "folders"];
        openState = false;
        activePane = "appearance";
        releaseLayer = null;
        previewUrl = "";
        previewToken = 0;
        stopWatchingDisplay = null;
        connectedCallback() {
          super.connectedCallback();
          this.stopWatchingDisplay = onHdrDisplayChange(() => this.syncHdrDescription());
          document.addEventListener("paste", this.onPaste);
        }
        open() {
          if (this.openState) return;
          this.openState = true;
          this.syncOpenState();
          this.syncHdrDescription();
          this.placeSegmentThumbs();
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
          this.stopWatchingDisplay?.();
          this.stopWatchingDisplay = null;
          document.removeEventListener("paste", this.onPaste);
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
            <section class="glass-panel settings-window" role="dialog" aria-modal="true" aria-label="\u8BBE\u7F6E" aria-hidden="true" inert>
                <aside class="settings-sidebar">
                    <div class="settings-title">
                        <button class="settings-close" type="button" aria-label="\u5173\u95ED\u8BBE\u7F6E" aria-keyshortcuts="Escape" title="\u5173\u95ED\uFF08Esc\uFF09">${ICONS.close}</button>
                    </div>
                    <label class="settings-search">
                        ${ICONS.search}
                        <input type="search" placeholder="\u641C\u7D22" aria-label="\u641C\u7D22\u8BBE\u7F6E" autocomplete="off">
                    </label>
                    <nav class="settings-nav" aria-label="\u8BBE\u7F6E\u5206\u7C7B">
                        ${PANES.map(([pane2, label]) => `
                            <button class="settings-nav-item" type="button" data-pane="${pane2}">
                                <span class="nav-tile" data-tile="${pane2}">${SETTINGS_GLYPHS[pane2]}</span><span>${label}</span>
                            </button>`).join("")}
                    </nav>
                    <span class="settings-version">Infinity New Tab ${escapeHtml(chrome.runtime?.getManifest?.().version ?? "")}</span>
                </aside>
                <div class="settings-content">
                    ${this.appearancePane(settings)}
                    ${this.widgetsPane(settings)}
                    ${this.wallpaperPane(settings)}
                    ${this.dataPane()}
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
                ${toggleRow("showBookmarks", "\u4E66\u7B7E")}
                ${toggleRow("showStatus", "\u72B6\u6001\u80F6\u56CA", "\u53EA\u5728\u64AD\u653E\u5A92\u4F53\u3001\u4E0B\u8F7D\u6216\u4F7F\u7528\u7535\u6C60\u65F6\u51FA\u73B0")}
            `)}
            ${group("\u4E66\u7B7E", `
                ${toggleRow("showRecent", "\u5E38\u8BBF\u95EE\u7F51\u7AD9", "\u6839\u636E\u672C\u673A\u6700\u8FD1 30 \u5929\u7684\u6D4F\u89C8\u8BB0\u5F55\u751F\u6210\uFF0C\u6392\u5728\u4E66\u7B7E\u6700\u540E\uFF0C\u4E5F\u51FA\u73B0\u5728\u641C\u7D22\u4E2D")}
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
            <div class="settings-group wallpaper-card setting-row" data-search="\u58C1\u7EB8 \u89C6\u9891 \u56FE\u7247 \u7167\u7247 \u5728\u7EBF \u9009\u62E9 \u62D6\u653E \u7C98\u8D34 \u6062\u590D\u9ED8\u8BA4">
                <div class="wallpaper-preview" aria-hidden="true"><div class="wallpaper-preview-media"></div><span class="wallpaper-duration" hidden></span></div>
                <div class="wallpaper-info">
                    <strong class="wallpaper-name"></strong>
                    <span class="row-sub wallpaper-meta"></span>
                    <div class="wallpaper-actions">
                        <label class="pill-button primary upload-wallpaper">\u9009\u62E9\u89C6\u9891\u6216\u56FE\u7247\u2026<input type="file" accept="image/*,video/*" hidden></label>
                        <button class="pill-button random-wallpaper" type="button">\u6362\u4E00\u4E2A\u5728\u7EBF\u58C1\u7EB8</button>
                        <button class="pill-button reset-wallpaper" type="button">\u6062\u590D\u9ED8\u8BA4</button>
                    </div>
                    <span class="row-sub wallpaper-hint">\u4E5F\u53EF\u4EE5\u628A\u7167\u7247\u6216\u89C6\u9891\u62D6\u5230\u8FD9\u91CC\uFF0C\u6216\u590D\u5236\u540E\u6309 ${PASTE_LABEL} \u7C98\u8D34</span>
                </div>
            </div>
            ${group("\u663E\u793A", `
                ${segmentRow("wallpaperKind", "\u7C7B\u578B", wallpaperKind(wallpaper), [["video", "\u89C6\u9891"], ["image", "\u56FE\u7247"], ["online", "\u5728\u7EBF"]], "\u9ED8\u8BA4\u662F\u5185\u7F6E\u7684\u52A8\u6001\u573A\u666F Twilight Bay", "actions")}
                ${rangeRow("blur", "\u6A21\u7CCA", wallpaper.blur, 0, 40, "px")}
                ${rangeRow("overlay", "\u6697\u5316", wallpaper.overlay, 0, 60, "%", "\u8BA9\u767D\u8272\u6587\u5B57\u5728\u4EAE\u58C1\u7EB8\u4E0A\u4E5F\u6E05\u695A")}
            `)}
            ${group("\u64AD\u653E", `
                ${toggleRow("idleHide", "\u9759\u6B62\u65F6\u9690\u85CF\u754C\u9762", "8 \u79D2\u65E0\u64CD\u4F5C\u540E\u53EA\u4FDD\u7559\u65F6\u95F4\uFF0C\u79FB\u52A8\u9F20\u6807\u5373\u6062\u590D")}
                ${toggleRow("pauseOnBattery", "\u4F7F\u7528\u7535\u6C60\u65F6\u6682\u505C\u52A8\u6001\u58C1\u7EB8")}
                ${toggleRow("pauseWhenHidden", "\u6807\u7B7E\u9875\u4E0D\u53EF\u89C1\u65F6\u6682\u505C")}
                ${toggleRow("sound", "\u64AD\u653E\u89C6\u9891\u58F0\u97F3")}
            `)}
        `);
        }
        dataPane() {
          return pane("data", "\u6570\u636E", `
            ${group("", `
                ${infoRow("Chrome \u540C\u6B65", '<span class="sync-summary"></span>', '<span class="row-value sync-usage"></span>')}
                ${infoRow("\u672C\u5730\u5A92\u4F53", "\u89C6\u9891\u4E0E\u56FE\u7247\u58C1\u7EB8\u4FDD\u5B58\u5728\u672C\u673A\uFF0C\u4E0D\u5360\u7528\u540C\u6B65\u7A7A\u95F4", '<span class="row-value media-usage"></span>')}
            `)}
            ${group("\u5907\u4EFD", `
                ${infoRow("\u5BFC\u51FA\u5907\u4EFD", "\u4E66\u7B7E\u3001\u8BBE\u7F6E\u548C\u672C\u5730\u58C1\u7EB8\uFF0C\u4E00\u4E2A JSON \u6587\u4EF6", '<button class="pill-button export-data" type="button">\u5BFC\u51FA\u2026</button>')}
                ${infoRow("\u4ECE\u5907\u4EFD\u6062\u590D", "\u4F1A\u8986\u76D6\u5F53\u524D\u6570\u636E\uFF0C\u5EFA\u8BAE\u5148\u5BFC\u51FA\u4E00\u4EFD", '<label class="pill-button import-data">\u5BFC\u5165\u2026<input type="file" accept="application/json,.json" hidden></label>')}
                ${toggleRow("backupReminder", "\u6BCF\u6708\u63D0\u9192\u6211\u5907\u4EFD")}
            `)}
            ${group("", `
                ${infoRow("\u6E05\u7A7A\u6240\u6709\u6570\u636E", "\u5220\u9664\u4E66\u7B7E\u3001\u8BBE\u7F6E\u4E0E\u672C\u5730\u58C1\u7EB8\uFF0C\u65E0\u6CD5\u64A4\u9500", '<button class="pill-button danger reset-data" type="button">\u6E05\u7A7A\u2026</button>')}
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
            const actions = groupElement.dataset.kind === "actions";
            buttons.forEach((button) => button.addEventListener("click", () => {
              void this.applySegment(groupElement.dataset.segment ?? "", button.dataset.value ?? "");
            }));
            groupElement.addEventListener("keydown", (event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              const current = actions ? buttons.indexOf(document.activeElement) : buttons.findIndex((button) => button.classList.contains("is-active"));
              const next = buttons[(current + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length];
              if (actions) buttons.forEach((button) => {
                button.tabIndex = button === next ? 0 : -1;
              });
              next.focus();
              if (!actions) next.click();
            });
          });
          this.querySelectorAll("input[data-toggle]").forEach((input) => {
            input.addEventListener("change", () => void this.applyToggle(input.dataset.toggle ?? "", input.checked));
          });
          this.querySelectorAll('input[type="range"]').forEach((input) => {
            input.addEventListener("input", () => {
              const output = input.closest(".setting-row")?.querySelector("output");
              if (output) output.textContent = `${input.value}${input.dataset.unit ?? ""}`;
              syncSlider(input);
              const [property, value] = input.name === "blur" ? ["--wallpaper-blur", `${input.value}px`] : ["--wallpaper-overlay", String(Number(input.value) / 100)];
              document.querySelector("wallpaper-surface")?.style.setProperty(property, value);
            });
            input.addEventListener("change", () => {
              void appStore.updateSettings("wallpaper", { [input.name]: Number(input.value) }).catch(notifyError);
            });
          });
          const upload = this.querySelector(".upload-wallpaper input");
          upload.addEventListener("change", () => {
            const file = upload.files?.[0];
            upload.value = "";
            if (file) void this.withBusy(upload.closest("label"), () => useLocalWallpaper(file));
          });
          this.querySelector(".random-wallpaper")?.addEventListener("click", (event) => void this.withBusy(event.currentTarget, useOnlineWallpaper));
          const windowElement = this.querySelector(".settings-window");
          windowElement.addEventListener("dragover", this.onDragOver);
          windowElement.addEventListener("dragleave", this.onDragLeave);
          windowElement.addEventListener("drop", this.onDrop);
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
          this.placeSegmentThumbs();
          if (target === "wallpaper") void this.refreshPreview();
        }
        /** Slides each visible segmented control's thumb under its selected option. */
        placeSegmentThumbs() {
          this.querySelectorAll("[data-segment]").forEach((groupElement) => {
            const active = groupElement.querySelector(".is-active");
            if (!active || !groupElement.offsetWidth) return;
            groupElement.style.setProperty("--thumb-x", `${active.offsetLeft}px`);
            groupElement.style.setProperty("--thumb-width", `${active.offsetWidth}px`);
            groupElement.classList.toggle("has-thumb", true);
            if (!groupElement.classList.contains("is-placed")) requestAnimationFrame(() => groupElement.classList.add("is-placed"));
          });
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
        }
        /** The screen can change while the page is open (a window moved to another display). */
        syncHdrDescription() {
          const row = this.querySelector('input[data-toggle="hdrHighlights"]')?.closest(".setting-row");
          const sub = row?.querySelector(".row-sub");
          if (sub) sub.textContent = hdrDescription();
        }
        syncControls(settings) {
          const { appearance, layout, wallpaper } = settings;
          const segments = {
            theme: appearance.theme,
            glass: appearance.glass,
            clockFormat: appearance.clockFormat,
            dateFormat: appearance.dateFormat,
            searchEngine: layout.searchEngine,
            wallpaperKind: wallpaperKind(wallpaper)
          };
          this.querySelectorAll("[data-segment]").forEach((groupElement) => {
            const value = segments[groupElement.dataset.segment ?? ""];
            const buttons = [...groupElement.querySelectorAll("[data-value]")];
            const hasValue = buttons.some((button) => button.dataset.value === value);
            const state = groupElement.dataset.kind === "actions" ? "aria-pressed" : "aria-checked";
            buttons.forEach((button, index) => {
              const checked = button.dataset.value === value;
              button.classList.toggle("is-active", checked);
              button.setAttribute(state, String(checked));
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
            showRecent: layout.showRecent,
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
          });
          const ranges = { blur: wallpaper.blur, overlay: wallpaper.overlay };
          this.querySelectorAll('input[type="range"]').forEach((input) => {
            const value = ranges[input.name];
            syncSlider(input);
            if (!Number.isFinite(value) || Number(input.value) === value) return;
            input.value = String(value);
            input.dispatchEvent(new Event("input", { bubbles: false }));
          });
          this.placeSegmentThumbs();
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
            else if (name === "searchEngine") await appStore.updateSettings("layout", { searchEngine: value });
            else if (name === "wallpaperKind") this.pickWallpaper(value);
          } catch (error) {
            notifyError(error);
          }
        }
        /** True while the wallpaper card is on screen (its pane, or a settings search that shows it). */
        get wallpaperCardVisible() {
          const card = this.querySelector(".wallpaper-card");
          return this.openState && Boolean(card?.getClientRects().length);
        }
        useWallpaperFile(file) {
          void this.withBusy(this.querySelector(".upload-wallpaper"), () => useLocalWallpaper(file));
        }
        /**
         * Files dropped anywhere on the settings window are caught so Chrome does not
         * navigate away to them; only the wallpaper pane takes the drop.
         */
        onDragOver = (event) => {
          if (!event.dataTransfer?.types.includes("Files")) return;
          event.preventDefault();
          const accepts = this.wallpaperCardVisible && Boolean(event.target.closest('.settings-pane[data-pane="wallpaper"]'));
          event.dataTransfer.dropEffect = accepts ? "copy" : "none";
          this.querySelector(".wallpaper-card")?.classList.toggle("is-drop-target", accepts);
        };
        onDragLeave = (event) => {
          const windowElement = this.querySelector(".settings-window");
          if (windowElement?.contains(event.relatedTarget)) return;
          this.querySelector(".wallpaper-card")?.classList.remove("is-drop-target");
        };
        onDrop = (event) => {
          if (!event.dataTransfer?.types.includes("Files")) return;
          event.preventDefault();
          const card = this.querySelector(".wallpaper-card");
          const accepts = card?.classList.contains("is-drop-target");
          card?.classList.remove("is-drop-target");
          if (!accepts) return;
          const files = [...event.dataTransfer.files];
          const file = files.find((item) => mediaKindOf(item)) ?? files[0];
          if (file) this.useWallpaperFile(file);
        };
        /** A picture copied in Photos (⌘C) and pasted while the wallpaper card is on screen becomes the wallpaper. */
        onPaste = (event) => {
          if (!this.wallpaperCardVisible) return;
          const file = [...event.clipboardData?.files ?? []].find((item) => mediaKindOf(item));
          if (!file) return;
          event.preventDefault();
          this.useWallpaperFile(file);
        };
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
          name.textContent = wallpaperLabel(wallpaper);
          const size = blob ? ` \xB7 ${formatBytes(blob.size)}` : "";
          meta.textContent = type === "gradient" ? "\u5185\u7F6E\u52A8\u6001\u573A\u666F \xB7 \u4E0D\u5360\u7528\u4EFB\u4F55\u5B58\u50A8" : `${type === "video" ? "\u89C6\u9891" : "\u56FE\u7247"}${size} \xB7 \u5DF2\u4FDD\u5B58\u5230\u672C\u673A`;
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
            mediaStore.snapshot().then(({ image, video }) => [image, video]).catch(() => [null, null])
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
                <div class="glass glass-dark capsule media-capsule" data-glass>
                    <button class="media-open" type="button" title="\u5207\u6362\u5230\u6B63\u5728\u64AD\u653E\u7684\u6807\u7B7E\u9875">
                        <img class="media-art" src="${escapeHtml(media.icon)}" alt="" draggable="false">
                        <span class="capsule-text">
                            <strong>${escapeHtml(truncate(media.title, 28))}</strong>
                            <small>${escapeHtml(media.host)} \u6807\u7B7E\u9875${media.muted ? "\u5DF2\u9759\u97F3" : "\u6B63\u5728\u64AD\u653E"}</small>
                        </span>
                        ${media.muted ? "" : '<span class="equalizer" aria-hidden="true"><span></span><span></span><span></span><span></span></span>'}
                    </button>
                    <button class="media-mute" type="button" aria-label="${muteLabel}" title="${muteLabel}">${media.muted ? ICONS.muted : ICONS.speaker}</button>
                </div>` : "",
            downloads.length ? `<button class="glass glass-dark capsule download-capsule" type="button" data-glass title="\u5728\u6587\u4EF6\u5939\u4E2D\u663E\u793A">${ICONS.download}<span>${downloads.length} \u9879\u4E0B\u8F7D\u4E2D</span></button>` : "",
            battery ? `<span data-glass class="glass glass-dark capsule battery-capsule ${battery.level <= 0.2 && !battery.charging ? "is-low" : ""}" title="${battery.charging ? "\u6B63\u5728\u5145\u7535" : "\u6B63\u5728\u4F7F\u7528\u7535\u6C60"}">${battery.charging ? ICONS.bolt : ICONS.battery}<span>${Math.round(battery.level * 100)}%</span></span>` : ""
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
        update({ animated, paused }) {
          if (!this.querySelector(".wallpaper-pause")) {
            this.innerHTML = '<button class="glass round-button wallpaper-pause" type="button" data-glass></button>';
          }
          const action = paused ? "\u64AD\u653E\u52A8\u6001\u58C1\u7EB8" : "\u6682\u505C\u52A8\u6001\u58C1\u7EB8";
          const button = this.querySelector(".wallpaper-pause");
          this.hidden = !animated;
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
    unmuteTarget = video;
    if (waitingForGesture) return;
    waitingForGesture = true;
    const unmute = () => {
      window.removeEventListener("pointerdown", unmute, true);
      window.removeEventListener("keydown", unmute, true);
      waitingForGesture = false;
      const target = unmuteTarget;
      unmuteTarget = null;
      if (target?.isConnected && appStore.state.settings.wallpaper.sound) target.muted = false;
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
  var WallpaperSurface, unmuteTarget, waitingForGesture, SCENE;
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
        /** Media that failed to load is not retried (nor reported again) until the wallpaper itself changes. */
        failedMediaKey = "";
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
          const { type } = appStore.state.settings.wallpaper;
          return { animated: type === "gradient" || type === "video", paused: this.userPaused };
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
          if (mediaKey === this.appliedMediaKey || mediaKey === this.pendingMediaKey || mediaKey === this.failedMediaKey) return;
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
              this.commitMedia(host, null, "", "");
              host.innerHTML = SCENE;
            }
            this.appliedMediaKey = mediaKey;
            this.failedMediaKey = "";
            this.syncPlayback();
            this.reportState();
            const resolved = await tone;
            if (token === this.renderToken) this.reportTone(resolved);
          } catch (error) {
            if (token === this.renderToken) {
              this.failedMediaKey = mediaKey;
              this.reportError(error);
            }
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
      unmuteTarget = null;
      waitingForGesture = false;
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
      init_bookmark_index();
      init_dashboard_header();
      init_icons();
      init_glass();
      init_search_box();
      init_settings_panel();
      init_status_strip();
      init_ui_layer();
      init_wallpaper_badge();
      init_wallpaper_surface();
      installChromeFallback();
      var IDLE_DELAY = 8e3;
      var InfinityNewTabApp = class extends HTMLElement {
        wallpaperTone = "dark";
        idleTimer = 0;
        lastActivity = 0;
        updateClasses = () => {
          const { appearance } = appStore.state.settings;
          const theme = appearance.theme === "auto" ? this.wallpaperTone : appearance.theme;
          document.body.classList.toggle("theme-light", theme === "light");
          document.body.classList.toggle("theme-dark", theme === "dark");
          document.body.classList.toggle("glass-tinted", appearance.glass === "tinted");
          document.body.classList.toggle("reduce-transparency", appearance.reduceTransparency);
          document.body.classList.toggle("hdr-highlights", appearance.hdrHighlights);
        };
        onStoreChange = (event) => {
          const changes = event.detail?.changes;
          if (!changes || changes.includes("settings.appearance")) this.updateClasses();
          if (!changes || changes.includes("settings.wallpaper")) this.wake();
        };
        async connectedCallback() {
          this.innerHTML = '<div class="app-loading" role="status"><span></span><p>\u6B63\u5728\u8F7D\u5165\u4E66\u7B7E\u2026</p></div>';
          try {
            await appStore.init();
            this.updateClasses();
            appStore.addEventListener("change", this.onStoreChange);
            this.render();
            window.addEventListener("keydown", this.onKeyDown);
            ["pointermove", "pointerdown", "keydown", "wheel", "focusin"].forEach((type) => {
              window.addEventListener(type, this.wake, { passive: true, capture: true });
            });
            this.wake();
          } catch (error) {
            this.innerHTML = `<div class="app-error"><h1>\u65B0\u6807\u7B7E\u9875\u52A0\u8F7D\u5931\u8D25</h1><p>${escapeHtml(error instanceof Error ? error.message : "\u672A\u77E5\u9519\u8BEF")}</p></div>`;
          }
        }
        disconnectedCallback() {
          appStore.removeEventListener("change", this.onStoreChange);
          window.removeEventListener("keydown", this.onKeyDown);
          ["pointermove", "pointerdown", "keydown", "wheel", "focusin"].forEach((type) => {
            window.removeEventListener(type, this.wake, true);
          });
          window.clearTimeout(this.idleTimer);
        }
        render() {
          this.innerHTML = `
            <wallpaper-surface></wallpaper-surface>
            <div class="home">
                <header class="top-bar">
                    <status-strip></status-strip>
                    <button class="glass round-button shuffle-wallpaper" type="button" data-glass aria-label="\u6362\u4E00\u4E2A\u5728\u7EBF\u58C1\u7EB8" title="\u6362\u4E00\u4E2A\u5728\u7EBF\u58C1\u7EB8">${ICONS.shuffle}</button>
                    <button class="glass round-button settings-trigger" type="button" data-glass aria-label="\u8BBE\u7F6E" title="\u8BBE\u7F6E">${ICONS.settings}</button>
                </header>
                <main class="hero">
                    <dashboard-header></dashboard-header>
                    <search-box></search-box>
                </main>
                <footer class="home-footer">
                    <bookmark-index></bookmark-index>
                    <wallpaper-badge></wallpaper-badge>
                </footer>
            </div>
            <settings-panel></settings-panel>
            <bookmark-dialog></bookmark-dialog>
            <backup-toast></backup-toast>
            <glass-system></glass-system>
        `;
          this.querySelector(".settings-trigger")?.addEventListener("click", () => this.settings?.open());
          this.querySelector(".shuffle-wallpaper")?.addEventListener("click", (event) => void this.shuffleWallpaper(event.currentTarget));
          this.addEventListener("wallpaper-error", this.onWallpaperError);
          this.addEventListener("wallpaper-tone", this.onWallpaperTone);
        }
        get search() {
          return this.querySelector("search-box");
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
        /**
         * Any input brings the interface back and restarts the idle countdown. Input
         * only records its time; the one pending timer checks it when it fires.
         */
        wake = () => {
          document.body.classList.remove("is-idle");
          this.lastActivity = Date.now();
          if (!appStore.state.settings.wallpaper.idleHide) {
            window.clearTimeout(this.idleTimer);
            this.idleTimer = 0;
            return;
          }
          if (!this.idleTimer) this.idleTimer = window.setTimeout(this.goIdle, IDLE_DELAY);
        };
        goIdle = () => {
          this.idleTimer = 0;
          const remaining = this.lastActivity + IDLE_DELAY - Date.now();
          if (remaining > 0) {
            this.idleTimer = window.setTimeout(this.goIdle, remaining);
            return;
          }
          if (hasOpenLayer() || isTypingTarget(document.activeElement)) {
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
          if (commandK && this.search?.hasFocus) {
            event.preventDefault();
            document.activeElement?.blur();
            return;
          }
          if (hasOpenLayer()) return;
          if (commandK || event.key === "/" && !isTypingTarget(event.target)) {
            event.preventDefault();
            this.search?.focusField();
          }
        };
      };
      function isTypingTarget(target) {
        return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target instanceof HTMLElement && target.isContentEditable;
      }
      var elements = [
        ["glass-system", GlassSystem],
        ["wallpaper-surface", WallpaperSurface],
        ["wallpaper-badge", WallpaperBadge],
        ["status-strip", StatusStrip],
        ["dashboard-header", DashboardHeader],
        ["search-box", SearchBox],
        ["bookmark-index", BookmarkIndex],
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
