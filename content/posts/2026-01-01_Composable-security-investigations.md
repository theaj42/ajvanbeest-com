---
title: "Composable Security Investigation"
subtitle: "Or: How to Play Security Legos"
date: 2026-01-01
author: ["AJ Van Beest", "Claude"]
tags: ["security", "playbooks", "automation", "agentic", "secops"]
draft: false
---

As I've been building the first generation of agentic security tools for my SecOps team, one question has bubbled to the top: How do we get "the robot" to do the right thing?

For instance, when we get a ticket about "a user that visited a sketchy website," we have several steps that we take to build a standard information baseline, including:

- Understand the context of the user;
- Understand the state of their endpoint;
- Research the external site;
- Review the information about the actual communication;
- Make a gut-check about "Does this seem right, in the context of the user and org?"
- etc.

*Human* analysts natively understand that for each step in that process, there are several actions they need to take before the step is complete. They can generally rely on their previous experience to guide their current actions.

*Robot* analysts don't have that baked-in experience, so we need to explain the entire process. That explanation needs to be delivered in a way that's easy for the robot to consume, act on, and report about.

Hello, playbooks, my old friends.


## Explain It To Me Like I'm Five

First understand: This isn't about dumbing processes down; It's an integrity gate for the team.

If a playbook is prescriptive enough that anyone with proper tool access can follow it to successfully complete the task, you know:

- Your team *actually* understands the process;
- The process is *fully* documented;
- That fully-understood, well-documented process is *ripe* for automation.

These playbooks should be written for someone who can "computer" just fine, but who maybe hasn't spent much time in a security role. Each one should focus on a single task. For example: "Find the geolocation of an external IP address."

Each of these playbooks should contain:

- A sentence explaining what the playbook does;
- A list of tools and access necessary to accomplish the task;
- All specific steps necessary to accomplish the task;
- Steps for validating the results of the playbook;
- Instructions for logging the process.


## Know When to Use the Robot

Spoiler alert: Not every task or workflow needs AI.

If a task can be done deterministically - same inputs, same outputs, every single time - *do that task with a script.*

Only use the robot for the parts that actually require intelligence.

Working that way is cheaper, faster, and more predictable.

A pipeline might look like:

- **Deterministic**: Gather IP info, pull user context, check threat intel
- **Agentic**: "Given all this, does this look suspicious for this user?"

### Know When to Kill the Robot

There's an important caveat for working with AI: Garbage In, Garbage Out. For those of you of an \*ahem\* certain age, you'll recognize this as GIGO.

If bad data gets into the pipeline, the robot will cheerfully spew crap for the rest of the session. Deterministic steps with validation help catch that before it cascades.

If you find yourself in an interactive session where your 'bot has gone off the rails, it's time to either rewind the session, or simply kill it and start over.


## Play Security Legos

Once you have the necessary playbooks defined, you can start putting them together into composable pipelines.

That's just a fancy way of saying, "Run these playbooks in order, and where appropriate, use the output of previous playbooks as input for future ones."

Here's a high-level example for running down that pesky website:

1. Get the IP addresses of the website hosts.
2. Get registrar info for the domain name.
3. Get whois info for the IPs.
4. Check threat intel sources for hits.
5. Get geoip data for IPs.
6. Check for risk factors with IPs.
7. ...and so on.

Each step is a single playbook. Each playbook runs the same way every time. The composition is where the flexibility lives.


## The Gut-Check

Remember that last step in the investigation baseline: "Does this seem right, in the context of the user and org?"

That's tribal knowledge. Right now, that knowledge mostly lives in analysts' heads, or is buried deep in the ticketing system.

A salesperson installing a PCAP analysis tool is weird. A security engineer installing the same tool? That's called "Tuesday."

A human analyst can check the org chart, look at incident history, and intuit whether the activity makes sense for someone in that role.

Capturing that context in a way the robot can use might be challenging, but it's *also* a prime spot where a little applied intelligence could pay off big-time.

## Wrap

Build great playbooks for your team.

They'll accelerate you, your colleagues, *and* your robots as you *all* move toward operating with defined, repeatable processes.


## Resources

- [Example playbook: Find the geolocation of an external IP address](/posts/2026-01-01_Playbook-geoip-lookup)
