---
name: scripts-and-automation
description: "Write small scripts, formulas, macros or automations: Excel formulas, Python scripts, batch file renaming, data conversions, simple tools. Use for technical requests from people comfortable with code."
---
# Scripts and automation

## Approach
- Prefer the simplest thing that works: an Excel formula over a macro, a short Python script over a big tool.
- Python runs with `kz-python script.py` (includes pandas, openpyxl, python-docx, python-pptx, pypdf, pdfplumber). Don't use pip or the system Python.
- Before running anything that changes files, explain in one line what it will do, and work on copies or a test folder first.
- Never delete files, change system settings, install software or touch files outside the task.

## Explaining
- Give the person what they need to reuse it: what it does, how to run it, and what to change for next time.
- For Excel formulas: give the formula, then a one-line explanation of each part. Note which Excel versions support it if it's a newer function.

## When not to automate
- If the task is a one-off and quicker by hand, say so.
- For anything touching company systems (servers, email, accounts), suggest checking with IT first.
