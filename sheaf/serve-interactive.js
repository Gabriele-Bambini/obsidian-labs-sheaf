const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const argPortIndex = process.argv.indexOf("--port");
const port = argPortIndex >= 0 ? Number(process.argv[argPortIndex + 1]) : 8766;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".md": "text/markdown; charset=utf-8"
};

function send(response, status, body, type = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "content-type": type,
    "access-control-allow-origin": "*",
    "cache-control": "no-store"
  });
  response.end(body);
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://127.0.0.1:${port}`);
  const requestedPath = requestUrl.pathname === "/" ? "/Interactive Lab Catalog.md" : decodeURIComponent(requestUrl.pathname);
  const target = path.resolve(root, `.${requestedPath}`);

  if (!target.startsWith(root)) {
    send(response, 403, "Forbidden");
    return;
  }

  fs.readFile(target, (error, data) => {
    if (error) {
      send(response, 404, "Not found");
      return;
    }

    send(response, 200, data, types[path.extname(target).toLowerCase()] || "application/octet-stream");
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Interactive labs available at http://127.0.0.1:${port}/`);
});
