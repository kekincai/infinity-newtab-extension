const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png'
};

http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const requestedPath = path.resolve(root, `.${pathname === '/' ? '/newtab.html' : pathname}`);
    if (!requestedPath.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
    }

    fs.readFile(requestedPath, (error, data) => {
        if (error) {
            response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
            return;
        }
        response.writeHead(200, {
            'Cache-Control': 'no-store',
            'Content-Type': mimeTypes[path.extname(requestedPath)] || 'application/octet-stream'
        });
        response.end(data);
    });
}).listen(4173, '127.0.0.1');
