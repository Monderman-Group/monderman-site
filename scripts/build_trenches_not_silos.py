#!/usr/bin/env python3
"""Freeze the supplied PDF's text and publish matching house-style HTML/PDF.

No editorial changes. Reconstructed figure labels are checked against the source
with whitespace ignored because the source's small vector labels omit spaces.
The browser embeds the licensed NHG faces; the established publisher supplies the
cover, closing page and running footers. Requires Playwright with Chromium.
"""
from pathlib import Path
from io import BytesIO
from html import escape
import argparse
import hashlib
import json
import os
import re
import subprocess
from collections import Counter

import pdfplumber
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream, DictionaryObject, NameObject
from reportlab import rl_config
from reportlab.pdfgen import canvas
from apply_publication_house_style import Publication, register_fonts, make_cover, ROMAN, draw_footer

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'pdf-src/trenches-not-silos.json'
SLUG = 'trenches-not-silos.html'
FILENAME = 'Monderman_Insight_Trenches_Not_Silos_2026-09-28.pdf'
FIGURES = [
    dict(after=7, title='Trenches do not stay parallel',
         subtitle='Three divisions dug in the same direction, and the two ways the lines bend.',
         panels=[['As drawn', 'Parallel lines, one direction.', 'Year one.'],
                 ['Convergence', 'Two lines meet and fight over the ground.', 'Duplication, turf, fratricide.'],
                 ['Divergence', 'Each line drifts a few degrees, and it compounds.', 'Five divisions, five directions.']],
         note="The middle line in each panel is the company's own direction. Realignment moves the lines back toward it and holds until the digging resumes."),
    dict(after=11, title='What dividing buys, and what it charges',
         subtitle='The case for divisions is real. So is the bill, and only one side of it usually appears in the accounts.',
         panels=[['Bought', 'Pieces small enough for one person to run', 'Decisions made near the knowledge', 'A clear answer to who is responsible for what', 'Measured every quarter, in revenue and margin'],
                 ['Charged', 'The same work done twice, then fought over', "Divisions drifting from the company's line", 'Programs built only to cross the internal walls', 'Usually not measured at all, until it is too late']],
         note='The left column is why the divisional form was designed. The right column is the maintenance it needs, and the argument of this paper is that it belongs in the budget.'),
    dict(after=25, title='Three stances, not a silver bullet',
         subtitle='What a company can do about the bend without pretending it will not happen.',
         panels=[['1. Decide at the start', 'Which trenches must stay parallel, which may drift, and how the bend will be seen. Write it down at the moment of division, when it is easy.'],
                 ['2. Budget the maintenance', 'Realignment is a scheduled cost of the structure, like the roof, not heroics after the collision. Deferral is a loan, with interest.'],
                 ['3. Measure the bend', 'Work done twice. One customer, two answers. Decisions that cross a wall and stall. Goals that stop adding up. Not a culture survey.']],
         note='When the measures show convergence or drift: merge, separate, or spin out, while the cost is small.'),
]


def norm(value):
    return re.sub(r'\s+', ' ', value).strip()


