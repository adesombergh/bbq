---
status: accepted
---

# The hub binds to loopback on a random port and still requires a per-process token

The HTTP/WebSocket hub listens on `127.0.0.1:0`, and every request (page, asset, API, socket upgrade) must carry a token generated at process start: as `?token=` on the first navigation, which sets an HttpOnly, SameSite=Strict cookie that authorises everything after. Loopback alone is not enough: any web page open in the same browser, or any local process, can reach a localhost port, and a grilling session is the plan of a private project. Moving the token from the URL into a cookie keeps it out of history, referrers and the address bar the person is likely to copy. We rejected user accounts and TLS as far beyond what a single-user local tool needs. The consequence is that a URL copied without its token yields a 403, so the tool result and the pending report always print the full URL.
