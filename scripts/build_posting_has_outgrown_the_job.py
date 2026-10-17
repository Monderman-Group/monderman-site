#!/usr/bin/env python3
"""Faithful source-PDF extraction and Monderman house-style publication.

The author's wording, emphasis, opinion labels, references and original figure
are preserved. Only line-wrap whitespace, series metadata and house layout change.
"""
from pathlib import Path
from io import BytesIO
from html import escape
import argparse
import base64
import hashlib
import json
import math
import os
import re
import subprocess

import pdfplumber
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream, DictionaryObject, NameObject
from reportlab import rl_config
from reportlab.pdfgen import canvas
from apply_publication_house_style import Publication, register_fonts, make_cover, ROMAN, draw_footer
from build_durable_organization import line_markup

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'pdf-src/posting-has-outgrown-the-job.json'
SLUG = 'posting-has-outgrown-the-job.html'
FILENAME = 'Monderman_Insight_The_Posting_Has_Outgrown_the_Job_2026-10-16.pdf'
FIGURE = ROOT / 'assets/research/posting-has-outgrown-the-job-figure.png'
SERIES = 'Hiring and Work Design'
SOURCE_SHA256 = '1c45dba444a5ba628c9f3c24513546fc718ca0d8b8d297696af8687639f57ff7'


def norm(value):
    return re.sub(r'\s+', ' ', value).strip()


def citations(markup):
    return re.sub(r'\[(\d+)\]', lambda m: f'<sup><a href="#reference-{m[1]}" aria-label="Reference {m[1]}">[{m[1]}]</a></sup>', markup)


def extract(source):
    assert hashlib.sha256(source.read_bytes()).hexdigest() == SOURCE_SHA256, 'Unexpected source edition'
    reader = PdfReader(source)
    assert len(reader.pages) == 6, 'Unexpected source edition'
    image = reader.pages[1].images[0]
    FIGURE.parent.mkdir(parents=True, exist_ok=True)
    FIGURE.write_bytes(image.data)
    blocks = []
    pending = []
    raw_lines = []
    pending_markup = []
    def flush():
        if pending:
            blocks.append({'type': 'paragraph', 'text': norm(' '.join(pending)), 'html': ' '.join(pending_markup)})
            pending.clear(); pending_markup.clear()
    with pdfplumber.open(source) as pdf:
        cover_lines = pdf.pages[0].extract_text_lines()
        title, subtitle, byline = [x['text'] for x in cover_lines[:3]]
        assert title == 'The Posting Has Outgrown the Job'
        assert byline == 'Jason Adamson · October 16, 2026'
        for pi in range(5):
            lines = [x for x in pdf.pages[pi].extract_text_lines() if x['top'] < 720 and not (pi == 0 and x['top'] < 160)]
            previous = None
            for line in lines:
                size = line['chars'][0]['size']
                text = line['text']
                raw_lines.append({'source_page': pi+1, 'top': line['top'], 'font_size': size, 'text': text})
                if abs(size - 11) < .02:
                    if previous is not None and line['top'] - previous > 20:
                        flush()
                    pending.append(text); pending_markup.append(line_markup(line))
                    previous = line['top']
                else:
                    flush(); previous = None
                    if abs(size - 13) < .02:
                        blocks.append({'type': 'heading', 'text': text, 'html': line_markup(line)})
                    elif text == 'OPINION':
                        blocks.append({'type': 'opinion', 'text': text})
                    elif abs(size - 8.5) < .02:
                        blocks.append({'type': 'figure', 'text': text, 'html': line_markup(line), 'source_page': 2})
                    else:
                        raise AssertionError(f'Unrecognized source line: {pi+1}: {text}')
            # Only page 2 ends mid-paragraph (the committee passage).
            if pi != 1:
                flush()
        refs = []
        for line in pdf.pages[5].extract_text_lines():
            if abs(line['chars'][0]['size'] - 9) > .02 or line['top'] >= 720:
                continue
            m = re.match(r'^(\d+)\. ', line['text'])
            if m:
                assert int(m[1]) == len(refs)+1
                refs.append(line['text'][len(m[0]):])
            else:
                refs[-1] += ' ' + line['text']
    assert len(refs) == 9
    uris = []
    for a in reader.pages[5].get('/Annots', []):
        uri = a.get_object().get('/A', {}).get('/URI')
        if uri and uri not in uris:
            uris.append(str(uri))
    references = []
    for ref in refs:
        # Rejoin only the exact authoritative URL characters across source wraps.
        for uri in sorted(uris, key=len, reverse=True):
            pattern = r'\s*'.join(re.escape(c) for c in uri)
            ref = re.sub(pattern, lambda _: uri, ref)
        references.append(norm(ref))
    references_html = []
    for ref in references:
        markup = escape(ref)
        for uri in sorted(uris, key=len, reverse=True):
            e = escape(uri)
            if e in markup:
                markup = markup.replace(e, f'<a href="{escape(uri, quote=True)}">{e}</a>')
        references_html.append(markup)
    paragraphs = []
    for block in blocks:
        if block['type'] == 'paragraph':
            block['number'] = len(paragraphs)+1
            paragraphs.append({'number': block['number'], 'text': block['text'], 'html': block['html']})
    assert len([x for x in blocks if x['type'] == 'figure']) == 1
    assert len([x for x in blocks if x['type'] == 'opinion']) == 3
    assert len([x for x in blocks if x['type'] == 'heading']) == 4
    original_words = re.sub(r'\s', '', ''.join(x['text'] for x in raw_lines))
    frozen_words = re.sub(r'\s', '', ''.join(x['text'] for x in blocks))
    assert original_words == frozen_words, 'Source body extraction lost or reordered wording'
    word_count = len(' '.join(p['text'] for p in paragraphs).split())
    data = dict(title=title, subtitle=subtitle, author='Jason Adamson', date='October 16, 2026', publication_date='2026-10-16',
                series=SERIES, part=2, category=SERIES.upper(), standfirst=paragraphs[0]['text'], paragraphs=paragraphs,
                body_blocks=blocks, references=references, references_html=references_html, source_urls=uris,
                source_filename=source.name, source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(), source_pages=6,
                source_body_lines=raw_lines, word_count=word_count, read_minutes=math.ceil(word_count/200),
                figure={'path': str(FIGURE.relative_to(ROOT)), 'source_page': 2, 'width': 1600, 'height': 900,
                        'bytes': len(image.data), 'sha256': hashlib.sha256(image.data).hexdigest(),
                        'policy': 'Exact extracted original PNG; no resampling, redrawing or color changes.'},
                pullquote='A requirement the work does not need cannot select for the work.',
                extraction_policy='All author prose, emphasis, headings, 3 OPINION labels, figure and 9 references preserved; line-wrap whitespace and URL wraps normalized. No editorial fact-check or external research is implied.',
                editorial_changes=[])
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
    return data


