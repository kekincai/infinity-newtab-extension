# Infinity New Tab

一个面向 Chrome 桌面端的二次元启动台新标签页。界面、状态、书签、设置与 Liquid Glass 光学层均由 TypeScript 原生 Web Components 实现。

## 功能

- 书签和文件夹处于同一个居中启动台网格，卡片保持正方形。
- 书签支持添加、编辑、删除、拖动排序和拖入文件夹；移动采用单份数据事务，不会复制条目。
- 最近常访问按网站主页合并，横向滚动，不显示访问次数。
- 搜索支持 Google、Bing、百度与 DuckDuckGo，并保存本地搜索建议。
- 活动栏显示正在播放的标签页与下载；系统栏显示 CPU、内存和电池信息。
- 支持随机二次元壁纸、本地图片、本地视频、循环静音自动播放、模糊度和暗度。
- 设置中可控制时钟、搜索、书签、状态、常访问、文字颜色和增强动画。
- 书签与设置存入 `chrome.storage.sync`，本地媒体存入 IndexedDB。

## Liquid Glass

全局只有一个无内容的光学水滴层：

- 指针进入交互区域时出现，离开后消失，不复制按钮文字或图标。
- 水滴的位置由每一次真实指针坐标直接决定，不播放预制的 A 到 B 时间轴。
- 停在两个组件之间时，水滴会停在相同的中间状态；继续或反向移动会从当前状态继续。
- 速度只影响水滴拉伸与折射强度，不会改变方向或触发翻转。
- 运行时生成 SVG 位移贴图，通过 `feDisplacementMap` 折射水滴下方的真实界面。

光学结构参考 [Liquid Glass in CSS and SVG](https://kube.io/blog/liquid-glass-css-svg/)，没有使用文章截图或图片素材。

## 数据导入与导出

设置 → 数据提供：

- 导出 `2.0` JSON：包含同步数据及本地图片/视频壁纸。
- 导入旧版 `1.0` 或新版 `2.0` JSON。
- 自动补齐旧备份缺少的状态栏、常访问、主题等设置。
- 自动合并同一文件夹中的重复网址，拒绝 `javascript:` 等危险 URL。
- 导入会覆盖当前扩展数据，建议先导出一份备份。

此前使用的 `bookmarks`、`folders`、`settings`、`todos`、`recentSearches` 与 `lastBackupPrompt` 数据键继续兼容。

## 安装

1. 在项目目录构建 TypeScript：

   ```bash
   npm install
   npm run build
   ```

2. 打开 `chrome://extensions` 并启用开发者模式。
3. 点击“加载已解压的扩展程序”，选择本项目目录。
4. 已经加载过时，点击扩展卡片上的“重新加载”，再打开新标签页。

当前版本应显示为 `2.0.0`。

## 项目结构

```text
infinity-newtab-extension/
├── manifest.json
├── newtab.html
├── styles.css
├── src/
│   ├── app.ts
│   ├── components/       # 原生 Web Components
│   └── core/             # 状态、存储、备份、媒体与历史记录
├── modules/
│   └── app.js            # 构建产物，Chrome 实际加载
├── tests/
│   ├── unit-entry.ts
│   └── e2e/
└── icons/
```

旧的全局 `script.js` 与 `modules/*.js` 运行时已经删除。

## 开发与验证

```bash
npm run build
npm run typecheck
npm test
```

自动化测试不读取日常 Chrome 数据，覆盖：

- 旧版备份清洗与迁移。
- 危险 URL 过滤与同步写入失败回滚。
- 书签拖入文件夹和同文件夹排序不复制。
- 水滴停在组件间隙、继续移动和反向移动的实时状态。
- 设置、本地壁纸、导入、导出和备份提醒布局。

仓库不保存界面截图或截图基线；回归以代码、DOM、存储结果和指针几何状态为准。

## 权限与隐私

- `storage`：同步书签与设置。
- `history`：仅在本机统计最近常访问的网站。
- `tabs`：识别正在播放媒体的标签页并支持跳转。
- `downloads`：显示进行中的下载。
- `favicon`：使用 Chrome 本地 favicon 接口获取图标。

扩展不会把浏览历史发送给第三方图标服务。随机二次元壁纸依赖 `dmoe.cc` 的可用性。

## 更新日志

### 2.0.0 - 2026-07-29

- 全面替换为 TypeScript + 原生 Web Components 架构。
- 删除全局脚本、旧模块、旧 Liquid Glass 运行时和截图基线。
- 使用单一全局实时指针光学场重写 Liquid Glass，不再模拟组件切换动画。
- 重写书签事务与拖放，修复移动、排序导致复制的问题。
- 保留旧数据键和 `1.0` 备份导入，导出格式继续为 `2.0`。
- 重写单元测试与 Chrome 界面回归测试。
