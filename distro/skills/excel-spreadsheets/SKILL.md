---
name: excel-spreadsheets
description: "Create, clean up or analyse Excel and CSV files. Use whenever the person wants a spreadsheet made, a sheet tidied, or numbers in a file worked out."
---
# Excel spreadsheets

## Before you start
- Only make a spreadsheet file if the person asked for one. For a quick answer, give it in the chat.
- Use only data the person gave you. Don't invent example rows unless asked.

## Making a new spreadsheet
1. Write a JSON spec in a temporary file. The format is in the header of `scripts/make_xlsx.py`: sheets, columns with a type (text, number, integer, currency, percent, date), rows, and an optional `total_row`.
   Use formulas (strings starting with `=`) for anything calculated, so the sheet keeps working when values change.
2. Build it: `kz-python <path of scripts/make_xlsx.py> spec.json "<working folder>/Name.xlsx"`
3. Tell the person the file name, location and what each sheet holds.

The result is deliberately plain: bold header, frozen top row, filters, sensible widths and formats. Currency defaults to the spec's `currency` (use "AED" unless told otherwise). Don't add colours, merged cells or extra sheets unless asked. Use one sheet unless there's a clear reason for more.

## Looking at an existing file
- Always start with `kz-python <path of scripts/inspect_data.py> "<file>"`. It reports sheets, columns, types, blanks and duplicate rows.
- If it says formulas have no saved result, calculate those values in Python rather than reporting them as blank.

## Cleaning up
- Write a short pandas script that reads the file, makes the fixes and saves a copy such as "Sales (cleaned).xlsx". Never overwrite the original.
- Typical fixes: stray spaces, inconsistent capitalisation or spellings, mixed date formats, exact duplicate rows, empty rows.
- Don't delete rows that only *might* be duplicates; list them and ask.
- Report what you changed, with counts ("removed 12 duplicate rows, fixed 40 dates").

## Analysis
- Answer the question in plain words first, with the key numbers, then show a small table.
- Say how you got the number (which column, which filter) in one line, so it can be checked.
- If the data can't answer the question, say what's missing.
- Offer a summary sheet or chart only if it would help; don't add one unasked.
