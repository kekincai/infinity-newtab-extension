/**
 * Main Application Script
 * Integrates all modules and manages the UI
 */

// Application State
let currentFolder = '全部';

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

    // Load content
    loadBookmarks();
    applySettings();
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
    toggleElement('time-display', settings.layout.showClock);
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
        toggleElement('time-display', e.target.checked);
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
            await settingsManager.resetToDefaults();
            alert('设置已重置！页面将刷新。');
            location.reload();
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

    // Quick search focus with '/'
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            document.getElementById('searchInput').focus();
        }
    });

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
        const name = nameInput.value.trim() || urlObj.hostname;
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
    const bookmarks = bookmarksManager.getBookmarksByFolder(currentFolder);

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

    if (bookmarks.length === 0 && currentFolder !== '全部') {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = '这里空空的，添加一些书签吧';
        grid.appendChild(empty);
        return;
    }

    bookmarks.forEach((bookmark, index) => {
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
    name.textContent = bookmark.name;

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
