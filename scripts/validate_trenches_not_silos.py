#!/usr/bin/env python3
"""Source fidelity and house-style release checks for Trenches, Not Silos."""
from pathlib import Path
from html.parser import HTMLParser
from collections import Counter
import argparse
import hashlib
import json
import logging
import re
import pdfplumber
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
PDF = 'Monderman_Insight_Trenches_Not_Silos_2026-09-28.pdf'
logging.getLogger('pdfminer').setLevel(logging.ERROR)


def compact(value):
    return re.sub(r'\s', '', value)


class Text(HTMLParser):
    def __init__(self):
        super().__init__(); self.text=[]; self.links=[]; self.figures=0
    def handle_data(self, data): self.text.append(data)
    def handle_starttag(self, tag, attrs):
        if tag == 'figure': self.figures += 1
        if tag == 'a': self.links.append(dict(attrs).get('href',''))


def validate(source=None):
    data = json.loads((ROOT/'pdf-src/trenches-not-silos.json').read_text())
    html = (ROOT/'trenches-not-silos.html').read_text()
    parser = Text(); parser.feed(html)
    visible = compact(' '.join(parser.text))
    checks = []
    def check(test, name):
        assert test, name
        checks.append(name)
    check(len(data['paragraphs'])==26 and len(data['references'])==8, '26 paragraphs and eight grouped references')
    check(parser.figures == len(data['figures']) == 3, 'all three source figures retained')
    if source:
        check(hashlib.sha256(source.read_bytes()).hexdigest()==data['source_sha256'], 'source PDF matches the frozen text of record')
        with pdfplumber.open(source) as original:
            body = ' '.join(' '.join(line['text'] for line in p.extract_text_lines() if abs(line['chars'][0]['size']-9.7)<.02 and line['top']<720) for p in original.pages[1:8])
        check(compact(body)==compact(' '.join(data['paragraphs'])), 'independent source extraction matches the entire body without edits')
    with pdfplumber.open(ROOT/PDF) as pdf:
        pages = [' '.join(l['text'] for l in p.extract_text_lines() if l['top']<730) for p in pdf.pages]
        pdf_text = compact(' '.join(pages))
        check(len(pages)==10, '10-page edition matches library and article metadata')
        for i,page in enumerate(pdf.pages[1:],2):
            check(all(c['x0'] >= 58 and c['x1'] <= 554 for c in page.chars), f'page {i}: text within house side margins')
            check(str(i) in (page.crop((500,730,612,792)).extract_text() or ''), f'page {i}: correct running folio')
        check(any('REFERENCES'==p.split(' ')[0] for p in pages), 'references start on a new page')
        check(sum('ABOUT THE AUTHOR' in p for p in pages)==1, 'single author biography on closing page')
    for surface,text in [('HTML',visible),('PDF',pdf_text)]:
        positions = [text.find(compact(p)) for p in data['paragraphs']]
        check(all(p>=0 for p in positions) and positions==sorted(positions), surface+': every body paragraph retained verbatim and in order')
        check(all(compact(r) in text for r in data['references']),surface+': all eight references retained')
        for key in ('title','subtitle','standfirst','pullquote','biography','copyright'):
            check(compact(data[key]) in text, surface+': original '+key+' retained')
        check('localhost' not in text and '127.0.0.1' not in text, surface+': no local QA URLs exposed')
    for figure in data['figures']:
        labels=[figure['title'],figure['subtitle'],figure['note'],figure['caption']]+[t for p in figure['panels'] for t in p]
        check(all(compact(t) in visible for t in labels), 'HTML: complete figure wording: '+figure['title'])
        # PDF columns interleave in extract_text; compare individual lexical tokens.
        pdf_words=Counter(re.findall(r'\w+', ' '.join(pages)))
        check(all(pdf_words[w]>=n for w,n in Counter(re.findall(r'\w+', ' '.join(labels))).items()), 'PDF: all figure words retained: '+figure['title'])
    reader = PdfReader(ROOT/PDF)
    fonts=set()
    for page in reader.pages:
        check(tuple(float(x) for x in page.mediabox[2:]) == (612,792), 'US Letter page geometry')
        for f in page['/Resources']['/Font'].get_object().values():
            f=f.get_object()
            desc=f.get('/FontDescriptor')
            if desc is None and '/DescendantFonts' in f: desc=f['/DescendantFonts'][0].get_object().get('/FontDescriptor')
            name=str(f.get('/BaseFont') or (desc.get_object().get('/FontName') if desc else '')); fonts.add(name)
            check(any(k in name for k in ('NHaas','NeueHaas','NHG')), 'house font: '+name)
            # Chromium embeds CFF webfonts as vector Type3 glyph programs.
            embedded_type3=f.get('/Subtype')=='/Type3' and bool(f.get('/CharProcs')) and all(bool(g.get_object().get_data()) for g in f['/CharProcs'].get_object().values())
            check(embedded_type3 or (desc and any(k in desc.get_object() for k in ('/FontFile','/FontFile2','/FontFile3'))), 'embedded font: '+name)
    check(any('Italic' in f or '56It' in f for f in fonts),'genuine italic NHG face embedded')
    uris={str(a.get_object().get('/A',{}).get('/URI','')) for p in reader.pages for a in p.get('/Annots',[])}
    check('https://www.monderman.com/the-unmeasured-layer.html' in uris,'PDF reference4 links to prior paper')
    check(PDF in parser.links,'HTML downloads current edition')
    check('Governance and Performance · Part 4' in html,'HTML identifies series and part')
    check('10 pages · 20-minute read' in html,'correct article edition metadata')
    check('href="https://www.monderman.com/trenches-not-silos.html"' in html,'canonical URL')
    print(json.dumps(dict(passed=True,checks=len(checks),pdf_pages=10,body_paragraphs=26,references=8,figures=3,fonts=sorted(fonts)),indent=2))


if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--source',type=Path)
    validate(parser.parse_args().source)
