#!/usr/bin/env python3
"""Build the Monderman edition from its frozen, authorized publication model."""
from pathlib import Path
from io import BytesIO
from html import escape
import json
import os
import re
import subprocess

from lxml import html as LH
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from apply_publication_house_style import Publication, register_fonts, make_cover, draw_footer, ROMAN, BOLD, MUTED, INK

ROOT = Path(__file__).resolve().parents[1]
SLUG = 'ai-wont-land-in-the-middle'
PDF = 'Monderman_Insight_AI_Wont_Land_in_the_Middle_2026-10-28.pdf'
WORK = ROOT.parent / 'publication-ai-wont-land-middle-20261028' / 'monderman'
NODE = os.environ.get('NODE', 'node')


def figure(data, index, printing=False):
    markup = data['figures'][index-1]['html']
    markup = markup.replace('/media/ai-wont-land-in-the-middle/five-middles.png', f'assets/research/{SLUG}-figure-1.png')
    markup = markup.replace('/media/ai-wont-land-in-the-middle/twenty-years.png', f'assets/research/{SLUG}-figure-2.png')
    node = LH.fromstring(markup)
    node.set('class', 'ai-middle-figure')
    img = node.xpath('.//img')[0]
    img.set('height', '870')
    if printing:
        img.set('src', (ROOT/img.get('src')).as_uri())
        img.set('loading', 'eager')
    else:
        anchor = node.xpath('.//a')[0]
        anchor.set('target', '_blank')
        anchor.set('rel', 'noopener noreferrer')
    return LH.tostring(node, encoding='unicode')


def body(data, printing=False):
    parts=[]
    for p in data['paragraphs']:
        if printing and p['number']==7:
            parts.append('<section class="timeline-context">'+p['html']+figure(data,2,True)+'</section>')
            continue
        parts.append(p['html'])
        if p['number'] in [6, 7]:
            parts.append(figure(data, 1 if p['number']==6 else 2, printing))
    return '\n'.join(parts)


def references(data):
    return '<ol class="reference-list">'+'\n'.join(data['references'])+'</ol>'


def build_html(data, pages):
    header=(ROOT/'site-shell/header.html').read_text().strip()
    footer=(ROOT/'site-shell/footer.html').read_text().strip()
    meta_title=escape(data['title']);deck=escape(data['deck'])
    title='AI Won’t Land in the Middle.'
    content=f'''<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{meta_title} | Monderman</title>
<meta name="author" content="Jason Adamson"><meta name="description" content="{deck}">
<link rel="canonical" href="https://www.monderman.com/{SLUG}.html">
<meta property="og:type" content="article"><meta property="og:url" content="https://www.monderman.com/{SLUG}.html">
<meta property="og:title" content="{meta_title} | Monderman"><meta property="og:description" content="{deck}">
<meta property="og:image" content="https://www.monderman.com/assets/brand/monderman-social-card.png?v=20260907-wordmark2">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Monderman">
<meta property="article:published_time" content="2026-10-28"><meta property="article:author" content="Jason Adamson">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{meta_title} | Monderman">
<meta name="twitter:description" content="{deck}">
<meta name="twitter:image" content="https://www.monderman.com/assets/brand/monderman-social-card.png?v=20260907-wordmark2"><meta name="twitter:image:alt" content="Monderman">
<link rel="icon" type="image/svg+xml" href="favicon.svg?v=20260906-enterprise1">
<link rel="icon" type="image/x-icon" sizes="any" href="favicon.ico?v=20260906-enterprise1">
<link rel="icon" type="image/png" sizes="192x192" href="favicon-192.png?v=20260906-enterprise1">
<link rel="apple-touch-icon" href="apple-touch-icon.png?v=20260906-enterprise1">
<link rel="stylesheet" href="publication-html.css?v=20260906-accent1">
<link rel="stylesheet" href="canonical-site-shell.css?v=20260906-accent1">
<link rel="stylesheet" href="enterprise-site.css?v=20260915.consistency1">
<link rel="stylesheet" href="publication-hero.css?v=20260906-system3">
<link rel="stylesheet" href="research-topics.css?v=20261017.1">
<link rel="stylesheet" href="ai-middle-publication.css?v=20261028.1">
<link rel="stylesheet" href="brand-surfaces.css?v=20261023.1">
</head><body class="canonical-green-shell"><a class="skip-link" href="#main-content">Skip to article</a>
{header}
<section class="article-hero publication-hero publication-hero--split publication-category--insight" aria-labelledby="article-title">
<div class="article-hero-inner publication-hero__inner"><div><p class="article-kicker">AI and Institutions · Part 5</p>
<h1 id="article-title">{title}</h1><p class="article-subtitle">Someone Has to Put It There.</p></div>
<div><p class="article-deck">{deck}</p><p class="article-byline">Jason Adamson · October 2026 · {pages} pages · {data['read_minutes']}-minute read</p>
<div class="article-actions"><a class="article-action article-action-primary" href="#main-content">Read online</a>
<a class="article-action" href="{PDF}" target="_blank" rel="noopener noreferrer">Download PDF</a></div></div></div></section>
<main class="article-main" id="main-content"><article class="article-body">{body(data)}</article>
<section class="article-references" aria-labelledby="references-heading"><h2 class="references-heading" id="references-heading">References</h2>{references(data)}</section>
<section class="article-about" aria-labelledby="about-author-heading"><h2 class="about-heading" id="about-author-heading">About the author</h2>
<p>{escape(data['biography'])}</p><p>{escape(data['copyright'])}</p></section>
<section class="article-further" aria-label="Article links"><p class="article-kicker">Keep reading</p>
<p><a href="{PDF}" target="_blank" rel="noopener noreferrer">Download the PDF →</a></p>
<p><a href="built-to-please.html">Read Part 4: Built to Please →</a></p>
<p><a href="research.html#ai-institutions-title">Read the AI and Institutions series →</a></p></section></main>
{footer}
<script src="canonical-site-shell.js?v=20260915.consistency1"></script>
<script src="assistant.js?v=20260828-footer-dock4" defer></script>
<script src="contact-transport.js?v=20260903-contact1" defer></script>
<script src="connect-widget.js?v=20260903-contact1" defer></script>
</body></html>'''
    (ROOT/(SLUG+'.html')).write_text(content)


