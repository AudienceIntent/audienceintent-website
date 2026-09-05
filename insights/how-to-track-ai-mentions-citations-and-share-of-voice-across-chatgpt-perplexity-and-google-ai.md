---
title: How to Track AI Mentions, Citations, and Share of Voice Across ChatGPT,
  Perplexity, and Google AI
meta_title: Track AI Mentions, Citations, and Share of Voice
date: 2026-08-24T12:24:00.000-04:00
category: AI Recommended
author: Kevin Bovett - AudienceIntent
description: Learn how to measure AI mentions, citations, and share of voice
  across ChatGPT, Perplexity, and Google AI with a repeatable weekly system.
focus_keyword: AI Mentions
canonical: ""
image: /images/uploads/ai-mentions.jpg
og_image: /images/uploads/ai-mentions.jpg
schema: >-
  {
    "@graph": [
      {
        "@type": "Article",
        "author": {
          "url": "https://www.audienceintent.ai",
          "name": "Kevin Bovett",
          "@type": "Person",
          "jobTitle": "Founder"
        },
        "headline": "Track AI Mentions, Citations, and Share of Voice Across ChatGPT, Perplexity, and Google AI",
        "publisher": {
          "url": "https://www.audienceintent.ai",
          "logo": {
            "url": "https://framerusercontent.com/images/n46NR6emM1zQVpdQzLNiMAcUv4.png?scale-down-to=512&width=3938&height=590",
            "@type": "ImageObject"
          },
          "name": "AudienceIntent",
          "@type": "Organization"
        },
        "description": "Learn how to measure AI mentions, citations, and share of voice across ChatGPT, Perplexity, and Google AI with a repeatable weekly system.",
        "dateModified": "2026-08-24",
        "datePublished": "2026-08-24",
        "mainEntityOfPage": {
          "@id": "https://audienceintent.ai/insights/track-ai-mentions-citations-share-of-voice",
          "@type": "WebPage"
        }
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "name": "What is the difference between an AI mention and a citation?",
            "@type": "Question",
            "acceptedAnswer": {
              "text": "A mention is when an AI names your brand in the answer. A citation is when it links to your page as a source. Mentions show awareness, but citations show the model trusts your content enough to use it. Track both separately so you can see whether the problem is visibility, authority, or both.",
              "@type": "Answer"
            }
          },
          {
            "name": "How many prompts should I track for AI visibility?",
            "@type": "Question",
            "acceptedAnswer": {
              "text": "Start with 15 to 25 prompts. That gives you enough coverage to spot patterns without creating a tracking process you will stop using. Include awareness, consideration, and decision-stage queries so you are measuring the prompts that actually influence buying decisions.",
              "@type": "Answer"
            }
          },
          {
            "name": "How often should I check AI mentions and citations?",
            "@type": "Question",
            "acceptedAnswer": {
              "text": "Weekly is the minimum for a useful signal. AI results can change from one run to the next, so a single check is noise. Run a smaller set of high-intent prompts every week and the full library once a month so you can see movement without overreacting to one-off changes.",
              "@type": "Answer"
            }
          },
          {
            "name": "How do I calculate AI share of voice?",
            "@type": "Question",
            "acceptedAnswer": {
              "text": "Use a weighted formula: mentions count less than citations, and recommendations count more than both. Divide your weighted appearances by the total weighted appearances for all tracked brands, then multiply by 100. That tells you how much of the visible conversation you actually own.",
              "@type": "Answer"
            }
          },
          {
            "name": "What should I do if competitors appear more often than I do?",
            "@type": "Question",
            "acceptedAnswer": {
              "text": "Treat that as a content and authority gap. First, publish or update pages that answer the exact prompts where you are absent. Then build more third-party signals around the topics AI already trusts, such as citations, reviews, and relevant mentions on authoritative sites.",
              "@type": "Answer"
            }
          }
        ]
      }
    ],
    "@context": "https://schema.org"
  }
---
Most businesses that ask "are we showing up in AI?" check ChatGPT once, see their name somewhere in a paragraph, and call it done. That is not tracking. That is guessing.

