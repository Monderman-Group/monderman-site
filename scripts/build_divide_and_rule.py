#!/usr/bin/env python3
"""Build the authorized Monderman edition from the frozen finalized DOCX extract."""
from pathlib import Path
from io import BytesIO
from html import escape
import argparse
import hashlib
import json
import math
import os
import re
import subprocess
import sys

from lxml import html as lhtml
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream, DictionaryObject, NameObject
from reportlab import rl_config
from reportlab.pdfgen import canvas
from reportlab.lib.colors import white
from PIL import Image
from apply_publication_house_style import Publication, register_fonts, make_cover, ROMAN, BOLD, MUTED, INK, draw_footer

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT.parent / 'publication-stalins-org-chart-20261025'
SOURCE = WORK / 'source-extracted.json'
SLUG = 'divide-and-rule-inside-the-company'
PDF = 'Monderman_Insight_Divide_and_Rule_Inside_the_Company_2026-10-25.pdf'
TITLE = 'Divide and Rule Inside the Company'
SUBTITLE = 'How rival divisions end up serving one person instead of the market.'
DECK = ('Overlapping divisions can make a leader indispensable while consuming the organization’s time. '
        'This essay examines why recurring disputes persist, who benefits, and how clearer decision boundaries can stop them forming.')
DATE = 'October 2026'
HEADINGS = {11, 14, 19, 22, 25, 28, 32, 37}
FIGURES = [
    {'after': 12, 'name': 'g1-route', 'caption': 'Figure 1. Where the dispute goes. A conceptual comparison of case-by-case rulings and a framework that governs subsequent disputes.',
     'alt': 'Four overlapping units route disputes either to one person for a case-specific ruling or to a standing decision framework. The constitutional comparison is an analogy, not a claim that every constitutional decision binds later cases.'},
    {'after': 18, 'name': 'g2-orgcharts', 'caption': 'Figure 2. How overlap accumulates. An illustrative organizational model showing added units, overlapping claims and recurring escalation.',
     'alt': 'Illustrative organization charts at year one, year five and year ten show additional units and overlapping responsibilities accumulating beneath the chief.'},
    {'after': 21, 'name': 'g3-fires', 'caption': 'Figure 3. A month of fires, sorted. Illustrative example: 3 novel incidents and 17 recurring disputes. These are not observed research data.',
     'alt': 'Illustrative example with three novel incidents and seventeen reruns. Novel incidents include a competitor price cut, a lost account and a regional outage. Reruns concern repeated disputes over approvals, customers, features, spending and decision ownership.'},
]


def plain(value):
    return re.sub(r'\s+', ' ', value).strip()


def inline(value):
    value = escape(value)
    return re.sub(r'\[(\d+)\]', lambda m: f'<sup><a href="#reference-{m[1]}" aria-label="Reference {m[1]}">[{m[1]}]</a></sup>', value)


def data_model():
    frozen=ROOT/'pdf-src'/(SLUG+'.json')
    if not SOURCE.is_file():
        data=json.loads(frozen.read_text())
        assert data['title']==TITLE and data['part']==7 and len(data['references'])==15
        return data
    source = json.loads(SOURCE.read_text())
    blocks = source['blocks']
    assert len(blocks) == 56
    assert blocks[1]['text'] == "Stalin's Org Chart"
    paragraphs = [{'number': block['index'], 'text': block['text'], 'heading': block['index'] in HEADINGS}
                  for block in blocks if 7 <= block['index'] <= 38]
    references = []
    for number, block in enumerate(blocks[39:54], 1):
        prefix = f'[{number}] '
        assert block['text'].startswith(prefix)
        references.append(block['text'][len(prefix):])
    assert len(paragraphs) == 32 and len(references) == 15
    words = len(' '.join(p['text'] for p in paragraphs).split())
    data = {'title': TITLE, 'subtitle': SUBTITLE, 'author': 'Jason Adamson', 'date': DATE,
            'category': 'GOVERNANCE AND PERFORMANCE', 'part': 7, 'standfirst': DECK,
            'paragraphs': paragraphs, 'references': references,
            'biography': blocks[55]['text'], 'copyright': '© 2026 Jason Adamson. All rights reserved.',
            'word_count': words, 'read_minutes': max(1, math.ceil(words/220)),
            'source_sha256': source['source_sha256'], 'editorial_changes_to_main_prose': []}
    assert 'DSI' not in data['biography']
    (ROOT / 'pdf-src' / (SLUG + '.json')).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    return data


