Set shell = CreateObject("WScript.Shell")
node = "C:\Users\Gabriele\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
server = "G:\Other computers\My PC\Desktop\Obsidian\AI Knowledge\_interactive\serve-interactive.js"
cmd = """" & node & """ """ & server & """ --port 8765"
shell.Run cmd, 0, False
