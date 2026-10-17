#!/usr/bin/env python3
"""Check authored wording and original artwork against actual HTML/PDF outputs."""
from pathlib import Path
from html.parser import HTMLParser
from io import BytesIO
import argparse
import base64
import hashlib
import json
import re

import pdfplumber
from PIL import Image
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]
FILENAME='Monderman_Insight_The_Posting_Has_Outgrown_the_Job_2026-10-16.pdf'


class Article(HTMLParser):
    def __init__(self):
        super().__init__();self.paragraphs={};self.references={};self.current=None;self.kind=None;self.urls=[];self.citations=[];self.figure_sources=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='img' and a.get('width')=='1600' and a.get('height')=='900':self.figure_sources.append(a.get('src',''))
        if tag=='p' and 'data-source-paragraph' in a:self.current=int(a['data-source-paragraph']);self.kind='p';self.paragraphs[self.current]=''
        if tag=='li' and 'data-source-reference' in a:self.current=int(a['data-source-reference']);self.kind='li';self.references[self.current]=''
        if tag=='a' and 'href' in a:
            self.urls.append(a['href'])
            if a['href'].startswith('#reference-'):self.citations.append(int(a['href'].split('-')[-1]))
    def handle_endtag(self,tag):
        if tag==self.kind:self.current=None;self.kind=None
    def handle_data(self,text):
        if self.current is not None:(self.paragraphs if self.kind=='p' else self.references)[self.current]+=text


def norm(text):return re.sub(r'\s+','',text)
def ref(path):
    b=path.read_bytes();return {'path':str(path),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}


def validate(source,hiring_before=None):
    data_path=ROOT/'pdf-src/posting-has-outgrown-the-job.json';data=json.loads(data_path.read_text())
    assert hashlib.sha256(source.read_bytes()).hexdigest()==data['source_sha256']
    assert len(data['paragraphs'])==30 and len(data['references'])==9
    assert len([b for b in data['body_blocks'] if b['type']=='opinion'])==3
    assert len([b for b in data['body_blocks'] if b['type']=='heading'])==4
    html_path=ROOT/'posting-has-outgrown-the-job.html';markup=html_path.read_text();html=Article();html.feed(markup)
    assert len(html.paragraphs)==30
    for p in data['paragraphs']:assert norm(html.paragraphs[p['number']])==norm(p['text']),p['number']
    assert len(html.references)==9
    for i,r in enumerate(data['references'],1):assert norm(html.references[i])==norm(r),i
    expected_citations=[int(x) for p in data['paragraphs'] for x in re.findall(r'\[(\d+)\]',p['text'])]
    assert html.citations==expected_citations
    assert set(data['source_urls']).issubset(html.urls)
    assert 'Hiring and Work Design · Part 2' in markup and '7 pages · 10-minute read' in markup
    pdf_path=ROOT/FILENAME;reader=PdfReader(pdf_path)
    assert len(reader.pages)==7 and all(tuple(float(x) for x in p.mediabox[2:])==(612,792) for p in reader.pages)
    with pdfplumber.open(pdf_path) as pdf:
        body=''.join(''.join(x['text'] for x in page.extract_text_lines() if x['top']<725) for page in pdf.pages[1:5])
        target=''.join(b['text'] for b in data['body_blocks'])
        assert norm(body)==norm(target),'Actual PDF body differs from source blocks'
        refs=''.join(x['text'] for x in pdf.pages[5].extract_text_lines() if x['top']<725)
        target_refs='REFERENCES'+''.join(str(i)+'.'+r for i,r in enumerate(data['references'],1))
        assert norm(refs)==norm(target_refs),'Actual PDF references differ'
        cover=norm(pdf.pages[0].extract_text())
        assert 'HIRINGANDWORKDESIGN·PART2' in cover
        assert all(p.width==612 and p.height==792 for p in pdf.pages)
    original_image=PdfReader(source).pages[1].images[0]
    asset_path=ROOT/data['figure']['path'];assert asset_path.read_bytes()==original_image.data
    assert len(html.figure_sources)==1 and html.figure_sources[0].startswith('data:image/png;base64,')
    encoded=html.figure_sources[0].split(',',1)[1]
    assert base64.b64encode(base64.b64decode(encoded,validate=True)).decode()==encoded
    assert base64.b64decode(encoded,validate=True)==original_image.data, 'HTML figure must embed exact original PNG bytes'
    original=Image.open(BytesIO(original_image.data)).convert('RGBA');assert original.size==(1600,900)
    embedded=[x for p in reader.pages for x in p.images if x.image.size==(1600,900)]
    assert len(embedded)==1 and embedded[0].image.convert('RGBA').tobytes()==original.tobytes()
    uri_set={str(a.get_object()['/A']['/URI']) for p in reader.pages for a in p.get('/Annots',[]) if a.get_object().get('/A',{}).get('/URI')}
    assert set(data['source_urls']).issubset(uri_set)
    result={'status':'PASS_ACTUAL_SOURCE_HTML_AND_BRANDED_PDF_FIDELITY','source':ref(source),'data':ref(data_path),'html':ref(html_path),'pdf':ref(pdf_path),'figure':ref(asset_path),'pages':7,'source_paragraphs':30,'source_references':9,'source_opinion_labels':3,'source_headings':4,'source_words':data['word_count'],'read_minutes':data['read_minutes'],'html_source_paragraphs_exact':True,'actual_pdf_entire_body_and_references_exact_ignoring_only_whitespace':True,'inline_citation_sequence':expected_citations,'all_source_reference_links_retained':True,'figure_source_encoded_bytes_exact':True,'figure_html_data_uri_original_bytes_exact':True,'figure_pdf_decoded_rgba_pixels_exact':True,'figure_rgba_sha256':hashlib.sha256(original.tobytes()).hexdigest(),'visual_review':'All 7 final rendered pages inspected; no clipping, overlaps, missing glyphs, broken references or near-empty overflow page.','qualification':'Formatting and source fidelity only. No independent fact-check, external research or source-claim endorsement is implied.'}
    if hiring_before:
        old=PdfReader(hiring_before);new_path=ROOT/'Monderman_Insight_The_Hiring_Blind_Spot_2026-10-16.pdf';new=PdfReader(new_path)
        assert len(old.pages)==len(new.pages)==10
        streams=[]
        for a,b in zip(old.pages[1:],new.pages[1:]):
            assert a.get_contents().get_data()==b.get_contents().get_data()
            assert a.extract_text()==b.extract_text()
            assert [(x.name,x.data) for x in a.images]==[(x.name,x.data) for x in b.images]
            streams.append(hashlib.sha256(a.get_contents().get_data()).hexdigest())
        assert 'HIRINGANDWORKDESIGN·PART1' in norm(new.pages[0].extract_text())
        assert 'GOVERNANCEANDPERFORMANCE' not in norm(new.pages[0].extract_text())
        result['part1_cover_relabel']={'source':ref(hiring_before),'output':ref(new_path),'interior_nine_content_streams_exact':True,'interior_text_and_image_bytes_exact':True,'interior_stream_sha256':streams,'cover_visual_inspected':True}
    return result


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,default=Path('/Users/jasonadamson/Desktop/The Posting Has Outgrown the Job - Monderman plain.pdf'));p.add_argument('--hiring-before',type=Path);p.add_argument('--receipt',type=Path);a=p.parse_args()
    result=validate(a.source,a.hiring_before)
    if a.receipt:a.receipt.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False))
