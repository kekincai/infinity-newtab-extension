/**
 * Main Application Script
 * Integrates all modules and manages the UI
 */

// Application State
let currentFolder = '全部';
let statusIntervalId = null;
let draggedBookmark = null;
let dragPreviewFolder = null;

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize all managers
    await settingsManager.init();
    await bookmarksManager.init();
    await searchManager.init();

    // Initialize UI
    initializeUI();
    initializeEventListeners();

    // Start time updates
    updateTime();
    setInterval(updateTime, 1000);
    startStatusUpdates();

    // Load content
    loadBookmarks();
    applySettings();
    loadRecentSites();
});

// ============================================
// UI Initialization
// ============================================

function initializeUI() {
    const bgLayer = document.getElementById('backgroundLayer');
    wallpaperManager.init(bgLayer);
}

function applySettings() {
    const settings = settingsManager.getAllSettings();

    // Apply layout settings
    toggleElement('time-block', settings.layout.showClock);
    toggleElement('searchWidget', settings.layout.showSearch);
    toggleElement('bookmarks-section', settings.layout.showBookmarks);

    // Update search engine badge
    updateSearchEngineBadge();

    // Update settings UI
    updateSettingsUI(settings);
}

function updateSettingsUI(settings) {
    // Appearance
    document.getElementById('clockFormatSelect').value = settings.appearance.clockFormat;
    document.getElementById('searchEngineSelect').value = settings.layout.searchEngine;

    // Wallpaper
    document.getElementById('blurSlider').value = settings.wallpaper.blur;
    document.getElementById('overlaySlider').value = settings.wallpaper.overlay;
    document.getElementById('blurValue').textContent = settings.wallpaper.blur;
    document.getElementById('overlayValue').textContent = settings.wallpaper.overlay;

    // Layout toggles
    document.getElementById('showClockToggle').checked = settings.layout.showClock;
    document.getElementById('showSearchToggle').checked = settings.layout.showSearch;
    document.getElementById('showBookmarksToggle').checked = settings.layout.showBookmarks;
}

function toggleElement(id, show) {
    const element = document.getElementById(id) || document.querySelector(`.${id}`);
    if (element) {
        element.style.display = show ? '' : 'none';
    }
}

// ============================================
// Event Listeners
// ============================================

