---
name: word-documents
description: "Create or edit Word documents (.docx): reports, proposals, letters, policies, procedures. Use whenever the person asks for a Word file or wants an existing .docx changed."
---
# Word documents

## Before you start
- Only make a Word file if the person asked for one. Otherwise write in the chat and offer the file in one line.
- For anything longer than about a page, agree a short outline in the chat first.

## Creating a document
1. Write the content as Markdown in a temporary file (system temp folder):
   `#` for the title, `##` for sections, `###` for sub-sections, `-` bullets (two spaces to indent), `1.` numbered steps, `|` tables, `**bold**`, `*italic*`, `---` alone on a line for a page break.
2. Build it: `kz-python <path of scripts/make_docx.py> notes.md "<working folder>/Name.docx"`
3. Read it back to check: `kz-python <path of scripts/read_docx.py> "<file>"`. Fix and rebuild if anything is wrong.
4. Tell the person the file name and location, and in one or two sentences what's in it.

The script handles styles, numbering, tables and special characters such as `&`. Don't write python-docx code yourself unless the person needs something it can't do, and never edit a document's XML.

## Writing it well
- Lead with the point: a short summary or purpose paragraph comes first.
- Use headings the reader can scan. Keep paragraphs to 2–4 sentences.
- Use tables for anything with rows and columns (costs, options, timelines). Use bullets for lists, not for whole arguments.
- Mark anything missing or unclear as `[to confirm]`; the script highlights it in yellow.
- Keep formatting plain. No colours, cover pages, logos or tables of contents unless asked.

## Changing an existing document
- Read it first with `read_docx.py`.
- Wording changes: write a JSON list of `{"find": "...", "replace": "..."}` pairs and run
  `kz-python <path of scripts/replace_in_docx.py> original.docx "Name (edited).docx" changes.json`.
  This keeps the document's formatting and never overwrites the original.
- Bigger restructuring: rebuild with `make_docx.py` from the edited Markdown, saved as a new file, and say that the original formatting wasn't kept.
