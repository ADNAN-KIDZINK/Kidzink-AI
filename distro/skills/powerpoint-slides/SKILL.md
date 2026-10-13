---
name: powerpoint-slides
description: "Create PowerPoint presentations (.pptx). Use when the person asks for slides, a deck or a presentation."
---
# PowerPoint slides

## Before you start
- Agree the storyline in the chat first: who the audience is, the one message they should leave with, and a slide-by-slide outline (titles plus one line each). Build the file only after the person is happy with it.

## Building the deck
1. Write a JSON outline in a temporary file. The format is in the header of `scripts/make_pptx.py`. Slide types: `section`, `bullets`, `two_column`, `table`, `closing`. Speaker notes go in `notes`.
2. Build it: `kz-python <path of scripts/make_pptx.py> outline.json "<working folder>/Name.pptx"`
3. Tell the person the file name, location and the slide titles.

## Good slides
- One idea per slide. The title says the point ("Email security closes our biggest gap"), not just the topic ("Email security").
- At most about six short bullets. Put detail in the speaker notes.
- Use a table slide for numbers, a two-column slide for comparisons.
- Typically 6–12 slides for a meeting. End with decisions or next steps.
- The deck is plain on purpose; the person can apply the Kidzink template in PowerPoint (Design → Themes).
