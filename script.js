/**
 * Main Application Script
 * Integrates all modules and manages the UI
 */

// Application State
let currentFolder = '全部';
let statusIntervalId = null;
let draggedBookmark = null;
let longPressTimer = null;
let isDragging = false;
let editingBookmarkId = null;

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
    loadSearchSuggestions();
    scheduleBackupReminder();
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
    toggleElement('status-strip', settings.layout.showStatus);
    toggleElement('recent-section', settings.layout.showRecent);

    // Update search engine badge
    updateSearchEngineBadge();

    // Update settings UI
    updateSettingsUI(settings);

    // Enhanced animations
    applyEnhancedAnimations(settings.appearance.enhancedAnimations);

    // Theme
    applyTheme(settings.appearance.theme);
}

function updateSettingsUI(settings) {
    // Appearance
    document.getElementById('clockFormatSelect').value = settings.appearance.clockFormat;
    document.getElementById('searchEngineSelect').value = settings.layout.searchEngine;
    document.getElementById('enhancedAnimationsToggle').checked = settings.appearance.enhancedAnimations;
    document.getElementById('themeToggle').checked = settings.appearance.theme === 'light';

    // Wallpaper
    document.getElementById('blurSlider').value = settings.wallpaper.blur;
    document.getElementById('overlaySlider').value = settings.wallpaper.overlay;
    document.getElementById('blurValue').textContent = settings.wallpaper.blur;
    document.getElementById('overlayValue').textContent = settings.wallpaper.overlay;

    // Layout toggles
    document.getElementById('showClockToggle').checked = settings.layout.showClock;
    document.getElementById('showSearchToggle').checked = settings.layout.showSearch;
    document.getElementById('showBookmarksToggle').checked = settings.layout.showBookmarks;
    document.getElementById('showStatusToggle').checked = settings.layout.showStatus;
    document.getElementById('showRecentToggle').checked = settings.layout.showRecent;
}

function applyTheme(theme) {
    const isLight = theme === 'light';
    document.body.classList.toggle('theme-light', isLight);
}

function toggleElement(id, show) {
    const element = document.getElementById(id) || document.querySelector(`.${id}`);
    if (element) {
        element.style.display = show ? '' : 'none';
    }
}

