#!/usr/bin/env python3
from pathlib import Path
from xml.sax.saxutils import escape
import sys

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "Monderman_Brief_The_Culture_Trap.pdf"
FONT_DIR = ROOT / "pdf-src" / "fonts"
pdfmetrics.registerFont(TTFont("Haas", FONT_DIR / "NeueHaasGroteskText-Roman.ttf"))
pdfmetrics.registerFont(TTFont("Haas-Medium", FONT_DIR / "NeueHaasGroteskText-Medium.ttf"))
pdfmetrics.registerFont(TTFont("Haas-Bold", FONT_DIR / "NeueHaasGroteskText-Bold.ttf"))

W, H = letter
INK = HexColor("#172226"); MUTED = HexColor("#657174"); PAPER = HexColor("#FBFBF9")
TEAL = HexColor("#0C6E78"); DARK = HexColor("#0B3D43"); PALE = HexColor("#E6F0EF")
LINE = HexColor("#D9DFDC"); SAND = HexColor("#F2EFE8"); GOLD = HexColor("#C9821F")
M = 58

BODY = ParagraphStyle("body", fontName="Haas", fontSize=10.35, leading=14.7, textColor=INK, spaceAfter=7)
SMALL = ParagraphStyle("small", parent=BODY, fontSize=8.35, leading=11.3, textColor=MUTED)
LEDE = ParagraphStyle("lede", parent=BODY, fontSize=14.2, leading=19.2, textColor=HexColor("#435053"))
H2 = ParagraphStyle("h2", fontName="Haas-Bold", fontSize=25.5, leading=26.5, textColor=INK)
H3 = ParagraphStyle("h3", fontName="Haas-Bold", fontSize=13.2, leading=14.2, textColor=INK)
CENTER = ParagraphStyle("center", parent=SMALL, alignment=TA_CENTER)
DARK_CENTER = ParagraphStyle("dark-center", parent=CENTER, textColor=HexColor("#D7E4E4"))

def clean(text):
    return escape(text).replace("\n", "<br/>")

def paragraph(c, text, x, top, width, style=BODY):
    p = Paragraph(text, style)
    _, h = p.wrap(width, H)
    p.drawOn(c, x, top - h)
    return top - h

def footer(c, page):
    c.setStrokeColor(LINE); c.line(M, 42, W-M, 42)
    c.setFillColor(MUTED); c.setFont("Haas-Medium", 7.3)
    c.drawString(M, 28, "MONDERMAN  |  SYSTEMS MEASUREMENT")
    c.setFillColor(INK); c.setFont("Haas-Bold", 8); c.drawRightString(W-M, 28, str(page))

def page_start(c, page, kicker, title):
    c.setFillColor(PAPER); c.rect(0, 0, W, H, fill=1, stroke=0)
    footer(c, page)
    c.setFillColor(TEAL); c.setFont("Haas-Bold", 8.2); c.drawString(M, H-67, kicker.upper())
    return paragraph(c, title, M, H-92, W-2*M, H2) - 18

def box(c, x, y, w, h, fill=HexColor("#FFFFFF"), stroke=LINE):
    c.setFillColor(fill); c.setStrokeColor(stroke); c.rect(x, y, w, h, fill=1, stroke=1)

def stat(c, x, top, w, number, caption, source):
    h=142; box(c,x,top-h,w,h)
    c.setFillColor(DARK); c.setFont("Haas-Bold", 35); c.drawString(x+15,top-43,number)
    paragraph(c, caption, x+15, top-58, w-30, BODY)
    paragraph(c, source, x+15, top-113, w-30, SMALL)

def card(c, x, top, w, h, headline, label, body):
    box(c,x,top-h,w,h); c.setFillColor(TEAL); c.rect(x,top-h,3,h,fill=1,stroke=0)
    c.setFillColor(DARK); c.setFont("Haas-Bold", 20); c.drawString(x+13,top-28,headline)
    paragraph(c, label, x+13, top-40, w-26, H3)
    paragraph(c, body, x+13, top-68, w-26, SMALL)

