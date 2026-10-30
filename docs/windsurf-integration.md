# Windsurf SWE-2 Integration Guide

How we connected Devin/Windsurf's SWE-2 models to ARTEX by reverse-engineering the Codeium Connect protocol. This guide is reusable for connecting SWE-2 to any tool that needs an LLM backend with tool-calling support.

## Architecture Overview

```
Your Tool ──► Windsurf Provider (Go/Python/etc.) ──► server.codeium.com
                  │                                        │
                  │  Connect protocol (protobuf/HTTP)      │
                  │  windsurf-api-key header (JWT)         │
                  │                                        │
                  ▼                                        ▼
            Hand-rolled protobuf               GetChatMessage (server-streaming)
            No .proto dependency               Returns deltas + tool calls + usage
```

**Key insight:** The Devin desktop client (`~/.local/share/devin/cli/`) talks to Codeium's inference backend via the Connect protocol (gRPC-Web, protobuf over HTTP POST). We bypass the Devin agent harness entirely and call the API directly, giving our own agent loop full control over tool calling, message history, and system prompts.

This is superior to the ACP (Agent Client Protocol) approach, which spawned `devin acp` as a child process — that path had the Devin harness's own agent loop fighting with the host tool's agent loop.

## Prerequisites

1. **Devin Pro subscription** — the API uses your existing Devin account credentials
2. **Devin CLI installed** — needed only for initial auth; after that, just the credential file
3. **Credential file** at `~/.local/share/devin/credentials.toml`:
   ```toml
   windsurf_api_key = "devin-session-token$eyJhbGc..."
   ```
   The value is a JWT (HS256, currently no `exp` claim — long-lived). It's created when you first authenticate via `devin auth login`.

## Protocol Details

### Endpoint

```
POST https://server.codeium.com/exa.api_server_pb.ApiServerService/GetChatMessage
```

Server-streaming Connect protocol — one request, multiple protobuf response frames.

### Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `application/connect+proto` |
| `Connect-Protocol-Version` | `1` |
| `windsurf-api-key` | Value from `credentials.toml` |

### Request Body: Connect Envelope + GetChatMessageRequest

The HTTP body is a Connect envelope wrapping a protobuf message:

```
[1 byte flags][4 bytes big-endian length][protobuf payload]
```

- `flags = 0x00` (uncompressed)
- `length` = byte length of the protobuf payload

### GetChatMessageRequest Protobuf Schema

Reverse-engineered field mapping:

```protobuf
message GetChatMessageRequest {
    Metadata metadata = 1;
    string system_prompt = 2;
    repeated ChatMessagePrompt chat_messages = 3;
    uint64 request_type = 7;     // 5 = CASCADE
    repeated ChatToolDefinition tools = 10;
    string cascade_id = 16;
    string chat_model_uid = 21;  // e.g. "swe-2-high", "swe-2-max"
}

message Metadata {
    string ide_name = 1;          // "devin"
    string extension_version = 2; // "3000.11.228"
    string api_key = 3;           // same as header
    string locale = 4;            // "en_US"
    string os = 5;                // "linux"
    string ide_version = 7;       // "3000.11.228"
    string hardware = 8;          // "x86_64"
    uint64 request_id = 9;        // incrementing counter
    string session_id = 10;       // random UUID
    string extension_name = 12;   // "devin"
    string plan_name = 26;        // "Pro"
    string ide_type = 28;         // "devin"
}

message ChatMessagePrompt {
    string message_id = 1;        // random UUID
    uint64 source = 2;            // 1=USER, 2=ASSISTANT, 4=TOOL
    string prompt = 3;            // message text
    repeated ToolCallInfo tool_calls = 6;
    string tool_call_id = 7;      // for TOOL source messages
    repeated ImageData images = 10;
    string thinking = 11;         // extended thinking content
    string signature = 12;        // thinking signature for replay
}

message ImageData {
    string base64_data = 1;       // base64-encoded image (no data: URI prefix)
    string mime_type = 2;         // "image/png", "image/jpeg", "image/gif", "image/webp"
    string caption = 3;           // optional
}

message ToolCallInfo {
    string id = 1;
    string name = 2;
    string arguments = 3;         // JSON string
}

message ChatToolDefinition {
    string name = 1;
    string description = 2;
    string parameters_schema = 3; // JSON Schema as string
}
```

### Available Models

| Model UID | Description |
|-----------|-------------|
| `swe-2-high` | Default SWE-2 — good balance of speed/quality |
| `swe-2-max` | Higher quality, slower |

### Message Source Mapping