function initializeEventListeners() {
    // Settings Panel
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);

    // Settings Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });

    // Appearance Settings
    document.getElementById('clockFormatSelect').addEventListener('change', async (e) => {
        await settingsManager.updateSetting('appearance', 'clockFormat', e.target.value);
        updateTime();
    });

    document.getElementById('searchEngineSelect').addEventListener('change', async (e) => {
        await settingsManager.updateSetting('layout', 'searchEngine', e.target.value);
        await searchManager.setSearchEngine(e.target.value);
        updateSearchEngineBadge();
    });

    // Wallpaper Controls
    document.getElementById('randomWallpaperBtn').addEventListener('click', async () => {
        await wallpaperManager.setRandomPreset();
    });

    document.getElementById('wallpaperUpload').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            await wallpaperManager.uploadLocal(file);
            e.target.value = ''; // Reset input
        }
    });

    document.getElementById('resetWallpaperBtn').addEventListener('click', async () => {
        await wallpaperManager.resetToGradient();
    });

    document.getElementById('animeWallpaperBtn').addEventListener('click', async () => {
        await wallpaperManager.setRandomAnime();
    });

    document.getElementById('blurSlider').addEventListener('input', async (e) => {
        const value = e.target.value;
        document.getElementById('blurValue').textContent = value;
        await wallpaperManager.updateBlur(parseInt(value));
    });

    document.getElementById('overlaySlider').addEventListener('input', async (e) => {
        const value = e.target.value;
        document.getElementById('overlayValue').textContent = value;
        await wallpaperManager.updateOverlay(parseInt(value));
    });

    // Layout Toggles
    document.getElementById('showClockToggle').addEventListener('change', async (e) => {
        await settingsManager.updateSetting('layout', 'showClock', e.target.checked);
        toggleElement('time-block', e.target.checked);
    });

    document.getElementById('showSearchToggle').addEventListener('change', async (e) => {
        await settingsManager.updateSetting('layout', 'showSearch', e.target.checked);
        toggleElement('searchWidget', e.target.checked);
    });

    document.getElementById('showBookmarksToggle').addEventListener('change', async (e) => {
        await settingsManager.updateSetting('layout', 'showBookmarks', e.target.checked);
        toggleElement('bookmarks-section', e.target.checked);
    });

    // Data Management
    document.getElementById('exportBtn').addEventListener('click', async () => {
        await importExportManager.createBackup();
    });

    document.getElementById('importInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const jsonData = await importExportManager.readJSONFile(file);
                await importExportManager.importData(jsonData);
                alert('数据导入成功！页面将刷新以应用更改。');
                location.reload();
            } catch (error) {
                alert('导入失败：' + error.message);
            }
            e.target.value = ''; // Reset input
        }
    });

    document.getElementById('resetBtn').addEventListener('click', async () => {
        if (confirm('确定要重置所有设置吗？此操作不可撤销！')) {
            chrome.storage.sync.clear(() => {
                if (chrome.runtime.lastError) {
                    alert('重置失败：' + chrome.runtime.lastError.message);
                    return;
                }
                alert('设置与数据已重置！页面将刷新。');
                location.reload();
            });
        }
    });

    // Search
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = e.target.value.trim();
            if (query) {
                searchManager.search(query);
                e.target.value = '';
            }
        }
    });

    const refreshRecentBtn = document.getElementById('refreshRecentBtn');
    if (refreshRecentBtn) {
        refreshRecentBtn.addEventListener('click', loadRecentSites);
    }

    // Quick search focus with '/'
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            document.getElementById('searchInput').focus();
        }
    });

    // System status updates
    window.addEventListener('online', updateSystemStatus);
    window.addEventListener('offline', updateSystemStatus);

    // Bookmarks
    document.getElementById('addBtn').addEventListener('click', openModal);
    document.getElementById('closeBtn').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    document.getElementById('saveBtn').addEventListener('click', saveBookmark);
    document.getElementById('addFolderBtn').addEventListener('click', promptAddFolder);

    // Modal click outside to close
    document.getElementById('addModal').addEventListener('click', (e) => {
        if (e.target.id === 'addModal') closeModal();
    });

    // URL input preview
    document.getElementById('urlInput').addEventListener('input', debounce(() => {
        let url = document.getElementById('urlInput').value.trim();
        if (url) {
            url = normalizeUrl(url);
            if (isValidUrl(url)) {
                previewBookmark(url);
            }
        }
    }, 500));

    // Enter to save bookmark
    document.getElementById('urlInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveBookmark();
    });
}

// ============================================
// Settings Panel
// ============================================

function openSettings() {
    document.getElementById('settingsPanel').classList.add('active');
}

function closeSettings() {
    document.getElementById('settingsPanel').classList.remove('active');
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === tabName + 'Tab');
    });
}

// ============================================
// Time Display
// ============================================

function updateTime() {
    const now = new Date();
    const settings = settingsManager.getAllSettings();
    const format = settings?.appearance?.clockFormat || '24h';

    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');

    let timeString;
    if (format === '12h') {
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        timeString = `${hours}:${minutes} ${ampm}`;
    } else {
        timeString = `${String(hours).padStart(2, '0')}:${minutes}`;
    }

    document.getElementById('time').textContent = timeString;

    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[now.getDay()];

    document.getElementById('date').textContent = `${year}年${month}月${day}日 ${weekday}`;
}

// ============================================
// Search Functions
// ============================================

function updateSearchEngineBadge() {
    const engine = searchManager.getCurrentEngine();
    document.getElementById('searchEngineBadge').textContent = engine.name;
}

// ============================================
// Status Bar
// ============================================

function startStatusUpdates() {
    updateSystemStatus();
    updateActivityStatus();

    if (statusIntervalId) clearInterval(statusIntervalId);
    statusIntervalId = setInterval(() => {
        updateSystemStatus();
        updateActivityStatus();
    }, 8000);
}

