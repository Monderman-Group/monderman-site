#!/usr/bin/env python3
"""Publish the supplied PDF faithfully as Governance and Performance Part 5.

The input is immutable. Only pagination, house typography, series labeling and
publisher branding change. The qualitative illustration is never a data chart.
"""
from pathlib import Path
from io import BytesIO
from html import escape
from collections import Counter
import argparse
import hashlib
import json
import os
import re
import subprocess

import pdfplumber
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream, DictionaryObject, NameObject
from reportlab import rl_config
from reportlab.pdfgen import canvas
import build_trenches_not_silos as house
from apply_publication_house_style import Publication, register_fonts, make_cover, ROMAN, draw_footer

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'pdf-src/the-durable-organization.json'
FILENAME = 'Monderman_Insight_The_Durable_Organization_2026-10-07.pdf'
SOURCE_SHA256 = 'dd0f951b5b96a722f9bd42a379cac76a2c57cc7267875b06536296964b48379f'
SECTION_TITLES = [
    ('PART ONE', 'Strong is not durable'),
    ('PART TWO', 'Late change is the dangerous change'),
    ('PART THREE', 'What steady change buys'),
    ('PART FOUR', 'Why change gets put off'),
    ('PART FIVE', 'What people actually resist'),
    ('PART SIX', 'What a durable organization does'),
]


def norm(value):
    return re.sub(r'\s+', ' ', value).strip()


def line_markup(line):
    """Recover original emphasis without guessing word boundaries or citations."""
    chars = iter(line['chars'])
    runs = []
    for letter in line['text']:
        if letter.isspace():
            style = runs[-1][0] if runs else (False, False)
        else:
            source = next(chars)
            assert source['text'] == letter, 'Source character association differs'
            style = ('Italic' in source['fontname'], 'Bold' in source['fontname'])
        if runs and runs[-1][0] == style:
            runs[-1][1] += letter
        else:
            runs.append([style, letter])
    assert next(chars, None) is None
    result = []
    for (italic, bold), text in runs:
        item = escape(text)
        if italic:
            item = '<em>' + item + '</em>'
        if bold:
            item = '<strong>' + item + '</strong>'
        result.append(item)
    return ''.join(result)