| Source value | Role |
|-------------|------|
| 1 | User message |
| 2 | Assistant message (Codeium calls this "SYSTEM" internally — confusing but correct) |
| 4 | Tool result |

**Important:** The server rejects source=3 for Devin-type clients. Always use 2 for assistant.

### Tool Results

Each tool result is sent as a **separate** `ChatMessagePrompt` with `source=4`:
- `prompt` = the tool's text output
- `tool_call_id` = the `id` from the assistant's `ToolCallInfo`
- `images` (field 10) = any image results (screenshots, etc.)

### Response Format

The response is a stream of Connect frames, each containing a `GetChatMessageResponse` protobuf:

```protobuf
message GetChatMessageResponse {
    string message_id = 1;
    string delta_text = 3;
    uint64 stop_reason = 5;       // 2=end_turn, 3=max_tokens, 10=tool_use
    repeated ToolCallDelta tool_calls = 6;
    ModelUsageStats usage = 7;
    string delta_thinking = 9;
    string delta_signature = 10;
}

message ToolCallDelta {
    string id = 1;
    string name = 2;
    string arguments_delta = 3;   // JSON fragment (streamed incrementally)
}

message ModelUsageStats {
    int64 input_tokens = 2;
    int64 output_tokens = 3;
    int64 cache_write_tokens = 4;
    int64 cache_read_tokens = 5;
}
```

**Connect frame format (response):**
```
[1 byte flags][4 bytes big-endian length][payload]
```
- `flags & 0x02` → trailer frame (JSON, may contain error)
- Otherwise → data frame (protobuf)

**Trailer error format:**
```json
{"error": {"code": "invalid_argument", "message": "..."}}
```

### Stop Reasons

| Value | Meaning |
|-------|---------|
| 2 | `end_turn` — model finished naturally |
| 3 | `max_tokens` — hit output limit |
| 10 | `tool_use` — model wants to call a tool |

## Implementation Guide

### Minimal Python Example

```python
import struct, requests, uuid, json

def encode_varint(value):
    """Encode unsigned varint."""
    result = bytearray()
    while value > 0x7f:
        result.append((value & 0x7f) | 0x80)
        value >>= 7
    result.append(value & 0x7f)
    return bytes(result)

def encode_string(field_num, value):
    """Encode a protobuf string field."""
    tag = encode_varint((field_num << 3) | 2)
    data = value.encode('utf-8') if isinstance(value, str) else value
    return tag + encode_varint(len(data)) + data

def encode_uvarint(field_num, value):
    """Encode a protobuf varint field."""
    tag = encode_varint((field_num << 3) | 0)
    return tag + encode_varint(value)

def encode_submsg(field_num, data):
    """Encode a protobuf sub-message field."""
    tag = encode_varint((field_num << 3) | 2)
    return tag + encode_varint(len(data)) + data

def envelope_wrap(body):
    """Wrap in Connect envelope: [flags:1][length:4][body]."""
    return b'\x00' + struct.pack('>I', len(body)) + body

def build_request(system_prompt, messages, model="swe-2-high", api_key="", tools=None):
    """Build GetChatMessageRequest protobuf."""
    cascade_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())

    # Metadata (field 1)
    meta = b''
    meta += encode_string(1, "devin")          # ide_name
    meta += encode_string(7, "3000.11.228")    # ide_version
    meta += encode_string(2, "3000.11.228")    # extension_version
    meta += encode_string(3, api_key)          # api_key
    meta += encode_string(4, "en_US")          # locale
    meta += encode_string(5, "linux")          # os
    meta += encode_string(8, "x86_64")         # hardware
    meta += encode_string(10, session_id)      # session_id
    meta += encode_uvarint(9, 1)               # request_id
    meta += encode_string(12, "devin")         # extension_name
    meta += encode_string(26, "Pro")           # plan_name
    meta += encode_string(28, "devin")         # ide_type

    body = encode_submsg(1, meta)
    body += encode_string(2, system_prompt)
    
    for role, text in messages:
        source = 1 if role == "user" else 2
        msg = encode_string(1, str(uuid.uuid4()))  # message_id
        msg += encode_uvarint(2, source)
        msg += encode_string(3, text)
        body += encode_submsg(3, msg)

    body += encode_string(21, model)           # model
    body += encode_uvarint(7, 5)               # request_type = CASCADE
    body += encode_string(16, cascade_id)      # cascade_id
    
    if tools:
        for tool in tools:
            td = encode_string(1, tool["name"])
            td += encode_string(2, tool["description"])
            td += encode_string(3, json.dumps(tool["parameters"]))
            body += encode_submsg(10, td)

    return envelope_wrap(body)

def send_request(api_key, system_prompt, messages, model="swe-2-high"):
    """Send request and return raw response bytes."""
    body = build_request(system_prompt, messages, model, api_key)
    resp = requests.post(
        "https://server.codeium.com/exa.api_server_pb.ApiServerService/GetChatMessage",
        data=body,
        headers={
            "Content-Type": "application/connect+proto",
            "Connect-Protocol-Version": "1",
            "windsurf-api-key": api_key,
        },
        stream=True,
    )
    return resp.content

# Usage:
# api_key = open("~/.local/share/devin/credentials.toml").read() ... parse windsurf_api_key
# data = send_request(api_key, "You are helpful.", [("user", "Hello!")])
# ... parse Connect frames + protobuf from data
```

