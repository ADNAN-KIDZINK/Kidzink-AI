"""Print a Word document as Markdown-style text: headings, lists, tables, in document order.

Usage: kz-python read_docx.py input.docx
"""

import sys

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph


def paragraph_text(paragraph):
    style = (paragraph.style.name or "") if paragraph.style is not None else ""
    text = paragraph.text.strip()
    if not text:
        return None
    if style == "Title":
        return f"# {text}"
    if style.startswith("Heading"):
        level = style.replace("Heading", "").strip()
        return f"{'#' * (int(level) + 1 if level.isdigit() else 2)} {text}"
    if style.startswith("List Number"):
        return f"1. {text}"
    if style.startswith("List"):
        return f"- {text}"
    return text


def table_text(table):
    rows = [[cell.text.strip().replace("\n", " ") for cell in row.cells] for row in table.rows]
    if not rows:
        return None
    lines = ["| " + " | ".join(rows[0]) + " |", "|" + "---|" * len(rows[0])]
    lines += ["| " + " | ".join(row) + " |" for row in rows[1:]]
    return "\n".join(lines)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    doc = Document(sys.argv[1])
    for block in doc.element.body.iterchildren():
        if block.tag.endswith("}p"):
            text = paragraph_text(Paragraph(block, doc))
        elif block.tag.endswith("}tbl"):
            text = table_text(Table(block, doc))
        else:
            text = None
        if text:
            print(text + "\n")


if __name__ == "__main__":
    main()
