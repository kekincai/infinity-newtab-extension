// 初始化
document.addEventListener('DOMContentLoaded', () => {
    updateTime();
    setInterval(updateTime, 1000);
    loadBookmarks();
    initEventListeners();
});

// 更新时间显示
function updateTime() {
    const now = new Date();
    const timeElement = document.getElementById('time');
    const dateElement = document.getElementById('date');

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    timeElement.textContent = `${hours}:${minutes}`;

    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[now.getDay()];
    dateElement.textContent = `${year}年${month}月${day}日 ${weekday}`;
}

// 初始化事件监听器
function initEventListeners() {
    const addBtn = document.getElementById('addBtn');
    const modal = document.getElementById('addModal');
    const closeBtn = document.getElementById('closeBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveBtn = document.getElementById('saveBtn');
    const urlInput = document.getElementById('urlInput');

    addBtn.addEventListener('click', () => openModal());
    closeBtn.addEventListener('click', () => closeModal());
    cancelBtn.addEventListener('click', () => closeModal());
    saveBtn.addEventListener('click', () => saveBookmark());

    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // URL输入时自动预览
    urlInput.addEventListener('input', debounce(() => {
        let url = urlInput.value.trim();
        if (url) {
            url = normalizeUrl(url);
            if (isValidUrl(url)) {
                previewBookmark(url);
            }
        }
    }, 500));

    // 回车键保存
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveBookmark();
        }
    });
}

// 打开模态框
function openModal() {
    const modal = document.getElementById('addModal');
    modal.classList.add('active');
    document.getElementById('urlInput').focus();
}

// 关闭模态框
function closeModal() {
    const modal = document.getElementById('addModal');
    modal.classList.remove('active');
    document.getElementById('urlInput').value = '';
    document.getElementById('nameInput').value = '';
    document.getElementById('preview').style.display = 'none';
}

// 预览书签
function previewBookmark(url) {
    try {
        const urlObj = new URL(url);
        const faviconUrl = getFaviconUrl(url);
        const name = document.getElementById('nameInput').value || urlObj.hostname;

        const preview = document.getElementById('preview');
        const previewIcon = document.getElementById('previewIcon');
        const previewName = document.getElementById('previewName');

        previewIcon.src = faviconUrl;
        previewName.textContent = name;
        preview.style.display = 'flex';
    } catch (e) {
        console.error('Invalid URL:', e);
    }
}

// 保存书签
async function saveBookmark() {
    const urlInput = document.getElementById('urlInput');
    const nameInput = document.getElementById('nameInput');
    let url = urlInput.value.trim();

    // 标准化URL
    if (url) {
        url = normalizeUrl(url);
    }

    if (!isValidUrl(url)) {
        alert('请输入有效的网址（例如：www.google.com 或 https://www.google.com）');
        return;
    }

    try {
        const urlObj = new URL(url);
        const name = nameInput.value.trim() || urlObj.hostname;
        const faviconUrl = getFaviconUrl(url);

        const bookmark = {
            id: Date.now(),
            url: url,
            name: name,
            icon: faviconUrl
        };

        // 获取现有书签
        const bookmarks = await getBookmarks();
        bookmarks.push(bookmark);

        // 保存到Chrome存储
        await saveToStorage(bookmarks);

        // 重新加载书签
        loadBookmarks();
        closeModal();
    } catch (e) {
        alert('保存失败，请重试');
        console.error('Save error:', e);
    }
}

// 删除书签
async function deleteBookmark(id) {
    if (!confirm('确定要删除这个书签吗？')) {
        return;
    }

    const bookmarks = await getBookmarks();
    const filtered = bookmarks.filter(bookmark => bookmark.id !== id);
    await saveToStorage(filtered);
    loadBookmarks();
}

// 加载书签
async function loadBookmarks() {
    const bookmarks = await getBookmarks();
    const grid = document.getElementById('bookmarksGrid');

    grid.innerHTML = '';

    bookmarks.forEach((bookmark, index) => {
        const card = createBookmarkCard(bookmark, index);
        grid.appendChild(card);
    });
}

// 创建书签卡片
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

// 获取书签数据
async function getBookmarks() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['bookmarks'], (result) => {
            resolve(result.bookmarks || []);
        });
    });
}

// 保存到存储
async function saveToStorage(bookmarks) {
    return new Promise((resolve) => {
        chrome.storage.sync.set({ bookmarks }, () => {
            resolve();
        });
    });
}

// 获取网站图标URL
function getFaviconUrl(url) {
    try {
        const urlObj = new URL(url);
        // 使用Google的favicon服务
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
    } catch (e) {
        return getDefaultIcon();
    }
}

// 获取默认图标
function getDefaultIcon() {
    // 返回一个简单的SVG图标作为base64
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjNjM2NmYxIi8+PHBhdGggZD0iTTE2IDhWMjRNOCAxNkgyNCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=';
}

// 标准化URL（自动添加协议）
function normalizeUrl(url) {
    url = url.trim();
    // 如果没有协议，自动添加 https://
    if (!url.match(/^[a-zA-Z]+:\/\//)) {
        url = 'https://' + url;
    }
    return url;
}

// 验证URL
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

// 防抖函数
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