def cover(c):
    c.setFillColor(DARK); c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(HexColor("#FFFFFF")); c.setFont("Haas-Bold",15); c.drawString(M,H-74,"M  O  N  D  E  R  M  A  N")
    c.setStrokeColor(HexColor("#8FC4C9")); c.line(M,H-92,M+52,H-92)
    c.setFont("Haas-Bold",8.5); c.drawString(M,H-190,"I N S T I T U T I O N A L   P E R F O R M A N C E   R E S E A R C H")
    c.setFont("Haas-Bold",49); c.drawString(M,H-254,"The Culture Trap")
    paragraph(c,"Why sentiment measurement can locate strain without identifying the organizational systems beneath it.",M,H-282,W-2*M,ParagraphStyle("cover-sub",fontName="Haas-Medium",fontSize=19,leading=23,textColor=HexColor("#9ED0D3")))
    paragraph(c,"A research brief on the difference between reported experience and the mechanisms through which work is organized.",M,H-370,410,ParagraphStyle("cover-dek",fontName="Haas",fontSize=12,leading=17,textColor=HexColor("#D7E4E4")))
    c.setStrokeColor(HexColor("#6E9599")); c.line(M,67,W-M,67); c.setFillColor(HexColor("#FFFFFF")); c.setFont("Haas-Bold",8.5); c.drawString(M,48,"August 2026")
    c.setFont("Haas",8); c.drawRightString(W-M,48,"connect@monderman.com  |  www.monderman.com")
    c.showPage()

def executive(c):
    y=page_start(c,2,"Executive summary","Experience is evidence. It is not the whole mechanism.")
    y=paragraph(c,"Sentiment measurement can show where people experience strain. A culture or sentiment score does not, by itself, identify the organizational mechanisms producing the condition.",M,y,W-2*M,LEDE)-22
    gap=14; cw=(W-2*M-gap)/2; ch=128
    for i,(head,copy) in enumerate([
        ("Reported experience","Engagement, morale, confidence, and other self-reported scores locate where attention may be needed."),
        ("Operating structure","Ownership, authority, handoffs, routing, process load, and performance discipline show how the system is arranged.")]):
        x=M+i*(cw+gap); box(c,x,y-ch,cw,ch); c.setFillColor(TEAL); c.rect(x,y-ch,cw,3,fill=1,stroke=0)
        paragraph(c,head,x+15,y-18,cw-30,ParagraphStyle("sumh",fontName="Haas-Bold",fontSize=16,leading=17,textColor=INK))
        paragraph(c,copy,x+15,y-50,cw-30,BODY)
    y-=ch+22; c.setFillColor(DARK); c.rect(M,y-132,W-2*M,132,fill=1,stroke=0)
    c.setFillColor(HexColor("#9ED0D3")); c.setFont("Haas-Bold",8); c.drawString(M+18,y-25,"S Y S T E M S   M E A S U R E M E N T")
    paragraph(c,"Systems Measurement is Monderman's term for examining the organizational mechanisms people work within rather than measuring only how they feel about working inside them.",M+18,y-42,W-2*M-36,ParagraphStyle("def",fontName="Haas-Medium",fontSize=15,leading=20,textColor=HexColor("#FFFFFF")))
    y-=156; y=paragraph(c,"The distinction is complementary. Sentiment information has value. It can locate reported strain. It was not designed, by itself, to identify the operating mechanisms beneath that strain. Systems Measurement examines that second layer.",M,y,W-2*M,BODY)-14
    box(c,M,y-71,W-2*M,71,PALE,PALE); paragraph(c,"<b>The central contrast</b><br/>Sentiment measurement shows where people experience strain. Systems Measurement examines the organizational systems beneath that experience.",M+16,y-14,W-2*M-32,BODY)
    c.showPage()

def scoreboard(c):
    y=page_start(c,3,"01  |  The scoreboard","Global engagement rose, then fell in 2024 and 2025.")
    gap=14; sw=(W-2*M-gap)/2; stat(c,M,y,sw,"20%","Share of employees worldwide engaged at work in 2025. The lowest global level since 2020.","Gallup, State of the Global Workplace 2026.")
    stat(c,M+sw+gap,y,sw,"$438B","Estimated lost productivity attributed by Gallup to the global engagement decline in 2024.","Gallup, State of the Global Workplace 2025.")
    y-=163; y=paragraph(c,"Organizations have measured employee sentiment at global scale for more than fifteen years. Global engagement rose substantially over the longer trend before falling in both 2024 and 2025. The measurement tools located the change in reported experience. The score alone did not identify which operating mechanisms sat beneath it.",M,y,W-2*M,BODY)-13
    y=paragraph(c,"What controlled trials show",M,y,W-2*M,H3)-7
    y=paragraph(c,"Programs designed to increase engagement have been tested in controlled trials. A 2017 meta-analysis found a small positive average effect on self-reported work engagement. A later meta-analysis of 54 controlled trials found a similarly small effect. These studies evaluated engagement outcomes. They did not establish that increasing the score caused better operating results.",M,y,W-2*M,BODY)-16
    gap=9; cw=(W-2*M-gap*2)/3
    items=[("g = 0.29","2017 meta-analysis","Small positive average effect on self-reported work engagement."),("d = 0.24","54 controlled trials","A later review found another small positive average effect."),("Boundary","Engagement outcome","The studies did not establish that increasing engagement scores caused better operating results.")]
    for i,it in enumerate(items): card(c,M+i*(cw+gap),y,cw,142,*it)
    c.showPage()