function updateSystemStatus() {
    // CPU info
    const cpuInfo = document.getElementById('cpuInfo');
    const cores = navigator.hardwareConcurrency || 0;
    cpuInfo.textContent = cores ? `CPU: ${cores} 线程` : 'CPU: 未知';

    // Memory info (approximate, deviceMemory is in GB)
    const memoryInfo = document.getElementById('memoryInfo');
    const deviceMemory = navigator.deviceMemory;
    memoryInfo.textContent = deviceMemory ? `内存: ≈${deviceMemory} GB` : '内存: 未知';

    // Battery info
    const batteryInfo = document.getElementById('batteryInfo');
    if (navigator.getBattery) {
        navigator.getBattery().then(battery => {
            const level = Math.round(battery.level * 100);
            const charging = battery.charging ? '⚡️' : '';
            batteryInfo.textContent = `电池: ${level}% ${charging}`;
            batteryInfo.onclick = () => alert(`电池电量 ${level}% ${battery.charging ? '（充电中）' : ''}`);
        }).catch(() => {
            batteryInfo.textContent = '电池: 不支持';
            batteryInfo.onclick = null;
        });
    } else {
        batteryInfo.textContent = '电池: 不支持';
        batteryInfo.onclick = null;
    }
}

function updateActivityStatus() {
    const mediaLabel = document.getElementById('mediaActivity');
    const downloadLabel = document.getElementById('downloadActivity');

    chrome.tabs.query({ audible: true }, (tabs) => {
        if (tabs.length === 0) {
            mediaLabel.textContent = '无媒体播放';
            mediaLabel.classList.remove('highlight');
            mediaLabel.onclick = null;
        } else {
            const titles = tabs.slice(0, 3).map(t => truncate(t.title || t.url, 18));
            mediaLabel.textContent = `播放中：${titles.join(' / ')}`;
            mediaLabel.classList.add('highlight');
            mediaLabel.onclick = () => {
                const target = tabs[0];
                chrome.tabs.update(target.id, { active: true });
            };
        }
    });

    if (chrome.downloads && chrome.downloads.search) {
        chrome.downloads.search({ state: 'in_progress' }, (items) => {
            if (items.length === 0) {
                downloadLabel.textContent = '无下载';
                downloadLabel.classList.remove('highlight');
                downloadLabel.onclick = null;
                return;
            }
            const first = items[0];
            const fileName = first.filename ? first.filename.split(/[\\/]/).pop() : '下载中';
            const progress = first.totalBytes > 0 ? Math.round((first.bytesReceived / first.totalBytes) * 100) : 0;
            downloadLabel.textContent = `下载中：${truncate(fileName, 14)} (${progress}%)`;
            downloadLabel.classList.add('highlight');
            downloadLabel.onclick = () => chrome.downloads.show(first.id);
        });
    } else {
        downloadLabel.textContent = '下载不可用';
        downloadLabel.classList.remove('highlight');
    }
}

// ============================================
// Bookmark Functions
// ============================================

function openModal() {
    document.getElementById('addModal').classList.add('active');
    document.getElementById('urlInput').focus();
}

function closeModal() {
    document.getElementById('addModal').classList.remove('active');
    document.getElementById('urlInput').value = '';
    document.getElementById('nameInput').value = '';
    document.getElementById('preview').style.display = 'none';
}

function previewBookmark(url) {
    try {
        const urlObj = new URL(url);
        const faviconUrl = getFaviconUrl(url);
        const name = document.getElementById('nameInput').value || urlObj.hostname;

        document.getElementById('previewIcon').src = faviconUrl;
        document.getElementById('previewName').textContent = name;
        document.getElementById('preview').style.display = 'flex';
    } catch (e) {
        console.error('Invalid URL:', e);
    }
}

async function saveBookmark() {
    const urlInput = document.getElementById('urlInput');
    const nameInput = document.getElementById('nameInput');
    const folderSelect = document.getElementById('folderSelect');

    let url = urlInput.value.trim();

    if (url) {
        url = normalizeUrl(url);
    }

    if (!isValidUrl(url)) {
        alert('请输入有效的网址');
        return;
    }

    try {
        const urlObj = new URL(url);
        const name = nameInput.value.trim() || cleanDisplayName(urlObj.hostname);
        const folder = folderSelect.value;
        const faviconUrl = getFaviconUrl(url);

        await bookmarksManager.addBookmark(url, name, faviconUrl, folder);
        loadBookmarks();
        closeModal();
    } catch (e) {
        alert('保存失败，请重试');
        console.error('Save error:', e);
    }
}

