#!/usr/bin/env python3
"""Apply the approved September 24 publication corrections without reflowing other pages.

Inputs are preserved in tmp/pdfs/publication-copy-20260924/source. Outputs go to
output/pdf/copy-review for visual review before replacing the public editions.
Requires PyMuPDF and ReportLab. This is an explicit edition correction, not a
generic PDF rewriter; unexpected input text causes failure.
"""
from pathlib import Path
from io import BytesIO
from xml.sax.saxutils import escape
import shutil
import pymupdf as fitz
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'tmp/pdfs/publication-copy-20260924/source'
OUT = ROOT / 'output/pdf/copy-review'
FONT_DIR = ROOT / 'pdf-src/fonts'
for name, suffix in [('CopyRoman', 'Roman'), ('CopyBold', 'Bold')]:
    pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / f'NeueHaasGroteskText-{suffix}.ttf')))

MERIT = 'Monderman_Insight_Merit_After_the_Machine_2026-09-02.pdf'
BUILT = 'Monderman_Insight_Built_to_Please_2026-09-02.pdf'
CULTURE = 'Monderman_Brief_The_Culture_Trap.pdf'
HEALTH = 'Monderman_Brief_Quarter_Trillion_Dollar_Friction_US_Healthcare.pdf'

def open_original(name):
    SOURCE.mkdir(parents=True, exist_ok=True)
    path = SOURCE / name
    if not path.exists():
        shutil.copyfile(ROOT / name, path)
    return fitz.open(path)

def paragraph_overlay(text, rect, size=10, leading=15.2, color='#14181B', bold=False, bold_prefix=None):
    """Place text within a fixed checked rectangle, using the site's NHG fonts."""
    rect = fitz.Rect(rect)
    stream = BytesIO()
    c = canvas.Canvas(stream, pagesize=(612, 792))
    style = ParagraphStyle('copy', fontName='CopyBold' if bold else 'CopyRoman', fontSize=size,
                           leading=leading, textColor=HexColor(color), splitLongWords=False)
    content=escape(text)
    if bold_prefix:
        assert text.startswith(bold_prefix)
        content='<font name="CopyBold">'+escape(bold_prefix)+'</font>'+escape(text[len(bold_prefix):])
    p = Paragraph(content, style)
    _, height = p.wrap(rect.width, rect.height)
    if height > rect.height:
        raise RuntimeError(f'Text does not fit ({height} > {rect.height}): {text[:80]}')
    p.drawOn(c, rect.x0, 792 - rect.y0 - height)
    c.save()
    return fitz.open(stream=stream.getvalue(), filetype='pdf')

def replace(page, rect, text, old, *, size=10, leading=15.2, color='#14181B', fill=(1,1,1), bold_prefix=None):
    rect = fitz.Rect(rect)
    if old not in page.get_text('text', clip=rect):
        raise RuntimeError(f'Expected old text not found on page {page.number + 1}: {old}')
    page.add_redact_annot(rect, fill=fill)
    page.apply_redactions(images=0, graphics=0)
    if text:
        overlay = paragraph_overlay(text, rect, size, leading, color, bold_prefix=bold_prefix)
        page.show_pdf_page(page.rect, overlay, 0)

def save(doc, name):
    OUT.mkdir(parents=True, exist_ok=True)
    doc.save(OUT / name, garbage=4, deflate=True)