function applyEnhancedAnimations(enabled) {
    document.body.classList.toggle('enhanced-animations', !!enabled);
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
        const changed = await wallpaperManager.setRandomPreset();
        if (!changed) alert('壁纸加载失败，已保留当前背景。');
    });

    document.getElementById('wallpaperUpload').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                await wallpaperManager.uploadLocal(file);
            } catch (error) {
                alert('本地壁纸保存失败：' + error.message);
            }
            e.target.value = ''; // Reset input
        }
    });

    document.getElementById('resetWallpaperBtn').addEventListener('click', async () => {
        try {
            await wallpaperManager.resetToGradient();
        } catch (error) {
            alert('壁纸重置失败：' + error.message);
        }
    });

    document.getElementById('animeWallpaperBtn').addEventListener('click', async () => {
        const changed = await wallpaperManager.setRandomAnime();
        if (!changed) alert('二次元壁纸加载失败，已保留当前背景。');
    });

    const saveBlur = debounce((value) => {
        wallpaperManager.updateBlur(value).catch((error) => console.error('Failed to save blur:', error));
    }, 200);
    const saveOverlay = debounce((value) => {
        wallpaperManager.updateOverlay(value).catch((error) => console.error('Failed to save overlay:', error));
    }, 200);

    document.getElementById('blurSlider').addEventListener('input', (e) => {
        const value = e.target.value;
        document.getElementById('blurValue').textContent = value;
        saveBlur(parseInt(value, 10));
    });

    document.getElementById('overlaySlider').addEventListener('input', (e) => {
        const value = e.target.value;
        document.getElementById('overlayValue').textContent = value;
        saveOverlay(parseInt(value, 10));
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

    document.getElementById('showStatusToggle').addEventListener('change', async (e) => {
        await settingsManager.updateSetting('layout', 'showStatus', e.target.checked);
        toggleElement('status-strip', e.target.checked);
    });

    document.getElementById('showRecentToggle').addEventListener('change', async (e) => {
        await settingsManager.updateSetting('layout', 'showRecent', e.target.checked);
        toggleElement('recent-section', e.target.checked);
    });

    document.getElementById('enhancedAnimationsToggle').addEventListener('change', async (e) => {
        await settingsManager.updateSetting('appearance', 'enhancedAnimations', e.target.checked);
        applyEnhancedAnimations(e.target.checked);
    });

    document.getElementById('themeToggle').addEventListener('change', async (e) => {
        const next = e.target.checked ? 'light' : 'dark';
        await settingsManager.updateSetting('appearance', 'theme', next);
        applyTheme(next);
    });

    // Data Management
    document.getElementById('exportBtn').addEventListener('click', async () => {
        try {
            await importExportManager.createBackup();
        } catch (error) {
            alert('导出失败：' + error.message);
        }
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
            try {
                await importExportManager.resetAllData();
                alert('设置与数据已重置！页面将刷新。');
                location.reload();
            } catch (error) {
                alert('重置失败：' + error.message);
            }
        }
    });

    // Search
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = e.target.value.trim();
            if (query) {
                searchManager.search(query);
                saveRecentSearch(query);
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

    document.getElementById('iconInput').addEventListener('input', debounce(() => {
        let url = document.getElementById('urlInput').value.trim();
        if (url && isValidUrl(normalizeUrl(url))) {
            previewBookmark(normalizeUrl(url));
        }
    }, 300));

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

    const dateFormat = settings?.appearance?.dateFormat || 'long';
    document.getElementById('date').textContent = dateFormat === 'short'
        ? `${month}月${day}日 ${weekday}`
        : `${year}年${month}月${day}日 ${weekday}`;
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
    editingBookmarkId = null;
    document.querySelector('#addModal .modal-header h2').textContent = '添加书签';
    document.getElementById('addModal').classList.add('active');
    document.getElementById('urlInput').focus();
}

function openEditModal(bookmark) {
    editingBookmarkId = bookmark.id;
    document.querySelector('#addModal .modal-header h2').textContent = '编辑书签';
    document.getElementById('addModal').classList.add('active');
    document.getElementById('urlInput').value = bookmark.url;
    document.getElementById('nameInput').value = bookmark.name || '';
    document.getElementById('folderSelect').value = bookmark.folder || '全部';
    document.getElementById('iconInput').value = isManagedFavicon(bookmark.icon) ? '' : (bookmark.icon || '');
    previewBookmark(bookmark.url);
}

function closeModal() {
    document.getElementById('addModal').classList.remove('active');
    document.getElementById('urlInput').value = '';
    document.getElementById('nameInput').value = '';
    document.getElementById('iconInput').value = '';
    document.getElementById('preview').style.display = 'none';
}

function previewBookmark(url) {
    try {
        const urlObj = new URL(url);
        const iconInput = document.getElementById('iconInput').value.trim();
        const faviconUrl = iconInput || getFaviconUrl(url);
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
    const iconInput = document.getElementById('iconInput');

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
        const customIcon = iconInput.value.trim();

        if (editingBookmarkId) {
            await bookmarksManager.updateBookmark(editingBookmarkId, {
                url,
                name,
                icon: customIcon,
                folder
            });
        } else {
            await bookmarksManager.addBookmark(url, name, customIcon, folder);
        }
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

    try {
        await bookmarksManager.deleteBookmark(id);
        loadBookmarks();
    } catch (error) {
        alert('删除失败：' + error.message);
    }
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
    card.rel = 'noopener noreferrer';
    card.style.animationDelay = `${index * 0.05}s`;
    card.draggable = false;
    card.addEventListener('dragstart', (e) => onBookmarkDragStart(e, bookmark, card));
    card.addEventListener('dragover', (e) => e.preventDefault());
    card.addEventListener('drop', (e) => handleDropOnBookmark(e, bookmark));
    card.addEventListener('dragend', clearDragState);
    attachLongPressDrag(card);
    card.addEventListener('click', (e) => {
        if (isDragging) {
            e.preventDefault();
            e.stopPropagation();
        }
    });

    const icon = document.createElement('div');
    icon.className = 'bookmark-icon';
    const img = document.createElement('img');
    img.src = getBookmarkIconUrl(bookmark);
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

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.innerHTML = '✎';
    editBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openEditModal(bookmark);
    };

    card.appendChild(deleteBtn);
    card.appendChild(editBtn);
    card.appendChild(icon);
    card.appendChild(name);

    return card;
}

function switchFolder(folder) {
    currentFolder = folder;
    loadBookmarks();
}

function createFolderCard(folder, index) {
    const card = document.createElement('div');
    const bookmarks = bookmarksManager.getBookmarksByFolder(folder);
    card.className = 'folder-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.dataset.folder = folder;
    card.style.setProperty('--folder-accent', getFolderAccent(index));
    card.onclick = () => switchFolder(folder);
    card.onkeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            switchFolder(folder);
        }
    };
    card.addEventListener('dragover', (e) => e.preventDefault());
    card.addEventListener('drop', (e) => handleDropOnFolder(e, folder));
    card.addEventListener('dragend', clearDragState);

    const preview = document.createElement('div');
    preview.className = 'folder-preview';
    bookmarks.slice(0, 4).forEach(bookmark => {
        const bubble = document.createElement('div');
        bubble.className = 'preview-bubble';
        const img = document.createElement('img');
        img.src = getBookmarkIconUrl(bookmark);
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

    const actions = document.createElement('div');
    actions.className = 'folder-actions';
    actions.setAttribute('aria-label', '文件夹操作');
    actions.onkeydown = (event) => event.stopPropagation();

    const rename = document.createElement('button');
    rename.type = 'button';
    rename.className = 'folder-action';
    rename.title = '重命名文件夹';
    rename.textContent = '✎';
    rename.onclick = (event) => {
        event.stopPropagation();
        renameFolder(folder);
    };

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'folder-action danger';
    remove.title = '删除文件夹';
    remove.textContent = '×';
    remove.onclick = (event) => {
        event.stopPropagation();
        deleteFolder(folder);
    };

    actions.appendChild(rename);
    actions.appendChild(remove);
    card.appendChild(actions);

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

    try {
        await bookmarksManager.addFolder(cleanName);
        loadBookmarks();
    } catch (error) {
        alert('创建文件夹失败：' + error.message);
    }
}

async function renameFolder(folder) {
    const nextName = prompt('新的文件夹名称', folder);
    if (!nextName || nextName.trim() === folder) return;
    try {
        const renamed = await bookmarksManager.renameFolder(folder, nextName);
        if (!renamed) {
            alert('文件夹名称不能为空，也不能与现有文件夹重复。');
            return;
        }
        loadBookmarks();
    } catch (error) {
        alert('重命名失败：' + error.message);
    }
}

async function deleteFolder(folder) {
    if (!confirm(`删除文件夹“${folder}”？其中的书签会移回“全部”。`)) return;
    try {
        await bookmarksManager.deleteFolder(folder);
        loadBookmarks();
    } catch (error) {
        alert('删除失败：' + error.message);
    }
}

// ============================================
// Drag & Drop Helpers
// ============================================

function getSortedBookmarks(folder) {
    const targetFolder = folder || '全部';
    const list = targetFolder === '全部'
        ? bookmarksManager.getAllBookmarks()
        : bookmarksManager.getBookmarksByFolder(targetFolder);
    return list.map((bookmark) => ({ ...bookmark }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.id - b.id));
}

function onBookmarkDragStart(e, bookmark) {
    if (!e) return;
    isDragging = true;
    draggedBookmark = { ...bookmark, sourceFolder: bookmark.folder || '全部' };
    if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', String(bookmark.id));
        e.dataTransfer.effectAllowed = 'move';
    }
}

