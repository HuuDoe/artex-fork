---
name: agent-browser
description: Stealth browser automation via CloakBrowser + agent-browser CLI. Bypasses WAF/bot detection. Use for any web interaction during pentesting.
allowed-tools: Bash(agent-browser:*) Bash(npx:*)
---

# Browser Automation with CloakBrowser + agent-browser

CloakBrowser is a stealth Chromium with 87 source-level C++ patches that defeat bot-detection and WAF fingerprinting (canvas, WebGL, audio, fonts, WebRTC, CDP detection). It is a drop-in replacement for stock Chromium — use it for **all** web browsing tasks, especially targets behind Cloudflare, Akamai, or other bot-detection systems.

`agent-browser` is the CLI that drives it.

## Quick start

```bash
# open browser (headless by default) and navigate
agent-browser open https://example.com
# get accessibility-tree snapshot with element refs
agent-browser snapshot
# interact using @eN refs from the snapshot
agent-browser click @e3
agent-browser fill @e5 "user@example.com"
agent-browser press Enter
# take a screenshot
agent-browser screenshot
# close the browser
agent-browser close
```

## Headed mode (visible browser)

By default the browser runs **headless**. Use `--headed` when:
- The operator explicitly asks for a visible/headed browser
- Human intervention is needed (CAPTCHAs, visual review, manual interaction)

```bash
# launch with visible window — operator sees it via noVNC
agent-browser --headed open https://target.com

# the operator can view and interact at:
#   http://localhost:6080/vnc.html
```

When you're told to use a "headed browser", "visible browser", or "spawn a headed browser", pass `--headed` to `agent-browser open`.

## Commands

### Core

```bash
agent-browser open <url>           # navigate (headless)
agent-browser --headed open <url>  # navigate (visible window)
agent-browser open                 # launch without navigating
agent-browser snapshot             # accessibility-tree with @eN refs
agent-browser click @e3            # click element by ref
agent-browser dblclick @e7         # double-click
agent-browser fill @e5 "text"      # clear + type into input
agent-browser type @e5 "text"      # type without clearing
agent-browser hover @e4            # hover
agent-browser select @e9 "value"   # select dropdown option
agent-browser press Enter          # press key
agent-browser press Tab
agent-browser press Control+a
agent-browser screenshot           # take screenshot
agent-browser screenshot @e5       # screenshot specific element
agent-browser get text             # get page text
agent-browser get title            # get page title
agent-browser get url              # get current URL
agent-browser close                # close browser
```

### Navigation

```bash
agent-browser navigate <url>       # alias for open (when browser already running)
agent-browser back                 # go back
agent-browser forward              # go forward
agent-browser reload               # reload page
```

### Keyboard

```bash
agent-browser press Enter
agent-browser press ArrowDown
agent-browser press Escape
agent-browser keyboard type "text with real keystrokes"
agent-browser keyboard inserttext "text without key events"
```

### Mouse

```bash
agent-browser mouse move 150 300
agent-browser mouse down
agent-browser mouse up
agent-browser mouse wheel 0 100    # scroll
agent-browser scroll down 500      # scroll direction + pixels
agent-browser scroll up 300
```

### Finding elements

```bash
# search by role, text, label, etc.
agent-browser find role "button" click
agent-browser find text "Sign in" click
agent-browser find placeholder "Email" fill "user@example.com"
```

### Tabs

```bash
agent-browser tab list
agent-browser tab new <url>
agent-browser tab close
agent-browser tab select 0
```

### JavaScript evaluation

```bash
agent-browser eval "document.title"
agent-browser eval "document.querySelectorAll('a').length"
```

### Network

```bash
agent-browser network route "**/api/**" --abort
agent-browser network requests             # list captured requests
agent-browser network har save.har         # export HAR
```

### Sessions

```bash
agent-browser --session mysession open https://target.com
agent-browser --session mysession snapshot
agent-browser --session mysession close
agent-browser close --all                  # close all sessions
```

### Waiting

```bash
agent-browser wait url "**/dashboard**"          # wait for URL pattern
agent-browser wait text "Welcome"                # wait for text to appear
agent-browser wait visible @e5                   # wait for element visible
agent-browser wait network-idle                  # wait for network idle
```

## Snapshots

After each command, agent-browser provides an accessibility snapshot of the page. Element refs (`@e1`, `@e2`, ...) are stable handles you use to interact.

```
> agent-browser open https://example.com
✓ Example Domain
  https://example.com/

> agent-browser snapshot
@e1 heading "Example Domain" [level=1]
@e2 paragraph "This domain is for use in illustrative examples..."
@e3 link "More information..." -> https://www.iana.org/domains/example
```

## When to use headed vs headless

| Scenario | Mode |
|----------|------|
| Normal pentesting / recon | headless (default) |
| Target behind CAPTCHA needing human solve | `--headed` |
| Operator asks to "see the browser" | `--headed` |
| Visual review / design inspection | `--headed` |
| Automated form filling / crawling | headless |
| Taking screenshots for reports | headless |

## Prefer agent-browser over playwright-cli

CloakBrowser (via agent-browser) should be used instead of playwright-cli for pentesting targets because:
- Stock Playwright Chromium gets fingerprinted and blocked by WAFs
- CloakBrowser patches CDP detection, canvas fingerprinting, WebGL, audio context, fonts, and WebRTC
- Same CLI workflow — snapshots, refs, interaction — just stealthier
