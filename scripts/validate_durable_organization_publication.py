#!/usr/bin/env python3
"""Full supplied-source, PDF and actual six-part publication release gate.

Uses an independent extraction of the original PDF, not a regenerated source
fixture. It never calls a service or changes any publication artifact.
"""
from collections import Counter
from copy import deepcopy
from hashlib import sha256
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
import argparse
import json
import logging
import re
import subprocess

import pdfplumber
from pypdf import PdfReader
from durable_publication_20261007_inverse import source_at_durable_publication_baseline

ROOT = Path(__file__).resolve().parents[1]
BASELINE = '74bcf2e86cf7829e2d4aaa5f83ade90b6b6ffaad'
PDF = 'Monderman_Insight_The_Durable_Organization_2026-10-07.pdf'
SLUG = 'durable-organization.html'
HOLD = 'Monderman_Insight_Hold_Collide_Come_Apart_2026-10-01.pdf'
SOURCE_SHA = 'dd0f951b5b96a722f9bd42a379cac76a2c57cc7267875b06536296964b48379f'
SOURCE_FIXTURE_SHA = 'f1938ca731515030bcfe593811a5bfedba7353213f6eb1723fd2ac8752e97a2b'
logging.getLogger('pdfminer').setLevel(logging.ERROR)

def compact(text):
    return re.sub(r'\s', '', text)

class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values, self.links, self.ids = [], [], []
    def handle_data(self, value):
        self.values.append(value)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a':
            self.links.append(attrs.get('href', ''))
        if attrs.get('id'):
            self.ids.append(attrs['id'])

def inspect_pdf(path):
    reader = PdfReader(path)
    result = {'metadata': dict(reader.metadata), 'pages': [], 'fonts': [], 'uris': [], 'italic_words': Counter()}
    with pdfplumber.open(path) as document:
        for page in document.pages:
            result['pages'].append({
                'text': ' '.join(line['text'] for line in page.extract_text_lines() if line['top'] < 730),
                'width': page.width, 'height': page.height,
                'chars': [(char['x0'], char['x1'], char['top'], char['bottom']) for char in page.chars],
                'folio': page.crop((500, 730, 612, 792)).extract_text() or '',
            })
        for page in document.pages[1:]:
            result['italic_words'].update(word['text'] for word in page.extract_words(extra_attrs=['fontname'])
                if word['top'] < 730 and any(fragment in word['fontname'] for fragment in ['Italic', '56It', '76BdIt']))
    for page in reader.pages:
        for ref in page.get('/Annots', []):
            action = ref.get_object().get('/A')
            if action and action.get('/S') == '/URI':
                result['uris'].append(str(action.get('/URI')))
        for ref in (page.get('/Resources') or {}).get('/Font', {}).values():
            font = ref.get_object()
            descriptor = font.get('/FontDescriptor')
            if descriptor is None and '/DescendantFonts' in font:
                descriptor = font['/DescendantFonts'][0].get_object().get('/FontDescriptor')
            name = str(font.get('/BaseFont') or (descriptor.get_object().get('/FontName') if descriptor else ''))
            embedded = font.get('/Subtype') == '/Type3' and bool(font.get('/CharProcs'))
            embedded = embedded or bool(descriptor and any(key in descriptor.get_object() for key in ['/FontFile', '/FontFile2', '/FontFile3']))
            result['fonts'].append((name, embedded))
    return result