async function handleDropOnBookmark(e, targetBookmark) {
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

    try {
        await persistFolderOrder(folder, list);
        loadBookmarks();
    } catch (error) {
        alert('排序保存失败：' + error.message);
    } finally {
        clearDragState();
    }
}

async function handleDropOnFolder(e, folderName) {
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

    try {
        await bookmarksManager.reorderBookmarks(all);
        loadBookmarks();
    } catch (error) {
        alert('移动书签失败：' + error.message);
    } finally {
        clearDragState();
    }
}

async function persistFolderOrder(folderName, orderedList) {
    const all = bookmarksManager.getAllBookmarks().map(b => ({ ...b }));
    const others = all.filter(b => b.folder !== folderName);
    const merged = [...others, ...orderedList];
    await bookmarksManager.reorderBookmarks(merged);
}

function normalizeFolderOrders(allBookmarks, folderName) {
    const list = allBookmarks
        .filter(b => b.folder === folderName)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.id - b.id));
    list.forEach((b, idx) => { b.order = idx; });
}

function clearDragState() {
    draggedBookmark = null;
    isDragging = false;
}

function attachLongPressDrag(card) {
    const start = () => {
        longPressTimer = setTimeout(() => {
            card.draggable = true;
            card.classList.add('drag-ready');
        }, 300);
    };

    const cancel = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        if (!isDragging) {
            card.draggable = false;
            card.classList.remove('drag-ready');
        }
    };

    card.addEventListener('pointerdown', start);
    card.addEventListener('pointerup', cancel);
    card.addEventListener('pointerleave', cancel);
    card.addEventListener('pointercancel', cancel);
}