def culture_conclusion():
    stream=BytesIO(); c=canvas.Canvas(stream,pagesize=(612,792))
    c.setFillColor(HexColor('#FBFBF9'));c.rect(0,0,612,792,fill=1,stroke=0)
    c.setFillColor(HexColor('#0C6E78'));c.setFont('CopyBold',8.2);c.drawString(58,725,'05 | CONCLUSION')
    def para(text,x,top,width,size=10,leading=14.7,color='#172226',bold=False):
        s=ParagraphStyle('culture',fontName='CopyBold' if bold else 'CopyRoman',fontSize=size,leading=leading,textColor=HexColor(color))
        p=Paragraph(text,s);_,h=p.wrap(width,700);p.drawOn(c,x,792-top-h);return top+h
    y=para('Measure experience. Examine mechanisms.',58,98,496,20.5,26.5,bold=True)+20
    y=para('Culture can affect performance, and operating conditions can shape culture. Use sentiment measurement to locate reported strain, then examine ownership, decisions, handoffs, and process load to understand what may be producing it.',58,y,496,11.5,17.5,color='#435053')+24
    # Keep the existing five-part diagram, but eliminate repeated prose around it.
    top=y;c.setFillColor(HexColor('#0B3D43'));c.rect(58,792-top-118,496,118,fill=1,stroke=0)
    c.setFillColor(HexColor('#9ED0D3'));c.setFont('CopyBold',8)
    c.drawString(74,792-top-23,'A COMPLETE READ KEEPS BOTH LAYERS VISIBLE')
    labels=['Experience','Structure','Decision flow','Operating load','Remeasurement']; nw=88.8
    for i,label in enumerate(labels):
        x=74+i*(nw+5);c.setStrokeColor(HexColor('#53777B'));c.rect(x,792-top-101,nw,54,fill=0,stroke=1)
        c.setFillColor(HexColor('#D7E4E4'));c.setFont('CopyRoman',8.35)
        c.drawCentredString(x+nw/2,792-top-73,label)
    y=top+142
    c.setFillColor(HexColor('#F2EFE8'));c.rect(58,792-y-83,496,83,fill=1,stroke=0)
    c.setFillColor(HexColor('#C9821F'));c.rect(58,792-y-83,4,83,fill=1,stroke=0)
    para('<b>No instrument-validation claim</b><br/>The cited studies provide evidence about engagement interventions, corporate values, management integrity, and management practices. They did not test or validate Monderman\'s Diagnostics.',74,y+15,464)
    y+=105;c.setFillColor(HexColor('#E6F0EF'));c.rect(58,792-y-67,496,67,fill=1,stroke=0)
    para('<b>Further reading</b><br/>Visit www.monderman.com/the-culture-trap.html for the short evidence page, the Platform Brief, and a sample report.',73,y+13,466)
    c.setFillColor(HexColor('#657174'));c.setFont('CopyRoman',8);c.drawString(58,45,'August 2026')
    c.setFillColor(HexColor('#172226'));c.setFont('CopyBold',8);c.drawRightString(554,45,'7');c.save()
    return fitz.open(stream=stream.getvalue(),filetype='pdf'), top

def build():
    d=open_original(MERIT)
    replace(d[9],(59.5,495,552,589),
      'What can be checked is the present, and for an institution the checking has a shape. Any leadership team, this quarter, can ask a short list of questions and follow the answers.',
      'What can be checked')
    save(d,MERIT)
    d=open_original(BUILT)
    replace(d[9],(59.5,110.5,552,171),
      'All of this costs money and time. The plain chat window stays faster, cheaper, and friendlier. For questions that are low on all four factors, the window is fine. The controls are for the questions where something rides on the answer. The final control needs closer attention: the person who owns the decision.',
      'All of this costs')
    save(d,BUILT)
    d=open_original(CULTURE)
    replace(d[1],(57,600,555,684),'','The central contrast',fill=(251/255,251/255,249/255))
    # Remove the now-empty callout's rectangle too, while preserving all other artwork.
    d[1].draw_rect(fitz.Rect(57,600,555,684),color=None,fill=(251/255,251/255,249/255),overlay=True)
    replacement,chart_top=culture_conclusion()
    d.delete_page(6);d.insert_pdf(replacement,from_page=0,to_page=0,start_at=6)
    replace(d[8],(59,258,553,315),
      'Monderman builds organizational diagnostics that collect structured responses about ownership, decisions, administrative burden, and institutional performance. Its versioned scoring system is separate from the AI explanation of completed results.',
      'Monderman is an institutional',size=8.6,leading=12.9)
    save(d,CULTURE)
    print(f'Culture figure 9 crop top={chart_top:.2f}, bottom={chart_top+118:.2f}')
    d=open_original(HEALTH)
    replace(d[1],(74.13,293,541,339),
      'Prior authorization uses about 14 hours of combined physician and staff time per physician per week (AMA, 2022). Less than half of physician work time reaches patients directly. These demands can delay treatment, increase burnout, and reduce capacity for care.',
      'Physicians and staff',size=9.3,leading=13.9)
    replace(d[5],(59,566.5,552,631),
      "The AMA's 2022 survey found that 88 percent of physicians rated prior authorization burden high or extremely high. Practices completed 45 requests per physician per week, using about 14 hours of combined physician and staff time. Ninety-four percent reported delayed care; 33 percent reported a serious adverse event for a patient.",
      'The AMA')
    replace(d[7],(156.5,343,253,383),
      '14 hours/week of combined physician and staff time per physician',
      '14+',size=8.6,leading=10.3)
    replace(d[7],(59,621,552,670),
      'Prior authorization reform targets about 14 hours per week of combined physician and staff effort per physician. First step: gold-card exemptions for high-approval-rate providers. Measure: requests per physician per week. Risk: utilization may rise without safeguards.',
      'Prior authorization reform',leading=14.7,bold_prefix='Prior authorization reform')
    replace(d[8],(59,308,552,372),
      'Administrative complexity is the largest single category of healthcare waste, at $266 billion annually by the most rigorous available estimate. The cited survey puts prior authorization at about 14 hours of combined physician and staff effort per physician per week. Complexity persists because it is profitable for multiple parties, even as it reduces capacity to deliver care.',
      'Administrative complexity')
    save(d,HEALTH)
    for name in [MERIT,BUILT,CULTURE,HEALTH]:print(OUT/name)

if __name__=='__main__':build()
