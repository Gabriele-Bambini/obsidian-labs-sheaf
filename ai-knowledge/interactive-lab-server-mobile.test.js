const assert = require("assert");
const fs = require("fs");
const Module = require("module");
const path = require("path");

const pluginDir = path.resolve(__dirname, "..", ".obsidian", "plugins", "interactive-lab-server");
const manifestPath = path.join(pluginDir, "manifest.json");
const mainPath = path.join(pluginDir, "main.js");

function loadPluginWithMobileObsidian() {
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "obsidian") {
      return {
        Notice: class Notice {
          constructor(message) {
            this.message = message;
          }
        },
        Platform: { isMobileApp: true },
        Plugin: class Plugin {
          registerMarkdownPostProcessor() {}
        }
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[require.resolve(mainPath)];
    return require(mainPath);
  } finally {
    Module._load = originalLoad;
  }
}

async function run() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.strictEqual(
    manifest.isDesktopOnly,
    false,
    "Interactive Lab Server must be installable on Obsidian Android"
  );

  const source = fs.readFileSync(mainPath, "utf8");
  assert(
    !/^\s*const\s+(?:fs|http|path)\s*=\s*require\(["'](?:fs|http|path)["']\)/m.test(source),
    "Node-only modules must not be required at top level because mobile plugin loading would fail"
  );
  assert(source.includes("registerMarkdownPostProcessor"), "Plugin must process rendered iframes on mobile");
  assert(source.includes("srcdoc"), "Plugin must inject mobile labs through iframe srcdoc");
  assert(
    source.includes('iframe[src^="_interactive/"]') && source.includes('iframe[src^="./_interactive/"]'),
    "Mobile iframe processor must also catch relative vault lab iframes, not only localhost URLs"
  );
  assert(
    source.includes("data-interactive-lab-desktop-src"),
    "Mobile srcdoc injection must preserve the original desktop iframe src for Windows compatibility/debugging"
  );

  const PluginClass = loadPluginWithMobileObsidian();
  const files = {
    "_interactive/sample.html": [
      "<!doctype html>",
      "<html><head>",
      '<link rel="stylesheet" href="shared/core.css?cache=1">',
      "</head><body>",
      '<main class="gnn-lab"><canvas id="canvas"></canvas></main>',
      '<script src="shared/core.js?cache=1"></script>',
      "</body></html>"
    ].join(""),
    "_interactive/sample.android.html": [
      "<!doctype html>",
      "<html><head>",
      '<link rel="stylesheet" href="shared/core.css">',
      "</head><body>",
      '<main data-mobile="yes"></main>',
      '<script src="shared/core.js"></script>',
      "</body></html>"
    ].join(""),
    "_interactive/shared/core.css": ".gnn-lab{height:100%;}",
    "_interactive/shared/core.js": "window.__sampleLabReady = true;"
  };
  const reads = [];
  const plugin = new PluginClass();
  plugin.app = {
    vault: {
      adapter: {
        async exists(filePath) {
          return Object.prototype.hasOwnProperty.call(files, filePath);
        },
        async read(filePath) {
          reads.push(filePath);
          if (!Object.prototype.hasOwnProperty.call(files, filePath)) {
            throw new Error(`Missing ${filePath}`);
          }
          return files[filePath];
        }
      }
    }
  };

  const srcdoc = await plugin.inlineLabHtmlForMobile("sample.html?cache=2");
  assert(srcdoc.includes('data-obsidian-android-srcdoc="true"'), "srcdoc should be marked as Android-injected");
  assert(srcdoc.includes('data-mobile="yes"'), "Android-specific lab variant should be preferred when present");
  assert(srcdoc.includes("<style"), "CSS asset should be inlined into srcdoc");
  assert(srcdoc.includes(".gnn-lab{height:100%;}"), "CSS content should be included");
  assert(srcdoc.includes("<script"), "JS asset should be inlined into srcdoc");
  assert(srcdoc.includes("window.__sampleLabReady = true;"), "JS content should be included");
  assert(!srcdoc.includes('href="shared/core.css"'), "relative stylesheet link should not remain in mobile srcdoc");
  assert(!srcdoc.includes('src="shared/core.js"'), "relative script src should not remain in mobile srcdoc");
  assert(reads.includes("_interactive/sample.android.html"), "Android lab variant should be read first");
  assert.strictEqual(await plugin.inlineLabHtmlForMobile("../secret.html"), null, "path traversal must be rejected");

  const fakeIframe = {
    attrs: { src: "_interactive/sample.html?cache=2" },
    getAttribute(name) {
      return this.attrs[name] || "";
    },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    removeAttribute(name) {
      delete this.attrs[name];
    }
  };
  await plugin.injectMobileSrcdoc(fakeIframe, "sample.html?cache=2", "_interactive/sample.html?cache=2");
  assert(!("src" in fakeIframe.attrs), "Mobile iframe should remove localhost/relative src after srcdoc injection");
  assert(fakeIframe.attrs.srcdoc.includes('data-obsidian-android-srcdoc="true"'), "Mobile iframe should receive inline srcdoc");
  assert.strictEqual(
    fakeIframe.attrs["data-interactive-lab-desktop-src"],
    "_interactive/sample.html?cache=2",
    "Mobile iframe should preserve the original Windows/desktop source"
  );
  assert.strictEqual(
    fakeIframe.attrs["data-interactive-lab-path"],
    "sample.html",
    "Mobile iframe should expose the normalized lab path"
  );

  const vaultRoot = path.resolve(__dirname, "..");
  const coverage = JSON.parse(fs.readFileSync(path.join(__dirname, "coverage-data.json"), "utf8"));
  const realPlugin = new PluginClass();
  realPlugin.app = {
    vault: {
      adapter: {
        async exists(filePath) {
          return fs.existsSync(path.join(vaultRoot, filePath));
        },
        async read(filePath) {
          return fs.promises.readFile(path.join(vaultRoot, filePath), "utf8");
        }
      }
    }
  };
  realPlugin.mobileSrcdocCache = new Map();

  for (const { lab } of coverage.existingLabs) {
    const mobileSrcdoc = await realPlugin.inlineLabHtmlForMobile(lab);
    assert(mobileSrcdoc, `${lab} should produce Android srcdoc`);
    assert(
      mobileSrcdoc.includes('data-obsidian-android-srcdoc="true"'),
      `${lab} should carry the Android srcdoc marker`
    );
    assert(
      /(?:lab-viewport|stage|canvas)/i.test(mobileSrcdoc),
      `${lab} srcdoc should still contain the interactive visual surface`
    );
    assert(!/<script\b[^>]*\bsrc=/i.test(mobileSrcdoc), `${lab} should not leave local script src dependencies`);
    assert(!/<link\b[^>]*\bhref=/i.test(mobileSrcdoc), `${lab} should not leave local stylesheet dependencies`);
  }

  console.log(
    `interactive-lab-server mobile test passed: plugin can load on Android and inline ${coverage.existingLabs.length} lab(s) into iframe srcdoc.`
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
