package traffic

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/MithrandirHEX/falcon/egress"
	mproxy "github.com/lqqyt2423/go-mitmproxy/proxy"
)

// paceWaitMax bounds the pacing wait of one request. Past it the request is
// sent unpaced: pacing never blocks a command indefinitely.
const paceWaitMax = 30 * time.Second

// Requestheaders runs for every request the proxy sees: the CONNECT that opens
// a tunnel, each request inside an intercepted tunnel, and each plain-HTTP
// request. The recording proxy takes no credentials, so a Proxy-Authorization
// header is only ever meant for it: it is dropped here, before anything is
// forwarded, and never reaches the target or the recording. When it carries
// the pace marker (egress.PaceUser), the client connection is marked; every
// request on it, including those inside its tunnel, is then paced by the
// current noise profile before it goes upstream.
func (s *sink) Requestheaders(f *mproxy.Flow) {
	if f.Request == nil || f.ConnContext == nil || f.ConnContext.ClientConn == nil {
		return
	}
	id := f.ConnContext.ClientConn.Id
	if egress.IsPaceMarker(f.Request.Header.Get("Proxy-Authorization")) {
		s.paced.Store(id, struct{}{})
	}
	f.Request.Header.Del("Proxy-Authorization")
	if f.Request.Method == http.MethodConnect || f.Request.URL == nil {
		return
	}
	if _, marked := s.paced.Load(id); marked {
		pace(f)
	}
}

// ClientDisconnected forgets a closed connection's pace mark.
func (s *sink) ClientDisconnected(c *mproxy.ClientConn) {
	if c != nil {
		s.paced.Delete(c.Id)
	}
}

// pace waits for the request's host under the current noise profile, bounded
// by paceWaitMax and by the request's own context. Off returns at once.
func pace(f *mproxy.Flow) {
	ctx := context.Background()
	if raw := f.Request.Raw(); raw != nil {
		ctx = raw.Context()
	}
	ctx, cancel := context.WithTimeout(ctx, paceWaitMax)
	defer cancel()
	host := egress.HostKey(f.Request.URL)
	if err := egress.Wait(ctx, host); err != nil {
		log.Printf("[traffic] pacing request stopped waiting, sending unpaced (host=%s): %v", host, err)
	}
}
