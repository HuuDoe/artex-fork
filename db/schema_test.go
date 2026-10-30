package db

import (
	"fmt"
	"testing"
	"time"
)

func TestLLMProfilesSchemaAllowsDevinACP(t *testing.T) {
	d, err := Open(testDSN(t))
	if err != nil {
		t.Skipf("postgres unavailable (%v) — skipping", err)
	}
	defer d.Close()

	name := fmt.Sprintf("devin-test-%d", time.Now().UnixNano())
	p := &LLMProfile{Name: name, Format: "devin-acp", Model: "swe-2-high", AgentType: "summarizer"}
	id, err := d.SaveProfile(p)
	if err != nil {
		t.Fatalf("SaveProfile with format=devin-acp: %v", err)
	}
	t.Cleanup(func() { d.Exec(`DELETE FROM llm_profiles WHERE id=$1`, id) })

	got, err := d.ProfileByID(id)
	if err != nil {
		t.Fatalf("ProfileByID: %v", err)
	}
	if got.Format != "devin-acp" || got.AgentType != "summarizer" {
		t.Fatalf("got format=%q agent_type=%q, want devin-acp/summarizer", got.Format, got.AgentType)
	}
}

func TestLLMProfilesSchemaRejectsBadAgentType(t *testing.T) {
	d, err := Open(testDSN(t))
	if err != nil {
		t.Skipf("postgres unavailable (%v) — skipping", err)
	}
	defer d.Close()

	name := fmt.Sprintf("devin-bad-%d", time.Now().UnixNano())
	p := &LLMProfile{Name: name, Format: "devin-acp", Model: "swe-2-high", AgentType: "not-a-real-type"}
	if _, err := d.SaveProfile(p); err == nil {
		t.Fatal("expected a CHECK-constraint error for an invalid agent_type, got nil")
	}
}
