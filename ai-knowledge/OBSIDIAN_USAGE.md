# Interactive Labs In Obsidian

The notes embed labs through:

```html
<iframe src="https://gabrielebambini00.github.io/obsidian-labs/ai-knowledge/<lab-file>.html"></iframe>
```

The local Obsidian plugin `.obsidian/plugins/interactive-lab-server` starts that server automatically when the vault opens on desktop.

If labs do not appear:

1. Restart Obsidian or run `Ctrl+R`.
2. Open Settings -> Community plugins.
3. Make sure `Interactive Lab Server` is enabled.
4. Test the catalog in a browser: `https://gabrielebambini00.github.io/obsidian-labs/ai-knowledge/index.html`.

This is portable across machines because the plugin serves files from the current vault path instead of using an absolute disk path.

## Android

The same local plugin is mobile-safe. When the vault is synced to Android, Obsidian cannot use the desktop localhost server path, so the plugin reads the synced files from the vault, inlines local CSS/JS assets, and injects the lab into the iframe with `srcdoc`.

No note rewrites are needed. Keep the desktop iframe source:

```html
<iframe src="https://gabrielebambini00.github.io/obsidian-labs/ai-knowledge/<lab-file>.html"></iframe>
```

If a mobile-specific version exists beside the normal lab, Android uses it first:

```text
<lab-file>.android.html
<lab-file>-android.html
<lab-file>.html
```

For reliable Android sync, keep the vault in device storage rather than app-only storage, and sync the full `_interactive` folder plus `.obsidian/plugins/interactive-lab-server`.

The Android path is covered by:

```powershell
node ".obsidian/plugins/interactive-lab-server/mobile-preview-static.test.js"
```