### Minimal Go Example

See the full production implementation at `norma/llm/windsurf/windsurf.go` (686 lines). Key design choices:

- **No protobuf dependency** — all encoding/decoding is hand-rolled (~70 lines of helpers). The schema is stable and small enough that generated code would be overkill.
- **Connect envelope** — 5-byte header per frame (1 byte flags + 4 byte big-endian length)
- **Streaming** — reads full response body, then parses frames sequentially. True streaming (reading frames as they arrive) is possible but adds complexity for marginal gain since responses are typically < 100KB.
- **Credential auto-refresh** — re-reads `credentials.toml` on 401/403, thread-safe via `sync.RWMutex`
- **Image support** — inline base64 in `ChatMessagePrompt.images` (field 10), same as Devin client

## ARTEX Integration Points

### Backend (Go)

1. **Provider package:** `norma/llm/windsurf/windsurf.go` implements the `llm.Provider` interface:
   - `Stream(ctx, CompletionRequest) iter.Seq2[StreamEvent, error]`
   - `Complete(ctx, CompletionRequest) (Message, string, Usage, error)`

2. **Provider factory:** `agent/provider.go` — `case "windsurf":` in `ConfigFrom()`, `Provider()`, `NewProvider()`

3. **API key exemption:** Several places in `server/server.go` and `server/task_resolution.go` exempt `format == "windsurf"` from the API key check, since the key comes from `credentials.toml` at runtime.

4. **DB schema:** `db/schema.sql` — `'windsurf'` in the format CHECK constraint

### Frontend (TypeScript/Next.js)

1. **Type:** `web/src/lib/types.ts` — `"windsurf"` in `LLMProfile.format` union
2. **LLM config UI:** `web/src/app/(main)/system/llm/page.tsx` — windsurf format option, API key field hidden for windsurf

### Docker

`docker-compose.yml` mounts credentials read-only:
```yaml
volumes:
  - ${HOME}/.local/share/devin:/host-devin/data-parent/devin:ro
```

The provider reads from `/host-devin/data-parent/devin/credentials.toml` first, falling back to `~/.local/share/devin/credentials.toml`.

## Adapting for Other Tools

To connect SWE-2 to a different tool:

1. **Read the credential:** Parse `windsurf_api_key` from `~/.local/share/devin/credentials.toml`
2. **Build the protobuf:** Follow the field mapping above. The metadata fields (ide_name, version, etc.) can be adjusted but must be present.
3. **Send via Connect:** POST to `server.codeium.com/exa.api_server_pb.ApiServerService/GetChatMessage` with the correct headers
4. **Parse the response:** Iterate Connect frames, decode protobuf, handle text deltas + tool calls + usage
5. **Handle tool calls:** When `stop_reason=10`, parse the accumulated tool calls, execute them, and send results back as source=4 messages

### Gotchas

- **source=2 for assistant, NOT 3** — the server rejects source=3 for Devin clients
- **request_type must be 5** (CASCADE) — other values cause routing errors
- **Tool call arguments stream incrementally** — accumulate fragments by tool call ID before parsing JSON
- **No refresh endpoint** — the JWT token is long-lived (30+ days observed). On 401/403, re-read `credentials.toml` in case the CLI refreshed it.
- **Images are always inline base64** — no separate upload endpoint. Supported: PNG, JPEG, GIF, WebP.
- **The `api_key` appears in both the header AND the metadata** — both are required
- **Plan name "Pro"** — if the account subscription changes, this may need updating

## Token Usage Characteristics

From our production testing (CVE discovery tasks):

| Metric | Observation |
|--------|-------------|
| Input token ratio | ~4:1 input:output typical |
| Response latency | 5-15s for complex tool-using responses |
| Streaming | Responses arrive as a single body (not true SSE streaming) |
| Cache tokens | Reports cache_read and cache_write in usage stats |
| Rate limits | Not observed in testing; likely tied to Pro plan quota |
