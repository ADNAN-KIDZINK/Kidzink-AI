---
name: pdf-files
description: "Read, summarise or pull information out of PDFs, including scanned ones. Use whenever the person drops in a PDF or asks about one."
---
# PDF files

## Reading
- Short text PDFs: the `pdf_tool` (extract_text) is quickest.
- Long PDFs, page references, tables or scans: `kz-python <path of scripts/read_pdf.py> "<file>"`
  - `--pages 3-5` reads only some pages; use it for long documents once you know where to look.
  - `--tables` adds tables as Markdown.
  - `--images <temp folder>` saves pages as pictures. Use it for pages reported as having no text (scans), and for charts or forms; then look at each image with `read_image`.
- Read the whole document before summarising it. If it's very long, read the contents and the sections that matter, and say which parts you didn't read.

## Reporting
- Quote exact wording for anything important, legal or numerical, with the page number ("p. 4").
- Copy figures exactly. If a number is unreadable or ambiguous, say so instead of guessing.
- If pages couldn't be read, say which.
- For summaries, follow the summarise skill. For contracts, follow the contract-review skill.

## Making PDFs
- You can't produce a PDF directly. Make a Word document (word-documents skill) and tell the person to use File → Save As → PDF in Word.