// ============================================
// Utility Functions
// ============================================

function getFaviconUrl(url) {
    try {
        const pageUrl = new URL(url).href;
        const faviconUrl = new URL(chrome.runtime.getURL('/_favicon/'));
        faviconUrl.searchParams.set('pageUrl', pageUrl);
        faviconUrl.searchParams.set('size', '64');
        return faviconUrl.toString();
    } catch (e) {
        return getDefaultIcon();
    }
}

function getBookmarkIconUrl(bookmark) {
    const icon = bookmark?.icon || '';
    return !icon || isManagedFavicon(icon) ? getFaviconUrl(bookmark?.url) : icon;
}

function isManagedFavicon(icon) {
    return /^https:\/\/www\.google\.com\/s2\/favicons/i.test(icon || '')
        || /^chrome-extension:\/\/[^/]+\/_favicon\//i.test(icon || '');
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
// Search Suggestions
// ============================================

function loadSearchSuggestions() {
    chrome.storage.sync.get(['recentSearches'], (result) => {
        const list = Array.isArray(result.recentSearches) ? result.recentSearches : [];
        renderSearchSuggestions(list);
    });
}

function saveRecentSearch(query) {
    chrome.storage.sync.get(['recentSearches'], (result) => {
        const list = Array.isArray(result.recentSearches) ? result.recentSearches : [];
        const normalized = query.trim();
        const next = [normalized, ...list.filter(q => q !== normalized)].slice(0, 6);
        chrome.storage.sync.set({ recentSearches: next }, () => {
            renderSearchSuggestions(next);
        });
    });
}

function renderSearchSuggestions(list) {
    const datalist = document.getElementById('searchSuggestions');
    if (!datalist) return;
    datalist.innerHTML = '';
    list.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        datalist.appendChild(option);
    });
}

// ============================================
// Backup Reminder
// ============================================

function scheduleBackupReminder() {
    chrome.storage.sync.get(['lastBackupPrompt'], (result) => {
        const last = result.lastBackupPrompt || 0;
        const now = Date.now();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (now - last < sevenDays) return;
        showBackupToast();
    });
}

function showBackupToast() {
    if (document.getElementById('backupToast')) return;
    const toast = document.createElement('div');
    toast.id = 'backupToast';
    toast.className = 'backup-toast';
    toast.innerHTML = `
        <div class="backup-text">💾 建议导出备份，避免数据丢失</div>
        <div class="backup-actions">
            <button class="ghost-btn primary" id="backupNowBtn">立即导出</button>
            <button class="ghost-btn" id="backupLaterBtn">稍后</button>
        </div>
    `;
    document.body.appendChild(toast);

    document.getElementById('backupNowBtn').onclick = async () => {
        await importExportManager.createBackup();
        closeBackupToast();
    };
    document.getElementById('backupLaterBtn').onclick = closeBackupToast;
}

function closeBackupToast() {
    chrome.storage.sync.set({ lastBackupPrompt: Date.now() });
    const toast = document.getElementById('backupToast');
    if (toast) toast.remove();
}

// ============================================
// Recent Sites
// ============================================

function loadRecentSites() {
    if (!chrome.history) {
        renderRecentMessage('无法访问历史记录（未授权）', true);
        return;
    }

    const daysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    chrome.history.search({ text: '', startTime: daysAgo, maxResults: 5000 }, (items) => {
        if (chrome.runtime.lastError) {
            renderRecentMessage('读取历史记录失败', true);
            return;
        }
        const hostMap = new Map();

        items.forEach(item => {
            try {
                const url = new URL(item.url);
                if (!['http:', 'https:'].includes(url.protocol)) return;
                if (url.hostname === 'newtab' || url.hostname.endsWith('google.com')) {
                    // ignore internal/newtab noise
                    return;
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
        card.rel = 'noopener noreferrer';

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

function renderRecentMessage(text, showAction = false) {
    const track = document.getElementById('recentTrack');
    if (!track) return;
    track.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'recent-meta';
    empty.textContent = text;
    track.appendChild(empty);

    if (showAction) {
        const btn = document.createElement('button');
        btn.className = 'ghost-btn';
        btn.textContent = '打开权限设置';
        btn.onclick = () => {
            const id = chrome.runtime.id;
            window.open(`chrome://extensions/?id=${id}`, '_blank');
        };
        track.appendChild(btn);
    }
}