async function deleteBookmark(id) {
    if (!confirm('确定要删除这个书签吗？')) {
        return;
    }

    await bookmarksManager.deleteBookmark(id);
    loadBookmarks();
}

function loadBookmarks() {
    const grid = document.getElementById('bookmarksGrid');
    const folders = bookmarksManager.getAllFolders();
    const bookmarks = getSortedBookmarks(currentFolder);

    updateFolderSelect(folders);
    document.getElementById('currentFolderLabel').textContent = currentFolder;

    grid.innerHTML = '';

    if (currentFolder !== '全部') {
        grid.appendChild(createBackCard());
    } else {
        const folderNames = folders.filter(folder => folder !== '全部');
        folderNames.forEach((folder, index) => {
            const card = createFolderCard(folder, index);
            grid.appendChild(card);
        });
        grid.appendChild(createAddFolderCard());
    }

    const showBookmarks = currentFolder === '全部'
        ? bookmarks.filter(b => (b.folder || '全部') === '全部')
        : bookmarks;

    if (showBookmarks.length === 0 && currentFolder !== '全部') {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = '这里空空的，添加一些书签吧';
        grid.appendChild(empty);
        return;
    }

    showBookmarks.forEach((bookmark, index) => {
        const card = createBookmarkCard(bookmark, index);
        grid.appendChild(card);
    });
}

function createBookmarkCard(bookmark, index) {
    const card = document.createElement('a');
    card.className = 'bookmark-card';
    card.href = bookmark.url;
    card.target = '_blank';
    card.style.animationDelay = `${index * 0.05}s`;
    card.draggable = true;
    card.addEventListener('dragstart', (e) => onBookmarkDragStart(e, bookmark));
    card.addEventListener('dragover', (e) => e.preventDefault());
    card.addEventListener('drop', (e) => handleDropOnBookmark(e, bookmark));
    card.addEventListener('dragend', clearDragState);

    const icon = document.createElement('div');
    icon.className = 'bookmark-icon';
    const img = document.createElement('img');
    img.src = bookmark.icon;
    img.alt = bookmark.name;
    img.onerror = () => {
        img.src = getDefaultIcon();
    };
    icon.appendChild(img);

    const name = document.createElement('div');
    name.className = 'bookmark-name';
    name.textContent = cleanDisplayName(bookmark.name);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteBookmark(bookmark.id);
    };

    card.appendChild(deleteBtn);
    card.appendChild(icon);
    card.appendChild(name);

    return card;
}

function switchFolder(folder) {
    currentFolder = folder;
    loadBookmarks();
}

function createFolderCard(folder, index) {
    const card = document.createElement('button');
    const bookmarks = bookmarksManager.getBookmarksByFolder(folder);
    card.className = 'folder-card';
    card.dataset.folder = folder;
    card.style.setProperty('--folder-accent', getFolderAccent(index));
    card.onclick = () => switchFolder(folder);
    card.addEventListener('dragover', (e) => e.preventDefault());
    card.addEventListener('drop', (e) => handleDropOnFolder(e, folder));
    card.addEventListener('dragend', clearDragState);

    const preview = document.createElement('div');
    preview.className = 'folder-preview';
    bookmarks.slice(0, 4).forEach(bookmark => {
        const bubble = document.createElement('div');
        bubble.className = 'preview-bubble';
        const img = document.createElement('img');
        img.src = bookmark.icon;
        img.alt = bookmark.name;
        img.onerror = () => {
            img.src = getDefaultIcon();
        };
        bubble.appendChild(img);
        preview.appendChild(bubble);
    });

    if (bookmarks.length === 0) {
        const placeholder = document.createElement('div');
        placeholder.className = 'folder-empty';
        placeholder.textContent = '空文件夹，等你填满';
        preview.appendChild(placeholder);
    }

    const meta = document.createElement('div');
    meta.className = 'folder-meta';

    const name = document.createElement('div');
    name.className = 'folder-name';
    name.textContent = folder;

    const count = document.createElement('div');
    count.className = 'folder-count';
    count.textContent = `${bookmarks.length} 个书签`;

    meta.appendChild(name);
    meta.appendChild(count);

    card.appendChild(preview);
    card.appendChild(meta);

    return card;
}

