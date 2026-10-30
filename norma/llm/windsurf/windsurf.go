// Package windsurf implements llm.Provider by calling the Windsurf/Codeium
// inference API directly via the Connect protocol (protobuf-over-HTTP).
// This bypasses the ACP harness entirely, giving the ARTEX agent loop
// direct control over tool calling and message history.
//
// Wire format: server-streaming Connect (Content-Type: application/connect+proto)
// to server.codeium.com/exa.api_server_pb.ApiServerService/GetChatMessage.
// Messages are manually encoded as protobuf to avoid a generated-code dependency.
package windsurf

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"iter"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Autumn-27/norma/llm"
)

// Config configures the Windsurf Connect provider.
type Config struct {
	APIKey  string // windsurf-api-key (session token from credentials.toml)
	BaseURL string // default https://server.codeium.com
	Model   string // model uid, e.g. "swe-2-high"
	Client  *http.Client
}

type provider struct {
	cfg      Config
	reqID    atomic.Int64
	apiKeyMu sync.RWMutex
}

// NewProvider creates a Windsurf Connect provider.
// If APIKey is empty, it reads windsurf_api_key from ~/.local/share/devin/credentials.toml.
func NewProvider(cfg Config) (llm.Provider, error) {
	if cfg.APIKey == "" {
		cfg.APIKey = readCredentials()
	}
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("windsurf: api key required (set it or ensure ~/.local/share/devin/credentials.toml exists)")
	}
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://server.codeium.com"
	}
	if cfg.Model == "" {
		cfg.Model = "swe-2-high"
	}
	if cfg.Client == nil {
		cfg.Client = &http.Client{Timeout: 5 * time.Minute}
	}
	return &provider{cfg: cfg}, nil
}

func (p *provider) apiKey() string {
	p.apiKeyMu.RLock()
	defer p.apiKeyMu.RUnlock()
	return p.cfg.APIKey
}

// refreshCredentials re-reads credentials.toml and returns true if the key changed.
func (p *provider) refreshCredentials() bool {
	fresh := readCredentials()
	if fresh == "" || fresh == p.apiKey() {
		return false
	}
	p.apiKeyMu.Lock()
	p.cfg.APIKey = fresh
	p.apiKeyMu.Unlock()
	return true
}

// doConnect sends the Connect request, retrying once if credentials can be refreshed.
func (p *provider) doConnect(ctx context.Context, req llm.CompletionRequest) (*http.Response, error) {
	body := p.buildRequest(req)
	envelope := envelopeWrap(body)

	send := func() (*http.Response, error) {
		httpReq, err := http.NewRequestWithContext(ctx, "POST",
			p.cfg.BaseURL+"/exa.api_server_pb.ApiServerService/GetChatMessage",
			strings.NewReader(string(envelope)))
		if err != nil {
			return nil, err
		}
		httpReq.Header.Set("Content-Type", "application/connect+proto")
		httpReq.Header.Set("Connect-Protocol-Version", "1")
		httpReq.Header.Set("windsurf-api-key", p.apiKey())
		return p.cfg.Client.Do(httpReq)
	}

	resp, err := send()
	if err != nil {
		return nil, fmt.Errorf("windsurf: connect: %w", err)
	}
	if resp.StatusCode == 401 || resp.StatusCode == 403 {
		resp.Body.Close()
		if p.refreshCredentials() {
			resp, err = send()
			if err != nil {
				return nil, fmt.Errorf("windsurf: connect (retry): %w", err)
			}
		}
	}
	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		resp.Body.Close()
		return nil, fmt.Errorf("windsurf: HTTP %d: %s", resp.StatusCode, b)
	}
	return resp, nil
}

