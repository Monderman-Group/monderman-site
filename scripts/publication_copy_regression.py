#!/usr/bin/env python3
"""Read-only regression coverage for the approved September 24 publication repairs."""
from html import unescape
from pathlib import Path
import re
import pdfplumber
from build_publication_html_editions import PUBLICATIONS, extract_blocks, extract_references, normalize_text

ROOT=Path(__file__).resolve().parents[1]
publications={p.slug:p for p in PUBLICATIONS}

def html(slug):
    return unescape((ROOT/f'{slug}.html').read_text())

def pdf_text(slug):
    with pdfplumber.open(ROOT/publications[slug].pdf) as doc:
        return normalize_text(' '.join(p.extract_text() or '' for p in doc.pages))

def extracted(slug):
    pub=publications[slug]
    with pdfplumber.open(ROOT/pub.pdf) as doc:
        return extract_blocks(doc,pub),extract_references(doc,pub)

body,_=extracted('the-art-of-interior-reasoning')
body=' '.join(b.get('text','') for b in body)
for text in ['Claims draw on research in decision theory, organizational behavior, and cognitive psychology.',
             'what the organization becomes over time.']:
    assert text in body and text in html('the-art-of-interior-reasoning'),text
for slug,expected,count in [
    ('from-tokens-to-outcomes','How 100 Enterprise CIOs Are Building and Buying Gen AI in 2025.',17),
    ('quarter-trillion-friction-us-healthcare','1586–1594.',13),
    ('when-bureaucracy-became-the-obstacle','149–164.',10),
]:
    _,refs=extracted(slug)
    assert len(refs)==count,(slug,len(refs))
    assert any(expected in r for r in refs),(slug,expected)
    assert expected in html(slug),(slug,expected)

defense=html('accumulated-drag-department-of-war')
for bad in ['N ot','I t illustrates','like-forlike','like - for - like']:
    assert bad not in defense,bad
assert 'Not a like-for-like cohort comparison.' in defense
assert normalize_text('N ot a like - for - like comparison. I t illustrates a like-forlike comparison.')=='Not a like-for-like comparison. It illustrates a like-for-like comparison.'

for slug in ['merit-after-the-machine','built-to-please','the-culture-trap-brief','quarter-trillion-friction-us-healthcare']:
    assert '?v=20260924-copy' in html(slug),slug
merit=pdf_text('merit-after-the-machine')
assert merit.count('Where is polished output being mistaken for understanding?')==1
assert html('merit-after-the-machine').count('Where is polished output being mistaken for understanding?')==1
built=pdf_text('built-to-please')
assert 'one thing is still missing from the list' not in built
assert 'The final control needs closer attention: the person who owns the decision.' in built
culture=pdf_text('the-culture-trap-brief')
assert 'The central contrast' not in culture
assert 'Use sentiment measurement to locate reported strain' in culture
assert 'They did not test or validate Monderman' in culture
assert 'limited interview' not in html('the-culture-trap-brief')
assert 'Its versioned scoring system is separate from the AI explanation of completed results.' in culture
health=pdf_text('quarter-trillion-friction-us-healthcare')
assert health.count('combined physician and staff')==4,health.count('combined physician and staff')
with pdfplumber.open(ROOT/publications['quarter-trillion-friction-us-healthcare'].pdf) as doc:
    cell=normalize_text(doc.pages[7].crop((156.5,343,253,383)).extract_text())
    assert 'combined physician and staff time per physician' in cell,cell
for bad in ['14+ hrs/wk','14 hours weekly on PA tasks','two full days of clinician time']:
    assert bad not in health and bad not in html('quarter-trillion-friction-us-healthcare'),bad
print('Publication copy regression passed: recovered passages, complete references, singular audit, synchronized capability wording, and consistent survey unit.')
