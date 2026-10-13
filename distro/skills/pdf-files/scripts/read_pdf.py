"""Read a PDF page by page, with optional tables and page images for scanned documents.

Usage: kz-python read_pdf.py file.pdf [--pages 1-3,7] [--tables] [--images OUTPUT_FOLDER]

  --pages    only these pages (1-based)
  --tables   also print tables found on each page as Markdown
  --images   save each selected page as a PNG (for scanned pages, charts or layouts);
             look at them with the read_image tool
Pages with no extractable text are reported, since they're usually scans.
"""

import argparse
from pathlib import Path

import pdfplumber


def parse_pages(spec, count):
    if not spec:
        return list(range(1, count + 1))
    pages = []
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            start, end = (int(value) for value in part.split("-", 1))
            pages.extend(range(start, end + 1))
        elif part:
            pages.append(int(part))
    return [page for page in pages if 1 <= page <= count]


def table_markdown(table):
    rows = [[(cell or "").replace("\n", " ").strip() for cell in row] for row in table if row]
    if not rows:
        return ""
    lines = ["| " + " | ".join(rows[0]) + " |", "|" + "---|" * len(rows[0])]
    lines += ["| " + " | ".join(row) + " |" for row in rows[1:]]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("file")
    parser.add_argument("--pages")
    parser.add_argument("--tables", action="store_true")
    parser.add_argument("--images")
    args = parser.parse_args()

    with pdfplumber.open(args.file) as pdf:
        pages = parse_pages(args.pages, len(pdf.pages))
        print(f"{Path(args.file).name}: {len(pdf.pages)} pages; showing {len(pages)}\n")
        no_text = []
        image_folder = Path(args.images) if args.images else None
        if image_folder:
            image_folder.mkdir(parents=True, exist_ok=True)

        for number in pages:
            page = pdf.pages[number - 1]
            text = (page.extract_text() or "").strip()
            print(f"--- Page {number} ---")
            print(text if text else "[no text on this page: probably scanned; use --images]")
            if not text:
                no_text.append(number)
            if args.tables:
                for index, table in enumerate(page.extract_tables(), start=1):
                    markdown = table_markdown(table)
                    if markdown:
                        print(f"\n[Table {index} on page {number}]\n{markdown}")
            if image_folder:
                target = image_folder / f"page-{number:03d}.png"
                page.to_image(resolution=110).save(target)
                print(f"[Image saved: {target.resolve()}]")
            print()

        if no_text:
            print(f"Pages without text: {', '.join(map(str, no_text))}. Run again with --images to read them.")


if __name__ == "__main__":
    main()