// Stream sends a GetChatMessage request and yields normalized StreamEvents.
func (p *provider) Stream(ctx context.Context, req llm.CompletionRequest) iter.Seq2[llm.StreamEvent, error] {
	return func(yield func(llm.StreamEvent, error) bool) {
		resp, err := p.doConnect(ctx, req)
		if err != nil {
			yield(llm.StreamEvent{}, err)
			return
		}
		defer resp.Body.Close()

		if !yield(llm.StreamEvent{Type: llm.SEMessageStart}, nil) {
			return
		}

		data, err := io.ReadAll(resp.Body)
		if err != nil {
			yield(llm.StreamEvent{}, fmt.Errorf("windsurf: read body: %w", err))
			return
		}

		var stopReason string
		var usage llm.Usage

		// Accumulate tool call fragments across chunks.
		type toolAcc struct {
			id   string
			name string
			args string
		}
		toolAccs := map[string]*toolAcc{}

		off := 0
		for off+5 <= len(data) {
			flags := data[off]
			msgLen := int(binary.BigEndian.Uint32(data[off+1 : off+5]))
			off += 5
			if off+msgLen > len(data) {
				break
			}
			msg := data[off : off+msgLen]
			off += msgLen

			if flags&0x02 != 0 {
				// Trailer (JSON).
				var trailer struct {
					Error *struct {
						Code    string `json:"code"`
						Message string `json:"message"`
					} `json:"error"`
				}
				if json.Unmarshal(msg, &trailer) == nil && trailer.Error != nil {
					code := trailer.Error.Code
					// Server-side "internal error" disguised as invalid_argument is transient;
					// include the raw trailer so ARTEX logs enough to debug repeat occurrences.
					yield(llm.StreamEvent{}, fmt.Errorf("windsurf: %s: %s (trailer: %s)", code, trailer.Error.Message, msg))
					return
				}
				continue
			}

			// Parse GetChatMessageResponse protobuf.
			cr := parseGetChatMessageResponse(msg)

			if cr.deltaText != "" {
				if !yield(llm.StreamEvent{Type: llm.SETextDelta, Text: cr.deltaText}, nil) {
					return
				}
			}
			if cr.deltaThinking != "" {
				if !yield(llm.StreamEvent{Type: llm.SEThinkingDelta, Text: cr.deltaThinking}, nil) {
					return
				}
			}
			if cr.deltaSignature != "" {
				if !yield(llm.StreamEvent{Type: llm.SEThinkingSignature, Text: cr.deltaSignature}, nil) {
					return
				}
			}
			for _, tc := range cr.toolCalls {
				acc, exists := toolAccs[tc.id]
				if !exists {
					acc = &toolAcc{id: tc.id, name: tc.name}
					toolAccs[tc.id] = acc
					if !yield(llm.StreamEvent{Type: llm.SEToolUseStart, ToolID: tc.id, ToolName: tc.name}, nil) {
						return
					}
				}
				if tc.args != "" {
					acc.args += tc.args
					if !yield(llm.StreamEvent{Type: llm.SEToolInputJSON, Text: tc.args}, nil) {
						return
					}
				}
			}
			if cr.stopReason != 0 {
				switch cr.stopReason {
				case 2:
					stopReason = "end_turn"
				case 3:
					stopReason = "max_tokens"
				case 10:
					stopReason = "tool_use"
				default:
					stopReason = fmt.Sprintf("stop_%d", cr.stopReason)
				}
			}
			if cr.inputTokens > 0 || cr.outputTokens > 0 {
				usage.InputTokens = cr.inputTokens
				usage.OutputTokens = cr.outputTokens
				usage.CacheReadTokens = cr.cacheReadTokens
				usage.CacheWriteTokens = cr.cacheWriteTokens
			}
		}

		yield(llm.StreamEvent{Type: llm.SEMessageDelta, StopReason: stopReason, Usage: usage}, nil)
		yield(llm.StreamEvent{Type: llm.SEMessageStop, StopReason: stopReason}, nil)
	}
}

// Complete performs a streaming request and assembles the full response.
func (p *provider) Complete(ctx context.Context, req llm.CompletionRequest) (llm.Message, string, llm.Usage, error) {
	acc := llm.NewAccumulator()
	for ev, err := range p.Stream(ctx, req) {
		if err != nil {
			return llm.Message{}, "", llm.Usage{}, err
		}
		acc.Add(ev)
	}
	return acc.Message(), acc.StopReason, acc.Usage, nil
}