def values(c):
    y=page_start(c,4,"02  |  Values and management practice","Stated values and operating practice are different evidence.")
    y=paragraph(c,"A study of corporate values found no correlation between advertised values and profitability. Employee perceptions of management integrity were positively associated with productivity, profitability, and other performance measures.",M,y,W-2*M,BODY)-17
    gap=50; cw=(W-2*M-gap)/2; top=y; h=142
    for i,(head,lines) in enumerate([("Advertised values",["Public statements","Declared principles","No correlation with profitability in the cited study"]),("Management integrity",["Employee perceptions","Observed consistency","Positive association with several performance measures"]) ]):
        x=M+i*(cw+gap); box(c,x,top-h,cw,h); paragraph(c,head,x+15,top-18,cw-30,ParagraphStyle("vh",fontName="Haas-Bold",fontSize=16,leading=17,textColor=TEAL)); paragraph(c,"<br/>".join("• "+z for z in lines),x+15,top-54,cw-30,BODY)
    c.setStrokeColor(TEAL); c.setLineWidth(2); c.line(M+cw+8,top-72,M+cw+gap-8,top-72); c.line(M+cw+gap-14,top-78,M+cw+gap-8,top-72); c.line(M+cw+gap-14,top-66,M+cw+gap-8,top-72)
    y-=h+20; y=paragraph(c,"A separate research program measured management practices directly, including monitoring, targets, and accountability. Those practices were strongly associated with productivity, profitability, and firm survival. In a randomized trial, firms that adopted better management practices raised productivity by 17 percent in the first year. A nine-year follow-up found that a large and significant management-practice gap remained between treatment and control plants.",M,y,W-2*M,BODY)-15
    stat(c,M,y,sw:=(W-2*M-14)/2,"+17%","First-year productivity increase in the randomized management-practices trial.","This was productivity, not profitability.")
    stat(c,M+sw+14,y,sw,"~1/4","Estimated share of measured total-factor-productivity gaps accounted for by management practices.","Within and across countries.")
    paragraph(c,"The nine-year follow-up also found that approximately half of the adopted practices had been dropped. It did not establish that the first-year productivity effect persisted for nine years.",M,y-157,W-2*M,SMALL)
    c.showPage()

def layers(c):
    y=page_start(c,5,"03  |  Two measurement layers","From reported strain to the system beneath it.")
    gap=50; cw=(W-2*M-gap)/2; top=y; h=156
    groups=[("Sentiment measurement",["Asks how people experience work","Locates low engagement, morale, or confidence","Tracks changes in self-reported scores"]),("Systems Measurement",["Examines organizational mechanisms","Locates strain in ownership, authority, handoffs, routing, and process load","Establishes a baseline for matched remeasurement"])]
    for i,(head,lines) in enumerate(groups):
        x=M+i*(cw+gap); box(c,x,top-h,cw,h); paragraph(c,head,x+15,top-18,cw-30,ParagraphStyle("lh",fontName="Haas-Bold",fontSize=15,leading=16,textColor=TEAL)); paragraph(c,"<br/>".join("• "+z for z in lines),x+15,top-53,cw-30,BODY)
    c.setStrokeColor(TEAL); c.setLineWidth(2); c.line(M+cw+8,top-78,M+cw+gap-8,top-78); c.line(M+cw+gap-14,top-84,M+cw+gap-8,top-78); c.line(M+cw+gap-14,top-72,M+cw+gap-8,top-78)
    y-=h+22; c.setFillColor(DARK); c.rect(M,y-122,W-2*M,122,fill=1,stroke=0); c.setFillColor(HexColor("#9ED0D3")); c.setFont("Haas-Bold",8); c.drawString(M+16,y-22,"T H E   O P E R A T I N G   L A Y E R")
    labels=["Reported strain","Ownership and authority","Handoffs and routing","Process load","Performance discipline"]; ng=6; nw=(W-2*M-32-ng*4)/5
    for i,label in enumerate(labels):
        x=M+16+i*(nw+4); c.setStrokeColor(HexColor("#53777B")); c.setFillColor(HexColor("#164A50") if i==0 else DARK); c.rect(x,y-104,nw,59,fill=1,stroke=1); paragraph(c,label,x+4,y-63,nw-8,DARK_CENTER)
    y-=145; y=paragraph(c,"A low sentiment score can show where reported experience warrants attention. It cannot identify whether the condition is linked to unclear ownership, slow approvals, unstable handoffs, excess process load, or another operating mechanism. Those questions require evidence about the system itself.",M,y,W-2*M,BODY)-18
    box(c,M,y-82,W-2*M,82,SAND,SAND); c.setFillColor(GOLD); c.rect(M,y-82,4,82,fill=1,stroke=0); paragraph(c,"<b>Evidence boundary</b><br/>The studies cited here did not test Monderman's instruments. They do not establish that Monderman changes performance. They support examining management practices and organizational mechanisms alongside sentiment.",M+16,y-15,W-2*M-32,BODY)
    c.showPage()