def figure_html(figure, index, printing=False):
    filename = f'assets/research/{SLUG}-figure-{index}.png'
    if printing and index == 3 and (ROOT/f'assets/research/{SLUG}-figure-3-print.png').is_file():
        filename = f'assets/research/{SLUG}-figure-3-print.png'
    src = (ROOT/filename).as_uri() if printing else filename
    width,height=Image.open(ROOT/filename).size
    loading = 'eager' if printing else 'lazy'
    decoding = 'sync' if printing else 'async'
    markup = f'<img src="{src}" alt="{escape(figure["alt"])}" width="{width}" height="{height}" loading="{loading}" decoding="{decoding}">'
    if not printing:
        markup = f'<a class="divide-figure-image" href="{filename}" target="_blank" rel="noopener noreferrer" aria-label="Open Figure {index} at full size">{markup}</a>'
    return f'<figure class="divide-figure divide-figure-{index}" id="figure-{index}">{markup}<figcaption>{escape(figure["caption"])}</figcaption></figure>'


def article_body(data, printing=False):
    parts = []
    for block in data['paragraphs']:
        number = block['number']
        tag = 'h2' if block['heading'] else 'p'
        parts.append(f'<{tag} data-source-paragraph="{number}">{inline(block["text"])}</{tag}>')
        for index, figure in enumerate(FIGURES, 1):
            if figure['after'] == number:
                parts.append(figure_html(figure, index, printing))
    return '\n'.join(parts)


def reference_html(data):
    def link(value):
        value = escape(value)
        for text, url in [('Trenches, Not Silos: The Bill for Dividing a Company','https://www.monderman.com/trenches-not-silos.html'),
                          ('Hold, Collide, Come Apart: The Three Forms the Trenches Take','https://www.monderman.com/hold-collide-come-apart.html')]:
            value = value.replace(text, f'<a href="{url}">{text}</a>')
        return re.sub(r'https://[^\s<]+', lambda m: '<a href="'+m[0]+'">'+m[0]+'</a>' if not value[max(0,m.start()-6):m.start()].endswith('href="') else m[0], value) if '<a ' not in value else value
    return '\n'.join(f'<li id="reference-{i}" data-source-reference="{i}">{link(text)}</li>' for i,text in enumerate(data['references'],1))


def build_html(data, pages):
    template = (ROOT/'hold-collide-come-apart.html').read_text()
    header = (ROOT/'site-shell/header.html').read_text().strip()
    footer = (ROOT/'site-shell/footer.html').read_text().strip()
    scripts = template[template.index('</footer>')+len('</footer>'):]
    head = f'''<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{TITLE} | Monderman</title>
<meta name="author" content="Jason Adamson"><meta name="description" content="{escape(DECK)}">
<link rel="canonical" href="https://www.monderman.com/{SLUG}.html">
<meta property="og:type" content="article"><meta property="og:url" content="https://www.monderman.com/{SLUG}.html">
<meta property="og:title" content="{TITLE} | Monderman"><meta property="og:description" content="{escape(SUBTITLE)}">
<meta property="og:image" content="https://www.monderman.com/assets/research/{SLUG}-social.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{TITLE} — Governance and Performance, Part 7">
<meta property="article:published_time" content="2026-10-25"><meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{TITLE} | Monderman"><meta name="twitter:description" content="{escape(SUBTITLE)}">
<meta name="twitter:image" content="https://www.monderman.com/assets/research/{SLUG}-social.png">
<link rel="icon" type="image/svg+xml" href="favicon.svg?v=20260906-enterprise1">
<link rel="icon" type="image/x-icon" sizes="any" href="favicon.ico?v=20260906-enterprise1">
<link rel="icon" type="image/png" sizes="192x192" href="favicon-192.png?v=20260906-enterprise1">
<link rel="apple-touch-icon" href="apple-touch-icon.png?v=20260906-enterprise1">
<link rel="stylesheet" href="publication-html.css?v=20260906-accent1">
<link rel="stylesheet" href="canonical-site-shell.css?v=20260906-accent1">
<link rel="stylesheet" href="enterprise-site.css?v=20260915.consistency1">
<link rel="stylesheet" href="publication-hero.css?v=20260906-system3">
<link rel="stylesheet" href="research-topics.css?v=20261017.1">
<link rel="stylesheet" href="divide-rule-publication.css?v=20261025.1">
</head><body class="canonical-green-shell"><a class="skip-link" href="#main-content">Skip to article</a>
{header}
<section class="article-hero publication-hero publication-hero--split publication-category--insight" aria-labelledby="article-title">
<div class="article-hero-inner publication-hero__inner"><div><p class="article-kicker">Governance and Performance · Part 7</p>
<h1 id="article-title">{TITLE}</h1><p class="article-subtitle">{SUBTITLE}</p></div>
<div><p class="article-deck">{escape(DECK)}</p><p class="article-byline">Jason Adamson · October 2026 · {pages} pages · {data['read_minutes']}-minute read</p>
<div class="article-actions"><a class="article-action article-action-primary" href="#main-content">Read online</a>
<a class="article-action" href="{PDF}" target="_blank" rel="noopener noreferrer">Download PDF</a></div></div></div></section>
<main class="article-main" id="main-content"><article class="article-body">{article_body(data)}</article>
<section class="article-references" aria-labelledby="references-heading"><h2 class="references-heading" id="references-heading">References</h2>
<ol class="reference-list">{reference_html(data)}</ol></section>
<section class="article-about" aria-labelledby="about-author-heading"><h2 class="about-heading" id="about-author-heading">About the author</h2>
<p>{escape(data['biography'])}</p><p>{escape(data['copyright'])}</p></section>
<section class="article-further" aria-label="Article links"><p class="article-kicker">Keep reading</p>
<p><a href="{PDF}" target="_blank" rel="noopener noreferrer">Download the PDF →</a></p>
<p><a href="hold-collide-come-apart.html">Read Part 6: Hold, Collide, Come Apart →</a></p>
<p><a href="research.html#governance-performance-title">Read the Governance and Performance series →</a></p></section></main>
{footer}{scripts}'''
    (ROOT/(SLUG+'.html')).write_text(head)


