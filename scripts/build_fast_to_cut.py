#!/usr/bin/env python3
"""Source-preserving September 2026 publication, using the canonical house system.

Extract the supplied text of record once with --source PATH; subsequent builds use
the checked-in JSON. Only two approved body names and two reference locations change.
"""
from pathlib import Path
from io import BytesIO
import argparse
import hashlib
import json
import re
from xml.sax.saxutils import escape

import pdfplumber
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream, DictionaryObject, NameObject
from reportlab import rl_config
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether, Table, TableStyle
from apply_publication_house_style import Publication, register_fonts, make_cover, make_back, ROMAN, BOLD, MEDIUM, BODY, draw_footer

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / 'pdf-src/fast-to-cut-slow-to-build.json'
FILENAME = 'Monderman_Insight_Fast_to_Cut_Slow_to_Build_2026-09-25.pdf'
SECTIONS = [
    ('Budgets That Barely Move', 'Every year, large companies go through the same ritual.'),
    ('How the Layers Pile Up', 'The first cause is how large companies are built.'),
    ('Leaders Who Leave Sooner', 'The second cause is time.'),
    ('Who Gains When Nothing Moves', 'The third cause is the people inside the company'),
    ('Why a Company Can Fix This', 'A company does have two advantages'),
    ('Five Practices', 'So what can a company do?'),
    ('The Business Case', 'What if a company does none of this?'),
]
ABOUT = 'This paper draws on published research and public data, listed in the references. Monderman builds diagnostics that measure some of the conditions this paper describes.'
QUOTE = 'Adding a rule is usually someone’s job. Removing one is usually no one’s.'
STATS = [
    ('About 1 in 3', 'business units whose funding barely changed from year to year (1,600+ U.S. companies, 1990 to 2005)'),
    ('30%', 'higher yearly shareholder returns for the companies that moved the most money between their businesses, compared with those that moved the least'),
    ('7.1 years', 'average tenure of CEOs who left in 2025, down from 8.3 in 2021'),
]
REFERENCE_LINKS = {12: 'https://www.monderman.com/nothing-stays-tuned.html', 19: 'https://www.monderman.com/the-unmeasured-layer.html'}


def clean(text):
    return re.sub(r'\s+', ' ', text).strip()


def extract(source):
    with pdfplumber.open(source) as pdf:
        assert len(pdf.pages) == 9, 'Unexpected source edition'
        paragraphs = []
        for page_index in range(1, 6):
            lines = [x for x in pdf.pages[page_index].extract_text_lines() if x['top'] < 720]
            groups = []
            for i, line in enumerate(lines):
                if not i or line['top'] - lines[i-1]['top'] > 20:
                    groups.append([])
                groups[-1].append(line['text'])
            texts = [clean(' '.join(group)) for group in groups]
            # These paragraphs continue across the original source page breaks.
            if page_index in (2, 4):
                paragraphs[-1] += ' ' + texts.pop(0)
            paragraphs.extend(texts)
        paragraphs = [p for p in paragraphs if p != '“' + QUOTE + '”']
        original_paragraphs = list(paragraphs)
        text = ' '.join(paragraphs)
        assert text.count('McKinsey') == 2
        paragraphs = [p.replace('McKinsey studied', 'Researchers studied').replace('the McKinsey researchers', 'the researchers') for p in paragraphs]
        references = []
        for page in pdf.pages[6:]:
            for line in page.extract_text_lines():
                t = line['text']
                if line['top'] >= 720 or t == 'References':
                    continue
                if t == 'About the author':
                    break
                match = re.match(r'^(\d+)\. ', t)
                if match:
                    assert int(match[1]) == len(references) + 1
                    references.append(t[len(match[0]):])
                elif references:
                    references[-1] += ' ' + t
        assert len(references) == 19
        original_references = list(references)
        for n in REFERENCE_LINKS:
            assert 'Available on the author’s LinkedIn profile' in references[n-1]
            references[n-1] = references[n-1].replace('Available on the author’s LinkedIn profile', 'Available in the Monderman research library')
        cover_lines = pdf.pages[0].extract_text().splitlines()
        start = next(i for i, line in enumerate(cover_lines) if line.startswith('Large companies can cut'))
        end = next(i for i, line in enumerate(cover_lines) if line.startswith('BY '))
        standfirst = clean(' '.join(cover_lines[start:end]))
    data = dict(title='Fast to Cut, Slow to Build', subtitle='Why big companies lose the ability to change, and how they can get it back',
                author='Jason Adamson', date='September 2026', category='GOVERNANCE AND PERFORMANCE', standfirst=standfirst,
                about=ABOUT, paragraphs=paragraphs, references=references, pullquote=QUOTE, stats=STATS,
                sections=[dict(title=t, starts_with=s) for t,s in SECTIONS], reference_links=REFERENCE_LINKS,
                source_sha256=hashlib.sha256(Path(source).read_bytes()).hexdigest(),
                source_paragraphs=original_paragraphs, source_references=original_references,
                authorized_body_edits={'McKinsey studied':'Researchers studied','the McKinsey researchers':'the researchers'})
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    return data


