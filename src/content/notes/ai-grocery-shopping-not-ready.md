---
title: "I Tried to Get AI to Do My Grocery Shopping"
subtitle: "The Ecosystem Isn't Ready Yet (But It's Getting There)"
description: "For about a year and a half, I've had this dream: Give my AI assistant a shopping list, have it programmatically add items to my grocery cart, review the cart myself, checkout manually, and pick up…"
date: 2026-02-07
maturity: seedling
tags: ["ai", "automation", "mcp", "grocery", "practical-ai"]
draft: true
---

For about a year and a half, I've had this dream: Give my AI assistant a shopping list, have it programmatically add items to my grocery cart, review the cart myself, checkout manually, and pick up curbside. Simple, right?

This morning I finally sat down to make it happen. Here's what I learned.

## The Dream Workflow

1. Tell Claude: "Add these 80 items to my cart"
2. AI uses API/MCP to add items programmatically
3. I review the cart (catch substitutions, verify quantities)
4. Manual checkout (I keep control of payment)
5. Drive to store, pick up groceries

No delivery fees. No tipping. No stranger picking my produce. Just the cognitive load of list-making offloaded to AI.

## Attempt #1: Browser Automation

My first thought: Use Claude's browser automation capabilities (via the Chrome MCP server) to literally click through the grocery website like a human would.

**The test:** Add a gallon of milk and a quart of half & half to my Fresh Thyme cart.

**The result:** 3 minutes and 14 seconds.

For two items.

My typical shopping list runs 80-100 items. At that rate, we're looking at 2+ hours of browser automation, burning through tokens, compute, and electricity. The environmental cost alone made me uncomfortable—this is not a sustainable approach.

Browser automation works. It's just obscenely expensive for this use case.

## Attempt #2: Find an API

Okay, so we need a real API. I spent the next hour surveying every grocery store within reasonable distance of my home in the Chicago suburbs:

| Store | API Status |
|-------|-----------|
| **Kroger/Mariano's** | ✅ Full Cart API + existing MCP server |
| Fresh Thyme | ❌ Instacart backend, B2B2C only |
| Jewel-Osco | ❌ Albertsons family, no public API |
| Whole Foods | ❌ Amazon backend, no third-party access |
| Meijer | ❌ Reverse-engineered library exists but auth is broken |
| Walmart | ❌ No official API (plus personal objections) |
| Costco | ❌ No API access |

**The discovery:** There's actually a mature MCP ecosystem for grocery shopping! The [kroger-mcp](https://github.com/CupOfOwls/kroger-mcp) server is production-ready, with full cart management, product search, and even shopping path optimization.

But here's my problem: I shop at Meijer.

## The Economics Don't Work

The nearest Kroger-family store (Mariano's) is 12 miles away—through western Chicago suburbs, so 20-30 minutes each way.

And according to [Chicago Consumers' Checkbook](https://www.checkbook.org/chicago-area/supermarkets/articles/Which-Grocery-Stores-Offer-the-Best-Prices-and-Quality-2055), Mariano's prices are about **18% higher** than Meijer.

So my options are:
1. **Use the working API** but pay 18% more + an hour of driving
2. **Use browser automation** but burn through compute and feel bad about it
3. **Wait** for Meijer to open their API or someone to build a working integration

I chose option 3.

## What Exists Today

If you're luckier than me with store selection, here's what's available in the MCP ecosystem:

- **[kroger-mcp](https://github.com/CupOfOwls/kroger-mcp)** - Kroger, Mariano's, Fred Meyer, Ralphs, etc.
- **[groceries-mcp](https://github.com/o-b-one/groceries-mcp)** - Multi-vendor (currently Rami Levy, Keshet)
- **[MCP Picnic](https://lobehub.com/mcp/ivo-toby-mcp-picnic)** - Picnic (EU grocery)
- **[Shufersal MCP](https://skywork.ai/skypage/en/automate-groceries-ai-shufersal)** - Shufersal (Israel)
- **[OurGroceries MCP](https://mcpmarket.com/server/ourgroceries)** - List management

ChatGPT also has full Instacart integration with embedded checkout—but that's delivery-only, not curbside pickup.

## The Meijer Situation

There IS a [reverse-engineered Meijer Python library](https://github.com/dapperfu/python_Meijer) that supports cart management. But the login is currently broken due to Meijer's security measures. Getting it to work requires capturing auth tokens via MITM proxy—fragile, high-maintenance, and not something I want to babysit.

Meijer has an [official developer portal](https://apiportal.meijer.com/), but it appears to be B2B-focused, not consumer cart access.

## My Takeaway

This use case isn't ready for prime time—*for me*. If you shop at Kroger-family stores, you're golden. The infrastructure exists, it works, and it's exactly what I've been dreaming about.

For the rest of us, we wait. The MCP ecosystem is growing fast. Someone will build a Meijer integration eventually, or Meijer will open their API, or I'll move somewhere with a closer Kroger.

Until then, I'll keep making my shopping lists the old-fashioned way—with AI helping me think, but my own fingers doing the clicking.

---

## Resources

- [kroger-mcp on GitHub](https://github.com/CupOfOwls/kroger-mcp)
- [Kroger Developer Portal](https://developer.kroger.com/)
- [MCP (Model Context Protocol) Overview](https://modelcontextprotocol.io/)
- [Chicago Consumers' Checkbook Grocery Price Comparison](https://www.checkbook.org/chicago-area/supermarkets/articles/Which-Grocery-Stores-Offer-the-Best-Prices-and-Quality-2055)
