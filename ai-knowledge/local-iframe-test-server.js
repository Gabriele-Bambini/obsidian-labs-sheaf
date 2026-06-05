const http = require("http");
const fs = require("fs");
const path = require("path");

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  return "application/octet-stream";
}

function createServer(root) {
  return http.createServer((request, response) => {
    const urlPath = decodeURIComponent(new URL(request.url, "http://127.0.0.1:8765").pathname);
    const safePath = path.normalize(urlPath.replace(/^\/+/, "")).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(root, safePath);

    if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": contentType(filePath) });
    fs.createReadStream(filePath).pipe(response);
  });
}

async function ensureLocalServer(root) {
  const server = createServer(root);
  const ownsServer = await new Promise((resolve, reject) => {
    server.once("listening", () => resolve(true));
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }
      reject(error);
    });
    server.listen(8765, "127.0.0.1");
  });

  return async function closeLocalServer() {
    if (!ownsServer) return;
    await new Promise((resolve) => server.close(resolve));
  };
}

module.exports = { ensureLocalServer };
