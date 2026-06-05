# Interactive Lab Catalog

This folder contains the portable HTML labs used by the book chapters.

- `Interactive Lab Catalog.md`: human-readable catalog.
- `catalog.csv`: machine-readable manifest.
- `book_chapters/`: hand-built chapter labs such as A01/A02/A03.
- `<lesson-id>-<slug>-lab.html`: generated lesson labs.

Open the catalog: [[_interactive/Interactive Lab Catalog]]

## Obsidian Desktop And Android

The vault embeds labs through the local Obsidian plugin:

```html
<div class="interactive-lab-embed" data-interactive-lab-embed="true" data-interactive-lab-path="book_chapters/A01-biology-gnn-lab.html" data-interactive-lab-title="interactive lab">
<iframe src="http://127.0.0.1:8766/book_chapters/A01-biology-gnn-lab.html" class="interactive-lab-frame" data-interactive-lab-frame="true" data-interactive-lab-path="book_chapters/A01-biology-gnn-lab.html" width="100%" height="720" loading="lazy" scrolling="no" sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-popups" allow="fullscreen; pointer-lock" title="interactive lab" style="width:100%;height:720px;min-height:620px;border:1px solid #1f3544;border-radius:10px;background:#071015;display:block;box-sizing:border-box;overflow:hidden;"></iframe>
</div>
```

Why `8766`: the AI Knowledge vault convention uses `8765`, so this vault uses a dedicated port to avoid cross-vault 404/blank iframes.

On desktop, enable `.obsidian/plugins/interactive-lab-server` and reload Obsidian. The plugin serves `_interactive/` locally.

On Android, the same plugin does not need a Node server. It reads the synced HTML file from the vault and injects it into the iframe as `srcdoc`, so the note stays readable offline after sync.

Each important chapter also keeps:

- an always-visible SVG concept figure in the Markdown note;
- a direct wiki link to the HTML lab file for full-screen use;
- no CDN dependency for the hand-built A01/A02/A03 labs.

## Manual Browser Fallback

If Obsidian is not running the plugin, use:

```powershell
.\_interactive\start-interactive-server.ps1
```

Then open `http://127.0.0.1:8766/` or any lab path shown in the chapter.
