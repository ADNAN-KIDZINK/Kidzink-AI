"""Replace text in a Word document and save the result as a new file, keeping the formatting.

Usage: kz-python replace_in_docx.py input.docx output.docx replacements.json

replacements.json is a list of {"find": "...", "replace": "..."} pairs. Body text, tables,
headers and footers are all searched. A paragraph where text is replaced takes the
formatting of the paragraph's first run.
"""

import json
import sys
from pathlib import Path

from docx import Document


def paragraphs_in(container):
    yield from container.paragraphs
    for table in container.tables:
        for row in table.rows:
            for cell in row.cells:
                yield from paragraphs_in(cell)


def all_paragraphs(doc):
    yield from paragraphs_in(doc)
    for section in doc.sections:
        for part in (section.header, section.footer):
            yield from paragraphs_in(part)


def replace_in_paragraph(paragraph, find, replace):
    if find not in paragraph.text:
        return 0
    count = paragraph.text.count(find)
    # Fast path: the text sits inside single runs, so each run keeps its own formatting.
    if any(find in run.text for run in paragraph.runs):
        for run in paragraph.runs:
            run.text = run.text.replace(find, replace)
        if find not in paragraph.text:
            return count
    new_text = paragraph.text.replace(find, replace)
    runs = paragraph.runs
    runs[0].text = new_text
    for run in runs[1:]:
        run.text = ""
    return count


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    source, target, spec = (Path(arg) for arg in sys.argv[1:])
    if source.resolve() == target.resolve():
        sys.exit("Save to a new file; the original is never overwritten.")
    replacements = json.loads(spec.read_text(encoding="utf-8"))
    doc = Document(source)
    for pair in replacements:
        total = sum(replace_in_paragraph(p, pair["find"], pair["replace"]) for p in all_paragraphs(doc))
        print(f"{total} x  {pair['find']!r}")
    doc.save(target)
    print(f"Saved {target.resolve()}")


if __name__ == "__main__":
    main()
