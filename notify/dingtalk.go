package notify

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"time"
)

// dingTalkChannel 实现钉钉自定义机器人。
//
// 平台特性（决定了这里的实现取舍）：
//   - 单机器人限流 20 条/分钟，超发会被静默丢弃（HTTP 仍可能 200），
//     所以限流必须在客户端做，见 DefaultRatePerMin。
//   - 安全设置三选一：加签 / 自定义关键词 / IP 白名单。加签是唯一不依赖
//     消息内容的方案，所以只支持加签（也支持三者都不开的裸 webhook）。
//   - 成功/失败都返回 HTTP 200，靠 body 里的 errcode 区分——不检查 errcode
//     会把投递失败记成成功。
type dingTalkChannel struct{}

func (dingTalkChannel) Kind() string { return KindDingTalk }

func (dingTalkChannel) DefaultRatePerMin() int { return 20 }

// 钉钉的 Webhook 地址里带 access_token，本身就是凭据，因此整体掩码。
func (dingTalkChannel) SecretKeys() []string { return []string{"webhook", "secret"} }

// 目标是钉钉的 Webhook 地址本身；改地址必须同时对新地址重新表态加签密钥。
func (dingTalkChannel) DestinationKeys() []string { return []string{"webhook"} }

func (dingTalkChannel) Validate(cfg map[string]any) error {
	hook := cfgString(cfg, "webhook")
	if hook == "" {
		return errors.New("Missing webhook URL")
	}
	if err := validateHTTPURL(hook); err != nil {
		return fmt.Errorf("Invalid webhook URL: %w", err)
	}
	return nil
}

// Send 投递一次消息。有回链且是单条时用 ActionCard（带按钮），否则用 markdown。
func (c dingTalkChannel) Send(ctx context.Context, cfg map[string]any, m Message) (int, error) {
	hook := cfgString(cfg, "webhook")
	if err := c.Validate(cfg); err != nil {
		return 0, Permanent(err)
	}
	endpoint, err := dingTalkSignedURL(hook, cfgString(cfg, "secret"), time.Now())
	if err != nil {
		return 0, Permanent(err)
	}

	title := markdownTitle(m)
	// 钉钉 markdown 正文无明确字节上限，但仍做上限保护，避免证据字段异常膨胀。
	text, kept := markdownBody(m, 20000)

	var payload any
	if !m.Batch && len(m.Items) == 1 && m.Items[0].DetailURL != "" {
		payload = map[string]any{
			"msgtype": "actionCard",
			"actionCard": map[string]any{
				"title":          title,
				"text":           text,
				"btnOrientation": "0",
				"singleTitle":    "View Details",
				"singleURL":      m.Items[0].DetailURL,
			},
		}
	} else {
		payload = map[string]any{
			"msgtype":  "markdown",
			"markdown": map[string]any{"title": title, "text": text},
		}
	}

	raw, err := doJSON(ctx, "POST", endpoint, nil, payload)
	if err != nil {
		return 0, err
	}
	// 钉钉把业务错误藏在 200 响应里。
	var res struct {
		ErrCode int    `json:"errcode"`
		ErrMsg  string `json:"errmsg"`
	}
	if err := json.Unmarshal(raw, &res); err != nil {
		return 0, fmt.Errorf("Failed to parse DingTalk response: %w (%s)", err, snippet(raw))
	}
	if res.ErrCode != 0 {
		// 301000 是签名校验失败、310000 是关键词不匹配——都是配置错误，
		// 重试不会自愈。
		return 0, Permanent(fmt.Errorf("DingTalk returned error %d: %s", res.ErrCode, res.ErrMsg))
	}
	return kept, nil
}

// dingTalkSignedURL 按官方加签规则给 webhook 追加 timestamp 与 sign 参数。
//
// 规则：待签串 = timestamp + "\n" + secret，HMAC-SHA256 的**密钥也是 secret**，
// 结果 base64 后 URL 编码。timestamp 是毫秒。secret 为空时原样返回，
// 以支持未开启加签的机器人。
func dingTalkSignedURL(hook, secret string, now time.Time) (string, error) {
	if secret == "" {
		return hook, nil
	}
	ts := strconv.FormatInt(now.UnixMilli(), 10)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(ts + "\n" + secret))
	sign := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	u, err := url.Parse(hook)
	if err != nil {
		// 不透传 err：url.Parse 的错误文本里带完整地址（含 access_token）。
		return "", fmt.Errorf("Failed to parse webhook URL: %s", redactRequestTarget(hook))
	}
	q := u.Query()
	q.Set("timestamp", ts)
	q.Set("sign", sign)
	u.RawQuery = q.Encode()
	return u.String(), nil
}

// validateHTTPURL 校验地址可用、协议受支持，并对字面 IP 目标做内网判断。
func validateHTTPURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("Failed to parse URL (%s)", redactRequestTarget(raw))
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("Only http/https supported, got %q", u.Scheme)
	}
	if u.Host == "" {
		return errors.New("Missing hostname")
	}
	if ip := net.ParseIP(u.Hostname()); ip != nil && isBlockedDialIP(ip) && !allowLocalTargets() {
		return fmt.Errorf("Refusing delivery to loopback/link-local address %s (set %s=1 if delivery to local service is required)", ip, AllowLocalTargetsEnv)
	}
	return nil
}
