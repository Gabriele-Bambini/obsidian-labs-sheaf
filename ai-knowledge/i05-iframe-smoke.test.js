const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

function loadPlaywright() {
  const candidates = [
    "playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  ];
  let lastError = null;
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const { chromium } = loadPlaywright();
const root = __dirname;
const notePath = path.join(root, "..", "I05 - Quantum Graph Neural Networks.md");
const note = fs.readFileSync(notePath, "utf8");
const iframeMatch = note.match(/<iframe[^>]+src="([^"]+i05-quantum-graph-circuit-lab\.html)"[^>]*>/i);

if (!iframeMatch) {
  throw new Error("I05 note does not embed the quantum graph circuit iframe.");
}

const iframeHtml = iframeMatch[0];
const iframeSrc = iframeMatch[1];

if (iframeSrc !== "http://127.0.0.1:8765/i05-quantum-graph-circuit-lab.html") {
  throw new Error(`I05 iframe must use the local-server URL. Found: ${iframeSrc}`);
}

if (!/height="720"/i.test(iframeHtml) || !/background:#071015/i.test(iframeHtml)) {
  throw new Error(`I05 iframe is missing the expected 720px dark frame: ${iframeHtml}`);
}

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

function startServer(server) {
  return new Promise((resolve, reject) => {
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
}

async function main() {
  const server = createServer();
  const ownsServer = await startServer(server);
  const tmpRoot = path.join(os.tmpdir(), "obsidian-i05-smoke");
  fs.mkdirSync(tmpRoot, { recursive: true });
  const harnessPath = path.join(tmpRoot, "__i05_iframe_harness.html");
  fs.writeFileSync(harnessPath, `<!doctype html><html><body style="margin:0;background:#071015">${iframeHtml}</body></html>`, "utf8");

  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await page.goto(`file:///${harnessPath.replace(/\\/g, "/")}`);
    await page.locator("iframe").waitFor({ state: "visible" });
    let frame = null;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      frame = page.frames().find((candidate) => /i05-quantum-graph-circuit-lab\.html/.test(candidate.url()));
      if (frame) break;
      await page.waitForTimeout(100);
    }
    if (!frame) throw new Error("I05 iframe did not load from the local server.");

    await frame.locator(".lab-viewport canvas").waitFor({ state: "visible" });
    await frame.waitForFunction(() => window.__i05LabReady === true && window.__i05LabSnapshot());
    await frame.waitForTimeout(180);

    const initial = await frame.evaluate(() => {
      const canvas = document.querySelector(".lab-viewport canvas");
      return {
        canvasBytes: canvas.toDataURL("image/png").length,
        hasRoot: Boolean(document.querySelector(".lab-shell.lab-3d-shell")),
        pageOverflow: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight,
        snapshot: window.__i05LabSnapshot(),
        stateText: document.querySelector("#state").textContent.trim()
      };
    });
    if (!initial.hasRoot) throw new Error("I05 iframe did not expose lab-shell lab-3d-shell.");
    if (initial.canvasBytes < 9000) throw new Error(`I05 iframe canvas appears blank: ${initial.canvasBytes} bytes.`);
    if (initial.pageOverflow > 2) throw new Error(`I05 iframe vertically overflows by ${initial.pageOverflow}px.`);
    if (!initial.snapshot || initial.snapshot.appliedLayers !== 0 || initial.snapshot.nodeCount < 4 || initial.snapshot.edgeCount < 3) {
      throw new Error(`I05 iframe snapshot is weak: ${JSON.stringify(initial.snapshot)}.`);
    }
    if (!/quantum|graph|edge|measurement|readout/i.test(initial.stateText)) {
      throw new Error(`I05 iframe state text is weak: ${initial.stateText}`);
    }

    await frame.locator("#applyLayer").click();
    await frame.waitForFunction((before) => window.__i05LabSnapshot().appliedLayers > before, initial.snapshot.appliedLayers);
    await frame.locator("#measure").click();
    await frame.waitForFunction(() => window.__i05LabSnapshot().measured === true);
    await frame.locator("#toggleEdges").click();
    await frame.waitForFunction(() => window.__i05LabSnapshot().shuffled === true);

    const after = await frame.evaluate(() => ({
      snapshot: window.__i05LabSnapshot(),
      entangleLabel: document.querySelector("#entangleLabel").textContent.trim(),
      energyLabel: document.querySelector("#energyLabel").textContent.trim(),
      depthCostLabel: document.querySelector("#depthCostLabel").textContent.trim()
    }));
    if (after.snapshot.appliedLayers < 1 || after.snapshot.measured !== true || after.snapshot.shuffled !== true) {
      throw new Error(`I05 interaction state is weak: ${JSON.stringify(after)}.`);
    }
    if (!/^\d+\.\d{2}$/.test(after.entangleLabel) || !/^-?\d+\.\d{2}$/.test(after.energyLabel) || !/gates$/.test(after.depthCostLabel)) {
      throw new Error(`I05 metric labels are weak: ${JSON.stringify(after)}.`);
    }

    console.log(`I05 local-server iframe render passed: ${iframeSrc}`);
  } finally {
    await browser.close();
    fs.rmSync(harnessPath, { force: true });
    if (ownsServer) await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