def extract(source):
    assert hashlib.sha256(source.read_bytes()).hexdigest() == SOURCE_SHA256, 'Unexpected source edition'
    blocks = []
    with pdfplumber.open(source) as pdf:
        assert len(pdf.pages) == 14 and all(p.width == 612 and p.height == 792 for p in pdf.pages)
        cover = pdf.pages[0].extract_text_lines()
        standfirst = norm(' '.join(x['text'] for x in cover if abs(x['chars'][0]['size'] - 10.5) < .02))
        pending = []
        pending_markup = []
        previous_top = None
        def flush():
            nonlocal pending, pending_markup
            if pending:
                blocks.append({'type': 'paragraph', 'text': norm(' '.join(pending)), 'html': ' '.join(pending_markup)})
                pending = []
                pending_markup = []
        for page_index in range(1, 12):
            lines = [x for x in pdf.pages[page_index].extract_text_lines() if x['top'] < 720]
            previous_top = None
            for line in lines:
                text = line['text']
                size = line['chars'][0]['size']
                if abs(size - 9.7) < .03:
                    if previous_top is not None and line['top'] - previous_top > 19:
                        flush()
                    pending.append(text)
                    pending_markup.append(line_markup(line))
                    previous_top = line['top']
                else:
                    flush()
                    previous_top = None
                    if text == 'THE BOTTOM LINE':
                        blocks.append({'type': 'summary_heading', 'text': text})
                    elif text in dict(SECTION_TITLES):
                        blocks.append({'type': 'section_label', 'text': text})
                    elif text in [x[1] for x in SECTION_TITLES]:
                        blocks.append({'type': 'section_heading', 'text': text})
                    elif abs(size - 12.5) < .1:
                        if blocks and blocks[-1]['type'] == 'pullquote':
                            blocks[-1]['text'] += ' ' + text
                            blocks[-1]['html'] += ' ' + line_markup(line)
                        else:
                            blocks.append({'type': 'pullquote', 'text': text, 'html': line_markup(line)})
                    else:
                        raise AssertionError(f'Unrecognized body text on page {page_index + 1}: {text!r} ({size})')
            # Source page breaks can occur in the middle of a paragraph.
            if page_index not in (3, 4, 5, 8, 10):
                flush()
        flush()
        references = []
        references_markup = []
        biography = []
        copyright_text = None
        in_bio = False
        for page_index in (12, 13):
            for line in pdf.pages[page_index].extract_text_lines():
                text = line['text']
                if line['top'] >= 720 or text == 'References':
                    continue
                if text == 'About the author':
                    in_bio = True
                    continue
                if text.startswith('© '):
                    copyright_text = text
                elif in_bio:
                    biography.append(text)
                else:
                    match = re.match(r'^(\d+)\. ', text)
                    if match and 1 <= int(match[1]) <= 19:
                        assert int(match[1]) == len(references) + 1
                        references.append(text[len(match[0]):])
                        markup = line_markup(line)
                        assert markup.startswith(match[0])
                        references_markup.append(markup[len(match[0]):])
                    else:
                        references[-1] += ' ' + text
                        references_markup[-1] += ' ' + line_markup(line)
        assert len(references) == 19 and copyright_text == '© 2026 Jason Adamson. All rights reserved.'
        figure = {
            'title': 'Strong is not durable',
            'subtitle': 'Strength is the load a system can carry. Durability is how much it can absorb before it breaks.',
            'labels': {'vertical': 'load carried', 'horizontal': 'how far it is pushed', 'area': 'what it can absorb',
                       'strong': 'Strong', 'strong_caption': 'carries more, then breaks without warning',
                       'durable': 'Durable', 'durable_caption': 'bends, gives warning, and holds'},
            'caption': 'An illustration of this paper’s argument. It is not drawn from data.',
            'kind': 'illustrative', 'source_page': 1,
            'svg': illustration_svg(),
        }
        figure_lines = [x['text'] for x in cover if 480 < x['top'] < 700]
        exact_labels = [figure['title'], figure['subtitle'], *figure['labels'].values(), figure['caption']]
        assert Counter(re.sub(r'\s', '', ''.join(figure_lines))) == Counter(re.sub(r'\s', '', ''.join(exact_labels))), 'Illustration text differs'
    paragraphs = []
    section = 'bottom_line'
    sections = []
    for block in blocks:
        if block['type'] == 'section_label':
            section = block['text'].lower().replace(' ', '_')
            sections.append({'label': block['text'], 'title': dict(SECTION_TITLES)[block['text']], 'paragraphs': []})
        elif block['type'] == 'paragraph':
            number = len(paragraphs) + 1
            block.update(number=number, section=section)
            paragraphs.append({'number': number, 'section': section, 'text': block['text'], 'html': block['html']})
            if sections:
                sections[-1]['paragraphs'].append(number)
    assert len(sections) == 6
    reader = PdfReader(source)
    source_urls = {str(a.get_object()['/A']['/URI']) for p in reader.pages for a in p.get('/Annots', [])
                   if a.get_object().get('/A', {}).get('/URI')}
    assert source_urls == {'https://www.linkedin.com/in/jason-adamson-1a036a429'}
    assert references_markup[0].count('LinkedIn profile') == 1
    references_markup[0] = references_markup[0].replace('LinkedIn profile', '<a href="https://www.linkedin.com/in/jason-adamson-1a036a429">LinkedIn profile</a>')
    data = dict(title='The Durable Organization', subtitle='Why strong is not the same as lasting',
                standfirst=standfirst, author='Jason Adamson', date='October 2026', publication_date='2026-10-07',
                category='GOVERNANCE AND PERFORMANCE', part=5, paragraphs=paragraphs, body_blocks=blocks,
                sections=sections, references=[norm(x) for x in references], references_html=references_markup, figure=figure,
                source_links=[{'reference': 1, 'label': 'LinkedIn profile', 'url': next(iter(source_urls))}],
                biography=norm(' '.join(biography)), copyright=copyright_text, read_minutes=35,
                source_sha256=SOURCE_SHA256, source_pages=14, source_filename=source.name,
                editorial_changes=[], extraction_policy='Whitespace and line wraps normalized; all source wording, headings, references and illustration labels preserved.')
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    return data


