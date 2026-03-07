---
name: marketplace-monitor
description: Monitor and summarize second-hand marketplace listings (especially Facebook Marketplace) for a target product and radius. Use when the user asks to search/track items like “Mac mini M4 within 50km of Melbourne CBD”, compare listings, deduplicate, or set recurring checks. This skill is for compliant, logged-in browser workflows (no anti-bot bypassing).
---

# Marketplace Monitor

## Overview
Collect, filter, and summarize marketplace listings from a user-provided, logged-in browsing session. Prioritize speed, deduplication, and actionable output (price, location, condition, link, posted time).

## Workflow

1. Confirm search target and constraints
- Product keywords (e.g., `mac mini m4`)
- Radius and origin (e.g., `50km from Melbourne CBD`)
- Budget range (optional)
- Must-haves (RAM/storage/condition/with box)

2. Use a compliant page source
- Prefer user-opened Facebook Marketplace search pages in a logged-in browser tab.
- If direct fetch fails due login/anti-bot, continue via interactive browser session only.
- Never attempt CAPTCHA bypass, automated account abuse, or anti-bot evasion.

3. Capture listings and normalize
- Extract title, price, suburb/city, distance (if shown), posted time, URL.
- Normalize price to AUD numeric where possible.
- Deduplicate by URL first, then title+price+suburb similarity.

4. Filter and rank
- Keep only listings matching product intent (exclude accessories unless user asked).
- Apply radius/budget/spec filters.
- Rank by relevance: exact model > nearby distance > newest > lower price.

5. Deliver concise result set
- Return top matches (usually 5–15) with short notes.
- Include “none found” explicitly when zero matches.
- Add next-step suggestions: broaden query, raise radius, include nearby city names.

## Output format
Use bullets (no markdown tables):
- `Title — A$Price — Location/Distance — Posted — <URL>`
- `Why it matched` (one short clause)

Then include:
- `Matched count`
- `Excluded count` + key exclusion reasons
- `Suggested next query` (1–3 options)

## Guardrails
- Do not claim full-market coverage unless explicitly verified.
- Call out uncertainty when distance/time is missing.
- Keep links raw and clickable.
- Stay compliant with platform terms and account safety.

## References
- Read `references/facebook-marketplace.md` when working specifically with Facebook Marketplace.
