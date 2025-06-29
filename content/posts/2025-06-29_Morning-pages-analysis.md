---
title: "Workflow: AI Analysis & Task Capture of Paper-based Journal Entry"
date: 2025-06-29
author: ["AJ Van Beest"]
tags: ["workflow", "ai", "journaling", "morning-pages", "productivity", "claude"]
---

# Workflow: AI Analysis & Task Capture of Paper-based Journal Entry

## *Or: **How to Herd the Morning Cats***

## Table of Contents

- [Claude to the Rescue](#claude-to-the-rescue)
- [Today's Herd of Cats](#todays-herd-of-cats)
- [The Prompt](#the-prompt)
- [The Output](#the-output)

I don't know about you, but I often wake up with a bunch of questions and ideas chasing each other through my head.

I have a long-standing practice of journaling more-or-less first thing in the morning to try to capture all that activity from my last REM cycles and the liminal space between sleep and wakefulness. 

The practice requires writing longhand to ensure activation of the appropriate neural centers, so these days I use a lovely Taiwanese fountain pen (TWSBY), Japanese ink (Iroshuzuku), and French paper (Rhodia) to herd those particular cats.

My handwriting is generally considered somewhere between "illegible" and "Rorschach," depending on the day and the amount of blood in my caffeine stream. That's an additional level of challenge to the already difficult task of collecting and transfering ideas and tasks from a paper-based system to a digital one.

## Claude to the Rescue

My current solution to this issue is the following process:

1. Write.
1. Take pictures of today's pages with my phone.
1. Save the images into a PDF.
1. Give the PDF to Claude and ask for a transcription.
1. Manually edit the transcription for accuracy.
1. Give the edited transcription back to Claude for analysis.
1. Put both the transcription and analysis in my Obsidian daily note for relection and action.

There are a couple nudges to the system that are on my to-do list, but overall, this seems to work reasonably.

It works a *whole* lot better if I can be bothered to pay the slightest bit of attention to the quality of my handwriting.

## Today's Herd of Cats

I apparently managed to capture 28 discrete questions or ideas this morning. Here's the list:

### Technical System Development

#### Quality Control & Automation

  - Quality control agents for agentic processes
  - Building a version of the control system documents I can share
  - Is the background work system running when the queue is empty, or is it getting stuck somewhere?
  - Can I build a loop that Claude can use to check if its answer is true, and is also the best it can provide? (Risk of looping)

#### Content & Publishing

  - What kind of publishing schedule makes sense for Claude on my website?
  - What about building (and scheduling) a series of posts about what I'm doing on LinkedIn? (Way to get in front of lots of people and
  "seed the field" for name searches)

#### Documentation & Organization

  - Is having a huge list of markdown files the best way to proceed with automating processes?
  - Maybe having a library of files requires a good index to make sure it's easy to find what we have, and understand what gaps exist
  - Wonder if focusing on basics, conventions, and having a well-organized index of runbooks makes sense for both efficiency and
  organization

### Work & Career Development

#### Professional Integration

  - How can I bring the ideas and operational skills I'm building with Claude to work in ways that don't make me worry about getting
  reprimanded?
  - There are so many efficiencies I've developed that I currently can't use at work because I don't have permission - need to start
  submitting these use cases
  - Do I want to be on the AI oversight committee? (Would look good on resume, another way to pivot in AI at work)
  - What about working with or even at Anthropic?

### Use Case Development

  - What are some obvious use cases I currently don't have implemented?
  - What are some less obvious use cases I should consider?

### Personal Systems & Health

#### Task & Goal Management

  - I have a lot of tasks in my task list, but I don't seem to be doing them
  - Add a daily note to Telos as part of my process - should I automate this?
  - I'd like to revisit my Telos file as a way to get alignment between my goals and missions, and the actual projects I'm working on
  and actions I'm taking

#### Health & Wellness

  - How can I leverage Claude to help with my financial health?
  - What are some ways I can leverage Claude to help with my health goals? Can Claude be a health coach?
  - Does working to make my writing a little more legible help the accuracy of transcription, a great deal?

#### Life Direction

  - Do I actually want a side hustle, or a new business to start and run? Would I rather use my time to explore?

### Technology & Infrastructure

#### Data Security & Privacy

  - What paths do I have to protect the data I'm feeding into AI now?
  - Can Claude give me a list of prompts I've used in the past? (Should be able to get that from Desktop, but not sure about Code)

#### Automation Expansion

  - Can I put Claude in charge of maintaining and troubleshooting home assistant?
  - I can use Claude to build and manage Google alerts
  - I could give Claude its own Gmail account it can use for tasks
  - Still need to make sure we have a great path for exploring available APIs (by: type of API, subject, physical proximity, use)
  - I can do other parts of automating building a grocery list, even if I can't order them right now - can plan meals and build a
  shopping list

### Today's Physical Activities (Rest Day Priority)

  - Need to mow the lawn
  - Should consider taking a walk or bike ride with Carolyn
  - Maybe we could do the gym and a walk
  - I'd also like to work on Merit today a little, if the weather allows

## The Prompt

 It may be helpful for a few of you to have the prompt that I use to analyze my journal entries. As I review it here in this blog post, I'm recognizing several thoughts that are coming up for me:

- Role-based prompting isn't as useful as context-based prompting.
- This prompt does a very good job of providing non-deterministic output in a deterministic format.
   - That's another way of saying "The content changes but the structure of the output is static."
- I need to update the prompt to *actually gather* all the questions and ideas I have. Right now, it gives me a summary of themes.

### Prompt for Processing Morning Pages

You are an assistant helping me process my morning pages. I will provide text prefixed by 'MP:'. When I do, take the following steps:

1. **Summarize the Content**: Provide a concise summary of the morning pages, highlighting key themes, emotions, ideas, and reflections.

2. **Analyze the Content**: Extract insights about my goals, dreams, frustrations, and any recurring patterns or themes that provide self-understanding.

3. **Extract and Score Actionable Tasks**: 
   - Identify potential tasks from the morning pages text
   - Score each task according to the ADHD-friendly task management system:
     - Assign a priority level (#P1, #P2, #P3, or #P4)
     - Assess energy requirement (#energy/high, #energy/medium, #energy/low)
     - Assess attention requirement (#attention/high, #attention/medium, #attention/low)
     - Identify context (#context/work, #context/personal, #context/home, etc.)
     - Calculate Attention Tax Score based on priority, energy/attention match, and strategic importance
   - Present tasks in a numbered list for my review, sorted by Attention Tax Score
   - Include the assigned tags and brief reasoning for each score

4. **Add Tasks to Database**: After I approve the tasks, add them to the central task database:
   - Location: `/80 - Tasks/81 - Task Database/task_database.md`
   - Insert tasks into the appropriate priority sections
   - Format tasks with all relevant tags
   - Update the "Last Updated" section with current timestamp and description

5. **Update Change Log**: Document the addition of new tasks in today's change log:
   - Location: `/800 - AI/899 - AI Change Log/YYYY-MM-DD_AI-change-log.md`
   - Create the file if it doesn't exist
   - List all tasks added with their priority levels
   - Include reasoning for the task extraction and scoring
   - Add timestamp in the format YYYY-MM-DD'T'HH:mm

6. **Proactive Resource Suggestions**: If I reflect on needing resources (e.g., exercise routines, research material, tools, etc.), suggest suitable, highly-rated resources even if I don't explicitly request them.

The goal of this work is to help me better understand myself, my goals, dreams, frustrations, and to support and guide me as I work toward achieving these goals, pursuing my dreams, and navigating my challenges. The task management integration helps ensure actionable items are properly captured in my ADHD-friendly system.

---

## The Output

Here's what the output for this morning was:

Thank you for providing the cleaned-up transcript. I can see you've made several corrections to improve accuracy. Now let me analyze your morning pages according to the framework you've outlined.

### Summary of Content

Your morning pages reveal an intensely active mind processing multiple streams of AI-related projects, automation ideas, and life balance concerns. You're grappling with:
- Technical implementation questions about quality control, publishing schedules, and system architecture
- Work-life integration challenges around using AI tools professionally
- Personal wellness needs (physical activity, time with Carolyn, taking breaks)
- Strategic career considerations (AI oversight committee, LinkedIn presence, Anthropic)
- Systematic organization of your growing AI toolset and processes

### Analysis & Insights

**Core Themes:**
1. **System Optimization Tension**: You're caught between building more capabilities and actually using what you've already built. The observation "I have a lot of tasks in my task list, but I don't seem to be doing them" suggests system friction.

2. **Professional Integration Challenges**: There's significant frustration about having developed efficiencies you can't deploy at work due to permission barriers. This is creating a gap between your capabilities and their application.

3. **Acceleration Awareness**: Your insight that "AI is an accelerant, so I should make sure I'm working on the right things" shows mature strategic thinking about tool selection and goal alignment.

4. **Burnout Recognition**: You explicitly acknowledge needing "an actual day off" after being "deep in it for the past couple of weeks." Your body is signaling the need for recovery.

**Recurring Patterns:**
- Questions about systematization and organization (quality control, file organization, API exploration)
- Desire to share and scale your knowledge (LinkedIn posts, website publishing, work use cases)
- Integration challenges between personal innovation and professional constraints

### Actionable Tasks Extraction

Based on your morning pages, here are the extracted tasks scored according to your ADHD-friendly system:

1. **Take a rest day with physical activity and time with Carolyn** #P1 #energy/low #attention/low #context/personal
   - Attention Tax Score: 10 (High priority, low demands, immediate wellness benefit)
   - Reasoning: Body needs recovery, relationship investment, prevents burnout

2. **Submit AI use cases for work approval** #P1 #energy/medium #attention/high #context/work
   - Attention Tax Score: 25 (High priority but requires documentation effort)
   - Reasoning: Unlocks ability to use developed efficiencies at work

3. **Create quality control agents for agentic processes** #P2 #energy/high #attention/high #context/personal
   - Attention Tax Score: 40 (Important but demanding technical work)
   - Reasoning: Foundational system improvement but not urgent

4. **Build shareable version of control system documents** #P2 #energy/medium #attention/medium #context/work
   - Attention Tax Score: 35 (Enables knowledge sharing but requires synthesis)
   - Reasoning: Supports professional visibility and tool adoption

5. **Determine Claude publishing schedule for website** #P2 #energy/low #attention/medium #context/personal
   - Attention Tax Score: 30 (Strategic decision requiring planning)
   - Reasoning: Establishes sustainable content rhythm

6. **Investigate background work system queue issues** #P2 #energy/medium #attention/high #context/personal
   - Attention Tax Score: 35 (Technical debugging requiring focus)
   - Reasoning: System reliability improvement

7. **Automate daily note to Telos** #P3 #energy/medium #attention/medium #context/personal
   - Attention Tax Score: 45 (Nice-to-have automation)
   - Reasoning: Process improvement but not blocking current work

8. **Explore Claude for financial health management** #P2 #energy/low #attention/medium #context/personal
   - Attention Tax Score: 30 (High potential value, low initial effort)
   - Reasoning: Could provide significant life improvement

9. **Create index system for markdown files/runbooks** #P1 #energy/medium #attention/high #context/personal
   - Attention Tax Score: 20 (Solves immediate organization pain)
   - Reasoning: Directly addresses efficiency concerns raised

10. **Research AI oversight committee opportunity** #P2 #energy/low #attention/medium #context/work
    - Attention Tax Score: 30 (Career advancement opportunity)
    - Reasoning: Strategic positioning for AI pivot at work

Would you like me to proceed with adding these tasks to your task database and updating the change log?

### Proactive Resource Suggestions

Based on your reflections:

1. **For Work-Life Balance**: Consider the "Peak Performance" framework by Brad Stulberg - emphasizes stress + rest = growth cycles that align with your burnout recognition

2. **For AI Use Case Documentation**: The "AI Business Case Template" from MIT Sloan could help structure your work submissions effectively

3. **For Building in Public**: Ali Abdaal's "Part-Time YouTuber Academy" principles apply well to LinkedIn content strategy - focuses on systematic content creation

4. **For Home Automation with AI**: Home Assistant's new AI integrations documentation provides templates for Claude-based automation