def validate_content(data, html, pdf, source):
    checks = []
    def check(condition, label):
        assert condition, label
        checks.append(label)
    check(data['source_sha256'] == SOURCE_SHA and data['source_pages'] == 14, 'Exact original fourteen-page source identity')
    check(data['editorial_changes'] == [], 'No editorial changes')
    check(data['part'] == 5 and data['read_minutes'] == 35, 'Current Part 5 and reading time')
    check([p['number'] for p in data['paragraphs']] == list(range(1, 101)), 'All 100 source paragraphs')
    check(compact(' '.join(block['text'] for block in data['body_blocks'])) == compact(source['body_text']), 'Complete original source body, including qualifiers and headings')
    check(len(data['references']) == 19 and compact(' '.join(data['references'])) == compact(source['references_text']), 'Complete original source references in order')
    parser = Text()
    parser.feed(html)
    visible = compact(' '.join(parser.values))
    check(len(parser.ids) == len(set(parser.ids)), 'Unique HTML IDs')
    for para in data['paragraphs']:
        check(compact(para['text']) in visible, f'HTML complete paragraph {para["number"]}')
    for ref in data['references']:
        check(compact(ref) in visible, 'HTML complete reference')
    for key in ['title', 'subtitle', 'standfirst', 'biography', 'copyright']:
        check(compact(data[key]) in visible, 'HTML original ' + key)
    for link in parser.links:
        if link.startswith('#'):
            check(link[1:] in parser.ids, 'Real HTML fragment ' + link)
        elif not re.match(r'^[a-z]+:', link):
            check((ROOT / link.split('#')[0].split('?')[0]).exists(), 'Real local publication link ' + link)
    check('15 pages · 35-minute read' in html and 'Governance and Performance · Part 5' in html, 'Truthful article edition metadata')
    check(pdf['metadata'].get('/Title') == data['title'], 'PDF title identity')
    check(pdf['metadata'].get('/Author') == 'Jason Adamson', 'PDF author identity')
    check(pdf['metadata'].get('/Subject') == data['subtitle'], 'PDF subtitle identity')
    check(pdf['metadata'].get('/Keywords') == 'Governance and Performance, Part 5, organizational durability, illustrative chart', 'PDF actual series identity')
    pages = pdf['pages']
    check(len(pages) == 15, 'Actual fifteen-page published PDF')
    for number, page in enumerate(pages, 1):
        check((page['width'], page['height']) == (612, 792), f'Page {number}: US Letter')
        check(bool(page['chars']), f'Page {number}: no blank publication pages')
        check(all(59.8 <= x0 <= x1 <= 552.2 and 32 <= top <= bottom <= 763 for x0, x1, top, bottom in page['chars']), f'Page {number}: full text within print margins')
        if number > 1:
            check(str(number) in page['folio'], f'Page {number}: truthful folio')
    cover = compact(pages[0]['text'])
    check('GOVERNANCEANDPERFORMANCE·PART5' in cover, 'PDF cover actual Part 5')
    for key in ['title', 'subtitle', 'standfirst', 'author']:
        check(compact(data[key]) in cover, 'PDF cover ' + key)
    check('Monderman.' in pages[0]['text'], 'PDF current publisher wordmark')
    full = compact(' '.join(page['text'] for page in pages[1:]))
    start, end = full.find('THEBOTTOMLINE'), full.find('REFERENCES')
    check(0 <= start < end, 'PDF complete source body before separate reference pages')
    check(full[start:end] == compact(source['body_text']), 'PDF full source body equality, no missing or reordered wording')
    reference_positions = [full.find(compact(ref), end) for ref in data['references']]
    check(all(position >= 0 for position in reference_positions) and reference_positions == sorted(reference_positions), 'PDF every full reference in order')
    check(pages[12]['text'].startswith('REFERENCES'), 'PDF references begin on separate page 13')
    check(pages[14]['text'].startswith('ABOUT THE AUTHOR'), 'PDF closing author page begins separately')
    for key in ['biography', 'copyright']:
        check(compact(data[key]) in full, 'PDF original ' + key)
    figure = data['figure']
    check(figure['kind'] == 'illustrative' and figure['caption'] == 'An illustration of this paper’s argument. It is not drawn from data.', 'Original qualitative figure caveat')
    for text in [figure['title'], figure['subtitle'], figure['caption'], *figure['labels'].values()]:
        check(compact(text) in compact(source['cover_text']), 'Independent original figure wording ' + text)
        check(compact(text) in compact(pages[1]['text']), 'PDF complete qualitative figure wording ' + text)
    check(not (Counter(source['source_italic_words']) - pdf['italic_words']), 'All original italic wording retained in PDF')
    check(bool(pdf['fonts']), 'Published PDF fonts exist')
    for name, embedded in pdf['fonts']:
        check(any(part in name for part in ['NHaas', 'NeueHaas', 'NHG']), 'House font ' + name)
        check(embedded, 'Embedded publication font ' + name)
    for link in data['source_links']:
        check(link['url'] in parser.links and link['url'] in pdf['uris'], 'Original source hyperlink in HTML and PDF')
    check('localhost' not in visible + full and '127.0.0.1' not in visible + full, 'No local verification addresses')
    return len(checks)

def check_hold_renumbering():
    before = subprocess.check_output(['git', 'show', BASELINE + ':' + HOLD], cwd=ROOT)
    old, current = PdfReader(BytesIO(before)), PdfReader(ROOT / HOLD)
    assert len(old.pages) == len(current.pages) == 16, 'Hold page count retained'
    assert [sha256(p.get_contents().get_data()).hexdigest() for p in old.pages[1:]] == [sha256(p.get_contents().get_data()).hexdigest() for p in current.pages[1:]], 'All fifteen Hold body page streams byte-identical'
    metadata = dict(old.metadata)
    metadata['/Keywords'] = metadata['/Keywords'].replace('Part 5', 'Part 6')
    assert dict(current.metadata) == metadata, 'Hold metadata changes only Part 5 to Part 6'
    assert 'PART6' in compact(current.pages[0].extract_text()), 'Actual Hold cover Part 6'
    html = (ROOT / 'hold-collide-come-apart.html').read_text()
    assert 'Governance and Performance · Part 6' in html, 'Actual Hold HTML Part 6'
    old_data = json.loads(subprocess.check_output(['git', 'show', BASELINE + ':pdf-src/hold-collide-come-apart.json'], cwd=ROOT))
    old_data['part'] = 6
    assert json.loads((ROOT / 'pdf-src/hold-collide-come-apart.json').read_text()) == old_data, 'Hold source changes only part number'
    return 6

