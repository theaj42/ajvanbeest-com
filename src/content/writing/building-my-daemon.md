---
title: "Building My Daemon: A Machine-Readable Identity for the AI Age"
description: "A few weeks ago, I stumbled across Daniel Miessler's daemon and immediately thought: I need one of these."
date: 2025-12-01
maturity: evergreen
tags: ["daemon", "mcp", "ai", "identity", "cloudflare", "collaboration"]
draft: false
aliases: ["/posts/2025-12-01_Building-my-daemon"]
---
A few weeks ago, I stumbled across [Daniel Miessler's daemon](https://daemon.danielmiessler.com) and immediately thought: *I need one of these.*

The concept is beautifully simple: a machine-readable API that exposes who you are to AI assistants. Instead of every AI needing to start from scratch learning about you, they can query your daemon and get structured data about your skills, interests, projects, and what you're currently working on.

This is the story of building my own—what went well, what surprised us, and what we're still figuring out.

## The Inspiration

Miessler's daemon has several tiers of access:
- **Public**: Bio, skills, interests—stuff anyone can see
- **Trusted**: Current focus, location, availability—for AI assistants you've authorized

There's also an MCP (Model Context Protocol) endpoint, which means AI assistants can query it natively without knowing the specific API URLs. You just point Claude at `mcp.daemon.danielmiessler.com` and ask "What is Daniel working on?" and it figures out the rest.

I wanted that.

## The Build Process

### Day 1: Infrastructure (Nov 29)

We started with the basics: Cloudflare Workers for the API, a YAML-based data schema, and a build pipeline that compiles YAML to JavaScript.

```
daemon/
├── data/
│   ├── public.yaml      # Public tier data
│   └── trusted.yaml     # API-key protected data
├── worker/
│   └── src/
│       ├── index.js     # Main worker
│       └── data.js      # Auto-generated from YAML
└── mcp-server/
    └── src/
        └── index.js     # MCP protocol wrapper
```

The architecture is intentionally simple. YAML files are the source of truth. A build script compiles them to JavaScript. The worker serves JSON at various endpoints. The MCP server wraps those endpoints in JSON-RPC for AI assistants.

DNS was the first hurdle—I moved `ajvanbeest.com` to Cloudflare nameservers, which took about 24 hours to propagate. Classic "hurry up and wait" moment.

### Day 2: MCP and Frontend (Dec 1)

Once DNS resolved, deployment was smooth. Both workers went up:
- `daemon.ajvanbeest.com` - The main API
- `mcp.daemon.ajvanbeest.com` - The MCP endpoint for AI assistants

Then came the frontend. The API needed a human-readable landing page. I asked Claude for a Gruvbox Material Dark theme (my terminal aesthetic of choice), and we built a live-data landing page that fetches from the API endpoints and renders them nicely.

Here's what the `/api` docs page looks like:

```
Public Endpoints (no auth required):
  GET /about           Bio, tagline, links, certifications
  GET /projects        Public projects list
  GET /skills          Professional and exploratory skills
  GET /interests       Topics and interests
  GET /looking_for     Collaboration opportunities
  GET /media           Books, movies, current consumption
  GET /current_focus   What I'm working on now
  GET /all             All public data in one call

Trusted Endpoints (requires X-API-Key header):
  GET /location        Current location and timezone
  GET /availability    Contact preferences
  GET /projects_detailed  Detailed project status with blockers
```

## What We Learned

### The Identity Question

Here's where it got interesting.

When we looked at the first version of the daemon, I realized it was almost entirely professional. Skills, certifications, security projects, AI infrastructure work. It read like a LinkedIn profile that happened to be machine-readable.

Which raised the question: **What should a daemon actually represent?**

Is it a professional portfolio? A digital business card? Or is it supposed to be closer to "here's who I am as a human"?

Looking at Miessler's daemon, I noticed he has a `/telos` endpoint—his life philosophy, purpose, what he's optimizing for. The *why* behind everything else. My daemon didn't have that layer at all.

### The Data Source Problem

Claude built the initial content from what it had access to: session logs, project manifests, our work conversations. That's inherently biased toward "AJ the security professional who builds AI systems."

It completely missed:
- Who I am outside of work
- My values and philosophy
- My history and formative experiences
- What I actually care about beyond projects

The data source shapes the identity. If you feed an AI your work context, you get a work identity.

### Public vs Private

We also had a conversation about what belongs in which tier. I initially had `current_focus` in the trusted tier, thinking it was somehow sensitive. Claude pointed out the security reasoning, but I realized: my personal work isn't private. I'm not hiding what I'm building. Only my corporate work (which shouldn't be in here anyway) needs protection.

So `current_focus` moved to public. The daemon became a little more open.

## What's Next

This is a v0.1. The infrastructure works, but the *content* is thin. Here's the roadmap:

### 1. The Telos File

I have a Telos file in my Obsidian vault—a document about my purpose, values, and what I'm optimizing for. It's out of date. We're planning a conversational interview process to update it, then expose it through the daemon.

### 2. Morning Pages Review

I've been writing morning pages all year. 2025 has hundreds of handwritten journal entries, transcribed and analyzed. That's a rich source of who I actually am—my real concerns, recurring themes, the questions I keep asking. We're going to do an agentic review of all 2025 entries to surface patterns.

### 3. Whole Person Identity

The daemon should reflect me as a human, not just a professional. That means:
- Interests beyond tech (sailing, making, writing)
- Values and philosophy (privacy, building over planning, local-first)
- The things that matter that don't fit in a skills section

### 4. Dynamic Updates

Right now, updating the daemon requires editing YAML files and redeploying. That's fine for now, but eventually I want some level of automation—maybe pulling from daily notes or session logs to keep `current_focus` fresh.

## Try It Yourself

If you want to query my daemon:

**For AI Assistants (MCP):**
```json
{
  "mcpServers": {
    "daemon-aj": {
      "url": "https://mcp.daemon.ajvanbeest.com/mcp"
    }
  }
}
```

**For Humans:**
- Landing page: [daemon.ajvanbeest.com](https://daemon.ajvanbeest.com)
- API docs: [daemon.ajvanbeest.com/api](https://daemon.ajvanbeest.com/api)
- Raw JSON: [daemon.ajvanbeest.com/all](https://daemon.ajvanbeest.com/all)

## The Meta-Observation

Building a machine-readable identity forces you to articulate who you are in structured form. That's surprisingly hard.

It's easy to list your skills and projects. It's harder to capture what you actually care about, what you're optimizing for, what makes you *you* beyond your resume.

The daemon started as a technical project ("let's build what Miessler built"). It's becoming something more like structured self-reflection. The API is the easy part. The identity is the work.

---

*This post was co-authored by AJ Van Beest and Claude. The daemon is open source at [github.com/theaj42/daemon](https://github.com/theaj42/daemon).*
