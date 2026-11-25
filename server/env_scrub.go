package server

import "os"

// secretEnv lists the credentials read from the environment only at startup:
// FALCON_PG_DSN by NewManager (via db.DSN), and the LLM API keys and endpoint
// URLs by agent.FromEnv inside New. FALCON_LLM_PROXY and FALCON_LLM_BASE_URL are
// URLs that can carry credentials in their userinfo (http://user:pass@proxy:3128).
//
// AWS_* are scrubbed defensively: falcon never reads them, but an operator
// running falcon from a shell that has cloud creds would otherwise pass them to
// every agent child process. Credentials from a shared credentials/config file
// or the instance metadata service are not in the environment: the scrub does
// not hide them from child processes.
var secretEnv = []string{
	"FALCON_PG_DSN", "ANTHROPIC_API_KEY", "OPENAI_API_KEY",
	"FALCON_LLM_BASE_URL", "FALCON_LLM_PROXY",
	"AWS_ACCESS_KEY_ID", "AWS_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY", "AWS_SECRET_KEY", "AWS_SESSION_TOKEN",
	"AWS_CONTAINER_CREDENTIALS_FULL_URI", "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI", "AWS_CONTAINER_AUTHORIZATION_TOKEN", "AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE",
	"AWS_WEB_IDENTITY_TOKEN_FILE", "AWS_ROLE_ARN",
}

// ScrubSecretEnv removes secretEnv from the process environment once startup has
// read it. Child processes (agent shells, custom tools, MCP stdio servers) copy
// os.Environ() when they are spawned, so they no longer inherit these values.
//
// It runs inside New, after the env readers are captured and before the MCP
// discovery goroutine and the task resume loop: both can spawn children, and
// resuming a task starts workers that run shells. Scrubbing in main after New
// returned left that window open.
func ScrubSecretEnv() {
	for _, k := range secretEnv {
		_ = os.Unsetenv(k)
	}
}

// Option configures New. Options keep the test call sites unchanged: only the
// binary opts into scrubbing, because tests create several servers in one
// process and still need FALCON_PG_DSN on later calls.
type Option func(*Server)

// WithSecretScrub makes New drop the startup secrets after reading them, before
// the MCP discovery goroutine and the task resume loop can spawn children.
func WithSecretScrub() Option { return func(s *Server) { s.scrubSecrets = true } }
