# Monderman PDF house style

`Monderman_Insight_Built_to_Please_2026-08-27.pdf` is the canonical rendered reference for every new or revised PDF published on monderman.com. Preserve that file byte-for-byte when publishing it.

Use `pdf-src/monderman-pdf-house-style.css` for paged-media source documents. It defines the canonical US Letter page, 60-point side margins, 492-point body column, five Neue Haas Grotesk TX Pro faces, three-stop cover gradient, interior hierarchy, figures, captions, references, back page, and running footers.

The source type assets are the numbered webfonts at the repository root. Figure captions specifically use 56 Italic and 76 Bold Italic; do not substitute synthetic italics.

Before publishing a house-style PDF, render every page and inspect it. For the canonical reference, run:

```text
python scripts/validate_pdf_house_style.py Monderman_Insight_Built_to_Please_2026-08-27.pdf
```

The release gate also pins the canonical reference checksum and verifies the homepage and research-library placements.