def build_body(data):
    body = ParagraphStyle('body', fontName=ROMAN, fontSize=10, leading=15.2, spaceAfter=9,
                          textColor=BODY, allowWidows=0, allowOrphans=0, splitLongWords=False)
    label = ParagraphStyle('label', fontName=BOLD, fontSize=10.5, leading=12.5, spaceAfter=11, textColor=HexColor('#14181B'), keepWithNext=True)
    number = ParagraphStyle('number', fontName=MEDIUM, fontSize=11, leading=11, spaceBefore=22, spaceAfter=5, keepWithNext=True)
    heading = ParagraphStyle('heading', fontName=BOLD, fontSize=20.5, leading=22, spaceAfter=16, textColor=HexColor('#101417'), keepWithNext=True)
    ref = ParagraphStyle('reference', parent=body, fontSize=8.6, leading=11.2, spaceAfter=7, leftIndent=14, firstLineIndent=-14)
    quote = ParagraphStyle('quote', fontName=BOLD, fontSize=13.2, leading=16.5, alignment=1, textColor=HexColor('#FFFFFF'))
    stat_head = ParagraphStyle('stat_head', fontName=BOLD, fontSize=21, leading=22, spaceAfter=7, textColor=HexColor('#0E3A44'))
    stat_copy = ParagraphStyle('stat_copy', fontName=ROMAN, fontSize=8.5, leading=11.5, textColor=HexColor('#556268'))
    story = [Paragraph('ABOUT THIS PAPER', label), Paragraph(escape(data['about']), body), Spacer(1, 12),
             Paragraph('EXECUTIVE SUMMARY', label), Paragraph(escape(data['standfirst']), body), Spacer(1, 14)]
    cells = [[Paragraph(escape(h), stat_head), Paragraph(escape(t), stat_copy)] for h,t in data['stats']]
    table = Table([cells], colWidths=[164]*3)
    table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(0,0),0),
                             ('LEFTPADDING',(1,0),(-1,0),16),('RIGHTPADDING',(0,0),(-1,0),16),
                             ('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0),
                             ('LINEBEFORE',(1,0),(-1,0),.6,HexColor('#DDE3E4'))]))
    story.extend([table, Spacer(1, 20)])
    for paragraph in data['paragraphs']:
        for i, section in enumerate(data['sections'], 1):
            if paragraph.startswith(section['starts_with']):
                story.extend([Paragraph(str(i) + '.', number), Paragraph(escape(section['title']), heading)])
        story.append(Paragraph(escape(paragraph), body))
        if paragraph.startswith('This does not mean dropping rules'):
            panel = Table([[Paragraph('“' + escape(data['pullquote']) + '”', quote)]], colWidths=[492])
            panel.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),HexColor('#0C1113')),
                                     ('LEFTPADDING',(0,0),(-1,-1),30),('RIGHTPADDING',(0,0),(-1,-1),30),
                                     ('TOPPADDING',(0,0),(-1,-1),24),('BOTTOMPADDING',(0,0),(-1,-1),24)]))
            story.append(KeepTogether([Spacer(1,20),panel,Spacer(1,23)]))
    story.extend([PageBreak(),Paragraph('REFERENCES',label)])
    for i,text in enumerate(data['references'], 1):
        markup = escape(text)
        if i in REFERENCE_LINKS:
            markup = markup.replace('Available in the Monderman research library', '<a href="' + REFERENCE_LINKS[i] + '" color="#0E3A44">Available in the Monderman research library</a>')
        story.append(Paragraph(str(i)+'. '+markup, ref))
    stream = BytesIO()
    def footer(c,doc):
        draw_footer(c, data['date'], doc.page + 1)
    SimpleDocTemplate(stream, pagesize=(612,792), leftMargin=60, rightMargin=60, topMargin=60, bottomMargin=67).build(story,onFirstPage=footer,onLaterPages=footer)
    return stream.getvalue()


def build(data):
    register_fonts()
    rl_config.canvas_basefontname = ROMAN
    pub = Publication(FILENAME, data['category'], data['title'], data['subtitle'], data['standfirst'], data['date'], 0, ())
    writer = PdfWriter()
    writer.append(PdfReader(BytesIO(make_cover(pub))))
    writer.append(PdfReader(BytesIO(build_body(data))))
    writer.append(PdfReader(BytesIO(make_back(pub, len(writer.pages)+1))))
    # Tables and inherited cover overlays declare an unused Helvetica default.
    # Point those defaults at the embedded NHG Roman face before removing them.
    # Clone resource dictionaries per page; ReportLab shares them across pages.
    for page in writer.pages:
        resources = DictionaryObject(page['/Resources'].get_object())
        fonts = DictionaryObject(resources['/Font'].get_object())
        defaults = {name for name,font in fonts.items() if font.get_object().get('/BaseFont') == '/Helvetica'}
        if not defaults:
            continue
        roman = next(name for name,font in fonts.items() if any(s in str(font.get_object().get('/BaseFont')) for s in ('55Rg','NHG55')))
        content = ContentStream(page.get_contents(), writer)
        for args, op in content.operations:
            if op == b'Tf' and args[0] in defaults:
                args[0] = roman
        for name in defaults:
            del fonts[name]
        resources[NameObject('/Font')] = fonts
        page[NameObject('/Resources')] = resources
        page.replace_contents(content)
    writer.add_metadata({'/Title':data['title'], '/Author':data['author'], '/Subject':data['subtitle'], '/Keywords':'Governance and Performance, organizational change, resource allocation'})
    with (ROOT/FILENAME).open('wb') as handle:
        writer.write(handle)
    print(json.dumps({'file':FILENAME,'pages':len(writer.pages),'paragraphs':len(data['paragraphs']),'references':len(data['references'])}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path)
    parser.add_argument('--extract-only', action='store_true')
    args = parser.parse_args()
    data = extract(args.source) if args.source else json.loads(DATA_PATH.read_text())
    if not args.extract_only:
        build(data)
