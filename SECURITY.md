# Security

This is a static site. There is no account, no login, no stored personal data,
and no database — with one small exception described below.

## The one piece of server-side state

The footer can show how many people have the page open. That needs a counter
somewhere, and it lives in a Netlify Blobs store reached by
`netlify/functions/viewers.js`.

What it stores, exactly:

- a random identifier generated in your tab (`crypto.randomUUID`)
- a timestamp, so the entry can be expired

What it does **not** store: your IP address, your user agent, a cookie, a
fingerprint, or anything that identifies you. Each entry self-expires after 90
seconds without a heartbeat, so nothing accumulates over time. The identifier is
meaningless outside the blob, which is never read by anyone.

The endpoint only accepts same-origin POSTs, which is what stops anyone from
inflating the number from a script on another site.

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
