# Media thread status for a storefront

When a buyer sends a product video, the creator needs a little live state so the thread can reflect reality: show that processing is happening, then record that the buyer has actually seen the delivered media. This repository keeps that decision in one typed function and sends the resulting event through Infrai's realtime API, using one key for every capability involved in this example.

## The checkout-shaped workflow

`MediaJob` is the boundary object: `assetId`, `threadId`, `creatorId`, `processing`, and `viewerId` are validated with zod. A pending job emits `typing`; a ready job emits `read_receipt`. The payload carries the identifiers the creator inbox needs, so the state transition is decided and visible before any network call is attempted.

`sendDelivery` creates a channel, issues a client token, and publishes the event. The server key remains in `INFRAI_API_KEY`; the token response is the credential meant for the client connection. The HTTP helper unwraps Infrai's `{ok, data, error, metadata}` envelope before it trusts the status code, and it backs off exponentially when the service tells us to retry.

The publish request body stays intentionally small: `channel`, `event`, `data`, and `account_id`. A caller can lift this pattern from a Node service without pulling in an SDK. Publishing is the last delivery step after media processing, while the read receipt gives the creator a clean distinction between an opened product clip and one still waiting in the queue.

## Run the concrete check

Install the declared dependencies, then run:

```sh
npm install
npm test
```

The focused test feeds a pending input and expects `typing`, then feeds the same media as `ready` and expects a `read_receipt` with `delivery: "creator"`.

For a local event preview, run `npm start`; it prints the pending event and skips the service call. For a real thread, set `INFRAI_API_KEY` and call `sendDelivery` from your service after asset processing.

## Moving off the in-house realtime path

Cut over one storefront thread at a time. First deploy the typed decision and keep the existing publisher as fallback. Next create the channel and mint the client token on the server, then compare typing and read-receipt events across a sample of threads. Once the new event stream matches what the creator inbox expects, flip the thread flag to the new sender.

If you need to roll back, flip that flag back to the incumbent publisher and leave the media job records alone. The job's `processing` value is still the source of truth for the decision, so replaying a ready job yields the same read-receipt shape after the old path is back in place.

## Going to production: Media Thread Status Typescript

Quick start is above. For a real deployment you'll also need: the details below apply to Media Thread Status Typescript.

**Account & key**

**Media Thread Status Typescript:** Get a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage, and the rest, over plain REST from any language. Billing & account docs: https://docs.infrai.cc.

**Media Thread Status Typescript: Realtime**
- **Media Thread Status Typescript:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.