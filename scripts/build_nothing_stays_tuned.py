#!/usr/bin/env python3
"""Build the two approved publication treatments from one immutable essay source.

Branded: PDF_HOUSE_STYLE.md and the existing canonical cover/closing helpers.
Unbranded: the supplied September 2026 Fastest Tools PDF, using full Liberation
Sans faces, white cover, 72-point side margins, and title/date folios.
"""
from pathlib import Path
from io import BytesIO
import json, os, re
from xml.sax.saxutils import escape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether, HRFlowable
from pypdf import PdfReader, PdfWriter
from apply_publication_house_style import (Publication, register_fonts, make_cover,
    make_back, ROMAN, BOLD, BODY, draw_footer)

ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'pdf-src/nothing-stays-tuned.json').read_text())
BRANDED='Monderman_Perspective_Nothing_Stays_Tuned_2026-09-07.pdf'
UNBRANDED='Nothing_Stays_Tuned_Unbranded_2026-09-07.pdf'
BIO=('Jason Adamson is the author of <i>Governance, Bureaucracy and Organization: '
     'Stewardship, Drift, and Administrative Capacity</i> (Routledge, forthcoming). '
     'His career spans more than two decades of deep experience in intelligence '
     'analysis across the U.S. government, alongside private-sector experience at '
     'CrowdStrike and in startups. He holds an M.S. in Organization Development '
     'from Pepperdine University.')

def liberation_fonts():
    candidates=[Path(os.environ.get('MONDERMAN_LIBERATION_FONT_DIR','/nonexistent')),
        Path(os.environ.get('CODEX_PRIMARY_RUNTIME_NODE_MODULES','/nonexistent'))/'pdfjs-dist/standard_fonts',
        Path('/usr/share/fonts/truetype/liberation2'),Path('/usr/share/fonts/truetype/liberation')]
    folder=next((p for p in candidates if (p/'LiberationSans-Regular.ttf').exists()),None)
    if folder is None: raise RuntimeError('Set MONDERMAN_LIBERATION_FONT_DIR to the full Liberation Sans font directory')
    for name,suffix in [('Unbranded','Regular'),('Unbranded-Bold','Bold'),('Unbranded-Italic','Italic'),('Unbranded-BoldItalic','BoldItalic')]:
        pdfmetrics.registerFont(TTFont(name,str(folder/f'LiberationSans-{suffix}.ttf')))
    pdfmetrics.registerFontFamily('Unbranded',normal='Unbranded',bold='Unbranded-Bold',italic='Unbranded-Italic',boldItalic='Unbranded-BoldItalic')

def draw_paragraph(c,text,style,x,top,width):
    p=Paragraph(text,style);_,h=p.wrap(width,720);p.drawOn(c,x,top-h);return top-h

def unbranded_cover():
    stream=BytesIO();c=Canvas(stream,pagesize=(612,792))
    ink=HexColor('#1F2933');blue=HexColor('#3E5C76');muted=HexColor('#5C6670')
    c.setFillColor(ink);c.rect(72,727,75,3.3,fill=1,stroke=0)
    c.saveState()
    t=c.beginText(72,709);t.setFont('Unbranded-Bold',9);t.setCharSpace(2.7);t.textOut('GOVERNANCE AND PERFORMANCE');c.drawText(t)
    c.restoreState()
    title=ParagraphStyle('utitle',fontName='Unbranded-Bold',fontSize=30,leading=33.51,textColor=ink)
    sub=ParagraphStyle('usub',fontName='Unbranded',fontSize=15.5,leading=20.925,textColor=blue)
    deck=ParagraphStyle('udeck',fontName='Unbranded',fontSize=10.5,leading=16.275,textColor=muted)
    y=draw_paragraph(c,escape(DATA['title']),title,72,546,468)
    y=draw_paragraph(c,escape(DATA['subtitle']),sub,72,y-14,468)
    y=draw_paragraph(c,escape(DATA['paragraphs'][0]),deck,72,y-28,468)
    c.setFillColor(HexColor('#9AA2AB'));c.setFont('Unbranded-Bold',7.5);c.drawString(72,y-34,'B Y')
    c.setFillColor(ink);c.setFont('Unbranded',10.5);c.drawString(91,y-34,DATA['author'])
    c.setStrokeColor(HexColor('#D9DFE5'));c.setLineWidth(.7);c.line(72,83,540,83)
    c.setFillColor(muted);c.setFont('Unbranded',8.5);c.drawString(72,65,DATA['date'])
    c.showPage();c.save();return stream.getvalue()

