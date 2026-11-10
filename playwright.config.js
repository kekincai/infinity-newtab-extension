const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 30000,
    expect: { timeout: 5000 },
    fullyParallel: false,
    workers: 1,
    reporter: [['list']],
    outputDir: 'test-results',
    use: {
        baseURL: 'http://127.0.0.1:4173',
        channel: 'chrome',
        // Chrome's new headless mode composites SVG backdrop filters and runs WebGPU, so the
        // refraction pixel test and the HDR rim test run without opening a window.
        headless: true,
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
