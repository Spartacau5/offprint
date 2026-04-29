# Offprint Privacy Policy

**Last updated:** April 29, 2026

Offprint is a Chrome extension that helps you understand the cost and environmental impact of your conversations on ChatGPT and Claude, and nudges you toward lighter models when appropriate.

This policy explains exactly what data Offprint touches and what it does with it.

## Short version

Offprint stores everything on your own device using Chrome's local extension storage. It does not send any data to Offprint, to any server we operate, or to any third party. We do not have a backend. We do not have analytics. We cannot see what you do in the extension because no information ever leaves your computer.

## What data Offprint accesses

When you use ChatGPT (`chatgpt.com`) or Claude (`claude.ai`), Offprint runs a content script on those pages. The content script reads:

- The currently selected model (e.g. "GPT-4o", "Claude Sonnet 4.6").
- Approximate token counts and message metadata visible on the page, used to estimate cost and energy use.
- Your messages and the assistant's responses, only to the extent needed to count tokens and infer task type for nudges.

This information is processed entirely inside your browser. None of it is transmitted off your device.

## What data Offprint stores

Offprint uses `chrome.storage.local` to persist the following on your computer:

- Your preferred default model, plan tier, and monthly budget.
- A local history of session-level usage statistics (token counts, estimated cost, estimated energy use).
- UI preferences such as panel position, theme, and which nudges you have dismissed.

This data lives only in your browser profile. Uninstalling the extension or clearing extension storage removes it.

## What data Offprint does NOT collect

- Personally identifiable information (name, email, account IDs).
- Authentication credentials, cookies, or session tokens.
- The full content of your conversations.
- Browsing history outside of `chatgpt.com` and `claude.ai`.
- Location, device fingerprints, or advertising identifiers.

## Data sharing and selling

Offprint does not share, sell, transfer, or otherwise disclose user data, because Offprint never receives user data in the first place. There is no Offprint-operated server.

## Permissions justification

- **`storage`** — required to save your preferences and local usage history on your device.
- **Host permissions for `https://chatgpt.com/*` and `https://claude.ai/*`** — required to read the active model and message metadata from the page so Offprint can compute cost and impact in real time.

## Third-party services

Offprint does not integrate with any third-party analytics, telemetry, advertising, or error-reporting service.

## Children

Offprint is not directed at children under 13 and does not knowingly collect any data from children.

## Changes to this policy

If this policy changes in a way that affects what data is collected or how it is used, we will update the "Last updated" date and publish the revised policy at the same URL.

## Contact

Questions about this policy: travoca99@gmail.com
