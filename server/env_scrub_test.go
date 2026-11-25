package server

import (
	"context"
	"os"
	"os/exec"
	"strings"
	"testing"

	"github.com/MithrandirHEX/falcon/agent"
)

func isInSecretEnv(name string) bool {
	for _, k := range secretEnv {
		if k == name {
			return true
		}
	}
	return false
}

// A child process spawned after startup must not see the startup secrets, while
// other variables still pass through.
func TestScrubSecretEnvHidesSecretsFromChildren(t *testing.T) {
	sh, err := exec.LookPath("sh")
	if err != nil {
		t.Skip("no sh in PATH")
	}
	for _, k := range secretEnv {
		t.Setenv(k, "leak-"+k)
	}
	t.Setenv("FALCON_SCRUB_KEEP", "kept")

	ScrubSecretEnv()

	out, err := exec.Command(sh, "-c", "env").Output()
	if err != nil {
		t.Fatal(err)
	}
	env := "\n" + string(out)
	for _, k := range secretEnv {
		if strings.Contains(env, "\n"+k+"=") {
			t.Errorf("%s still reaches child processes", k)
		}
	}
	if !strings.Contains(env, "\nFALCON_SCRUB_KEEP=kept\n") {
		t.Errorf("non-secret variable did not reach the child process")
	}
}

// New must apply the options it receives. An earlier version accepted
// ...Option and never called them, so the binary kept the secrets in the
// environment while the unit test above still passed.
func TestNewAppliesSecretScrubOption(t *testing.T) {
	// t.Setenv restores both after the test: the scrub unsets them for the rest
	// of this process, and later tests still need the DSN.
	if dsn := os.Getenv("FALCON_PG_DSN"); dsn != "" {
		t.Setenv("FALCON_PG_DSN", dsn)
	}
	t.Setenv("ANTHROPIC_API_KEY", "scrub-probe")
	t.Setenv("OPENAI_API_KEY", "scrub-probe")

	m, err := NewManager(t.TempDir(), "")
	if err != nil {
		t.Skipf("no manager: %v", err)
	}
	t.Cleanup(func() { m.Close() })

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_ = New(ctx, m, t.TempDir(), t.TempDir(), t.TempDir(), WithSecretScrub())

	if os.Getenv("ANTHROPIC_API_KEY") != "" || os.Getenv("OPENAI_API_KEY") != "" {
		t.Fatal("New did not apply WithSecretScrub: the secrets are still in the environment")
	}
}

// The LLM proxy and endpoint URLs can carry user:pass@ credentials. They are
// scrubbed like the keys, and a child spawned after the scrub sees neither,
// while agent.FromEnv still read them before it.
func TestSecretEnvCoversCredentialURLs(t *testing.T) {
	sh, err := exec.LookPath("sh")
	if err != nil {
		t.Skip("no sh in PATH")
	}
	for _, k := range []string{"FALCON_LLM_PROXY", "FALCON_LLM_BASE_URL"} {
		if !isInSecretEnv(k) {
			t.Errorf("%s is not in secretEnv", k)
		}
	}
	// ScrubSecretEnv unsets every name in secretEnv for the rest of the test
	// binary, and t.Setenv restores only the names it set. Setting all of them
	// here gives FALCON_PG_DSN back to the tests that follow.
	for _, k := range secretEnv {
		t.Setenv(k, "probe-"+k)
	}
	t.Setenv("FALCON_LLM_PROVIDER", "openai")
	t.Setenv("OPENAI_API_KEY", "sk-test")
	t.Setenv("FALCON_LLM_PROXY", "http://proxyuser:proxypass@proxy.internal:3128")
	t.Setenv("FALCON_LLM_BASE_URL", "https://apiuser:apipass@llm.internal/v1")
	cfg, ok := agent.FromEnv()
	if !ok || cfg.Proxy != "http://proxyuser:proxypass@proxy.internal:3128" || cfg.BaseURL != "https://apiuser:apipass@llm.internal/v1" {
		t.Fatalf("FromEnv must read the URLs before the scrub: ok=%v proxy=%q base=%q", ok, cfg.Proxy, cfg.BaseURL)
	}
	ScrubSecretEnv()
	out, err := exec.Command(sh, "-c", "env").Output()
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(out), "proxypass") || strings.Contains(string(out), "apipass") {
		t.Fatalf("a child process still sees the proxy or endpoint credentials:\n%s", out)
	}
}