def figure_html(block, print_media=False):
    # Match the site's exact-original-artwork policy: browser image negotiation
    # cannot replace this authored diagram with a lossy CDN variant.
    src = FIGURE.as_uri() if print_media else 'data:image/png;base64,' + base64.b64encode(FIGURE.read_bytes()).decode('ascii')
    transcript = '' if print_media else '''<details><summary style="min-height:44px;padding:12px 0;cursor:pointer">Read figure text</summary><p><strong>Where the posting leaves the work</strong></p><p>The gap keeps its shape. The posting adds the dimension the gap does not have.</p><p>The work: the shape of the gap. The posting: what it asks for.</p><p><strong>A deep gap. The posting adds width.</strong> The one thing. + presenting; + mentoring; + project plans; + stakeholders; + six tools; + vendor calls.</p><p><strong>A wide gap. The posting adds depth.</strong> Eight things, well enough. + expert in finance; + expert in people; + expert in operations; + expert in facilities; + expert in contracts.</p><p>In both, the thing the gap needs is still on the list, surrounded by things it does not.</p></details>'''
    return f'''<figure class="posting-figure" id="figure-1" data-source-page="2"><img src="{src}" width="1600" height="900" alt="Two shapes of gap and where a posting drifts: the deep gap acquires width; the wide gap acquires depth."><figcaption>{block['html']}</figcaption>{transcript}</figure>'''


def article_body(data, print_media=False):
    body = []
    for i, b in enumerate(data['body_blocks'], 1):
        if b['type'] == 'paragraph':
            body.append(f'<p data-source-paragraph="{b["number"]}" data-source-block="{i}">{citations(b["html"])}</p>')
        elif b['type'] == 'heading':
            slug = re.sub(r'[^a-z0-9]+', '-', b['text'].lower()).strip('-')
            body.append(f'<h2 id="{slug}" data-source-block="{i}">{b["html"]}</h2>')
        elif b['type'] == 'opinion':
            body.append(f'<p class="publication-label" data-source-block="{i}"><strong>OPINION</strong></p>')
        elif b['type'] == 'figure':
            body.append(figure_html(b, print_media))
    return '\n'.join(body)