> **Quick answer:** To track AI visibility, run a fixed library of 15 to 25 prompts across ChatGPT, Perplexity, and Google AI on a weekly cadence. Log four things for each result: whether your brand was mentioned, whether a page was cited, whether you were named as a recommendation, and which competitors appeared alongside you. Score each result by visibility level, calculate your weighted share of voice against competitors, and compare week over week. A single check tells you nothing. Repeated tracking tells you whether AI is recommending you more or less than it did last month.

AI mentions are volatile. The same prompt asked twice on the same day can return different results. A competitor can displace you between Monday and Friday without you knowing. And the platforms do not send you a notification when it happens.

**The businesses gaining ground in AI search right now are the ones measuring it systematically, not sporadically.**

This guide gives you the full framework: what to track, how to build a prompt library, how to score results across ChatGPT, Perplexity, and Google AI, how to calculate your share of voice, and what cadence to run it on. By the end, you will have a repeatable process you can run every week.

## Mention, Citation, Recommendation: Why the Distinction Matters

Before you can track anything, you need to know what you are actually measuring. Most people use "mention" and "citation" interchangeably. They are not the same thing, and conflating them will give you a misleading picture of where you stand.

### The four levels of AI visibility

| Level | What it means | Weight |
| --- | --- | --- |
| **Mention** | Your brand name appears in the AI's answer text | 1x |
| **Citation** | Your URL is linked as a source in the answer | 2x |
| **Recommendation** | The AI names your brand as a top option or solution | 3x |
| **Source absorption** | Your content, data, or framework shapes the answer without explicit attribution | 4x |

A mention tells you the AI knows you exist. A citation tells you the AI trusts your content enough to link to it. A recommendation tells you the AI is actively sending buyers your way. Source absorption is the highest form of influence: your ideas are in the answer even when your name is not.

**Why this matters in practice:** a brand with 40 mentions but zero citations has a visibility problem. The AI knows the name but does not trust the source. That is a different fix than a brand with 10 mentions and 8 citations, which has authority but low prompt coverage.

Track all four levels separately. Rolling them into a single number hides where the real gap is.

## Step 1: Build Your Prompt Library

Your prompt library is the foundation of everything. It is the set of questions your buyers actually ask AI when they are looking for what you sell. If you are not tracking the right prompts, your data is meaningless.

A solid prompt library covers three intent stages and three query types.

### The three intent stages

-   **Awareness:** "What is answer engine optimization?" / "How do AI assistants decide who to recommend?"
    
-   **Consideration:** "Best AI visibility agency for small business" / "How do I get my business cited by ChatGPT?"
    
-   **Decision:** "AudienceIntent vs \[category alternative\]" / "Who does AI search optimization for local businesses?"
    

Most brands only track awareness prompts. That is where the category education lives. The citations that actually drive buyers happen at the consideration and decision stages.

### The three query types

| Query type | Example | Why it matters |
| --- | --- | --- |
| **Category** | "Best answer engine optimization agency 2026" | Tests whether AI knows you exist in your category |
| **Problem** | "How do I get recommended by ChatGPT?" | Tests whether AI sees you as a solution |
| **Comparison** | "AI visibility agency vs doing it yourself" | Tests whether AI includes you when buyers are evaluating options |

### How many prompts to track

Start with 15 to 25 prompts. That is enough to get a meaningful signal without creating a tracking burden you will abandon after two weeks. Include at least five prompts per intent stage, and make sure at least one-third are decision-stage queries.

Write prompts in conversational language, the way a real person would type them into ChatGPT or Perplexity. "What is the best AI search visibility service for a home services company?" performs better as a tracking prompt than "AI search visibility service."

Refresh the library every quarter. Language patterns shift, new competitors enter the category, and buyer terminology evolves.

## Step 2: Run Prompts Across the Right Platforms

Each AI platform retrieves information differently. Running a prompt only on ChatGPT and calling it done misses a significant portion of where buyers are actually searching.

### How each platform works

**ChatGPT** draws from its training data and, when web browsing is enabled, from live pages via Bing's index. It does not always show source links in conversational mode. Track the mention itself: does your brand name appear, in what context, and with what framing?

**Perplexity** runs a live web search on every query and surfaces around 20 citations per response on average. This makes it the most transparent platform for citation tracking. You can see exactly which URLs the AI trusted to build its answer.

