# Start Here: Obsidian Interactive Labs

Do not search for `Interactive Lab Server` in the online Community Plugins marketplace. It is a local plugin already inside this vault:

```text
.obsidian/plugins/interactive-lab-server
```

To enable it:

1. Open this vault in Obsidian.
2. Open **Settings**.
3. Go to **Community plugins**.
4. Turn off **Restricted mode** if it is on.
5. Look under **Installed plugins**, not Browse.
6. Enable **Interactive Lab Server**.
7. Press `Ctrl+R`.
8. Open a note with an interactive lab in Reading View.

If it still does not appear, confirm Obsidian opened the same vault folder that contains:

```text
.obsidian/plugins/interactive-lab-server/manifest.json
.obsidian/plugins/interactive-lab-server/main.js
AI Knowledge/_interactive/index.html
```

On desktop, the server URL should be:

```text
https://gabrielebambini00.github.io/obsidian-labs/ai-knowledge/index.html
```

This URL is local to each PC. It works only while Obsidian is open with the local plugin enabled, or while the fallback server script is running.

On Android, enable the same local plugin after the vault has synced. The plugin does not start a localhost server there: it automatically reads synced lab files from `_interactive`, inlines their local CSS/JS assets, and injects them into the embedded preview as iframe `srcdoc`. If a lab has `name.android.html` or `name-android.html`, Android uses that file before the desktop `name.html`.

For Android, make sure the synced vault includes:

```text
.obsidian/plugins/interactive-lab-server/manifest.json
.obsidian/plugins/interactive-lab-server/main.js
_interactive/index.html
_interactive/shared/three.min.js
```