// buildRequest encodes a GetChatMessageRequest protobuf from CompletionRequest.
func (p *provider) buildRequest(req llm.CompletionRequest) []byte {
	cascadeID := newUUID()
	sessionID := newUUID()
	reqID := p.reqID.Add(1)

	// Metadata (field 1).
	meta := encString(1, "devin")                        // ide_name
	meta = append(meta, encString(7, "3000.11.228")...)   // ide_version
	meta = append(meta, encString(2, "3000.11.228")...)   // extension_version
	meta = append(meta, encString(3, p.cfg.APIKey)...)    // api_key
	meta = append(meta, encString(4, "en_US")...)         // locale
	meta = append(meta, encString(5, "linux")...)         // os
	meta = append(meta, encString(8, "x86_64")...)        // hardware
	meta = append(meta, encString(10, sessionID)...)      // session_id
	meta = append(meta, encUvarint(9, uint64(reqID))...)  // request_id
	meta = append(meta, encString(12, "devin")...)        // extension_name
	meta = append(meta, encString(26, "Pro")...)          // plan_name
	meta = append(meta, encString(28, "devin")...)        // ide_type

	var out []byte
	out = append(out, encSubmsg(1, meta)...)

	// System prompt (field 2) — critical: must be set for routing.
	sysPrompt := joinSystem(req.System)
	out = append(out, encString(2, sysPrompt)...)

	// Conversation messages (field 3 repeated).
	for _, msg := range req.Messages {
		for _, encoded := range encodeChatMessages(msg) {
			out = append(out, encSubmsg(3, encoded)...)
		}
	}

	// Model (field 21).
	out = append(out, encString(21, p.cfg.Model)...)

	// Request type = CASCADE (field 7, value 5).
	out = append(out, encUvarint(7, 5)...)

	// Cascade ID (field 16).
	out = append(out, encString(16, cascadeID)...)

	// Tools (field 10 repeated).
	for _, tool := range req.Tools {
		out = append(out, encSubmsg(10, encToolDef(tool))...)
	}

	return out
}

// encodeChatMessages converts one llm.Message into one or more ChatMessagePrompt
// protobufs. A user message containing tool_result blocks produces one
// ChatMessagePrompt per result (source=TOOL); all other messages map 1:1.
func encodeChatMessages(msg llm.Message) [][]byte {
	var toolResults []llm.ContentBlock
	for _, b := range msg.Content {
		if b.Type == llm.BlockToolResult {
			toolResults = append(toolResults, b)
		}
	}
	if len(toolResults) > 0 {
		var out [][]byte
		for _, tr := range toolResults {
			resultText := ""
			var images []llm.ContentBlock
			for _, c := range tr.Content {
				switch c.Type {
				case llm.BlockText:
					resultText += c.Text
				case llm.BlockImage:
					images = append(images, c)
				}
			}
			var p []byte
			p = append(p, encString(1, newUUID())...)        // message_id
			p = append(p, encUvarint(2, 4)...)                // source = TOOL
			p = append(p, encString(3, resultText)...)        // prompt
			p = append(p, encString(7, tr.ToolUseID)...)      // tool_call_id
			for _, img := range images {
				p = append(p, encSubmsg(10, encImageData(img.ImageData, img.MimeType))...)
			}
			out = append(out, p)
		}
		return out
	}

	var source uint64
	switch msg.Role {
	case llm.RoleUser:
		source = 1 // CHAT_MESSAGE_SOURCE_USER
	case llm.RoleAssistant:
		source = 2 // CHAT_MESSAGE_SOURCE_SYSTEM (server rejects source=3/UNKNOWN for devin clients)
	default:
		source = 1
	}

	var text string
	var thinking string
	var signature string
	var toolCalls []llm.ContentBlock
	var images []llm.ContentBlock

	for _, b := range msg.Content {
		switch b.Type {
		case llm.BlockText:
			text += b.Text
		case llm.BlockThinking:
			thinking += b.Thinking
			if b.Signature != "" {
				signature = b.Signature
			}
		case llm.BlockToolUse:
			toolCalls = append(toolCalls, b)
		case llm.BlockImage:
			images = append(images, b)
		}
	}

	var out []byte
	out = append(out, encString(1, newUUID())...)
	out = append(out, encUvarint(2, source)...)
	out = append(out, encString(3, text)...)

	for _, tc := range toolCalls {
		var tcProto []byte
		tcProto = append(tcProto, encString(1, tc.ID)...)
		tcProto = append(tcProto, encString(2, tc.Name)...)
		inputJSON := string(tc.Input)
		if inputJSON == "" {
			inputJSON = "{}"
		}
		tcProto = append(tcProto, encString(3, inputJSON)...)
		out = append(out, encSubmsg(6, tcProto)...)
	}

	// ChatMessagePrompt.images (field 10, repeated ImageData)
	for _, img := range images {
		out = append(out, encSubmsg(10, encImageData(img.ImageData, img.MimeType))...)
	}

	if thinking != "" {
		out = append(out, encString(11, thinking)...)
	}
	if signature != "" {
		out = append(out, encString(12, signature)...)
	}

	return [][]byte{out}
}