def reference_html(data):
    return '\n'.join(f'<li id="reference-{i}" data-source-reference="{i}">{text}</li>' for i,text in enumerate(data['references_html'],1))


def print_html(data):
    style = (ROOT/'pdf-src/monderman-pdf-house-style.css').as_uri()
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{escape(data['title'])}</title><link rel="stylesheet" href="{style}"><style>
@page {{ size:Letter; margin:60pt 60pt 67pt; @bottom-left{{content:none}} @bottom-right{{content:none}} }}
body {{font-family:"Neue Haas Grotesk TX Pro";font-size:10pt;line-height:15.2pt;}}
p {{orphans:3;widows:3;margin:0 0 8pt;}}
h2 {{font-size:16pt;line-height:20pt;color:#0E3A44;margin:18pt 0 12pt;break-after:avoid;}}
.publication-label {{font-size:8pt;letter-spacing:1.2pt;margin:10pt 0 5pt;break-after:avoid;}}
.posting-figure {{margin:12pt 0 14pt;break-inside:avoid;}}
.posting-figure img {{display:block;width:100%;height:auto;}}
.posting-figure figcaption {{font-size:8.3pt;line-height:11.5pt;color:#69767C;margin:8pt 0 0;}}
sup {{font-size:7pt;line-height:0;}}
.print-references {{break-before:page;}}
.print-references h2,.print-about h2 {{font-size:10.5pt;line-height:12.5pt;margin:0 0 11pt;}}
.print-references ol {{padding-left:14pt;margin:0;}}
.print-references li {{font-size:8.6pt;line-height:11.2pt;margin:0 0 8pt;break-inside:avoid;overflow-wrap:anywhere;}}
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
</style></head><body>{article_body(data,True)}
<section class="print-references"><h2>REFERENCES</h2><ol>{reference_html(data)}</ol></section>
<section class="print-about"><h2>ABOUT THE AUTHOR</h2><p><b>Jason Adamson</b> is the author of <i>Governance, Bureaucracy and Organization: Stewardship, Drift, and Administrative Capacity</i> (Routledge, forthcoming). He holds an M.S. in Organization Development from Pepperdine University.</p>
<div class="print-company"><h2>ABOUT MONDERMAN</h2><p>Monderman is a SaaS platform built around Q²-SODI™, an organizational diagnostic framework.</p></div>
<div class="print-lockup"><p class="wordmark"><img src="{(ROOT/'assets/brand/monderman-map-ink.svg').as_uri()}" alt="">Monderman.</p><p>Clearer Insight. Stronger Performance.</p><p class="contact">connect@monderman.com · www.monderman.com</p><p class="copyright">© 2026 Jason Adamson. All rights reserved.</p></div></section></body></html>'''


def build_pdf(data):
    scratch = Path(os.environ.get('MONDERMAN_PDF_REVIEW_DIR', ROOT/'tmp/pdfs/posting')); scratch.mkdir(parents=True,exist_ok=True)
    body = scratch/'body.html'; body.write_text(print_html(data))
    subprocess.run([os.environ.get('NODE','node'),str(ROOT/'scripts/render_publication_body.cjs'),str(body),str(scratch/'body.pdf')],check=True)
    register_fonts(); rl_config.canvas_basefontname=ROMAN
    pub=Publication(FILENAME,SERIES.upper()+' · PART 2',data['title'],data['subtitle'],data['standfirst'],data['date'],0,())
    writer=PdfWriter(); writer.append(PdfReader(BytesIO(make_cover(pub))))
    for page in PdfReader(scratch/'body.pdf').pages:
        stream=BytesIO(); c=canvas.Canvas(stream,pagesize=(612,792)); draw_footer(c,data['date'],len(writer.pages)+1); c.save()
        page.merge_page(PdfReader(BytesIO(stream.getvalue())).pages[0]); writer.add_page(page)
    for page in writer.pages:
        resources=DictionaryObject(page['/Resources'].get_object()); fonts=DictionaryObject(resources['/Font'].get_object())
        defaults={name for name,font in fonts.items() if font.get_object().get('/BaseFont')=='/Helvetica'}
        if defaults:
            roman=next(name for name,font in fonts.items() if any(s in str(font.get_object().get('/BaseFont')) for s in ('55Rg','NHG55')))
            content=ContentStream(page.get_contents(),writer)
            for args,op in content.operations:
                if op==b'Tf' and args[0] in defaults: args[0]=roman
            for name in defaults: del fonts[name]
            resources[NameObject('/Font')]=fonts;page[NameObject('/Resources')]=resources;page.replace_contents(content)
    writer.add_metadata({'/Title':data['title'],'/Author':data['author'],'/Subject':data['subtitle'],'/Keywords':SERIES+', Part 2, hiring, job design, job postings','/Creator':'Monderman publication house-style builder'})
    with (ROOT/FILENAME).open('wb') as handle:writer.write(handle)
    return len(writer.pages)


def build_html(data,pages):
    template=(ROOT/'hiring-blind-spot.html').read_text()
    head=template[:template.index('<main class="article-main"')]
    head=head.replace('The Hiring Blind Spot',data['title']).replace('hiring-blind-spot.html',SLUG)
    head=head.replace('Monderman_Insight_The_Hiring_Blind_Spot_2026-10-16.pdf',FILENAME)
    head=head.replace('hiring-blind-spot-social.png','posting-has-outgrown-the-job-social.png')
    head=re.sub(r'Governance and Performance · Part 7|Hiring and Work Design · Part 1',SERIES+' · Part 2',head)
    old_sub='The more exactly a company describes the person it wants, the less it can tell whether it got one. The only part of hiring that still knows was never written down.'
    old_deck='This paper examines what hiring systems measure, what those measures miss, and the information carried by referrals.'
    head=head.replace(old_sub,escape(data['subtitle'])).replace(old_deck,escape(data['paragraphs'][1]['text']))
    head=re.sub(r'10 pages · 14-minute read',f'{pages} pages · {data["read_minutes"]}-minute read',head)
    head=re.sub(r'<style>[\s\S]*?</style>','''<style>.posting-figure{margin:36px 0 48px}.posting-figure img{display:block;width:100%;height:auto;border:1px solid var(--article-line)}.posting-figure figcaption{margin-top:14px}.article-body .publication-label{font-size:.8rem;letter-spacing:.12em;margin:28px 0 10px}.reference-list li{overflow-wrap:anywhere}</style>''',head,count=1)
    body=f'''<main class="article-main" id="main-content"><article class="article-body">{article_body(data)}</article>
<section class="article-references" aria-labelledby="references-heading"><h2 class="references-heading" id="references-heading">References</h2><ol class="reference-list">{reference_html(data)}</ol></section>
<section class="article-about" aria-labelledby="about-author-heading"><h2 class="about-heading" id="about-author-heading">About the author</h2><p>Jason Adamson is the author of Governance, Bureaucracy and Organization: Stewardship, Drift, and Administrative Capacity (Routledge, forthcoming). He holds an M.S. in Organization Development from Pepperdine University.</p><p>© 2026 Jason Adamson. All rights reserved.</p></section>
<section class="article-further" aria-label="Article links"><p class="article-kicker">Keep reading</p><p><a href="{FILENAME}" target="_blank" rel="noopener noreferrer">Download the PDF →</a></p><p><a href="hiring-blind-spot.html">Read Part 1: The Hiring Blind Spot →</a></p><p><a href="research.html#hiring-work-design-title">Read the Hiring and Work Design series →</a></p><p><a href="research.html">Browse all research →</a></p></section></main>
'''
    tail=template[template.index('<footer class="footer mond-footer"'):]
    # The source template's article JSON-LD describes the other publication.
    tail=re.sub(r'<script type="application/ld\+json">[\s\S]*?</script>','',tail)
    markup=head+body+tail
    if (ROOT/'research-topics.json').is_file():
        from build_research_topics import read_manifest, apply_article
        _,topics,articles=read_manifest()
        if SLUG in articles:
            markup=apply_article(markup,articles[SLUG],topics,articles)
    (ROOT/SLUG).write_text(markup)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,help='Explicit supplied source PDF to extract; otherwise use the frozen JSON source.');parser.add_argument('--extract-only',action='store_true');args=parser.parse_args()
    data=extract(args.source) if args.source else json.loads(DATA.read_text())
    if args.extract_only:print(json.dumps({'paragraphs':len(data['paragraphs']),'references':len(data['references']),'words':data['word_count'],'read_minutes':data['read_minutes']}))
    else:
        pages=build_pdf(data);build_html(data,pages)
        print(json.dumps({'pdf':FILENAME,'html':SLUG,'pages':pages,'paragraphs':len(data['paragraphs']),'references':len(data['references']),'read_minutes':data['read_minutes']}))
