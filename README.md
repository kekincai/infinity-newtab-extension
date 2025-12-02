# Infinity 新标签页 Chrome 插件

一个美观、现代的 Chrome 新标签页插件，可以快速访问你收藏的网站。

## 功能特性

- ✨ 现代化的玻璃态设计（Glassmorphism）
- 🎨 动态渐变背景和流畅动画
- ⏰ 实时时钟显示
- 🔖 添加、删除和管理书签
- 🌐 自动提取网站图标和名称
- 💾 数据自动保存到 Chrome 同步存储
- 📱 响应式设计，支持各种屏幕尺寸

## 安装方法

1. 下载或克隆此仓库到本地
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `infinity-newtab-extension` 文件夹
6. 完成！打开新标签页即可看到效果

## 使用说明

### 添加书签

1. 点击右下角的 **+** 按钮
2. 输入网址（例如：https://www.google.com）
3. 可选：自定义名称（留空将自动获取网站名称）
4. 点击"保存"

### 删除书签

1. 将鼠标悬停在书签卡片上
2. 点击右上角的 **×** 按钮
3. 确认删除

### 访问网站

直接点击任意书签卡片即可在新标签页中打开对应网站。

## 技术栈

- **HTML5** - 页面结构
- **CSS3** - 现代样式设计
  - Glassmorphism（玻璃态）
  - CSS Grid 布局
  - CSS 动画和过渡效果
- **JavaScript (ES6+)** - 交互逻辑
  - Chrome Storage API
  - 异步处理
  - 事件监听

## 文件结构

```
infinity-newtab-extension/
├── manifest.json       # Chrome 插件配置文件
├── newtab.html        # 新标签页 HTML
├── styles.css         # 样式文件
├── script.js          # JavaScript 逻辑
├── icons/             # 插件图标
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md          # 说明文档
```

## 图标来源

插件使用 Google Favicon Service 来获取网站图标：
```
https://www.google.com/s2/favicons?domain={网站域名}&sz=64
```

## 浏览器兼容性

- ✅ Chrome (推荐)
- ✅ Edge (Chromium 版本)
- ✅ Brave
- ✅ 其他基于 Chromium 的浏览器

## 开发建议

### 自定义样式

可以在 `styles.css` 中修改 CSS 变量来自定义配色：

```css
:root {
    --primary: #6366f1;        /* 主色调 */
    --primary-hover: #4f46e5;  /* 悬停颜色 */
    --bg-dark: #0f172a;        /* 深色背景 */
    /* ... */
}
```

### 修改背景渐变

在 `styles.css` 的 `body` 样式中修改：

```css
body {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

## 隐私说明

- ✅ 所有数据仅存储在本地（Chrome 同步存储）
- ✅ 不收集任何个人信息
- ✅ 不发送数据到第三方服务器
- ⚠️ 使用 Google Favicon Service 获取网站图标

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.0.0 (2025-12-02)
- 🎉 首次发布
- ✨ 基础书签管理功能
- 🎨 现代化 UI 设计
- ⏰ 时钟显示功能