def check_python_inverse():
    fixture = json.loads((ROOT / 'scripts/fixtures/durable-organization-publication-20261007.json').read_text())
    checks = 0
    for file in fixture['files']:
        current = (ROOT / file).read_bytes()
        before = subprocess.check_output(['git', 'show', BASELINE + ':' + file], cwd=ROOT)
        assert source_at_durable_publication_baseline(file, current) == before, file + ': exact Python inverse equals immutable Git source'
        assert source_at_durable_publication_baseline(file, current.decode()) == before.decode(), file + ': inverse retains text type'
        assert source_at_durable_publication_baseline(file, before) == before, file + ': no double inversion'
        mutant = current + b'\nUNREVIEWED\n'
        assert source_at_durable_publication_baseline(file, mutant) == mutant, file + ': unfamiliar Python input remains visible'
        checks += 4
    return checks

def main(source_path=None):
    fixture_bytes = (ROOT / 'scripts/fixtures/durable-organization-source-20261007.json').read_bytes()
    assert sha256(fixture_bytes).hexdigest() == SOURCE_FIXTURE_SHA, 'Independent supplied-source fixture remains immutable'
    source = json.loads(fixture_bytes)
    if source_path:
        assert sha256(source_path.read_bytes()).hexdigest() == SOURCE_SHA, 'Original supplied PDF bytes'
        original = PdfReader(source_path)
        pages = [re.sub(r'The Durable Organization\s*·\s*October 2026\s*\d+\s*$', '', p.extract_text()) for p in original.pages]
        assert len(pages) == 14
        assert compact(' '.join(pages[1:12])) == compact(source['body_text']), 'Independent fixture equals original PDF body'
        refs = '\n'.join(pages[12:]).split('About the author')[0]
        refs = re.sub(r'(?m)^(?:[1-9]|1[0-9])\.?\s*$', '', refs)
        refs = re.sub(r'^References\s*', '', refs)
        assert compact(refs) == compact(source['references_text']), 'Independent fixture equals original PDF references'
    data = json.loads((ROOT / 'pdf-src/the-durable-organization.json').read_text())
    html = (ROOT / SLUG).read_text()
    inspected = inspect_pdf(ROOT / PDF)
    checks = validate_content(data, html, inspected, source) + check_hold_renumbering() + check_python_inverse()
    negatives = 0
    mutations = [
        ('wrong PDF author', lambda d,p: p['metadata'].__setitem__('/Author', 'Other author')),
        ('wrong PDF series', lambda d,p: p['metadata'].__setitem__('/Keywords', 'Part 6')),
        ('missing PDF page', lambda d,p: p['pages'].pop()),
        ('wrong PDF page geometry', lambda d,p: p['pages'][4].__setitem__('width', 595)),
        ('clipped PDF text', lambda d,p: p['pages'][4]['chars'].append((20,40,61,75))),
        ('missing PDF paragraph', lambda d,p: p['pages'][3].__setitem__('text', p['pages'][3]['text'].replace(d['paragraphs'][15]['text'], ''))),
        ('altered PDF source caveat', lambda d,p: p['pages'][2].__setitem__('text', p['pages'][2]['text'].replace('The record does not support that.', 'The record proves that.'))),
        ('missing PDF reference', lambda d,p: p['pages'][13].__setitem__('text', p['pages'][13]['text'].replace(d['references'][18], ''))),
        ('missing original source URL', lambda d,p: p['uris'].clear()),
        ('missing original italic', lambda d,p: p['italic_words'].clear()),
        ('unembedded publication font', lambda d,p: p['fonts'].__setitem__(0, (p['fonts'][0][0], False))),
        ('data claim in illustration', lambda d,p: d['figure'].__setitem__('kind', 'measured')),
    ]
    for label, mutate in mutations:
        changed_data, changed_pdf = deepcopy(data), deepcopy(inspected)
        mutate(changed_data, changed_pdf)
        assert changed_data != data or changed_pdf != inspected, label + ': real mutation'
        try:
            validate_content(changed_data, html, changed_pdf, source)
        except AssertionError:
            negatives += 1
        else:
            raise AssertionError('Release guard accepted ' + label)
    print(json.dumps({'passed': True, 'checks': checks, 'negativeControls': negatives, 'sourcePages':14,
        'publishedPages':15, 'paragraphs':100, 'references':19, 'sections':6, 'qualitativeFigures':1,
        'holdUnchangedBodyPageStreams':15, 'actualHoldPart':6, 'networkCalls':0, 'productionWrites':0}, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path)
    main(parser.parse_args().source)