// encImageData encodes an ImageData protobuf: field 1=base64_data, field 2=mime_type.
func encImageData(base64Data, mimeType string) []byte {
	var out []byte
	out = append(out, encString(1, base64Data)...)
	out = append(out, encString(2, mimeType)...)
	return out
}

// encToolDef encodes a ChatToolDefinition.
func encToolDef(t llm.ToolSchema) []byte {
	schema, _ := json.Marshal(t.InputSchema)
	var out []byte
	out = append(out, encString(1, t.Name)...)
	out = append(out, encString(2, t.Description)...)
	out = append(out, encString(3, string(schema))...)
	return out
}

// chatMessageResponse holds parsed fields from GetChatMessageResponse.
type chatMessageResponse struct {
	messageID      string
	deltaText      string
	deltaThinking  string
	deltaSignature string
	stopReason     int
	toolCalls      []toolCallDelta
	inputTokens    int
	outputTokens   int
	cacheReadTokens  int
	cacheWriteTokens int
}

type toolCallDelta struct {
	id   string
	name string
	args string
}

// parseGetChatMessageResponse parses the protobuf response.
// Fields: 1=message_id, 3=delta_text, 4=delta_tokens, 5=stop_reason,
// 6=delta_tool_calls, 7=usage, 9=delta_thinking, 10=delta_signature.
func parseGetChatMessageResponse(data []byte) chatMessageResponse {
	var r chatMessageResponse
	off := 0
	for off < len(data) {
		fieldNum, wireType, n := decodeTag(data[off:])
		if n == 0 {
			break
		}
		off += n

		switch wireType {
		case 0: // varint
			val, vn := decodeVarint(data[off:])
			if vn == 0 {
				return r
			}
			off += vn
			switch fieldNum {
			case 5:
				r.stopReason = int(val)
			}
		case 2: // length-delimited
			ln, vn := decodeVarint(data[off:])
			if vn == 0 {
				return r
			}
			off += vn
			if off+int(ln) > len(data) {
				return r
			}
			payload := data[off : off+int(ln)]
			off += int(ln)

			switch fieldNum {
			case 1:
				r.messageID = string(payload)
			case 3:
				r.deltaText = string(payload)
			case 9:
				r.deltaThinking = string(payload)
			case 10:
				r.deltaSignature = string(payload)
			case 6:
				tc := parseToolCall(payload)
				r.toolCalls = append(r.toolCalls, tc)
			case 7:
				r.inputTokens, r.outputTokens, r.cacheReadTokens, r.cacheWriteTokens = parseUsage(payload)
			}
		default:
			// Skip unknown wire types.
			return r
		}
	}
	return r
}

func parseToolCall(data []byte) toolCallDelta {
	var tc toolCallDelta
	off := 0
	for off < len(data) {
		fn, wt, n := decodeTag(data[off:])
		if n == 0 {
			break
		}
		off += n
		if wt == 2 {
			ln, vn := decodeVarint(data[off:])
			if vn == 0 {
				break
			}
			off += vn
			if off+int(ln) > len(data) {
				break
			}
			switch fn {
			case 1:
				tc.id = string(data[off : off+int(ln)])
			case 2:
				tc.name = string(data[off : off+int(ln)])
			case 3:
				tc.args = string(data[off : off+int(ln)])
			}
			off += int(ln)
		} else if wt == 0 {
			_, vn := decodeVarint(data[off:])
			off += vn
		}
	}
	return tc
}