def extract(source):
    with pdfplumber.open(source) as pdf:
        assert len(pdf.pages) == 9, 'Unexpected source edition'
        paragraphs = []
        for index in range(1, 8):
            lines = [x for x in pdf.pages[index].extract_text_lines() if abs(x['chars'][0]['size'] - 9.7) < .02 and x['top'] < 720]
            groups = []
            for i, line in enumerate(lines):
                if not i or line['top'] - lines[i-1]['top'] > 19:
                    groups.append([])
                groups[-1].append(line['text'])
            texts = [norm(' '.join(g)) for g in groups]
            if index in (4, 5, 6):
                paragraphs[-1] += ' ' + texts.pop(0)
            paragraphs.extend(texts)
        assert len(paragraphs) == 26
        references = []
        for line in pdf.pages[8].extract_text_lines():
            if abs(line['chars'][0]['size'] - 8.4) > .02:
                continue
            match = re.match(r'^(\d+)\. ', line['text'])
            if match:
                assert int(match[1]) == len(references) + 1
                references.append(line['text'][len(match[0]):])
            else:
                references[-1] += ' ' + line['text']
        assert len(references) == 8
        # Join the URL split by the source PDF's line break, not a wording edit.
        references = [x.replace('monderman.com/the- unmeasured-layer.html', 'monderman.com/the-unmeasured-layer.html') for x in references]
        figures = json.loads(json.dumps(FIGURES))
        for figure, page_index in zip(figures, (2, 3, 7)):
            lines = pdf.pages[page_index].extract_text_lines()
            figure['caption'] = norm(' '.join(x['text'] for x in lines if abs(x['chars'][0]['size'] - 8.4) < .02))
            labels = [figure['title'], figure['subtitle'], figure['note']] + [text for panel in figure['panels'] for text in panel]
            # Source extraction interleaves text across the figure's columns.
            source_chars = ''.join(c['text'] for c in pdf.pages[page_index].chars if c['size'] < 8 and c['top'] < 720)
            assert Counter(re.sub(r'\s', '', ''.join(labels))) == Counter(re.sub(r'\s', '', source_chars)), 'Figure labels differ: ' + figure['title']
        cover = pdf.pages[0].extract_text_lines()
        standfirst = norm(' '.join(x['text'] for x in cover if abs(x['chars'][0]['size'] - 10.5) < .02))
        quote = norm(' '.join(x['text'] for x in pdf.pages[5].extract_text_lines() if abs(x['chars'][0]['size'] - 12.5) < .02))
        bio = norm(' '.join(x['text'] for x in pdf.pages[8].extract_text_lines() if abs(x['chars'][0]['size'] - 9.7) < .02))
    data = dict(title='Trenches, Not Silos', subtitle='The bill for dividing a company.', author='Jason Adamson',
                date='September 2026', category='GOVERNANCE AND PERFORMANCE', standfirst=standfirst,
                paragraphs=paragraphs, references=references, figures=figures, pullquote=quote, biography=bio,
                copyright='© 2026 Jason Adamson. All rights reserved.', read_minutes=20,
                source_sha256=hashlib.sha256(source.read_bytes()).hexdigest())
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    return data


def diagram(panel):
    paths = [
        ['M8 22H132', 'M8 48H132', 'M8 74H132'],
        ['M8 18C65 18 76 48 132 48', 'M8 48H132', 'M8 78C65 78 76 48 132 48'],
        ['M8 38C65 38 80 12 132 12', 'M8 48H132', 'M8 58C65 58 80 84 132 84'],
    ][panel]
    shapes = ''.join(f'<path d="{d}" stroke="{color}"/>' for d, color in zip(paths, ('#0C6E78', '#9CC4C9', '#0E3A44')))
    return f'<svg class="trench-lines" viewBox="0 0 140 96" aria-hidden="true" focusable="false"><g fill="none" stroke-width="3.5" stroke-linecap="round">{shapes}</g></svg>'


def figure_html(figure, index):
    panels = []
    for j, panel in enumerate(figure['panels']):
        content = f'<h3>{escape(panel[0])}</h3>'
        for k, text in enumerate(panel[1:]):
            content += f'<p>{escape(text)}</p>'
            if index == 1 and k == 0:
                content += diagram(j)
        panels.append('<div class="trench-panel">' + content + '</div>')
    return f'''<figure class="trench-figure trench-figure-{index}" aria-labelledby="figure-{index}-title">
<div class="trench-figure-box"><h2 id="figure-{index}-title">{escape(figure['title'])}</h2>
<p class="trench-figure-deck">{escape(figure['subtitle'])}</p>
<div class="trench-panels trench-panels-{len(panels)}">{''.join(panels)}</div>
<p class="trench-figure-note">{escape(figure['note'])}</p></div>
<figcaption>{escape(figure['caption'])}</figcaption></figure>'''


def article_body(data):
    parts = []
    for i, text in enumerate(data['paragraphs'], 1):
        parts.append(f'<p data-source-paragraph="{i}">{escape(text)}</p>')
        for j, figure in enumerate(data['figures'], 1):
            if figure['after'] == i:
                parts.append(figure_html(figure, j))
        if i == 19:
            parts.append('<blockquote class="article-pullquote">' + escape(data['pullquote']) + '</blockquote>')
    return '\n'.join(parts)


def reference_html(data):
    return '\n'.join(f'<li id="reference-{i}" data-source-reference="{i}">' + escape(text).replace('monderman.com/the-unmeasured-layer.html', '<a href="https://www.monderman.com/the-unmeasured-layer.html">monderman.com/the-unmeasured-layer.html</a>') + '</li>' for i, text in enumerate(data['references'], 1))


