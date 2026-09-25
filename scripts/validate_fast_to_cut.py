#!/usr/bin/env python3
"""Exact-source and publication checks for Fast to Cut, Slow to Build."""
from pathlib import Path
from html.parser import HTMLParser
import argparse
import hashlib
import json
import re
import pdfplumber
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
FILENAME = 'Monderman_Insight_Fast_to_Cut_Slow_to_Build_2026-09-25.pdf'
def norm(value):
    return re.sub(r'\s+', ' ', value).strip()

class Visible(HTMLParser):
    def __init__(self):
        super().__init__(); self.text=[]; self.links=[]
    def handle_data(self,data): self.text.append(data)
    def handle_endtag(self,tag):
        if tag in ('p','li','h1','h2','h3','div','section','article','dt','dd'):self.text.append('\n')
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='a':self.links.append(a.get('href',''))

def validate(source=None):
    data=json.loads((ROOT/'pdf-src/fast-to-cut-slow-to-build.json').read_text())
    checks=[]
    def check(test,label):
        assert test,label
        checks.append(label)
    expected_body=' '.join(data['source_paragraphs'])
    for old,new in data['authorized_body_edits'].items():expected_body=expected_body.replace(old,new)
    check(expected_body==' '.join(data['paragraphs']),'41 body paragraphs differ only by the two approved name removals')
    expected_refs=[x.replace('Available on the author’s LinkedIn profile','Available in the Monderman research library') if i in (12,19) else x for i,x in enumerate(data['source_references'],1)]
    check(expected_refs==data['references'],'19 references differ only by the two approved location replacements')
    if source:
        check(hashlib.sha256(source.read_bytes()).hexdigest()==data['source_sha256'],'source PDF SHA-256 matches the text of record')
        with pdfplumber.open(source) as original:
            source_body=norm(' '.join(' '.join(l['text'] for l in p.extract_text_lines() if l['top']<720) for p in original.pages[1:6]))
        source_body=source_body.replace('“'+data['pullquote']+'”','')
        check(norm(source_body)==norm(' '.join(data['source_paragraphs'])),'independent extraction matches all source body text in order')
    html=(ROOT/'fast-to-cut-slow-to-build.html').read_text()
    parser=Visible();parser.feed(html)
    visible=norm(''.join(parser.text))
    with pdfplumber.open(ROOT/FILENAME) as pdf:
        pages=[norm(' '.join(l['text'] for l in p.extract_text_lines() if l['top']<720)) for p in pdf.pages]
    rendered=norm(' '.join(pages))
    for surface,text in [('HTML',visible),('PDF',rendered)]:
        positions=[text.find(norm(p)) for p in data['paragraphs']]
        check(all(p>=0 for p in positions) and positions==sorted(positions),surface+' contains all 41 body paragraphs verbatim and in order')
        check(all(norm(r) in text for r in data['references']),surface+' contains all 19 references verbatim')
        check(all(norm(s['title']) in text for s in data['sections']),surface+' contains all seven approved section headings')
        check(norm(data['standfirst']) in text and norm(data['about']) in text,surface+' preserves approved front matter')
    check('—' not in visible,'new article has no em dashes')
    check(any(p.startswith('REFERENCES') for p in pages),'PDF references start on a fresh page')
    check(len(pages)==10,'PDF has ten pages including the canonical closing page')
    reader=PdfReader(ROOT/FILENAME)
    font_names=set()
    for p in reader.pages:
        for f in p['/Resources']['/Font'].get_object().values():
            f=f.get_object();name=str(f.get('/BaseFont',''));font_names.add(name)
            check(any(family in name for family in ('NeueHaasGrotesk','NHaasGrotesk','NHG')),'NHG font: '+name)
            desc=f.get('/FontDescriptor')
            if desc is None and '/DescendantFonts' in f:
                desc=f['/DescendantFonts'][0].get_object().get('/FontDescriptor')
            check(desc and any(k in desc.get_object() for k in ('/FontFile','/FontFile2','/FontFile3')),'embedded font: '+name)
    uris={str(a.get_object().get('/A',{}).get('/URI','')) for p in reader.pages for a in p.get('/Annots',[])}
    check(set(data['reference_links'].values()).issubset(uris),'PDF notes 12 and 19 link to the two article pages')
    check(all(u.replace('https://www.monderman.com/','') in parser.links or u in parser.links for u in data['reference_links'].values()),'HTML notes 12 and 19 link to the two article pages')
    check(any(FILENAME in u for u in parser.links),'HTML offers the correct PDF download')
    print(json.dumps(dict(passed=True,checks=len(checks),body_paragraphs=41,references=19,pdf_pages=10,fonts=sorted(font_names)),indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path)
    validate(parser.parse_args().source)
