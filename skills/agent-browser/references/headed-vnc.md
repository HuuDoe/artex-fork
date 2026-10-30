# Headed Browser via VNC — Lessons Learned

## How to launch a headed browser for human interaction

The operator sees the browser via noVNC at `http://localhost:6080/vnc.html`.

### Launch command (inside ARTEX container)

```bash
DISPLAY=:99 /root/.cloakbrowser/chrome \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --window-size=1920,1080 \
  --remote-debugging-port=9333 \
  --remote-allow-origins=* \
  'https://target.example.com' &
```

### Critical flags

| Flag | Why |
|------|-----|
| `--no-sandbox` | Required when running as root in a container |
| `--disable-dev-shm-usage` | Prevents `/dev/shm` exhaustion — containers have a 64MB default `/dev/shm` which Chrome fills quickly, causing "Page Unresponsive" crashes |
| `--disable-gpu` | No real GPU in container; avoids GL errors |
| `--remote-debugging-port=9333` | Allows agent-browser / CDP automation of the headed browser |
| `--remote-allow-origins=*` | Required for CDP websocket connections from localhost |
| `DISPLAY=:99` | Routes the window to Xvfb, which x11vnc mirrors to noVNC |

### Connecting agent-browser to the headed Chrome

```bash
agent-browser --cdp 9333 snapshot
agent-browser --cdp 9333 get url
agent-browser --cdp 9333 screenshot
```

### Common pitfalls

1. **"Page Unresponsive" dialog** — Almost always a memory issue, not a network issue. Check for other heavy processes in the container (consul agents, multiple Chrome instances, etc.) and kill them. Use `--disable-dev-shm-usage` to avoid shared memory exhaustion.

2. **agent-browser `--headed` flag ignored** — If the agent-browser daemon is already running (headless), `--headed` on a new command is ignored. You must `agent-browser close --all`, kill all chrome processes, then relaunch. Using `--cdp` to connect to a manually launched headed Chrome avoids this entirely.

3. **Daemon auto-respawns headless** — ARTEX workers using the browser MCP will auto-spawn the agent-browser daemon headless. Use a separate CDP port (9333) for the headed Chrome so they don't conflict.

4. **Multiple Chrome instances** — Each Chrome instance uses 400-600MB. With limited container RAM, only run one headed instance at a time. Kill headless instances first.

### Saving auth state after human login

```bash
# Via CDP websocket (python)
python3 -c "
import json, websocket, subprocess
ver = json.loads(subprocess.check_output(['curl', '-s', 'http://localhost:9333/json/version']))
ws = websocket.create_connection(ver['webSocketDebuggerUrl'])
ws.send(json.dumps({'id': 1, 'method': 'Storage.getCookies'}))
cookies = json.loads(ws.recv())['result']['cookies']
ws.close()
with open('/app/data/tasks/TASK_ID/auth-cookies.json', 'w') as f:
    json.dump(cookies, f, indent=2)
print(f'Saved {len(cookies)} cookies')
"
```