// parseUsage extracts ModelUsageStats.
// Fields: 2=input_tokens, 3=output_tokens, 4=cache_write_tokens, 5=cache_read_tokens.
func parseUsage(data []byte) (input, output, cacheRead, cacheWrite int) {
	off := 0
	for off < len(data) {
		fn, wt, n := decodeTag(data[off:])
		if n == 0 {
			break
		}
		off += n
		if wt == 0 {
			val, vn := decodeVarint(data[off:])
			if vn == 0 {
				break
			}
			off += vn
			switch fn {
			case 2:
				input = int(val)
			case 3:
				output = int(val)
			case 4:
				cacheWrite = int(val)
			case 5:
				cacheRead = int(val)
			}
		} else if wt == 2 {
			ln, vn := decodeVarint(data[off:])
			if vn == 0 {
				break
			}
			off += vn
			off += int(ln) // skip
		}
	}
	return
}

// --- protobuf encoding/decoding helpers ---

func encVarint(v uint64) []byte {
	var buf [10]byte
	n := binary.PutUvarint(buf[:], v)
	return buf[:n]
}

func encString(fieldNum int, val string) []byte {
	tag := encVarint(uint64(fieldNum<<3) | 2)
	ln := encVarint(uint64(len(val)))
	out := make([]byte, 0, len(tag)+len(ln)+len(val))
	out = append(out, tag...)
	out = append(out, ln...)
	out = append(out, val...)
	return out
}

func encUvarint(fieldNum int, val uint64) []byte {
	tag := encVarint(uint64(fieldNum<<3) | 0)
	v := encVarint(val)
	out := make([]byte, 0, len(tag)+len(v))
	out = append(out, tag...)
	out = append(out, v...)
	return out
}

func encSubmsg(fieldNum int, data []byte) []byte {
	tag := encVarint(uint64(fieldNum<<3) | 2)
	ln := encVarint(uint64(len(data)))
	out := make([]byte, 0, len(tag)+len(ln)+len(data))
	out = append(out, tag...)
	out = append(out, ln...)
	out = append(out, data...)
	return out
}

func envelopeWrap(body []byte) []byte {
	out := make([]byte, 5+len(body))
	out[0] = 0 // flags: not compressed
	binary.BigEndian.PutUint32(out[1:5], uint32(len(body)))
	copy(out[5:], body)
	return out
}

func decodeTag(data []byte) (fieldNum int, wireType int, n int) {
	v, vn := decodeVarint(data)
	if vn == 0 {
		return 0, 0, 0
	}
	return int(v >> 3), int(v & 0x7), vn
}

func decodeVarint(data []byte) (uint64, int) {
	var val uint64
	for i, b := range data {
		if i >= 10 {
			return 0, 0
		}
		val |= uint64(b&0x7f) << (7 * i)
		if b < 0x80 {
			return val, i + 1
		}
	}
	return 0, 0
}

func joinSystem(segs []string) string {
	parts := make([]string, 0, len(segs))
	for _, s := range segs {
		if s = strings.TrimSpace(s); s != "" {
			parts = append(parts, s)
		}
	}
	return strings.Join(parts, "\n\n")
}

func readCredentials() string {
	paths := []string{"/host-devin/data-parent/devin/credentials.toml"}
	if home, err := os.UserHomeDir(); err == nil {
		paths = append(paths, filepath.Join(home, ".local", "share", "devin", "credentials.toml"))
	}
	var data []byte
	for _, p := range paths {
		var err error
		data, err = os.ReadFile(p)
		if err == nil {
			break
		}
	}
	if data == nil {
		return ""
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "windsurf_api_key") {
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				v := strings.TrimSpace(parts[1])
				v = strings.Trim(v, `"'`)
				return v
			}
		}
	}
	return ""
}

func newUUID() string {
	var b [16]byte
	rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant 10
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

