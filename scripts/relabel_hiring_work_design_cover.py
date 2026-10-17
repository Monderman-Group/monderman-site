#!/usr/bin/env python3
"""Update Part 1's cover series metadata without touching its nine interior streams."""
from pathlib import Path
from io import BytesIO
import argparse
import hashlib
import json

from pypdf import PdfReader, PdfWriter
from reportlab import rl_config
from apply_publication_house_style import Publication, register_fonts, make_cover, ROMAN

ROOT=Path(__file__).resolve().parents[1]
FILENAME='Monderman_Insight_The_Hiring_Blind_Spot_2026-10-16.pdf'


def relabel(source,output,receipt_path):
    source_bytes=source.read_bytes();reader=PdfReader(BytesIO(source_bytes))
    assert len(reader.pages)==10
    text=''.join(reader.pages[0].extract_text().split())
    assert 'GOVERNANCEANDPERFORMANCE·PART7' in text
    subtitle='The more exactly a company describes the person it wants, the less it can tell whether it got one. The only part of hiring that still knows was never written down.'
    assert reader.metadata['/Subject']==subtitle
    interior=[hashlib.sha256(p.get_contents().get_data()).hexdigest() for p in reader.pages[1:]]
    register_fonts();rl_config.canvas_basefontname=ROMAN
    pub=Publication(FILENAME,'HIRING AND WORK DESIGN · PART 1','The Hiring Blind Spot',subtitle,'','October 16, 2026',0,())
    writer=PdfWriter();writer.append(PdfReader(BytesIO(make_cover(pub))))
    for p in reader.pages[1:]:writer.add_page(p)
    metadata=dict(reader.metadata);metadata['/Keywords']='Hiring and Work Design, Part 1, Insight, hiring';writer.add_metadata(metadata)
    with output.open('wb') as handle:writer.write(handle)
    actual=PdfReader(output)
    assert interior==[hashlib.sha256(p.get_contents().get_data()).hexdigest() for p in actual.pages[1:]]
    cover=''.join(actual.pages[0].extract_text().split())
    assert 'HIRINGANDWORKDESIGN·PART1' in cover and 'GOVERNANCEANDPERFORMANCE' not in cover and 'PART7' not in cover
    for old,new in zip(reader.pages[1:],actual.pages[1:]):
        assert old.extract_text()==new.extract_text()
        assert [(x.name,x.data) for x in old.images]==[(x.name,x.data) for x in new.images]
    receipt={'status':'PASS_MINIMAL_COVER_SERIES_RELABEL_NINE_INTERIORS_EXACT','source':str(source),'source_sha256':hashlib.sha256(source_bytes).hexdigest(),'output':str(output),'output_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'pages':10,'interior_content_stream_sha256':interior,'interior_text_and_image_bytes_equal':True,'cover_policy':'Rebuilt with identical original house cover arguments except category/part. Old category is removed from searchable text, not painted over. Title, subtitle, author, date, grid and typography retained.','new_category':'HIRING AND WORK DESIGN · PART 1','metadata_change':'Keywords follow approved series and part.'}
    receipt_path.write_text(json.dumps(receipt,indent=2)+'\n');return receipt


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,default=ROOT/FILENAME);p.add_argument('--receipt',type=Path,required=True);a=p.parse_args()
    print(json.dumps(relabel(a.source,a.output,a.receipt)))