def loop_page(c):
    y=page_start(c,6,"04  |  The measurement loop","Measure. Locate. Act. Re-measure.")
    y=paragraph(c,"Systems Measurement begins with a baseline. It reports where the organizational system shows strain. The organization acts. A later run measures the same system again.",M,y,W-2*M,LEDE)-20
    sw=(W-2*M)/4; top=y; h=100
    for i,(n,head,copy) in enumerate([("01","Measure","Establish the baseline."),("02","Locate","Identify where the system shows strain."),("03","Act","Record the response and ownership."),("04","Re-measure","Compare a compatible later run.")]):
        x=M+i*sw; box(c,x,top-h,sw,h); c.setFillColor(TEAL); c.setFont("Haas-Bold",8); c.drawString(x+11,top-20,n); paragraph(c,head,x+11,top-33,sw-22,H3); paragraph(c,copy,x+11,top-58,sw-22,SMALL)
    y-=h+24; y=paragraph(c,"What Monderman measures",M,y,W-2*M,H3)-12
    y=paragraph(c,"Research on management practices examines monitoring, targets, accountability, and the routines through which work is managed. Monderman's Diagnostics examine related organizational structures.",M,y,W-2*M,BODY)-12
    gap=9; cw=(W-2*M-gap)/2; ch=72; products=[("Operational Systems","Examines process load and operating friction."),("Decision Velocity","Examines how decisions move."),("Structural Clarity","Examines ownership, authority, and handoffs."),("Institutional Performance","Examines whether structure is converted into sustained performance.")]
    for i,(head,copy) in enumerate(products):
        row=i//2; col=i%2; x=M+col*(cw+gap); yy=y-row*(ch+9); box(c,x,yy-ch,cw,ch); c.setFillColor(TEAL); c.rect(x,yy-ch,4,ch,fill=1,stroke=0); paragraph(c,head,x+14,yy-13,cw-26,H3); paragraph(c,copy,x+14,yy-37,cw-26,SMALL)
    y-=2*(ch+9)+5; y=paragraph(c,"Depth Synthesis summarizes eligible runs of one Diagnostic. Cross-Lens Synthesis compares different Diagnostics and publishes a Composite Score only when the evidence is coherent enough to support one.",M,y,W-2*M,BODY)-12
    box(c,M,y-74,W-2*M,74,PALE,PALE); paragraph(c,"<b>Why the distinction matters</b><br/>The two forms of measurement answer different questions. Used together, they distinguish a reported symptom from the mechanisms that may sit beneath it.",M+15,y-14,W-2*M-30,BODY)
    c.showPage()