function createAddFolderCard() {
    const addCard = document.createElement('button');
    addCard.className = 'folder-card add-folder-card';
    addCard.innerHTML = `
        <span class="add-folder-icon">+</span>
        <span class="folder-name">新建文件夹</span>
        <span class="folder-count">把相关站点收进一个合集</span>
    `;
    addCard.addEventListener('click', promptAddFolder);
    return addCard;
}

function createBackCard() {
    const backCard = document.createElement('button');
    backCard.className = 'folder-card back-card';
    backCard.innerHTML = `
        <span class="back-icon">←</span>
        <span class="folder-name">返回全部</span>
        <span class="folder-count">回到所有文件夹</span>
    `;
    backCard.addEventListener('click', () => switchFolder('全部'));
    return backCard;
}

function updateFolderSelect(folders) {
    const folderSelect = document.getElementById('folderSelect');
    folderSelect.innerHTML = '';
    folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder;
        option.textContent = folder;
        folderSelect.appendChild(option);
    });
}

async function promptAddFolder() {
    const name = prompt('文件夹名称');
    if (!name) return;

    const cleanName = name.trim();
    if (!cleanName) return;

    await bookmarksManager.addFolder(cleanName);
    loadBookmarks();
}

// ============================================
// Drag & Drop Helpers
// ============================================

function getSortedBookmarks(folder) {
    const targetFolder = folder || '全部';
    ensureFolderOrder(targetFolder);
    const list = targetFolder === '全部'
        ? bookmarksManager.getAllBookmarks()
        : bookmarksManager.getBookmarksByFolder(targetFolder);
    return list.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.id - b.id));
}

function onBookmarkDragStart(e, bookmark) {
    draggedBookmark = { ...bookmark, sourceFolder: bookmark.folder || '全部' };
    dragPreviewFolder = currentFolder;
    if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', String(bookmark.id));
        e.dataTransfer.effectAllowed = 'move';
    }
}

function handleDropOnBookmark(e, targetBookmark) {
    e.preventDefault();
    if (!draggedBookmark) return;
    const folder = currentFolder === '全部' ? draggedBookmark.sourceFolder : currentFolder;
    const targetFolder = targetBookmark.folder || '全部';
    if (draggedBookmark.sourceFolder !== folder || targetFolder !== folder) {
        clearDragState();
        return;
    }

    const list = getSortedBookmarks(folder);
    const dragIndex = list.findIndex(b => b.id === draggedBookmark.id);
    const targetIndex = list.findIndex(b => b.id === targetBookmark.id);
    if (dragIndex === -1 || targetIndex === -1 || dragIndex === targetIndex) return;

    const [item] = list.splice(dragIndex, 1);
    list.splice(targetIndex, 0, item);
    list.forEach((b, idx) => { b.order = idx; });

    persistFolderOrder(folder, list);
    clearDragState();
    loadBookmarks();
}

function handleDropOnFolder(e, folderName) {
    e.preventDefault();
    if (!draggedBookmark) return;
    if (folderName === draggedBookmark.sourceFolder) {
        clearDragState();
        return;
    }

    const all = bookmarksManager.getAllBookmarks().map(b => ({ ...b }));
    const idx = all.findIndex(b => b.id === draggedBookmark.id);
    if (idx === -1) return;

    const sourceFolder = draggedBookmark.sourceFolder || '全部';
    all[idx].folder = folderName || '全部';

    normalizeFolderOrders(all, sourceFolder);
    normalizeFolderOrders(all, folderName || '全部');

    bookmarksManager.reorderBookmarks(all);
    clearDragState();
    loadBookmarks();
}

function persistFolderOrder(folderName, orderedList) {
    const all = bookmarksManager.getAllBookmarks().map(b => ({ ...b }));
    const others = all.filter(b => b.folder !== folderName);
    const merged = [...others, ...orderedList];
    bookmarksManager.reorderBookmarks(merged);
}

function normalizeFolderOrders(allBookmarks, folderName) {
    const list = allBookmarks
        .filter(b => b.folder === folderName)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.id - b.id));
    list.forEach((b, idx) => { b.order = idx; });
}

function clearDragState() {
    draggedBookmark = null;
    dragPreviewFolder = null;
}

