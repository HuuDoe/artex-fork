package agent

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Autumn-27/norma/harness"
)

// runTrace retains the latest tool call so an interrupted run can identify the
// operation that was still in flight.
type runTrace struct {
	startedAt time.Time
	id        string
	name      string
	input     string
	at        time.Time
	pending   bool
}

func (t *runTrace) start(id, name, input string) {
	t.id, t.name, t.input, t.at, t.pending = id, name, input, time.Now(), true
}

func (t *runTrace) done(id string) {
	if id == t.id {
		t.pending = false
	}
}

var reasonHint = map[harness.TerminalReason]string{
	harness.ReasonCompleted:         "The model completed this turn normally without a text summary; recorded facts and assets take precedence based on this turn's tool calls",
	harness.ReasonMaxTurns:          "Reached step budget limit (MaxTurns): SDK performed wrap-up and persisted facts and assets; intent is marked as exhausted for planner to pivot, not treated as a failure",
	harness.ReasonTimeout:           "Reached wall-clock budget for single run (MaxDuration): interrupts active tools and wraps up on the spot, persisting recognized facts and assets; intent marked as exhausted",
	harness.ReasonModelError:        "Model or API call failed (network, auth, rate limit, provider 5xx, etc.); retries exhausted, intent marked as blocked — review execution trace (get_worker_trace) before deciding to reassign or adjust method",
	harness.ReasonBlockingLimit:     "Context length reached hard limit and request was blocked before dispatch; intent scope should be narrowed or tool outputs compressed",
	harness.ReasonPromptTooLong:     "Prompt is too long and context compaction retries are exhausted; execution cannot continue",
	harness.ReasonImageError:        "Current model does not support multimodal content for this turn; switch to vision-capable model or prevent tools from returning images",
	harness.ReasonStopHookPrevented: "Stop hook prevented turn completion and subsequent execution failed; check whether task Guard rules are too strict",
	harness.ReasonHookStopped:       "Tool or hook stopped further execution (e.g. out-of-scope target or forbidden command); check interception notice in last tool_result",
	harness.ReasonAbortedStreaming:  "Run was cancelled during model streaming output phase",
	harness.ReasonAbortedTools:      "Run was cancelled during tool execution phase",
}

// terminalText renders a terminal event with no final text into a compact summary
// and a Markdown detail block.
func terminalText(ctx context.Context, term *harness.Terminal, tr *runTrace) (string, string) {
	reason := term.Reason
	aborted := reason == harness.ReasonAbortedStreaming || reason == harness.ReasonAbortedTools
	// Prompt may return ctx.Err directly without a terminal event. Preserve the
	// cancellation cause instead of falling back to an empty/unknown terminal reason.
	if reason == "" && ctx.Err() != nil {
		aborted = true
	}

	var sum string
	if aborted {
		_, short, _, ok := AbortReason(ctx)
		if !ok {
			short = "Failed to obtain cancellation cause"
		}
		stage := "during execution"
		switch reason {
		case harness.ReasonAbortedStreaming:
			stage = "model output phase"
		case harness.ReasonAbortedTools:
			stage = "tool execution phase"
		}
		sum = "(Run was interrupted: " + short + "; stopped at " + stage + progressSuffix(term, tr) + ", incomplete)"
	} else if reason == harness.ReasonMaxTurns || reason == harness.ReasonTimeout {
		sum = "(Reached budget limit (" + string(reason) + "), wrapped up and persisted facts" + progressSuffix(term, tr) + "; no text summary for this turn)"
	} else {
		hint := terminalReasonHint(reason)
		sum = "(No text summary, terminal status " + terminalReasonLabel(reason) + ": " + firstLine(hint, 80) + ")"
	}

	var b strings.Builder
	b.WriteString(sum)
	b.WriteString("\n\n")
	displayReason := terminalReasonLabel(reason)
	fmt.Fprintf(&b, "- **Terminal Status**: `%s` - %s\n", displayReason, terminalReasonHint(reason))
	if aborted {
		code, _, why, ok := AbortReason(ctx)
		if ok {
			fmt.Fprintf(&b, "- **Interruption Reason** (`%s`): %s\n", code, why)
		} else {
			b.WriteString("- **Interruption Reason**: Unavailable; canceler may not have attached a named cause via context.WithCancelCause\n")
		}
	}
	if term.Err != nil {
		fmt.Fprintf(&b, "- **Underlying Error**: `%v`\n", term.Err)
	}
	if aborted && strings.TrimSpace(term.Text) != "" {
		b.WriteString("- **Partial output generated before cancellation**:\n\n")
		b.WriteString(term.Text)
		b.WriteString("\n\n")
	}
	if term.Turns > 0 {
		fmt.Fprintf(&b, "- **Executed**: %d model turns\n", term.Turns)
	}
	if !tr.startedAt.IsZero() {
		fmt.Fprintf(&b, "- **Run Duration**: %s\n", roundDur(time.Since(tr.startedAt)))
	}
	if u := term.Usage; u.InputTokens+u.OutputTokens+u.CacheReadTokens+u.CacheWriteTokens > 0 {
		fmt.Fprintf(&b, "- **Cumulative Tokens**: prompt %d / completion %d / cache read %d / cache write %d\n",
			u.InputTokens, u.OutputTokens, u.CacheReadTokens, u.CacheWriteTokens)
	}
	if tr.name == "" {
		b.WriteString("- **Tool Calls**: Run finished before issuing any tool calls\n")
	} else if tr.pending {
		fmt.Fprintf(&b, "- **Tool executing when interrupted**: `%s` (running for %s, **no result returned**)\n\n  ```json\n  %s\n  ```\n",
			tr.name, roundDur(time.Since(tr.at)), firstLine(tr.input, 300))
	} else {
		fmt.Fprintf(&b, "- **Last tool before interruption**: `%s` (returned normally)\n", tr.name)
	}
	return sum, b.String()
}

func terminalReasonLabel(reason harness.TerminalReason) string {
	if reason == "" {
		return "context_canceled"
	}
	return string(reason)
}

func terminalReasonHint(reason harness.TerminalReason) string {
	if hint := reasonHint[reason]; hint != "" {
		return hint
	}
	if reason == "" {
		return "Run context was cancelled, but underlying layer did not produce a Terminal event"
	}
	return "Unknown terminal reason; harness may have added a new TerminalReason, please update reasonHint"
}

func progressSuffix(term *harness.Terminal, tr *runTrace) string {
	var parts []string
	if term.Turns > 0 {
		parts = append(parts, fmt.Sprintf("%d turns", term.Turns))
	}
	if !tr.startedAt.IsZero() {
		parts = append(parts, roundDur(time.Since(tr.startedAt)))
	}
	if len(parts) == 0 {
		return ""
	}
	return ", elapsed " + strings.Join(parts, " / ")
}

func roundDur(d time.Duration) string {
	switch {
	case d < time.Minute:
		return d.Round(100 * time.Millisecond).String()
	case d < time.Hour:
		return d.Round(time.Second).String()
	default:
		return d.Round(time.Minute).String()
	}
}