def conclusion(c):
    y=page_start(c,7,"05  |  Conclusion","Measure experience. Examine mechanisms.")
    y=paragraph(c,"Sentiment reports experience. Systems Measurement examines organizational mechanisms. The distinction is not a verdict on either category. It is a boundary between two kinds of evidence.",M,y,W-2*M,LEDE)-20
    y=paragraph(c,"Culture can affect performance, and operating conditions can shape culture. The defensible point is narrower: a culture or sentiment score does not, by itself, identify the organizational mechanisms producing the condition.",M,y,W-2*M,BODY)-18
    c.setFillColor(DARK); c.rect(M,y-118,W-2*M,118,fill=1,stroke=0); c.setFillColor(HexColor("#9ED0D3")); c.setFont("Haas-Bold",8); c.drawString(M+16,y-22,"A   C O M P L E T E   R E A D   K E E P S   B O T H   L A Y E R S   V I S I B L E")
    labels=["Experience","Structure","Decision flow","Operating load","Remeasurement"]; nw=(W-2*M-52)/5
    for i,label in enumerate(labels):
        x=M+16+i*(nw+5); c.setStrokeColor(HexColor("#53777B")); c.rect(x,y-101,nw,54,fill=0,stroke=1); paragraph(c,label,x+3,y-64,nw-6,DARK_CENTER)
    y-=142; y=paragraph(c,"Organizations can continue to use sentiment measurement to locate reported strain. Systems Measurement adds a distinct question: what mechanisms are people working within, and where does that system show strain?",M,y,W-2*M,BODY)-17
    box(c,M,y-83,W-2*M,83,SAND,SAND); c.setFillColor(GOLD); c.rect(M,y-83,4,83,fill=1,stroke=0); paragraph(c,"<b>No instrument-validation claim</b><br/>The cited studies provide evidence about engagement interventions, corporate values, management integrity, and management practices. They did not test or validate Monderman's Diagnostics.",M+16,y-15,W-2*M-32,BODY)
    y-=104; box(c,M,y-67,W-2*M,67,PALE,PALE); paragraph(c,"<b>Further reading</b><br/>Visit www.monderman.com/the-culture-trap.html for the short evidence page, the Platform Brief, and a sample report.",M+15,y-13,W-2*M-30,BODY)
    c.showPage()

def references(c):
    y=page_start(c,8,"References","Sources")
    refs=[
      "1. Gallup. <i>State of the Global Workplace: 2026 Report</i>. Gallup, Inc., 2026.",
      "2. Gallup. <i>State of the Global Workplace: 2025 Report</i>. Gallup, Inc., 2025.",
      "3. Knight, Caroline, Malcolm Patterson, and Jeremy Dawson. \"Building work engagement: A systematic review and meta-analysis investigating the effectiveness of work engagement interventions.\" <i>Journal of Organizational Behavior</i> 38 (2017): 792-812. DOI 10.1002/job.2167.",
      "4. Vîrgă, Delia, Laurențiu P. Maricuțoiu, and Alina Iancu. \"The efficacy of work engagement interventions: A meta-analysis of controlled trials.\" <i>Current Psychology</i> 40 (2021): 5863-5880. Published online 2019. DOI 10.1007/s12144-019-00438-z.",
      "5. Guiso, Luigi, Paola Sapienza, and Luigi Zingales. \"The Value of Corporate Culture.\" <i>Journal of Financial Economics</i> 117, no. 1 (2015): 60-76. DOI 10.1016/j.jfineco.2014.05.010.",
      "6. Bloom, Nicholas, Benn Eifert, Aprajit Mahajan, David McKenzie, and John Roberts. \"Does Management Matter? Evidence from India.\" <i>The Quarterly Journal of Economics</i> 128, no. 1 (2013): 1-51. DOI 10.1093/qje/qjs044.",
      "7. Bloom, Nicholas, Aprajit Mahajan, David McKenzie, and John Roberts. \"Do Management Interventions Last? Evidence from India.\" <i>American Economic Journal: Applied Economics</i> 12, no. 2 (2020): 198-219. DOI 10.1257/app.20180369.",
      "8. Bloom, Nicholas, and John Van Reenen. \"Measuring and Explaining Management Practices Across Firms and Countries.\" <i>The Quarterly Journal of Economics</i> 122, no. 4 (2007): 1351-1408. DOI 10.1162/qjec.2007.122.4.1351.",
      "9. Bloom, Nicholas, Renata Lemos, Raffaella Sadun, Daniela Scur, and John Van Reenen. \"The New Empirical Economics of Management.\" <i>Journal of the European Economic Association</i> 12, no. 4 (2014): 835-876. DOI 10.1111/jeea.12094."
    ]
    gap=18; cw=(W-2*M-gap)/2; cols=[refs[:5],refs[5:]]
    for col,items in enumerate(cols):
        yy=y; x=M+col*(cw+gap)
        for ref in items:
            yy=paragraph(c,ref,x,yy,cw,SMALL)-10
    box(c,M,110,W-2*M,83,PALE,PALE); paragraph(c,"<b>Research note</b><br/>This paper synthesizes published research. It does not report an original empirical test of Monderman's instruments. Effect sizes and study outcomes are stated within the boundaries of the cited work.",M+15,176,W-2*M-30,BODY)
    c.showPage()

def build():
    c=Canvas(str(OUT),pagesize=letter,pageCompression=1)
    c.setTitle("The Culture Trap"); c.setAuthor("Monderman"); c.setSubject("Systems Measurement and sentiment measurement")
    cover(c); executive(c); scoreboard(c); values(c); layers(c); loop_page(c); conclusion(c); references(c); c.save()

if __name__ == "__main__": build()