function ensureFolderOrder(folderName) {
    if (folderName === '全部') return;
    const all = bookmarksManager.getAllBookmarks().map(b => ({ ...b }));
    const before = JSON.stringify(all.filter(b => b.folder === folderName).map(b => b.order));
    normalizeFolderOrders(all, folderName);
    const after = JSON.stringify(all.filter(b => b.folder === folderName).map(b => b.order));
    if (before !== after) {
        bookmarksManager.reorderBookmarks(all);
    }
}

// ============================================
// Utility Functions
// ============================================

function getFaviconUrl(url) {
    try {
        const urlObj = new URL(url);
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
    } catch (e) {
        return getDefaultIcon();
    }
}

function getDefaultIcon() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjNjM2NmYxIi8+PHBhdGggZD0iTTE2IDhWMjRNOCAxNkgyNCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=';
}

function normalizeUrl(url) {
    url = url.trim();
    if (!url.match(/^[a-zA-Z]+:\/\//)) {
        url = 'https://' + url;
    }
    return url;
}

function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function getFolderAccent(index) {
    const palette = ['#ff9bd2', '#a5b4ff', '#7ad7f0', '#ffcba4', '#9bffd9'];
    return palette[index % palette.length];
}

function truncate(str, maxLength) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 1) + '…';
}

function cleanDisplayName(text) {
    if (!text) return '';
    let name = text.replace(/^https?:\/\//, '').replace(/^www\./, '');
    name = name.replace(/\/.*$/, '');
    return name;
}

// ============================================
// Recent Sites
// ============================================

function loadRecentSites() {
    if (!chrome.history) {
        renderRecentMessage('无法访问历史记录（未授权）');
        return;
    }

    const daysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    chrome.history.search({ text: '', startTime: daysAgo, maxResults: 5000 }, (items) => {
        if (chrome.runtime.lastError) {
            renderRecentMessage('读取历史记录失败');
            return;
        }
        const hostMap = new Map();

        items.forEach(item => {
            try {
                const url = new URL(item.url);
                if (!['http:', 'https:'].includes(url.protocol)) return;
                if (url.hostname === 'newtab' || url.hostname.endsWith('google.com')) {
                    // ignore internal/newtab noise
                }
                const host = url.hostname.replace(/^www\./, '');
                const prev = hostMap.get(host);
                const count = (prev?.count || 0) + (item.visitCount || 1);
                const lastVisit = Math.max(prev?.lastVisit || 0, item.lastVisitTime || 0);
                hostMap.set(host, {
                    host,
                    url: `https://${host}`,
                    title: getDisplayName(host),
                    count,
                    lastVisit
                });
            } catch {
                // ignore invalid URL
            }
        });

        const ranked = Array.from(hostMap.values())
            .sort((a, b) => (b.count - a.count) || (b.lastVisit - a.lastVisit))
            .slice(0, 20);

        if (!ranked.length) {
            renderRecentMessage('暂无历史数据或被浏览器隐私设置限制');
            return;
        }
        renderRecentSites(ranked);
    });
}

function renderRecentSites(list) {
    const track = document.getElementById('recentTrack');
    if (!track) return;
    track.innerHTML = '';

    if (!list.length) {
        renderRecentMessage('暂无数据');
        return;
    }

    list.forEach(item => {
        const card = document.createElement('a');
        card.className = 'recent-card';
        card.href = item.url;
        card.target = '_blank';

        const icon = document.createElement('div');
        icon.className = 'recent-icon';
        const img = document.createElement('img');
        img.src = getFaviconUrl(item.url);
        img.alt = item.title;
        img.onerror = () => {
            img.src = getDefaultIcon();
        };
        icon.appendChild(img);

        const info = document.createElement('div');
        info.className = 'recent-info';

        const title = document.createElement('div');
        title.className = 'recent-title';
        title.textContent = truncate(item.title, 18);

        const meta = document.createElement('div');
        meta.className = 'recent-meta';
        meta.textContent = item.host;

        info.appendChild(title);
        info.appendChild(meta);

        card.appendChild(icon);
        card.appendChild(info);
        track.appendChild(card);
    });
}

function getDisplayName(host) {
    if (!host) return '';
    const clean = host.replace(/^www\./, '');
    const parts = clean.split('.');
    if (parts.length <= 1) return clean;
    return parts[0];
}

function renderRecentMessage(text) {
    const track = document.getElementById('recentTrack');
    if (!track) return;
    track.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'recent-meta';
    empty.textContent = text;
    track.appendChild(empty);
}
