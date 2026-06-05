const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

function loadPlaywright() {
  const candidates = [
    "playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      // Try the next known bundled runtime path.
    }
  }
  throw new Error("Playwright is not available from the known runtime paths.");
}

const { chromium } = loadPlaywright();
const root = __dirname;
const noteRoot = path.join(root, "..");

const notes = [
  "E01- Neural Network Foundations.md",
  "E02- Backpropagation and Automatic Differentiation.md",
  "E03- Convolutional Neural Networks (CNNs).md",
  "E04- Recurrent Neural Networks (RNNs).md",
  "E05- Attention Mechanisms and Transformers.md",
  "E06- Large Language Models (LLMs).md",
  "E07- Variational Autoencoders (VAEs).md",
  "E08- Generative Adversarial Networks (GANs).md",
  "E09- Diffusion Models.md",
  "E10- Normalizing Flows.md",
  "E11- Reinforcement Learning Foundations.md",
  "E12- Deep Reinforcement Learning.md",
  "E13- Meta-Learning.md",
  "E14- Self-Supervised Learning.md",
  "E15- Neural ODEs.md",
  "E16- Energy-Based Models.md",
  "E17- State Space Models (SSMs).md",
  "E18- Physics-Informed Neural Networks (PINNs).md"
];

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  return "application/octet-stream";
}

function createServer() {
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

function startServer(server, port) {
  return new Promise((resolve, reject) => {
    server.once("listening", () => resolve(port));
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") resolve(false);
      else reject(error);
    });
    server.listen(port, "127.0.0.1");
  });
}

async function startAvailableServer(server) {
  for (const port of [8765, 8766, 8767, 8768]) {
    const result = await startServer(server, port);
    if (result) return result;
  }
  throw new Error("No available local lab test port.");
}

async function main() {
  const server = createServer();
  const serverPort = await startAvailableServer(server);
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const failures = [];

  try {
    for (const noteName of notes) {
      const note = fs.readFileSync(path.join(noteRoot, noteName), "utf8");
      const iframeMatch = note.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i);
      if (!iframeMatch) {
        failures.push(`${noteName}: missing iframe`);
        continue;
      }
      const iframeHtml = iframeMatch[0];
      const src = iframeMatch[1];
      const labFile = src.split("/").pop();
      if (!src.startsWith("http://127.0.0.1:8765/") || !/height="720"/i.test(iframeHtml) || !/background:#071015/i.test(iframeHtml)) {
        failures.push(`${noteName}: iframe is not the 720px dark local-server standard`);
        continue;
      }

      const harnessPath = path.join(os.tmpdir(), `__eblock_${noteName.replace(/[^A-Za-z0-9]/g, "_")}.html`);
      const testIframeHtml = iframeHtml.replace(src, `http://127.0.0.1:${serverPort}/${labFile}`);
      fs.writeFileSync(harnessPath, `<!doctype html><html><body style="margin:0;background:#071015">${testIframeHtml}</body></html>`, "utf8");
      const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
      try {
        await page.goto(`file:///${harnessPath.replace(/\\/g, "/")}`, { waitUntil: "domcontentloaded" });
        await page.locator("iframe").waitFor({ state: "visible" });
        let frame = null;
        for (let attempt = 0; attempt < 40; attempt += 1) {
          frame = page.frames().find((candidate) => candidate.url().includes(labFile));
          if (frame) break;
          await page.waitForTimeout(100);
        }
        if (!frame) throw new Error("iframe did not load");
        await frame.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
        await frame.waitForFunction((file) => {
          const canvas = document.querySelector("#canvas");
          const stateNode = document.querySelector("#state") || document.querySelector("#stateBox");
          if (!canvas || !stateNode) return false;
          const bytes = canvas.toDataURL("image/png").length;
          const minBytes = file.startsWith("e01") || file.startsWith("e02") ? 14000 : 8000;
          return bytes >= minBytes && stateNode.textContent.trim().length >= 80;
        }, labFile, { timeout: 9000 });
        const result = await frame.evaluate(() => {
          const canvas = document.querySelector("#canvas");
          return {
            bytes: canvas.toDataURL("image/png").length,
            text: (document.querySelector("#state") || document.querySelector("#stateBox")).textContent.trim()
          };
        });
        if ((labFile.startsWith("e01") || labFile.startsWith("e02")) && result.bytes < 14000) throw new Error(`weak canvas payload ${result.bytes}`);
        if (result.text.length < 80) throw new Error("weak state text");
      } catch (error) {
        failures.push(`${noteName}: ${error.message}`);
      } finally {
        await page.close();
        if (fs.existsSync(harnessPath)) fs.unlinkSync(harnessPath);
      }
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  if (failures.length) {
    throw new Error(`E-block iframe failures:\n${failures.join("\n")}`);
  }
  console.log(`E-block iframe smoke passed for ${notes.length} labs.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