def build_body(branded):
    stream=BytesIO();margin=60 if branded else 72
    family=ROMAN if branded else 'Unbranded';bold=BOLD if branded else 'Unbranded-Bold'
    ink=BODY if branded else HexColor('#1F2933')
    base=ParagraphStyle('body',fontName=family,fontSize=10 if branded else 9.7,
        leading=15.2 if branded else 14.55,spaceAfter=9,textColor=ink,
        allowWidows=0,allowOrphans=0,splitLongWords=False)
    refs=ParagraphStyle('refs',parent=base,fontSize=8.6 if branded else 8.4,
        leading=12.9 if branded else 12.6,spaceAfter=8,leftIndent=14,firstLineIndent=-14)
    heading=ParagraphStyle('heading',fontName=bold,fontSize=10.5 if branded else 19,
        leading=13 if branded else 23,spaceAfter=18,textColor=HexColor('#14181B') if branded else ink,keepWithNext=True)
    quote=ParagraphStyle('quote',fontName=bold if branded else 'Unbranded-BoldItalic',
        fontSize=13.2 if branded else 12.5,leading=17 if branded else 18.1,alignment=1,
        textColor=HexColor('#FFFFFF') if branded else HexColor('#3E5C76'),
        backColor=HexColor('#0C1113') if branded else None,borderPadding=18 if branded else 0,
        leftIndent=22,rightIndent=22,spaceBefore=26,spaceAfter=26)
    story=[]
    # The unbranded example carries the opening paragraph on its cover only.
    paragraphs=DATA['paragraphs'] if branded else DATA['paragraphs'][1:]
    for text in paragraphs:
        if text==DATA['paragraphs'][-2]:
            story.append(KeepTogether([Paragraph(escape(text),base),Paragraph(escape(DATA['paragraphs'][-1]),base)]));break
        story.append(Paragraph(escape(text),base))
        if text==DATA['paragraphs'][9]:story.append(Paragraph('“'+escape(DATA['pullquote'])+'”',quote))
    story.extend([PageBreak(),Paragraph('REFERENCES' if branded else 'References',heading)])
    for text in DATA['references']:story.append(Paragraph(escape(text),refs))
    if not branded:
        bio=ParagraphStyle('bio',parent=base,spaceAfter=0)
        rights=ParagraphStyle('rights',parent=base,fontSize=7.6,leading=10,textColor=HexColor('#8A94A0'))
        story.append(KeepTogether([Spacer(1,20),Paragraph('About the author',heading),Paragraph(BIO,bio),Spacer(1,22),HRFlowable(width='100%',color=HexColor('#D9DFE5'),thickness=.7),Spacer(1,7),Paragraph('© 2026 Jason Adamson. All rights reserved.',rights)]))
    def footer(c,doc):
        number=doc.page+1
        if branded:draw_footer(c,DATA['date'],number)
        else:
            c.setStrokeColor(HexColor('#D9DFE5'));c.setLineWidth(.7);c.line(72,53,540,53)
            c.setFont('Unbranded',7.6);c.setFillColor(HexColor('#8A94A0'))
            c.drawString(72,39,DATA['title']+' · '+DATA['date']);c.drawRightString(540,39,str(number))
    SimpleDocTemplate(stream,pagesize=(612,792),leftMargin=margin,rightMargin=margin,
        topMargin=60 if branded else 66,bottomMargin=67).build(story,onFirstPage=footer,onLaterPages=footer)
    return stream.getvalue()

def build():
    register_fonts();liberation_fonts()
    pub=Publication(BRANDED,'PERSPECTIVE',DATA['title'],DATA['subtitle'],DATA['paragraphs'][0],DATA['date'],0,())
    counts={}
    for branded,name in [(True,BRANDED),(False,UNBRANDED)]:
        writer=PdfWriter();writer.append(PdfReader(BytesIO(make_cover(pub) if branded else unbranded_cover())))
        writer.append(PdfReader(BytesIO(build_body(branded))))
        if branded:writer.append(PdfReader(BytesIO(make_back(pub,len(writer.pages)+1))))
        writer.add_metadata({'/Title':DATA['title'],'/Author':DATA['author'],'/Subject':DATA['subtitle'],'/Keywords':'institutional drift, governance, stewardship, Perspective'})
        with (ROOT/name).open('wb') as f:writer.write(f)
        counts[name]=len(writer.pages)
    print(json.dumps(counts))

if __name__=='__main__':build()
