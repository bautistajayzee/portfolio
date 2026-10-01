# Security

This is a static site. There is no account, no login, no stored personal data,
and no database — with one small exception described below.

## The one piece of server-side state

The footer can show how many people have the page open. That needs a counter
somewhere, and it lives in a Redis sorted set reached by `api/viewers.js`, a
Vercel Function. The store is created by a Redis integration installed from the
Vercel Marketplace; its credentials arrive as environment variables
(`KV_REST_API_URL`, `KV_REST_API_TOKEN`) and are never read from anywhere else,
never logged, and never sent to a browser.

What it stores, exactly:

- a random identifier generated in your tab (`crypto.randomUUID`)
- the time it was last seen, which is the sorted set's score

What it does **not** store: your IP address, your user agent, a cookie, a
fingerprint, or anything that identifies you. Each entry is pruned once its score
is older than 90 seconds, and that happens on the next write rather than on a
timer, so nothing accumulates over time. The identifier is meaningless outside
the set, which is never read by anyone — the only value that leaves the function
is a count.

Two further properties worth stating plainly:

- **The count is never cached.** The endpoint and both host configs all send
  `Cache-Control: no-store`, because a cached viewer count is a wrong viewer
  count.
- **The endpoint is not required.** If the store is not connected, or is
  unreachable, the function answers 503 and the client renders no badge at all.
  It degrades to absent rather than to a guess.

The endpoint only accepts same-origin requests, which is what stops anyone from
inflating the number from a script on another site, and refuses any identifier
longer than 64 characters, since the identifier is an opaque token and nothing
else.

## Reporting something

If you have found a way to make this site do something it should not — an
injected script, a way to write to that store from elsewhere, a broken link that
leaks something — email **jayzeegbautista@gmail.com**.

I will look at it and fix it. There is no bug bounty and no formal disclosure
process, because there is very little here to disclose: no user data, no
accounts, no payments.

## What is deliberately not protected

**The resume PDF and the project screenshots are public files.** They are in
`public/` and are served directly. That is the point of a portfolio, but it does
mean they can be downloaded and shared, and they will show up in search results
eventually.

**Client-side JavaScript cannot be kept secret.** Everything in
`dist/assets/` is readable by anyone who views source. Nothing sensitive is put
there — the mail address is meant to be public.