def build_html(data, pages):
    template = (ROOT/'fast-to-cut-slow-to-build.html').read_text()
    old = json.loads((ROOT/'pdf-src/fast-to-cut-slow-to-build.json').read_text())
    head = template[:template.index('<main class="article-main"')]
    head = head.replace(old['title'], data['title']).replace(old['subtitle'], data['subtitle']).replace(old['standfirst'], data['standfirst'])
    head = head.replace('fast-to-cut-slow-to-build.html', SLUG).replace('Monderman_Insight_Fast_to_Cut_Slow_to_Build_2026-09-25.pdf', FILENAME)
    head = re.sub(r'<style>[\s\S]*?</style>', '<link rel="stylesheet" href="trenches-publication.css?v=20260928.1">', head)
    head = head.replace('10 pages · 20-minute read', f'{pages} pages · 20-minute read')
    head = head.replace('<p class="article-kicker">Governance and Performance</p>', '<p class="article-kicker">Governance and Performance · Part 4</p>')
    head = re.sub(r'<header\b[\s\S]*?</header>', (ROOT/'site-shell/header.html').read_text().strip(), head, count=1)
    body = f'''<main class="article-main" id="main-content">
<article class="article-body">{article_body(data)}</article>
<section class="article-references" aria-labelledby="references-heading">
<h2 class="references-heading" id="references-heading">References</h2>
<ol class="reference-list">{reference_html(data)}</ol></section>
<section class="article-about" aria-labelledby="about-author-heading">
<h2 class="about-heading" id="about-author-heading">About the author</h2>
<p>{escape(data['biography'])}</p><p>{escape(data['copyright'])}</p></section>
<section class="article-further" aria-label="Article links"><p class="article-kicker">Keep reading</p>
<p><a href="{FILENAME}" target="_blank" rel="noopener noreferrer">Download the PDF →</a></p>
<p><a href="research.html#governance-performance-title">Read the Governance and Performance series →</a></p>
<p><a href="research.html">Browse all research →</a></p></section></main>
'''
    tail = template[template.index('<footer class="footer mond-footer"'):]
    tail = re.sub(r'<footer\b[\s\S]*?</footer>', (ROOT/'site-shell/footer.html').read_text().strip(), tail, count=1)
    (ROOT/SLUG).write_text(head + body + tail)


