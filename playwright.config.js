const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 30000,
    expect: { timeout: 5000 },
    fullyParallel: false,
    workers: 1,
    reporter: [['list']],
    outputDir: '/tmp/infinity-newtab-playwright-results',
    use: {
        baseURL: 'http://127.0.0.1:4173',
        channel: 'chrome',
        // SVG fragment filters in backdrop-filter are not composited by headless Chrome.
        headless: false,
        locale: 'zh-CN',
        screenshot: 'off',
        trace: 'retain-on-failure'
    },
    webServer: {
        command: 'node tests/e2e/server.js',
        url: 'http://127.0.0.1:4173/newtab.html',
        reuseExistingServer: false,
        timeout: 10000
    },
    projects: [
        {
            name: 'desktop-chrome',
            use: { viewport: { width: 1440, height: 1000 } }
        }
    ]
});
