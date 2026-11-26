# Semaphore

Messages and a pinned bulletin for a group. **A device that was away catches up in one sync** — in the
original order.

- **Demo:** https://drsamonline.github.io/app-semaphore/play/index.html
- **Landing page:** https://drsamonline.github.io/app-semaphore/
- **Release:** https://github.com/drsamonline/app-semaphore/releases/tag/app-latest
- **Plan row:** #34 of 37 in `drsamonline/forge` → `QUEUE/PLAN.json`
- **Specs absorbed:** `app-semaphore` (lead)
- **Licence:** PolyForm Noncommercial 1.0.0

## Status

| | |
|---|---|
| **Built** | Messages with sender and attachment; a catch-up after one sync in time order; a host-only bulletin that reaches everyone; low-power mode refusing attachments. |
| **Release** | Windows EXE, Android APK and Linux binary, built from this source by `app-builder` in CI. |
| **Not built** | **The LAN transport**, and therefore real multi-device messaging. Also **encryption**: messages are plain text on each device. |
| **Untested** | A real hotspot with four phones on it. The merge is exact and tested; what a venue's network does to a sync is not. |

## The spec's "done means", counted

| The spec says | The test |
|---|---|
| two devices exchange messages | each posts once, one sync, both hold both in order |
| a **third**, absent, receives everything after **one** sync, in order | 0 → 2 messages, `1,2`, same words, and `missing()` reports 0 afterwards |
| a pinned bulletin appears for every member and only the host edits it | the host pins; a non-host is refused with the host's name; the bulletin reaches both other copies |
| with low-power on, no image or voice note can be attached | an attachment is refused with `lowPower: true`, words still go through, and turning it off allows attachments again |

## The bug a test caught, and it was the important kind

Two devices both numbered their **first** message `#1`. The first sync deduplicated by sequence and **silently
dropped one message** — the exact failure the spec is about. The fix is structural: a message carries a
**unique id**, and the **sequence is assigned at merge**, ordered by time then id. The catch-up is then an
interval over a total order rather than two devices' private counters.

That is the kind of bug that looks like "the network lost it" and is not the network at all.

## What it will not do

- **Claim a transport it does not have.**
- **Let a non-host edit the bulletin.**
- **Accept an attachment in low-power mode.**
- **Start an empty group over a broken one.**
- **Use the internet.**

## When things go wrong

| Case | Behaviour |
|---|---|
| **Bad input** | Every refusal names the field: group name, host, sender, empty message, mismatched sync. |
| **No network** | Nothing changes; there is no network code. |
| **Storage full or unavailable** | **NOT SAVED**, group unchanged. |
| **Corrupt saved state** | Reported and offered for export, never replaced with an empty one. |

## Tests

```bash
npm test                      # all three suites
node tests/self-tests.js      # engine — 55 assertions
node tests/ui-tests.js        # the page in jsdom — 20 assertions
node tests/page-smoke.js      # every local src/href resolves, nothing off-origin
```

Mutation-tested six ways on 26/11/2026. Four failed immediately: a non-host able to pin (3 failures),
low-power allowing attachments (3), the catch-up dropping a message (11), a broken group starting empty (4).
**Two survived the first run and both taught something:** ordering by *name* instead of time was equivalent on
my fixture (both messages happened to sort the same way), and a bulletin that is not shared was equivalent
because the device I checked already had it. Both now have a test that constructs the case where they differ.

## Layout

```
docs/index.html              landing page
docs/play/index.html         the app — the group, the bulletin, messages, the other device
docs/play/app.js             DOM wiring: open, post, pin, low-power, sync, export
docs/play/semaphore-core.js  the engine — messages, catch-up, bulletin, low-power, storage
docs/play/web-kit.js         vendored kit (unmodified)
docs/play/export-kit.js      vendored kit (unmodified)
tests/self-tests.js          engine suite (55)
tests/ui-tests.js            page suite (20, jsdom)
tests/page-smoke.js          shape on disk
PAGES.json                   landing = docs/index.html, app = docs/play/index.html
```

## Where the spec was silent, and what was chosen

- **The sequence belongs to the merged group**, not to the device. That is the fix above, and it is the design.
- **Order is time then id**, so two messages posted in the same millisecond still have a stable order.
- **The bulletin is a message too**, pinned and marked, so it is in the catch-up rather than beside it.
- **Low-power mode is a refusal, not a warning** — the spec says "no image or voice note can be attached", so it cannot.
- **No encryption, and the README says so** rather than implying otherwise.

## What is not built, and why

**The transport and encryption.** The first needs sockets this fleet does not open; the second is a real
piece of work and pretending to have it would be worse than saying it is absent.