def print_html(data):
    book = 'Governance, Bureaucracy and Organization: Stewardship, Drift, and Administrative Capacity'
    bio = escape(data['biography']).replace(book, '<i>' + book + '</i>').replace('Jason Adamson', '<b>Jason Adamson</b>', 1)
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{escape(data['title'])}</title>
<link rel="stylesheet" href="{(ROOT/'pdf-src/monderman-pdf-house-style.css').as_uri()}">
<link rel="stylesheet" href="{(ROOT/'trenches-publication.css').as_uri()}">
<style>
@page {{ size:Letter; margin:60pt 60pt 67pt; @bottom-left{{content:none}} @bottom-right{{content:none}} }}
body {{font-family:"Neue Haas Grotesk TX Pro"; font-size:10pt; line-height:15.2pt;}}
p {{orphans:3;widows:3;margin:0 0 9pt;}}
.trench-figure {{margin:16pt 0 18pt;break-inside:avoid;}}
.trench-figure-box {{padding:14pt;}}
.trench-figure h2 {{font-size:12pt;line-height:15pt;margin:0 0 7pt;}}
.trench-figure .trench-figure-deck {{font-size:9pt;line-height:12pt;margin:0 0 12pt;}}
.trench-panels {{gap:12pt;}}
.trench-panel {{padding:10pt;}}
.trench-panel h3 {{font-size:10pt;line-height:12.5pt;margin:0 0 8pt;}}
.trench-panel p {{font-size:8.8pt;line-height:12pt;margin:0 0 9pt;orphans:2;widows:2;}}
.trench-lines {{height:68pt;}}
.trench-figure .trench-figure-note {{font-size:8.5pt;line-height:11.5pt;margin-top:12pt;}}
.trench-figure figcaption {{font-size:8.3pt;line-height:11.5pt;margin-top:8pt;font-style:italic;}}
.article-pullquote {{font-size:13.2pt;line-height:16.5pt;margin:18pt 0;padding:23pt 26pt;color:white;background:#0C1113;break-inside:avoid;}}
.print-references {{break-before:page;}}
.print-references h2,.print-about h2 {{font-size:10.5pt;line-height:12.5pt;margin:0 0 11pt;}}
.print-references ol {{padding-left:14pt;margin:0;}}
.print-references li {{font-size:8.6pt;line-height:11.2pt;margin:0 0 7pt;break-inside:avoid;}}
.print-about {{break-before:page;padding-top:12pt;}}
.print-about h2 {{font-size:9.5pt;line-height:11.5pt;letter-spacing:1.2pt;margin:0 0 11pt;}}
.print-about p {{font-size:8.8pt;line-height:13pt;color:#4A555A;}}
.print-company {{margin-top:78pt;}}
.print-lockup {{margin-top:84pt;text-align:center;}}
.print-lockup .wordmark {{font-size:16pt;line-height:20pt;font-weight:700;color:#0C6E78;}}
.print-lockup img {{width:14pt;height:17pt;vertical-align:-2pt;margin-right:6pt;}}
.print-lockup p {{margin:8pt 0;font-size:10pt;text-align:center;}}
.print-lockup .contact,.print-lockup .copyright {{font-size:8pt;color:#6C7A80;}}
a {{color:#0E3A44;text-decoration:none;}}
</style></head><body>{article_body(data)}
<section class="print-references"><h2>REFERENCES</h2><ol>{reference_html(data)}</ol></section>
<section class="print-about"><h2>ABOUT THE AUTHOR</h2><p>{bio}</p>
<div class="print-company"><h2>ABOUT MONDERMAN</h2><p>Monderman is an institutional performance research company building Deterministic AI Infrastructure for organizational diagnostics. Its diagnostic platform produces structured operational reads for enterprises across sectors, including defense, healthcare, government, financial services, technology, manufacturing, and higher education.</p></div>
<div class="print-lockup"><p class="wordmark"><img src="{(ROOT/'assets/brand/monderman-map-ink.svg').as_uri()}" alt="">Monderman.</p>
<p>Organizations deliver at the speed of their administrative reality.</p>
<p class="contact">connect@monderman.com · www.monderman.com</p><p class="copyright">{escape(data['copyright'])}</p></div></section>
</body></html>'''


def build_pdf(data):
    scratch = ROOT/'tmp/pdfs/trenches'; scratch.mkdir(parents=True, exist_ok=True)
    source = scratch/'body.html'; source.write_text(print_html(data))
    subprocess.run([os.environ.get('NODE', 'node'), str(ROOT/'scripts/render_publication_body.cjs'), str(source), str(scratch/'body.pdf')], check=True)
    register_fonts(); rl_config.canvas_basefontname = ROMAN
    pub = Publication(FILENAME, data['category'], data['title'], data['subtitle'], data['standfirst'], data['date'], 0, ())
    writer = PdfWriter(); writer.append(PdfReader(BytesIO(make_cover(pub))))
    for page in PdfReader(scratch/'body.pdf').pages:
        stream = BytesIO(); c = canvas.Canvas(stream, pagesize=(612,792))
        draw_footer(c, data['date'], len(writer.pages)+1); c.save()
        page.merge_page(PdfReader(BytesIO(stream.getvalue())).pages[0]); writer.add_page(page)
    for page in writer.pages:
        resources = DictionaryObject(page['/Resources'].get_object())
        fonts = DictionaryObject(resources['/Font'].get_object())
        defaults = {name for name,font in fonts.items() if font.get_object().get('/BaseFont') == '/Helvetica'}
        if defaults:
            roman = next(name for name,font in fonts.items() if any(s in str(font.get_object().get('/BaseFont')) for s in ('55Rg','NHG55')))
            content = ContentStream(page.get_contents(), writer)
            for args, op in content.operations:
                if op == b'Tf' and args[0] in defaults: args[0] = roman
            for name in defaults: del fonts[name]
            resources[NameObject('/Font')] = fonts; page[NameObject('/Resources')] = resources; page.replace_contents(content)
    writer.add_metadata({'/Title':data['title'], '/Author':data['author'], '/Subject':data['subtitle'], '/Keywords':'Governance and Performance, Part 4, organizational structure'})
    with (ROOT/FILENAME).open('wb') as handle: writer.write(handle)
    return len(writer.pages)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--source', type=Path); parser.add_argument('--extract-only', action='store_true')
    args = parser.parse_args()
    data = extract(args.source) if args.source else json.loads(DATA.read_text())
    if not args.extract_only:
        pages = build_pdf(data); build_html(data, pages)
        print(json.dumps(dict(file=FILENAME, pages=pages, paragraphs=len(data['paragraphs']), references=len(data['references']), figures=len(data['figures']))))
