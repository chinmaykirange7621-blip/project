"""Generate formatted Word (.docx) companion deliverables from Markdown scripts."""

from __future__ import annotations

from pathlib import Path
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH


def markdown_to_docx(md_path: Path, docx_path: Path, doc_title: str) -> None:
    lines = md_path.read_text(encoding="utf-8").splitlines()
    doc = Document()

    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.85)
        section.right_margin = Inches(0.85)

    style_normal = doc.styles["Normal"]
    style_normal.font.name = "Segoe UI"
    style_normal.font.size = Pt(10.5)
    style_normal.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

    table_rows: list[list[str]] = []

    def flush_table() -> None:
        nonlocal table_rows
        if not table_rows:
            return
        # Remove separator row (| :--- | :--- |)
        cleaned = [r for r in table_rows if not all(set(cell.strip()) <= {":", "-", " "} for cell in r)]
        if cleaned:
            cols = max(len(r) for r in cleaned)
            tbl = doc.add_table(rows=len(cleaned), cols=cols)
            tbl.style = "Table Grid"
            for r_idx, row in enumerate(cleaned):
                for c_idx in range(cols):
                    val = row[c_idx].strip() if c_idx < len(row) else ""
                    cell = tbl.cell(r_idx, c_idx)
                    p = cell.paragraphs[0]
                    run = p.add_run(val.replace("**", "").replace("`", ""))
                    run.font.name = "Segoe UI"
                    run.font.size = Pt(9.5)
                    if r_idx == 0:
                        run.bold = True
            doc.add_paragraph()
        table_rows = []

    for raw in lines:
        line = raw.rstrip()
        if line.startswith("|") and line.endswith("|"):
            cells = [c.strip() for c in line.strip("|").split("|")]
            table_rows.append(cells)
            continue
        flush_table()

        if not line.strip():
            continue
        if line.strip() == "---":
            continue

        if line.startswith("# "):
            p = doc.add_heading(line[2:].strip(), level=0)
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        elif line.startswith("## "):
            doc.add_heading(line[3:].strip(), level=1)
        elif line.startswith("### "):
            doc.add_heading(line[4:].strip(), level=2)
        elif line.startswith("> "):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.25)
            r = p.add_run(line[2:].replace("**", "").replace("*", ""))
            r.italic = True
            r.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
        elif line.startswith("- ") or line.startswith("1. ") or (len(line) > 3 and line[0].isdigit() and line[1:3] == ". "):
            p = doc.add_paragraph(style="List Bullet" if line.startswith("- ") else "List Number")
            txt = line[2:] if line.startswith("- ") else line.split(". ", 1)[1]
            txt = txt.replace("**", "").replace("`", "")
            p.add_run(txt)
        else:
            p = doc.add_paragraph()
            p.add_run(line.replace("**", "").replace("`", "").replace("*", ""))

    flush_table()
    doc.save(str(docx_path))


if __name__ == "__main__":
    base = Path(__file__).resolve().parent
    markdown_to_docx(
        base / "SPEAKER_SCRIPT.md",
        base / "ScholarAI_CSE276_Speaker_Script.docx",
        "ScholarAI Speaker Script",
    )
    print("Generated ScholarAI_CSE276_Speaker_Script.docx")
