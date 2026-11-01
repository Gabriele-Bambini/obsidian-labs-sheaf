# Interactive Labs

This folder contains local interactive learning labs embedded from the AI Knowledge notes.

## Embedding Pattern

Use this pattern inside a note:

```html
<iframe src="https://gabriele-bambini.github.io/obsidian-labs-sheaf/ai-knowledge/lab-file.html" width="100%" height="720"></iframe>
```

Also include a direct fallback link:

```markdown
Open lab directly: [[_interactive/lab-file.html]]
```

On desktop, the local Obsidian plugin serves `_interactive` on `127.0.0.1:8765`.
On Android, the same plugin does not start a server; it reads the synced lab HTML from the vault, inlines local CSS/JS assets, and injects the result into the rendered iframe as `srcdoc`.

## Phase 1 Labs

- `e02-backprop-computational-graph.html`
- `g02-gcn-message-passing.html`
- `h06-sheaf-diffusion.html`
- `i02-qubit-bloch-sphere.html`

## Verification

Run this from the vault root:

```powershell
node "AI Knowledge\_interactive\verify-interactive-links.js"
```

The script checks that note embeds point to existing local lab files and that each lab exposes a title, viewport, controls, and explanatory state text.