def print_html(data):
    style = (ROOT/'pdf-src/monderman-pdf-house-style.css').as_uri()
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{TITLE}</title>
<link rel="stylesheet" href="{style}"><style>
@page {{size:Letter;margin:60pt 60pt 67pt;@bottom-left{{content:none}}@bottom-right{{content:none}}}}
@page diagram-wide {{size:Letter landscape;margin:40pt 54pt 67pt;}}
body {{font-family:"Neue Haas Grotesk TX Pro";font-size:10pt;line-height:15.2pt;}}
p {{orphans:3;widows:3;margin:0 0 9pt;}}
h2 {{font-size:17pt;line-height:20pt;margin:22pt 0 12pt;break-after:avoid;color:#0E3A44;}}
sup {{font-size:7pt;line-height:0;}}
a {{color:#0C6E78;text-decoration:none;}}
.divide-figure {{margin:18pt 0 22pt;break-inside:avoid;}}
.divide-figure img {{width:492pt;height:auto;display:block;}}
.divide-figure-2 {{page:diagram-wide;break-before:page;break-after:page;}}
.divide-figure-2 img {{width:684pt;}}
.divide-figure-3 {{break-before:page;break-after:page;}}
.divide-figure-3 img {{width:auto;max-width:492pt;max-height:570pt;margin:0 auto;}}
.divide-figure figcaption {{font-size:8.3pt;line-height:11.5pt;margin-top:8pt;font-style:italic;}}
.print-references {{break-before:page;}}
.print-references h2,.print-about h2 {{font-size:10.5pt;line-height:13pt;margin:0 0 12pt;letter-spacing:1pt;}}
.print-references ol {{margin:0;padding-left:16pt;}}
.print-references li {{font-size:8.6pt;line-height:12.2pt;margin-bottom:8pt;break-inside:avoid;overflow-wrap:anywhere;}}
.print-about {{break-before:page;padding-top:12pt;}}
.print-about p {{font-size:9.3pt;line-height:14pt;color:#4A555A;}}
.print-lockup {{margin-top:130pt;text-align:center;}}
.print-lockup .wordmark {{font-weight:700;font-size:19pt;line-height:22pt;color:#0E3A44;}}
.print-lockup p {{text-align:center;margin:10pt 0;}}
.print-lockup .contact,.print-lockup .copyright {{font-size:8.5pt;color:#6C7A80;}}
</style></head><body>{article_body(data, True)}
<section class="print-references"><h2>REFERENCES</h2><ol>{reference_html(data)}</ol></section>
<section class="print-about"><h2>ABOUT THE AUTHOR</h2><p>{escape(data['biography'])}</p>
<div class="print-lockup"><p class="wordmark">Monderman.</p><p>Clearer Insight. Stronger Performance.</p>
<p class="contact"><a href="https://www.monderman.com">www.monderman.com</a> · connect@monderman.com</p>
<p class="copyright">{escape(data['copyright'])}</p></div></section></body></html>'''


def build_pdf(data):
    for i in range(1,4):
        assert (ROOT/f'assets/research/{SLUG}-figure-{i}.png').is_file(), f'Missing approved adapted Figure {i}'
    scratch = WORK/'tmp/pdfs/monderman'
    scratch.mkdir(parents=True,exist_ok=True)
    source=scratch/'body.html'
    source.write_text(print_html(data))
    subprocess.run([os.environ.get('NODE','node'),str(ROOT/'scripts/render_publication_body.cjs'),str(source),str(scratch/'body.pdf')],check=True)
    register_fonts();rl_config.canvas_basefontname=ROMAN
    pub=Publication(PDF,'GOVERNANCE AND PERFORMANCE · PART 7',TITLE,SUBTITLE,DECK,DATE,0,())
    writer=PdfWriter();writer.append(PdfReader(BytesIO(make_cover(pub))))
    writer.append(PdfReader(scratch/'body.pdf'))
    for number,page in enumerate(writer.pages[1:],2):
        width,height=float(page.mediabox.width),float(page.mediabox.height)
        stream=BytesIO();c=canvas.Canvas(stream,pagesize=(width,height))
        if width>height:
            c.setFillColor(white);c.rect(0,0,width,61,stroke=0,fill=1)
            c.setFillColor(MUTED);c.setFont(ROMAN,8);c.drawString(54,45,DATE)
            c.setFillColor(INK);c.setFont(BOLD,8);c.drawRightString(width-54,45,str(number))
        else:
            draw_footer(c,DATE,number)
        c.save()
        page.merge_page(PdfReader(BytesIO(stream.getvalue())).pages[0])
    for page in writer.pages:
        resources=DictionaryObject(page['/Resources'].get_object())
        fonts=DictionaryObject(resources['/Font'].get_object())
        defaults={name for name,font in fonts.items() if font.get_object().get('/BaseFont')=='/Helvetica'}
        if defaults:
            roman=next(name for name,font in fonts.items() if any(s in str(font.get_object().get('/BaseFont')) for s in ('55Rg','NHG55')))
            content=ContentStream(page.get_contents(),writer)
            for args,op in content.operations:
                if op==b'Tf' and args[0] in defaults:args[0]=roman
            for name in defaults:del fonts[name]
            resources[NameObject('/Font')]=fonts;page[NameObject('/Resources')]=resources;page.replace_contents(content)
    writer.add_metadata({'/Title':TITLE,'/Author':'Jason Adamson','/Subject':SUBTITLE,'/Keywords':'Governance and Performance, Part 7, organizational structure, decision authority'})
    output=ROOT/PDF
    with output.open('wb') as handle:writer.write(handle)
    return len(writer.pages)


def integrate(data,pages):
    research_path=ROOT/'research.html'
    research=research_path.read_text()
    match=re.search(r'<section class="series" aria-labelledby="governance-performance-title">[\s\S]*?</section>',research)
    assert match
    section=match.group()
    card=f'''        <article class="series-card" data-publication="{SLUG}">
          <div class="series-card-top"><span class="series-chip">Part 7</span><span class="series-format">Insight · HTML + PDF</span></div>
          <h3 class="series-card-title" id="divide-rule-title">{TITLE}</h3>
          <p class="series-card-desc">{SUBTITLE}</p>
          <div class="series-card-foot"><div class="series-stats"><span>October 2026</span><span>{pages} pages · ~{data['read_minutes']} min</span></div>
            <div class="series-actions"><a class="series-action publication-primary-link" href="{SLUG}.html">Read article →</a>
              <a class="series-action publication-secondary-link" href="{PDF}" target="_blank" rel="noopener noreferrer">PDF →</a></div></div>
        </article>
'''
    section=re.sub(r'        <article class="series-card" data-publication="'+SLUG+r'">[\s\S]*?</article>\n','',section)
    section=section.replace('<div class="series-grid">','<div class="series-grid">\n'+card,1)
    section=section.replace('Six papers on how organizations change over time: what their reports leave out, how they drift, why they stay fast at cutting but slow at building, what dividing a company costs, what makes an organization durable, and how its divisions hold, collide, or grow apart.',
        'Seven essays on how organizations change over time: what their reports leave out, how they drift, what dividing a company costs, what makes an organization durable, and how overlapping divisions can serve the leader instead of the market.')
    research=research[:match.start()]+section+research[match.end():]
    research=research.replace('<p class="library-stamp">24 items · Updated October 2026</p>', '<p class="library-stamp">25 items · Updated October 2026</p>')
    research_path.write_text(research)
    index_path=ROOT/'index.html';index=index_path.read_text()
    new_card=f'''<article class="latest-card category-insight" data-category="insight" data-publication="{SLUG}">
<div class="latest-card-image divide-rule-card-image"><img src="assets/research/{SLUG}-figure-2.png" alt="Illustrative organizational charts showing overlapping authority accumulating beneath a chief" width="1672" height="941" loading="lazy" decoding="async"></div>
<div class="latest-card-body"><p class="latest-card-kicker">Governance and Performance · Part 7</p>
<h3 class="latest-card-title">{TITLE}</h3><p class="latest-card-text">{SUBTITLE}</p>
<div class="latest-card-actions"><a class="latest-card-link" href="{SLUG}.html" aria-label="Read article: {TITLE}">Read article →</a><a class="latest-card-secondary-link" href="{PDF}" target="_blank" rel="noopener noreferrer" aria-label="Download PDF: {TITLE}">Download PDF ↗</a></div></div></article>
'''
    index=re.sub(r'<article class="latest-card category-insight" data-category="insight" data-publication="'+SLUG+r'">[\s\S]*?</article>\n','',index)
    index=index.replace('<div class="latest-track" id="latestTrack">','<div class="latest-track" id="latestTrack">\n'+new_card,1)
    index=index.replace('</head>','<link rel="stylesheet" href="divide-rule-publication.css?v=20261025.1">\n</head>',1) if 'href="divide-rule-publication.css?' not in index else index
    index_path.write_text(index)
    topics_path=ROOT/'research-topics.json';topics=json.loads(topics_path.read_text())
    topics['articles']=[article for article in topics['articles'] if article['path']!=SLUG+'.html']
    topics['articles'].append({'path':SLUG+'.html','title':TITLE,'summary':SUBTITLE,'topics':['organizational-governance','structural-clarity','organizational-drift','decision-velocity']})
    topics['articles'].sort(key=lambda article:article['path'])
    topics_path.write_text(json.dumps(topics,ensure_ascii=False,indent=2)+'\n')
    for name in ['sitemap.txt','sitemap.xml']:
        path=ROOT/name;value=path.read_text();url='https://www.monderman.com/'+SLUG+'.html'
        if url not in value:
            value=value.rstrip()+'\n'+url+'\n' if name.endswith('.txt') else value.replace('</urlset>',f'  <url><loc>{url}</loc><lastmod>2026-10-25</lastmod></url>\n</urlset>')
        path.write_text(value)


def verify(data):
    doc=lhtml.fromstring((ROOT/(SLUG+'.html')).read_text())
    for block in data['paragraphs']:
        node=doc.xpath(f'//*[@data-source-paragraph="{block["number"]}"]')
        assert len(node)==1 and plain(node[0].text_content())==plain(block['text']),block['number']
    for i,text in enumerate(data['references'],1):
        node=doc.xpath(f'//*[@data-source-reference="{i}"]')
        assert len(node)==1 and plain(node[0].text_content())==plain(text),i
    for node in doc.xpath('//a[starts-with(@href,"#")]'):
        assert doc.xpath('//*[@id=$id]',id=node.get('href')[1:]),node.get('href')
    r=lhtml.fromstring((ROOT/'research.html').read_text())
    section=r.xpath('//section[@aria-labelledby="governance-performance-title"]')[0]
    order=[plain(node.text_content()) for node in section.xpath('.//span[@class="series-chip"]')]
    assert order==[f'Part {n}' for n in range(7,0,-1)],order
    i=lhtml.fromstring((ROOT/'index.html').read_text())
    assert i.xpath('//*[@id="latestTrack"]/article')[0].get('data-publication')==SLUG
    assert 'Stalin.png' not in (ROOT/(SLUG+'.html')).read_text()
    return {'source_prose_blocks':32,'references':15,'figures':3,'series_order':order,'new_carousel_first':True,'source_prose_verbatim':True}


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--prepare-only',action='store_true');args=parser.parse_args()
    data=data_model()
    if args.prepare_only:
        print(json.dumps({'prepared':True,'source_sha256':data['source_sha256'],'words':data['word_count']}));sys.exit()
    pages=build_pdf(data);build_html(data,pages);integrate(data,pages)
    from generate_publication_social_cards import Card,render
    render(Card(SLUG,'Insight','Governance and Performance · Part 7',TITLE,SUBTITLE,DATE))
    result=verify(data);result.update({'pages':pages,'pdf':PDF,'html':SLUG+'.html'})
    (WORK/'monderman-build-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,indent=2))