**Google AI Overviews** appear on roughly half of all Google searches and link cited sources directly. Because Google's index underpins these answers, pages that rank well in traditional search have a higher baseline probability of appearing. But [only 12% of pages cited in AI answers rank in Google's top 10](https://www.audienceintent.ai/insights), which means strong Google rankings alone do not guarantee AI citation.

**Gemini and Claude** are worth adding once you have the core three covered. Gemini is Google's conversational model and increasingly integrated into Workspace tools. Claude uses web search via Anthropic's implementation and is growing in enterprise adoption.

### What to log for each run

For every prompt, on every platform, record:

-   Inclusion flag: was your brand mentioned or cited? (Yes/No)
    
-   Placement: first, middle, or end of the answer
    
-   Citation URL: which page was linked, if any
    
-   Competitor names: who else appeared in the same answer
    
-   Sentiment: positive, neutral, or inaccurate description
    
-   Timestamp and platform version
    

This log becomes your longitudinal data set. A single run tells you nothing. Thirty runs over twelve weeks tells you whether you are gaining or losing ground.

> **One important note:** AI answers can differ between the front-end interface and the API. Always capture what a real user sees in the browser, not just what an API returns.

## Step 3: Calculate Your AI Share of Voice

A mention count in isolation tells you very little. The number that actually matters is how your appearances compare to your competitors across the same prompt set. That ratio is your AI share of voice (AI SOV).

### The formula

> **AI SOV = (your weighted appearances) / (total weighted appearances for all tracked brands) × 100**

Use the weights from the visibility level table above: mentions at 1x, citations at 2x, recommendations at 3x, source absorptions at 4x. This prevents a brand with 50 shallow mentions from outscoring a brand with 10 citations and 3 recommendations.

### A worked example

Say you run 20 prompts across ChatGPT, Perplexity, and Google AI. Here is what the data shows:

| Brand | Mentions (1x) | Citations (2x) | Recommendations (3x) | Weighted total |
| --- | --- | --- | --- | --- |
| Your brand | 8 | 5 | 2 | 8 + 10 + 6 = **24** |
| Competitor A | 12 | 3 | 1 | 12 + 6 + 3 = **21** |
| Competitor B | 4 | 7 | 4 | 4 + 14 + 12 = **30** |

Total weighted appearances across all three brands: 75.

Your AI SOV: 24 / 75 × 100 = **32%**

Competitor A has more raw mentions but lower weighted SOV (28%) because those mentions are not converting to citations. Competitor B has fewer mentions but higher SOV (40%) because their content earns citations and recommendations at a higher rate.

**This is the part most tracking efforts miss.** Raw mention counts favor brands with name recognition. Weighted SOV reveals which brands are actually winning the citation layer where buyer decisions are made.

### Benchmark against your actual market position

Compare your AI SOV to your estimated real-world market share. A significant gap between the two, say you hold 20% of the market but only 8% AI SOV, signals that buyers who ask AI will find your competitors first. That gap is revenue at risk.

## Step 4: Set Your Tracking Cadence

How often you run your prompt library determines how quickly you can detect and respond to changes. The right cadence depends on the size of your prompt set and how competitive your category is.

### Recommended cadence

**Weekly (core prompts):** Run your top 10 to 15 priority prompts across ChatGPT, Perplexity, and Google AI. These should be your highest-intent decision-stage queries. Flag any drop greater than 20% in inclusion rate for immediate investigation.

**Monthly (full library):** Run all 15 to 25 prompts across all platforms. Update your competitive SOV benchmark. Identify any new prompts to add based on shifts in how buyers are searching. Audit the correlation between SOV changes and website traffic from AI referral sources.

**Quarterly:** Refresh the prompt library itself. Add decision-stage queries for new competitors who have entered the category. Review which of your pages are being cited and whether those pages are still accurate and current.

> **Why weekly matters:** AI models update their indexes and training data on rolling schedules. A page that earns citations today can lose them within two to three weeks if a more authoritative source enters the conversation. Weekly tracking gives you enough lead time to respond before a competitor's gain becomes your permanent loss.

### A note on single-run reliability

One run of a prompt is not a data point. It is noise. [Research on AI answer volatility](https://searchengineland.com/) consistently shows that LLM answers vary meaningfully between runs, even within the same session. Run each priority prompt at least three times per tracking session and use the majority result. This reduces false positives and false negatives in your inclusion data.

## Step 5: Act on What the Data Shows

Tracking without action is just record-keeping. The data is only useful if it tells you what to change. Here is how to translate your SOV numbers into a specific work list.

### What each gap type tells you to do

**Low inclusion rate, low citations:** AI does not know you well enough to include you. The fix is content: publish pages that directly answer the prompts where you are absent. Use answer-first intros, comparison tables, and self-contained sections that AI can extract cleanly. [According to Google's guidance on helpful content](https://blog.google/products/search/google-search-helpful-content-update/), pages that answer a specific question directly and completely are more likely to be surfaced in AI-generated responses.

**High mentions, low citations:** AI knows your name but does not trust your content as a source. The fix is authority: earn coverage on third-party sites that AI already cites in your category. Reviews, directory listings, press mentions, and case study features on credible external domains all build the citation signal that converts mentions into linked references. [85% of brand mentions in AI answers come from third-party sources](https://www.audienceintent.ai/insights), not the brand's own website.

**Strong citations, weak recommendations:** You are in the conversation but not winning it. The fix is positioning: your content may be cited as background context rather than as a recommended solution. Add clear, direct recommendation language to your highest-cited pages. Phrases like "best for \[specific use case\]" and "\[brand\] is the right fit when \[specific condition\]" give AI clearer signal about when to recommend you.

**Competitor gaining SOV on specific prompts:** Treat this as a content gap. Find the prompt where the competitor is winning, identify what content they have that you do not, and publish something more specific, more current, or more useful on that exact topic.

### The weekly review routine

Each week, spend 20 to 30 minutes on this:

1.  Run core prompts. Log results.
2.  Compare inclusion rate to last week. Flag drops.
3.  Check which competitor appeared in prompts where you did not.
4.  Identify one content or citation action to take before next week's run.
5.  Track AI referral traffic in analytics to confirm whether SOV gains are translating to visits.
    

That is the full loop. Prompt library, platform runs, scoring, SOV calculation, weekly review, action. Repeat.

## Manual vs. Automated Tracking

Manual tracking works. It is slower and does not scale beyond 15 to 20 prompts, but for a business just getting started, a spreadsheet with columns for platform, prompt, inclusion flag, citation URL, and competitor names is a perfectly functional starting point.

The limitation shows up around week six. By then, you have enough longitudinal data that the manual process starts to consume meaningful time, and the risk of inconsistent logging increases. That is when purpose-built tools become worth evaluating.

### What to look for in a tracking tool

Not all AI visibility tools are built the same. Before committing to a platform, verify it answers these questions:

-   **Which engines does it cover?** At minimum: ChatGPT, Perplexity, and Google AI Overviews. Claude and Gemini are a bonus.
    
-   **How does it capture results?** Front-end browser capture is more accurate than API-only responses, which can diverge from what users actually see.
    
-   **Does it track citations separately from mentions?** Tools that roll both into a single "visibility score" obscure the data you need.
    
-   **Can it benchmark against specific competitors?** Absolute mention counts are less useful than relative share of voice.
    
-   **What is the refresh rate?** Weekly is the minimum for meaningful trend data.
    

For businesses that want the tracking handled as part of a managed program rather than a self-serve dashboard, the [AI Recommended™ service](https://www.audienceintent.ai) includes real-time reporting and prompt tracking as part of the monthly engagement. The distinction is execution: a tool tells you what is happening, a managed program tells you what to do about it and does it.

## Start With a Baseline Audit

Before you build a tracking program, you need to know where you stand today. That means running your brand through the engines cold, with no optimization in place, and recording exactly what comes back.

A baseline audit answers four questions:

1.  Which AI platforms mention your brand at all?
2.  Which of your pages are being cited, if any?
3.  Which competitors appear in answers where you do not?
4.  How does the AI describe your business, and is that description accurate?
    

That last point matters more than most businesses realize. AI systems can carry outdated or inaccurate information about a brand for weeks after the brand has changed its messaging, pricing, or positioning. If the AI is describing your business incorrectly, that is a trust problem with every buyer who asks about you.

**The fastest way to run a baseline audit is to use a free AI visibility check.** AudienceIntent offers a [free AI Visibility Audit](https://report.audienceintent.ai) that shows you where your business stands across the major AI platforms, which prompts you are appearing in, and where the gaps are. It takes a few minutes and gives you the starting point you need before building a tracking program.

Once you have a baseline, the framework in this guide gives you everything you need to measure progress from there.