def build_pdf(data):
    WORK.mkdir(parents=True, exist_ok=True)
    css=(ROOT/'pdf-src/monderman-pdf-house-style.css').as_uri()
    source=WORK/'body.html'
    source.write_text(f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{escape(data['title'])}</title>
<link rel="stylesheet" href="{css}"><style>
@page {{size:Letter;margin:60pt 60pt 67pt;@bottom-left{{content:none}}@bottom-right{{content:none}}}}
@page diagram-wide {{size:Letter landscape;margin:40pt 54pt 67pt;}}
body {{font-family:"Neue Haas Grotesk TX Pro";font-size:10pt;line-height:15.2pt;}}
p {{orphans:3;widows:3;margin:0 0 9pt;}} a {{color:#0C6E78;text-decoration:none;}}
.citation {{font-size:7pt;vertical-align:super;line-height:0;}}
.ai-middle-figure {{page:diagram-wide;break-before:page;break-after:page;break-inside:avoid;margin:0;}}
.ai-middle-figure img {{width:684pt;height:auto;display:block;}}
.timeline-context {{page:diagram-wide;break-before:page;break-after:page;}}
.timeline-context .ai-middle-figure {{page:auto;break-before:auto;break-after:auto;margin-top:12pt;}}
figcaption {{font-size:8.3pt;line-height:11.5pt;margin-top:8pt;}}
figcaption small {{font-size:7.5pt;}}
.print-references {{break-before:page;}} .print-about {{break-before:page;}}
h2 {{font-size:10.5pt;line-height:13pt;margin:0 0 12pt;letter-spacing:1pt;color:#0E3A44;}}
.reference-list {{list-style:none;padding:0;margin:0;}}
.reference-list p {{font-size:8.6pt;line-height:12.2pt;margin-bottom:8pt;break-inside:avoid;overflow-wrap:anywhere;}}
.print-about p {{font-size:9.3pt;line-height:14pt;color:#4A555A;}}
.print-lockup {{margin-top:130pt;text-align:center;}}
.print-lockup p {{text-align:center;margin:10pt 0;}}
.wordmark {{font-weight:700;font-size:19pt!important;color:#0E3A44!important;}}
</style></head><body>{body(data,True)}
<section class="print-references"><h2>REFERENCES</h2>{references(data)}</section>
<section class="print-about"><h2>ABOUT THE AUTHOR</h2><p>{escape(data['biography'])}</p>
<div class="print-lockup"><p class="wordmark">Monderman.</p><p>Clearer Insight. Stronger Performance.</p>
<p>www.monderman.com · connect@monderman.com</p><p>{escape(data['copyright'])}</p></div></section></body></html>''')
    subprocess.run([NODE,str(ROOT/'scripts/render_publication_body.cjs'),str(source),str(WORK/'body.pdf')],check=True)
    register_fonts()
    pub=Publication(PDF,'AI AND INSTITUTIONS · PART 5','AI Won’t Land in the Middle.',data['subtitle'],data['deck'],data['date'],0,())
    writer=PdfWriter();writer.append(PdfReader(BytesIO(make_cover(pub))));writer.append(PdfReader(WORK/'body.pdf'))
    for number,page in enumerate(writer.pages[1:],2):
        w,h=float(page.mediabox.width),float(page.mediabox.height)
        stream=BytesIO();c=canvas.Canvas(stream,pagesize=(w,h))
        if w>h:
            c.setFillColorRGB(1,1,1);c.rect(0,0,w,61,stroke=0,fill=1)
            c.setFillColor(MUTED);c.setFont(ROMAN,8);c.drawString(54,45,data['date'])
            c.setFillColor(INK);c.setFont(BOLD,8);c.drawRightString(w-54,45,str(number))
        else: draw_footer(c,data['date'],number)
        c.save();page.merge_page(PdfReader(BytesIO(stream.getvalue())).pages[0])
    writer.add_metadata({'/Title':data['title'],'/Author':data['author'],'/Subject':data['deck'],'/Keywords':'Monderman, AI and Institutions, Part 5, independent scrutiny, governance'})
    with (ROOT/PDF).open('wb') as f:writer.write(f)
    return len(writer.pages)


if __name__=='__main__':
    data=json.loads((ROOT/'pdf-src'/f'{SLUG}.json').read_text())
    pages=build_pdf(data)
    build_html(data,pages)
    print(json.dumps({'html':SLUG+'.html','pdf':PDF,'pages':pages,'paragraphs':len(data['paragraphs']),'references':len(data['references'])}))