def illustration_svg():
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 282" role="img" aria-labelledby="durable-chart-title durable-chart-desc">
<title id="durable-chart-title">Strong is not durable</title>
<desc id="durable-chart-desc">A qualitative illustration, not drawn from data. Strong carries more, then breaks without warning. Durable bends, gives warning, and holds. The shaded area represents what it can absorb.</desc>
<g font-family="Neue Haas Grotesk TX Pro,Arial,sans-serif" fill="#23282C">
<path d="M45 232H682M45 232V30" fill="none" stroke="#6C7A80" stroke-width="1.4"/>
<path d="M45 232C110 118 170 88 300 84S530 78 655 75V232Z" fill="#C6DCDF"/>
<path d="M45 232L115 40M110 35L120 45M110 45L120 35" fill="none" stroke="#14181B" stroke-width="3.2"/>
<path d="M115 40V232" fill="none" stroke="#6C7A80" stroke-width="1" stroke-dasharray="3 3"/>
<path d="M45 232C110 118 170 88 300 84S530 78 655 75" fill="none" stroke="#0C6E78" stroke-width="3.2"/>
<circle cx="655" cy="75" r="3.5" fill="white" stroke="#0C6E78" stroke-width="2"/>
<text x="45" y="18" font-size="12">load carried</text>
<text x="682" y="264" text-anchor="end" font-size="12">how far it is pushed</text>
<text x="132" y="38" font-size="15" font-weight="700">Strong</text>
<text x="132" y="54" font-size="10">carries more, then breaks without warning</text>
<text x="655" y="43" text-anchor="end" font-size="15" font-weight="700" fill="#0E3A44">Durable</text>
<text x="655" y="59" text-anchor="end" font-size="10">bends, gives warning, and holds</text>
<text x="390" y="183" text-anchor="middle" font-size="13">what it can absorb</text>
</g></svg>'''


def figure_html(data):
    f = data['figure']
    return f'''<figure class="durable-figure"><h2>{escape(f['title'])}</h2><p class="figure-deck">{escape(f['subtitle'])}</p>
{illustration_svg()}<figcaption>{escape(f['caption'])}</figcaption></figure>'''


def article_body(data):
    result = [figure_html(data)]
    for block in data['body_blocks']:
        text = block.get('html', escape(block['text']))
        if block['type'] == 'paragraph':
            result.append(f'<p data-source-paragraph="{block["number"]}">{text}</p>')
        elif block['type'] == 'summary_heading':
            result.append(f'<h2 class="frontmatter-heading">{text}</h2>')
        elif block['type'] == 'section_label':
            result.append(f'<div class="section-number">{text}</div>')
        elif block['type'] == 'section_heading':
            result.append(f'<h2 class="section-title">{text}</h2>')
        elif block['type'] == 'pullquote':
            result.append(f'<blockquote class="article-pullquote">{text}</blockquote>')
    return '\n'.join(result)


def reference_html(data):
    return '\n'.join(f'<li id="reference-{i}" data-source-reference="{i}">{text}</li>' for i, text in enumerate(data['references_html'], 1))


def build_pdf(data):
    scratch = ROOT / 'tmp/pdfs/durable'; scratch.mkdir(parents=True, exist_ok=True)
    # Reuse the approved typography, cover, footers and closing-page layout.
    house.article_body = article_body
    house.reference_html = reference_html
    markup = house.print_html(data).replace('Organizations deliver at the speed of their administrative reality.', 'Clearer Insight. Stronger Performance.')
    markup = markup.replace('</head>', '''<style>
    .durable-figure{break-inside:avoid;margin:0 0 24pt;padding:15pt 18pt;background:#F4F7F7;}
    .durable-figure h2{font-size:12pt;line-height:15pt;margin:0 0 7pt;}
    .durable-figure .figure-deck{font-size:9pt;line-height:12pt;margin:0 0 10pt;}
    .durable-figure svg{display:block;width:100%;height:auto;}
    .durable-figure figcaption{font-size:8.3pt;line-height:11.5pt;margin:7pt 0 0;font-style:italic;}
    p{margin-bottom:8pt;}
    .print-references ol{padding-left:17pt;}
    .frontmatter-heading{margin:0 0 12pt;break-after:avoid;}
    .section-number{margin:23pt 0 6pt;break-after:avoid;}
    .section-title{font-size:17pt;line-height:20pt;margin:0 0 15pt;break-after:avoid;}
    .article-pullquote{font-weight:700;}
    </style></head>''')
    body_source = scratch/'body.html'; body_source.write_text(markup)
    subprocess.run([os.environ.get('NODE', 'node'), str(ROOT/'scripts/render_publication_body.cjs'), str(body_source), str(scratch/'body.pdf')], check=True)
    register_fonts(); rl_config.canvas_basefontname = ROMAN
    pub = Publication(FILENAME, data['category']+' · PART 5', data['title'], data['subtitle'], data['standfirst'], data['date'], 0, ())
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
    writer.add_metadata({'/Title':data['title'], '/Author':data['author'], '/Subject':data['subtitle'], '/Keywords':'Governance and Performance, Part 5, organizational durability, illustrative chart', '/Creator':'Monderman publication house-style builder'})
    output = ROOT/FILENAME
    with output.open('wb') as handle: writer.write(handle)
    (ROOT/'output/pdf').mkdir(parents=True, exist_ok=True)
    (ROOT/'output/pdf'/FILENAME).write_bytes(output.read_bytes())
    return len(writer.pages)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--source',type=Path); parser.add_argument('--extract-only',action='store_true')
    args = parser.parse_args()
    data = extract(args.source) if args.source else json.loads(DATA.read_text())
    if args.extract_only:
        print(json.dumps({'source':str(DATA),'paragraphs':len(data['paragraphs']),'references':len(data['references']),'sections':len(data['sections'])}))
    else:
        pages = build_pdf(data)
        from generate_publication_social_cards import Card, render
        render(Card('durable-organization','Insight','Governance and Performance · Part 5',data['title'],data['subtitle'],data['date'],('The Durable','Organization')))
        print(json.dumps({'file':FILENAME,'pages':pages,'paragraphs':len(data['paragraphs']),'references':len(data['references']),'sections':len(data['sections'])}))
