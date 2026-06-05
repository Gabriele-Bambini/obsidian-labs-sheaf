# Obsidian Usage

The chapter notes use three layers of visual explanation:

1. A static SVG figure inside the Markdown note, visible even if scripts are blocked.
2. A local interactive iframe served from `_interactive/` on `http://127.0.0.1:8766/`.
3. A direct wiki link to the same HTML file for full-screen use on desktop or Android.

Recommended iframe size:

```html
<div class="interactive-lab-embed" data-interactive-lab-embed="true" data-interactive-lab-path="book_chapters/A01-biology-gnn-lab.html" data-interactive-lab-title="interactive lab">
<iframe src="http://127.0.0.1:8766/book_chapters/A01-biology-gnn-lab.html" class="interactive-lab-frame" data-interactive-lab-frame="true" data-interactive-lab-path="book_chapters/A01-biology-gnn-lab.html" width="100%" height="720" loading="lazy" scrolling="no" sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-popups" allow="fullscreen; pointer-lock" title="interactive lab" style="width:100%;height:720px;min-height:620px;border:1px solid #1f3544;border-radius:10px;background:#071015;display:block;box-sizing:border-box;overflow:hidden;"></iframe>
</div>
```

This avoids giant frames that push the chapter away and cramped frames that hide the controls.

Do not embed generic repeated visualizations in book chapters. Each hand-built chapter lab should be tied to the actual lesson concept.
