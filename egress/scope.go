package egress

import "context"

// Scope identifies the task (or conversation) an egress request belongs to.
// It namespaces the governor's per-task GET coalescing and cache: requests with
// no scope are paced but never shared.
type Scope struct {
	TaskID         string
	ConversationID int64
}

type scopeCtxKey struct{}

// WithScope returns a child context carrying s. Wire it where a tool call's
// context is built for a specific task/conversation to enable coalescing.
func WithScope(ctx context.Context, s Scope) context.Context {
	return context.WithValue(ctx, scopeCtxKey{}, s)
}

// scopeFromContext extracts the scope; ok is false when absent.
func scopeFromContext(ctx context.Context) (s Scope, ok bool) {
	s, ok = ctx.Value(scopeCtxKey{}).(Scope)
	return s, ok
}
