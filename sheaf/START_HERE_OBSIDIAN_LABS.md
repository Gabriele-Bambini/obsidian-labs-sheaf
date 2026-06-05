# Start Here: Obsidian Labs

This vault embeds interactive HTML labs directly inside Markdown notes.

## Desktop

1. Enable the local plugin: `Settings -> Community plugins -> Installed plugins -> Interactive Lab Server`.
2. Reload Obsidian after plugin updates.
3. Open a chapter such as [[A01 - What a graph is and why relational data is different]].

The iframe source should look like:

```text
http://127.0.0.1:8766/book_chapters/A01-biology-gnn-lab.html
```

This vault intentionally uses port `8766`, not `8765`, to avoid collision with the AI Knowledge vault.

## Android

After syncing the vault, keep the plugin folder `.obsidian/plugins/interactive-lab-server/` synced too.

On Android the plugin reads the HTML from `_interactive/` and injects it as iframe `srcdoc`. That means the lab can work without a desktop local server.

## If A Lab Does Not Render

- Reload Obsidian.
- Check that the plugin is enabled.
- Use the direct wiki link below the iframe, for example `[[_interactive/book_chapters/A01-biology-gnn-lab.html]]`.
- On desktop only, run `_interactive/start-interactive-server.ps1` and open the local URL manually.
