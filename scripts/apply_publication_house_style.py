#!/usr/bin/env python3
"""Apply the canonical Monderman publication system to every public PDF.

The editorial body pages and figure artwork are preserved. Covers, folios,
reference headings, and closing pages are rebuilt as one coherent system.
"""

from __future__ import annotations

from dataclasses import dataclass
from copy import deepcopy
from io import BytesIO
from pathlib import Path
import argparse
import shutil
from xml.sax.saxutils import escape

from pypdf import PdfReader, PdfWriter, Transformation
from pypdf._page import PageObject
from pypdf.generic import ContentStream, FloatObject, NameObject, RectangleObject
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph

from pdf_brand_lockup import draw_header_lockup, draw_map_mark, lockup_width


ROOT = Path(__file__).resolve().parents[1]
SOURCE_BACKUP = ROOT / "tmp" / "pdfs" / "house-style-originals"
OUTPUT_DIR = ROOT / "output" / "pdf"
FONT_DIR = ROOT / "pdf-src" / "fonts"
CANONICAL_REFERENCE = ROOT / "Monderman_Insight_Built_to_Please_2026-09-02.pdf"
PAGE_W, PAGE_H = letter
MARGIN = 60.0
BODY_W = 492.0

ROMAN = "House-NHG-55"
MEDIUM = "House-NHG-65"
BOLD = "House-NHG-75"
ITALIC = "House-NHG-56"
BOLD_ITALIC = "House-NHG-76"

INK = HexColor("#14181B")
BODY = HexColor("#23282C")
MUTED = HexColor("#6C7A80")
TEAL = HexColor("#0E3A44")
PALE_TEAL = HexColor("#9CC4C9")
PALE_COPY = HexColor("#DCE3E4")
RULE = HexColor("#3E5F67")
CONTACT = HexColor("#C2CDD0")


@dataclass(frozen=True)
class Publication:
    filename: str
    category: str
    title: str
    subtitle: str
    standfirst: str
    date: str
    body_last: int
    reference_pages: tuple[int, ...]
    manual_references: tuple[str, ...] = ()
    author: str = "Jason Adamson"
    canonical: bool = False


TERMINAL_REFERENCES = (
    "Ibn Khaldun, The Muqaddimah: An Introduction to History (1377).",
    "Robert Michels, Political Parties: A Sociological Study of the Oligarchical Tendencies of Modern Democracy (1911).",
    "Robert K. Merton, “The Unanticipated Consequences of Purposive Social Action,” American Sociological Review 1, no. 6 (1936), 894–904.",
    "Joseph A. Schumpeter, Capitalism, Socialism and Democracy (1942).",
    "Daniel Bell, The Cultural Contradictions of Capitalism (1976).",
    "Joseph A. Tainter, The Collapse of Complex Societies (Cambridge University Press, 1988).",
    "Patrick J. Deneen, Why Liberalism Failed (Yale University Press, 2018).",
    "Peter Turchin, End Times: Elites, Counter-Elites, and the Path of Political Disintegration (Penguin Press, 2023).",
    "David E. Levari, Daniel T. Gilbert, Timothy D. Wilson, Beau Sievers, David M. Amodio, and Thalia Wheatley, “Prevalence-Induced Concept Change in Human Judgment,” Science 360, no. 6396 (2018), 1465–1467. https://doi.org/10.1126/science.aap8731.",
    "Nick Haslam, “Concept Creep: Psychology’s Expanding Concepts of Harm and Pathology,” Psychological Inquiry 27, no. 1 (2016), 1–17. https://doi.org/10.1080/1047840X.2016.1082418.",
    "Philip Selznick, TVA and the Grass Roots: A Study in the Sociology of Formal Organization (University of California Press, 1949).",
    "Karl Popper, The Open Society and Its Enemies (1945), vol. 1, note 4 to chapter 7.",
    "Eduard Bernstein, The Preconditions of Socialism (1899); Social Democratic Party of Germany, Godesberg Program (1959).",
    "Robert D. Putnam, Bowling Alone: The Collapse and Revival of American Community (Simon & Schuster, 2000).",
    "Office of the U.S. Surgeon General, Our Epidemic of Loneliness and Isolation (U.S. Department of Health and Human Services, 2023).",
    "Marilyn Strathern, “‘Improving Ratings’: Audit in the British University System,” European Review 5, no. 3 (1997), 305–321. https://doi.org/10.1002/(SICI)1234-981X(199707)5:3<305::AID-EURO184>3.0.CO;2-4.",
)

ART_REFERENCES = (
    "Bazerman, M. H., & Moore, D. A. (2013). Judgment in managerial decision making (8th ed.). Wiley.",
    "Fisher, R., Ury, W., & Patton, B. (1991). Getting to yes: Negotiating agreement without giving in. Penguin.",
    "Galbraith, J. R. (1977). Organization design. Addison-Wesley.",
    "Kahneman, D. (2011). Thinking, fast and slow. Farrar, Straus and Giroux.",
    "Klein, G. (1998). Sources of power: How people make decisions. MIT Press.",
    "March, J. G. (1994). A primer on decision making: How decisions happen. Free Press.",
    "Russo, J. E., & Schoemaker, P. J. H. (2002). Winning decisions: Getting it right the first time. Doubleday.",
    "Simon, H. A. (1955). A behavioral model of rational choice. Quarterly Journal of Economics, 69(1), 99–118. https://doi.org/10.2307/1884852.",
    "Tetlock, P. E., & Gardner, D. (2015). Superforecasting: The art and science of prediction. Crown.",
    "Weick, K. E. (1995). Sensemaking in organizations. Sage Publications.",
)

CULTURE_REFERENCES = (
    "Gallup. State of the Global Workplace: 2026 Report. Gallup, Inc., 2026.",
    "Gallup. State of the Global Workplace: 2025 Report. Gallup, Inc., 2025.",
    "Knight, Caroline, Malcolm Patterson, and Jeremy Dawson. “Building Work Engagement: A Systematic Review and Meta-Analysis Investigating the Effectiveness of Work Engagement Interventions.” Journal of Organizational Behavior 38 (2017): 792–812. https://doi.org/10.1002/job.2167.",
    "Vîrgă, Delia, Laurențiu P. Maricuțoiu, and Alina Iancu. “The Efficacy of Work Engagement Interventions: A Meta-Analysis of Controlled Trials.” Current Psychology 40 (2021): 5863–5880. https://doi.org/10.1007/s12144-019-00438-z.",
    "Guiso, Luigi, Paola Sapienza, and Luigi Zingales. “The Value of Corporate Culture.” Journal of Financial Economics 117, no. 1 (2015): 60–76. https://doi.org/10.1016/j.jfineco.2014.05.010.",
    "Bloom, Nicholas, Benn Eifert, Aprajit Mahajan, David McKenzie, and John Roberts. “Does Management Matter? Evidence from India.” Quarterly Journal of Economics 128, no. 1 (2013): 1–51. https://doi.org/10.1093/qje/qjs044.",
    "Bloom, Nicholas, Aprajit Mahajan, David McKenzie, and John Roberts. “Do Management Interventions Last? Evidence from India.” American Economic Journal: Applied Economics 12, no. 2 (2020): 198–219. https://doi.org/10.1257/app.20180369.",
    "Bloom, Nicholas, and John Van Reenen. “Measuring and Explaining Management Practices Across Firms and Countries.” Quarterly Journal of Economics 122, no. 4 (2007): 1351–1408. https://doi.org/10.1162/qjec.2007.122.4.1351.",
    "Bloom, Nicholas, Renata Lemos, Raffaella Sadun, Daniela Scur, and John Van Reenen. “The New Empirical Economics of Management.” Journal of the European Economic Association 12, no. 4 (2014): 835–876. https://doi.org/10.1111/jeea.12094.",
)

ACCUMULATED_REFERENCES = (
    "Andrews, D., Turban, S., & Tyros, S. (2026). Regulatory compliance costs and productivity: New task-based evidence. OECD Economics Department Working Papers, No. 1856. https://doi.org/10.1787/1c1da52e-en.",
    "Boston Consulting Group. (2024, February 15). Exploring a better way to manage costs. An adapted version appeared in Harvard Business Review as “Don’t Wait for a Crisis to Reduce Costs.”",
    "Gates, R. M. (2014). Duty: Memoirs of a Secretary at War. Alfred A. Knopf.",
    "U.S. Government Accountability Office. (2018, April 17). Civilian and contractor workforces: DOD’s cost comparisons addressed most report elements but excluded some costs (GAO-18-399).",
    "U.S. Government Accountability Office. (2023, July 26). Defense workforce: Opportunities for more effective management and efficiencies (GAO-23-106966).",
    "U.S. Government Accountability Office. (2025, February). High-Risk Series: Heightened attention to high-risk areas could yield billions in savings and a more efficient and effective government (GAO-25-107743).",
    "Hamel, G., & Zanini, M. (2016, September 5). Excess management is costing the U.S. $3 trillion per year. Harvard Business Review.",
    "Hamel, G., & Zanini, M. (2017, August 10). What we learned about bureaucracy from 7,000 HBR readers. Harvard Business Review.",
    "Harrison, T. (2021, March). U.S. military forces in FY 2021: Space, SOF, civilians, and contractors. Center for Strategic and International Studies.",
    "Kaufman, H. (1977). Red Tape: Its Origins, Uses, and Abuses. Brookings Institution Press.",
    "Light, P. C. (1995). Thickening Government: Federal Hierarchy and the Diffusion of Accountability. Brookings Institution Press.",
    "OECD. (2003). From Red Tape to Smart Tape: Administrative Simplification in OECD Countries. OECD Publishing.",
    "Whitlock, C., & Woodward, B. (2016, December 5). Pentagon buries evidence of $125 billion in bureaucratic waste. The Washington Post.",
    "Wilson, J. Q. (1989). Bureaucracy: What Government Agencies Do and Why They Do It. Basic Books.",
)

AFTER_LAP_REFERENCES = (
    "Wang, Sarah, Shangda Xu, Justin Kahl, and Tugce Erten. “How 100 Enterprise CIOs Are Building and Buying Gen AI in 2025.” Andreessen Horowitz, June 10, 2025.",
    "Dwivedi, Anshuman. “The Paradox of Plenty: Mastering Inference Economics in the Age of Scale.” AnalyticsWeek, March 2, 2026.",
    "Greenfield, Nicole. “AI Data Centers’ Impact on Electric Bills, Water, and More.” Consumer Reports, March 20, 2026.",
    "Deloitte Insights. “The AI Infrastructure Reckoning: Optimizing Compute Strategy in the Age of Inference Economics.” Tech Trends 2026.",
    "FinOps Foundation. State of FinOps 2026 Report. Survey of 1,192 respondents representing more than $83 billion in annual cloud spend.",
    "Cottier, Ben, Ben Snodin, David Owen, and Tom Adamczewski. “LLM Inference Prices Have Fallen Rapidly but Unequally Across Tasks.” Epoch AI, March 12, 2025.",
    "Denain, Jean-Stanislas. “How Persistent Is the Inference Cost Burden?” Epoch AI, February 16, 2026.",
    "International Energy Agency. Energy and AI: Energy Demand from AI. 2025, updated through 2026.",
    "Shehabi, Arman, et al. 2024 United States Data Center Energy Usage Report. Lawrence Berkeley National Laboratory, December 2024. https://doi.org/10.71468/P1WC7Q.",
    "Smith, Sarah Josephine, et al. United States Data Center Energy Usage Report: 2025 Update. Lawrence Berkeley National Laboratory, June 2026.",
    "TechCrunch. “VCs Predict Enterprises Will Spend More on AI in 2026, Through Fewer Vendors.” December 2025.",
    "OpenAI. “GPT-5.6: Frontier Intelligence That Scales with Your Ambition.” July 9, 2026; pricing update July 30, 2026.",
    "OpenAI. “Advancing the Price-Performance Frontier with GPT-5.6.” July 30, 2026.",
    "Anthropic. “Introducing Claude Sonnet 5.” 2026, including the June 30 pricing-methodology correction.",
    "Linux Foundation. “Linux Foundation Announces the Intent to Launch the Tokenomics Foundation to Establish Open Standards for AI Cost Management.” June 3, 2026.",
    "TechCrunch. “Anthropic Files to Go Public.” June 1, 2026; and “OpenAI Files Confidentially for IPO, Following Anthropic.” June 8, 2026.",
    "Amazon, Alphabet, Microsoft, Meta, and Oracle. Q2 calendar-year 2026 earnings disclosures and capital-expenditure guidance.",
)

EVERY_NODE_REFERENCES = (
    "Association of Corporate Counsel and Everlaw. Survey research on generative AI in corporate legal departments, 2024 and 2025.",
    "Charlotin, Damien. AI Hallucination Cases. Public database of court decisions; counts checked August 2026.",
    "Delaware General Corporation Law, section 141(e); Smith v. Van Gorkom, 488 A.2d 858 (Delaware Supreme Court, 1985).",
    "FTI Consulting and Relativity. The General Counsel Report 2026. March 2026.",
    "Klarna. Company announcement on its AI assistant, February 2024; Sebastian Siemiatkowski remarks reported by Bloomberg, May 2025.",
    "Lloyd’s Register. Institutional history: origins of ship classification for marine insurers, London, 1760.",
    "Mandiant, Google Cloud. M-Trends 2026 report.",
    "Adamson, Jason. Merit After the Machine. Monderman, August 2026.",
    "Adamson, Jason, and Michael Wilson. From Tokens to Outcomes. Monderman, revised August 2026.",
    "Adamson, Jason. Compensatory Systems. Monderman, March 2026.",
    "Adamson, Jason. Terminal Fidelity. Monderman, July 2026.",
)

MERIT_REFERENCES = (
    "OpenAI, “GPT-4 Technical Report” (2023); Eric Martínez, “Re-evaluating GPT-4’s Bar Exam Performance,” Artificial Intelligence and Law (2024); Harsha Nori et al., “Capabilities of GPT-4 on Medical Challenge Problems” (Microsoft, 2023); and Google DeepMind reports on International Mathematical Olympiad performance, July 2024 and July 2025.",
    "Cade Metz, “‘The Godfather of A.I.’ Leaves Google and Warns of Danger Ahead,” The New York Times, May 1, 2023.",
    "Chloe Taylor, “Almost Half of CEOs Fear A.I. Could Destroy Humanity,” Fortune, June 15, 2023, reporting Yann LeCun’s assessment of existential-risk claims; see also LeCun’s October 2023 exchanges with Geoffrey Hinton and Yoshua Bengio.",
    "Center for AI Safety, “Statement on AI Risk,” May 30, 2023.",
    "Dario Amodei, “Machines of Loving Grace,” October 2024.",
    "Sebastian Mallaby, “God From the Machine: AI and the Future of Humanity,” Foreign Affairs, September/October 2026, published online August 10, 2026.",
    "Benjamin A. Elman, A Cultural History of Civil Examinations in Late Imperial China (University of California Press, 2000).",
    "The Northcote–Trevelyan Report (1854); Order in Council of June 4, 1870; and the Pendleton Civil Service Reform Act (1883).",
    "Alfred Binet and Théodore Simon, “Méthodes nouvelles pour le diagnostic du niveau intellectuel des anormaux,” L’Année Psychologique 11 (1905).",
    "Robert M. Yerkes, ed., Psychological Examining in the United States Army (Government Printing Office, 1921).",
    "Nicholas Lemann, The Big Test: The Secret History of the American Meritocracy (Farrar, Straus and Giroux, 1999); College Board records on the SAT’s first administration, June 23, 1926.",
    "Servicemen’s Readjustment Act of 1944; U.S. Department of Veterans Affairs historical statistics; and U.S. National Archives educator resources on unequal access to GI Bill benefits.",
    "Michael Young, The Rise of the Meritocracy (Thames and Hudson, 1958); Stanford Encyclopedia of Philosophy, “Meritocracy.”",
    "National Aeronautics and Space Act of 1958, signed July 29, 1958.",
    "Michael Young, “Down with Meritocracy,” The Guardian, June 29, 2001.",
    "Jeremy Greenwood, Nezih Guner, Georgi Kocharkov, and Cezar Santos, “Marry Your Like: Assortative Mating and Income Inequality,” American Economic Review 104, no. 5 (2014).",
    "Matthias Doepke and Fabrizio Zilibotti, Love, Money, and Parenting (Princeton University Press, 2019); Garey Ramey and Valerie A. Ramey, “The Rug Rat Race,” Brookings Papers on Economic Activity (2010).",
    "Thorstein Veblen, The Theory of the Leisure Class (1899).",
    "Silvia Bellezza, Neeru Paharia, and Anat Keinan, “Conspicuous Consumption of Time: When Busyness and Lack of Leisure Become a Status Symbol,” Journal of Consumer Research 44, no. 1 (2017).",
    "Claudia Goldin and Lawrence F. Katz, The Race Between Education and Technology (Belknap Press, 2008).",
    "John Maynard Keynes, “Economic Possibilities for Our Grandchildren” (1930), in Essays in Persuasion; Lorenzo Pecchi and Gustavo Piga, eds., Revisiting Keynes (MIT Press, 2008).",
    "Michael Huberman and Chris Minns, “The Times They Are Not Changin’: Days and Hours of Work in Old and New Worlds, 1870–2000,” Explorations in Economic History (2007); Our World in Data, “Working Hours”; Peter Kuhn and Fernando Lozano, “The Expanding Workweek?” Journal of Labor Economics 26, no. 2 (2008).",
    "Elon Musk, remarks at the UK AI Safety Summit in conversation with Rishi Sunak, November 2, 2023; Musk post on X replying to Ray Dalio, December 17, 2025, reported by Fox Business the same day.",
    "Sam Altman, “Moore’s Law for Everything,” March 16, 2021.",
    "The Giving Pledge, pledge terms and signatory records; Institute for Policy Studies, analysis of deceased signatories, July 2025.",
    "Forbes, “World’s Billionaires 2026,” March 10, 2026; Forbes real-time tracking following the SpaceX public offering of June 12, 2026.",
    "Select Committee on Hand-Loom Weavers’ Petitions (1834–1835); Royal Commission on Hand-Loom Weavers, Reports (1839–1841); E. P. Thompson, The Making of the English Working Class (1963).",
    "Scott Reynolds Nelson, Steel Drivin’ Man: John Henry, the Untold Story of an American Legend (Oxford University Press, 2006).",
    "The first modern Olympic Games, Athens, 1896; Eugen Sandow’s Great Competition, Royal Albert Hall, 1901; Michael Anton Budd, The Sculpture Machine (New York University Press, 1997).",
    "David Alan Grier, When Computers Were Human (Princeton University Press, 2005).",
    "IBM records on Deep Blue’s May 1997 match with Garry Kasparov; Garry Kasparov, Deep Thinking (PublicAffairs, 2017); Chess.com announcements of 100 million members in December 2022 and 250 million members in February 2026.",
    "Federal Aviation Regulations, 14 C.F.R. Part 121, flightcrew requirements and related operating rules.",
    "Alan B. Krueger, Rockonomics (Currency, 2019).",
    "Authors Guild, “Authors Guild Launches Expanded ‘Human Authored’ Certification Program,” March 2, 2026; Publishers Weekly coverage of the January 2025 beta launch.",
    "Stephen Marche, “The College Essay Is Dead,” The Atlantic, December 6, 2022; Tal Waltzer, Riley L. Cox, and Gail D. Heyman, “Testing the Ability of Teachers and Students to Differentiate Between Essays Generated by ChatGPT and High School Students,” Human Behavior and Emerging Technologies (2023).",
    "Ben Cohen, “They Were Every Student’s Worst Nightmare. Now Blue Books Are Back,” The Wall Street Journal, May 2025; Tertiary Education Quality and Standards Agency, “Assessment Reform for the Age of Artificial Intelligence” (2023).",
)


PUBLICATIONS = (
    Publication(
        "Monderman_Brief_Accumulated_Drag_Department_of_War.pdf", "BRIEF", "Accumulated Drag",
        "Administrative overhead in the U.S. Department of War.",
        "How accumulated structure degrades decision velocity and absorbs institutional capacity — and why successive reform waves have diagnosed the problem without altering the architecture that produces it.",
        "March 2026", 8, (), ACCUMULATED_REFERENCES,
    ),
    Publication(
        "Monderman_Brief_Compensatory_Systems.pdf", "BRIEF", "Compensatory Systems",
        "How workarounds preserve output while masking institutional dysfunction.",
        "When movement is mistaken for progress, and adaptation becomes a substitute for stewardship. In large, complex organizations, failure rarely announces itself clearly — work continues, reports are produced, and the system does not stop working. It stops working as a system.",
        "March 2026", 9, (10,),
    ),
    Publication(
        "Monderman_Brief_Quarter_Trillion_Dollar_Friction_US_Healthcare.pdf", "BRIEF",
        "The Quarter-Trillion-Dollar Friction in U.S. Healthcare",
        "How administrative complexity absorbs a quarter-trillion dollars annually and diverts institutional capacity from patient care.",
        "The United States healthcare system spent $5.3 trillion in 2024 — roughly twice what comparable nations spend per person — and a substantial share of that spending is consumed by administrative complexity rather than patient care. The friction is structural, and it is a design problem.",
        "March 2026", 9, (10,),
    ),
    Publication(
        "Monderman_Brief_The_Collapse_of_Eastman_Kodak.pdf", "BRIEF", "When Bureaucracy Became the Obstacle",
        "The collapse of Eastman Kodak.",
        "How unstewarded bureaucratic governance turned foresight into delay and converted a market leader into a cautionary tale. In 1975, a Kodak engineer built the world’s first digital camera; in 2012, the company filed for Chapter 11. The popular explanation is complacency. The evidence tells a different story.",
        "March 2026", 8, (9,),
    ),
    Publication(
        "Monderman_Brief_The_Culture_Trap.pdf", "BRIEF", "The Culture Trap",
        "Why sentiment measurement can locate strain without identifying the organizational systems beneath it.",
        "A research brief on the difference between reported experience and the mechanisms through which work is organized.",
        "August 2026", 7, (), CULTURE_REFERENCES,
    ),
    Publication(
        "Monderman_Insight_After_the_First_Lap.pdf", "INSIGHT", "From Tokens to Outcomes",
        "How Token Economics Will Define the Next Phase of Enterprise AI",
        "A structural dependency on early-market foundation model pricing is forming now. The companies that recognize the exposure early, and build or buy the engineering discipline that mitigates it, will define the next decade of enterprise AI.",
        "May 2026 · Revised August 2026", 24, (), AFTER_LAP_REFERENCES, author="Jason Adamson & Michael Wilson",
    ),
    Publication(
        "Monderman_Insight_Built_to_Please_2026-09-02.pdf", "INSIGHT", "Built to Please",
        "Why Consumer AI Tells You What You Want to Hear, and What Serious Users Build Around It",
        "A general-purpose AI assistant is trained toward several goals at once: to be helpful, to give answers people prefer, to stay safe, and to be truthful. On most questions those goals agree. Where the asker already prefers one answer, the preference goal and the truthfulness goal can pull apart, and researchers have measured models leaning toward the asker. This paper separates what is known about that lean from what is only suspected, and describes what serious users build around the model so that its answers can be trusted.",
        "September 2026", 10, (11, 12,), canonical=True,
    ),
    Publication(
        "Monderman_Insight_Every_Node_for_Itself_Aug2026.pdf", "INSIGHT", "Every Node for Itself",
        "AI, In-Housing, and the Network That Keeps Companies Honest",
        "Companies and public institutions form a network of organizations that sell expertise to one another. AI has given every node in that network a reason to believe it can cut the others off. This paper is about what the cut wins, what it costs, and why the better use of AI is improving the nodes rather than severing them.",
        "August 2026", 9, (), EVERY_NODE_REFERENCES,
    ),
    Publication(
        "Monderman_Insight_Merit_After_the_Machine_2026-08-11.pdf", "INSIGHT", "Merit After the Machine",
        "Why AI Weakens the Evidence of Being Smart and Hardworking Faster Than Institutions Can Rebuild It",
        "The worry about artificial intelligence usually gets told as a story about jobs, or safety, or truth. This paper tells it another way: as a story about being smart and being hardworking, the two qualities modern professional life learned to prize most. And it is about what happens when the familiar evidence of both stops being reliable.",
        "August 2026", 11, (), MERIT_REFERENCES,
    ),
    Publication(
        "Monderman_Insight_The_Unmeasured_Layer.pdf", "INSIGHT", "The Unmeasured Layer",
        "Administrative Reality and the Risk Standard Reporting Misses",
        "Organizations deliver at the speed of their administrative reality. Boards, executives, and acquirers measure a great deal about the institutions they steward. This paper proposes that four conditions of how an institution actually operates are often measured in fragments, by different disciplines, and are seldom assembled into a standing, institution-level view.",
        "September 2026", 9, (10,),
    ),
    Publication(
        "Monderman_Insight_The_Art_of_Interior_Reasoning.pdf", "INSIGHT", "The Art of Interior Reasoning",
        "Why Excellent Decisions Live Off the Line",
        "The discipline of reasoning past both binary thinking and the compromise between. What it takes — analytically and emotionally — to consistently find answers off the line. And what compounds, in one direction or another, when this is or is not the practice.",
        "April 2026", 10, (), ART_REFERENCES,
    ),
    Publication(
        "Terminal_Fidelity.pdf", "INSIGHT", "Terminal Fidelity",
        "Why Ideas in Power Consume Themselves — and Where the Enduring Ones Learn to Stop",
        "Every political, economic, and existential philosophy that takes power carries the conditions of its own undoing. The traditions and companies that recognize the pattern early — and engineer the stopping rules that interrupt it — are the ones that endure.",
        "July 2026", 15, (), TERMINAL_REFERENCES,
    ),
)


# The older source PDFs use the right NHG faces but carry several legacy type
# sizes. These narrowly targeted content-stream substitutions bring their body
# hierarchy onto the approved Built to Please scale without rasterizing pages,
# touching wording, or rebuilding charts and tables. Keys are PDF font-resource
# names and source font sizes; unrelated display and figure typography remains
# unchanged.
BODY_TYPE_NORMALIZATION = {
    "Monderman_Brief_Accumulated_Drag_Department_of_War.pdf": {
        ("/BKYKFD", 26.0): 27.3333,
        ("/BKYKFD", 16.0): 15.4667,
    },
    "Monderman_Brief_Compensatory_Systems.pdf": {
        ("/BKYKFD", 26.0): 27.3333,
        ("/BKYKFD", 16.0): 15.4667,
    },
    "Monderman_Brief_Quarter_Trillion_Dollar_Friction_US_Healthcare.pdf": {
        ("/BKYKFD", 26.0): 27.3333,
        ("/BKYKFD", 16.0): 15.4667,
    },
    "Monderman_Brief_The_Collapse_of_Eastman_Kodak.pdf": {
        ("/BKYKFD", 26.0): 27.3333,
        ("/BKYKFD", 16.0): 15.4667,
    },
    "Monderman_Brief_The_Culture_Trap.pdf": {
        ("/F2+0", 35.0): 21.0,
        ("/F2+0", 25.5): 20.5,
        ("/F2+0", 20.0): 21.0,
        ("/F2+0", 16.0): 11.6,
        ("/F2+0", 13.2): 11.6,
        ("/F3+0", 15.0): 13.2,
        ("/F4+0", 14.2): 11.5,
        ("/F4+0", 10.35): 10.0,
    },
    "Monderman_Insight_Every_Node_for_Itself_Aug2026.pdf": {
        ("/F2+0", 25.5): 20.5,
        ("/F2+0", 16.2): 13.2,
        ("/F2+0", 15.4): 13.2,
        ("/F2+0", 13.0): 11.6,
        ("/F3+0", 16.2): 13.2,
        ("/F3+0", 16.0): 13.2,
        ("/F4+0", 13.6): 11.5,
        ("/F4+0", 9.7): 10.0,
    },
    "Monderman_Insight_Merit_After_the_Machine_2026-08-11.pdf": {
        ("/FNNBVY", 22.0): 27.3333,
        ("/FNNBVY", 20.0): 17.6,
        ("/FNNBVY", 16.0): 15.4667,
        ("/FNNBVY", 13.33): 14.0,
        ("/QUUQSR", 13.73): 13.3333,
        ("/DSKVBT", 11.47): 11.0667,
        ("/XNSAKT", 11.47): 11.0667,
    },
}

# One long canonical-size heading in the Kodak brief needs a minimal optical
# fit to remain inside the 492-point text column. This is scoped to that single
# text object; the following object is reset to 100 percent immediately.
BODY_HORIZONTAL_SCALE = {
    (
        "Monderman_Brief_The_Collapse_of_Eastman_Kodak.pdf",
        6,
        "/BKYKFD",
        26.0,
    ): 98.5,
}


def register_fonts() -> None:
    fonts = {
        ROMAN: "NeueHaasGroteskText-Roman.ttf",
        MEDIUM: "NeueHaasGroteskText-Medium.ttf",
        BOLD: "NeueHaasGroteskText-Bold.ttf",
        # ReportLab cannot embed the CFF outlines in the licensed webfont files.
        # Body/figure pages already carry the proper 56/76 faces; generated
        # reference and closing matter stays within the NHG Text family.
        ITALIC: "NeueHaasGroteskText-Roman.ttf",
        BOLD_ITALIC: "NeueHaasGroteskText-Bold.ttf",
    }
    for name, filename in fonts.items():
        if name not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / filename)))
    pdfmetrics.registerFontFamily(
        ROMAN,
        normal=ROMAN,
        bold=BOLD,
        italic=ITALIC,
        boldItalic=BOLD_ITALIC,
    )


def normalize_body_typography(
    page, filename: str, source_number: int, reader: PdfReader
) -> None:
    """Apply only the approved legacy-to-canonical type-size substitutions."""
    substitutions = BODY_TYPE_NORMALIZATION.get(filename)
    if not substitutions or page.get_contents() is None:
        return
    content = ContentStream(page.get_contents(), reader)
    changed = False
    operations = []
    reset_horizontal_scale = False
    for operands, operator in content.operations:
        if operator != b"Tf" or len(operands) < 2:
            operations.append((operands, operator))
            if reset_horizontal_scale and operator in (b"Tj", b"TJ"):
                operations.append(([FloatObject(100.0)], b"Tz"))
                reset_horizontal_scale = False
            continue
        key = (str(operands[0]), round(float(operands[1]), 2))
        target = substitutions.get(key)
        if target is None:
            operations.append((operands, operator))
            continue
        operands[1] = FloatObject(target)
        operations.append((operands, operator))
        horizontal_scale = BODY_HORIZONTAL_SCALE.get(
            (filename, source_number, key[0], key[1])
        )
        if horizontal_scale is not None:
            operations.append(([FloatObject(horizontal_scale)], b"Tz"))
            reset_horizontal_scale = True
        changed = True
    if changed:
        content.operations = operations
        # The page is still reader-owned at this point. Assign the rewritten
        # stream directly; PdfWriter.add_page() will clone it into the output.
        # This avoids pypdf's deprecated reader-owned replace_contents path.
        page[NameObject("/Contents")] = content


def _text_band(page, reader: PdfReader, *, top: float, bottom: float):
    """Return a visually cropped fragment with out-of-band text removed.

    A PDF crop box affects painting but not text extraction. Reflowing a page
    with crop boxes alone therefore leaves invisible duplicate copy in the
    document. The source uses a 4/3 internal coordinate scale with a top-down
    text matrix, so filter text-showing operations to the equivalent band
    before composing the fragment.
    """
    fragment = deepcopy(page)
    if fragment.get_contents() is not None:
        content = ContentStream(fragment.get_contents(), reader)
        minimum_y = top / 0.75
        maximum_y = bottom / 0.75
        current_y = None
        operations = []
        for operands, operator in content.operations:
            if operator == b"BT":
                current_y = None
            elif operator == b"Tm" and len(operands) >= 6:
                current_y = float(operands[5])
            elif operator in (b"Td", b"TD") and len(operands) >= 2:
                delta_y = float(operands[1])
                current_y = delta_y if current_y is None else current_y + delta_y
            if operator in (b"Tj", b"TJ", b"'", b'"'):
                if current_y is not None and not (minimum_y <= current_y < maximum_y):
                    continue
            operations.append((operands, operator))
        content.operations = operations
        fragment[NameObject("/Contents")] = content
    fragment.cropbox = RectangleObject((0.0, PAGE_H - bottom, PAGE_W, PAGE_H - top))
    return fragment


def reflow_terminal_opening(page_three, page_four, reader: PdfReader):
    """Use page three's blank field for the start of section 1.

    The source document stranded one short front-matter paragraph on page three.
    Move the first portion of section 1 into the available field, then move the
    remaining source content to the top of page four. The visible source copy is
    preserved while text outside each fragment is physically removed so search,
    copy, and accessibility layers do not contain duplicates.
    """
    page_three_out = deepcopy(page_three)
    opening = _text_band(page_four, reader, top=82.0, bottom=320.0)
    page_three_out.merge_transformed_page(
        opening,
        Transformation().translate(0.0, -93.0),
        over=True,
    )

    page_four_out = PageObject.create_blank_page(width=PAGE_W, height=PAGE_H)
    continuation = _text_band(page_four, reader, top=320.0, bottom=700.0)
    page_four_out.merge_transformed_page(
        continuation,
        Transformation().translate(0.0, 238.0),
        over=True,
    )
    return page_three_out, page_four_out


def tracked(c: Canvas, text: str, x: float, y: float, font: str, size: float, color, tracking: float) -> float:
    cursor = x
    c.setFont(font, size)
    c.setFillColor(color)
    for char in text:
        c.drawString(cursor, y, char)
        cursor += pdfmetrics.stringWidth(char, font, size) + tracking
    return cursor


def paragraph(c: Canvas, text: str, style: ParagraphStyle, x: float, top: float, width: float) -> float:
    p = Paragraph(escape(text), style)
    _, height = p.wrap(width, PAGE_H)
    p.drawOn(c, x, top - height)
    return top - height


def gradient(c: Canvas) -> None:
    stops = ((0.0, (16, 59, 68)), (0.55, (11, 52, 61)), (1.0, (4, 40, 47)))
    bands = 396
    for i in range(bands):
        t = i / (bands - 1)
        for j in range(len(stops) - 1):
            a, ca = stops[j]
            b, cb = stops[j + 1]
            if a <= t <= b:
                local = (t - a) / (b - a)
                rgb = tuple((ca[k] + (cb[k] - ca[k]) * local) / 255 for k in range(3))
                c.setFillColorRGB(*rgb)
                y = PAGE_H - (i + 1) * PAGE_H / bands
                c.rect(0, y, PAGE_W, PAGE_H / bands + 0.6, stroke=0, fill=1)
                break


def make_cover(pub: Publication) -> bytes:
    stream = BytesIO()
    c = Canvas(stream, pagesize=letter, pageCompression=1)
    gradient(c)

    label_end = tracked(c, pub.category, MARGIN, 746.0, BOLD, 8.5, white, 3.0)
    c.setStrokeColor(white)
    c.setLineWidth(2.0)
    c.line(MARGIN, 720.0, label_end - 3.0, 720.0)
    draw_header_lockup(c, x=MARGIN, baseline=681.0, color=white)

    tracked(c, "INSTITUTIONAL PERFORMANCE RESEARCH", MARGIN, 562.0, BOLD, 9.0, white, 5.0)
    title = ParagraphStyle("cover-title", fontName=BOLD, fontSize=28.0, leading=29.2, textColor=white)
    subtitle = ParagraphStyle("cover-sub", fontName=MEDIUM, fontSize=15.5, leading=18.4, textColor=PALE_TEAL)
    standfirst = ParagraphStyle("cover-deck", fontName=ROMAN, fontSize=11.5, leading=17.25, textColor=PALE_COPY)
    y = paragraph(c, pub.title, title, MARGIN, 526.0, BODY_W)
    y = paragraph(c, pub.subtitle, subtitle, MARGIN, y - 14.0, BODY_W)
    paragraph(c, pub.standfirst, standfirst, MARGIN, y - 24.0, BODY_W)

    tracked(c, "BY", MARGIN, 129.0, BOLD, 7.0, PALE_TEAL, 2.1)
    c.setFillColor(white)
    c.setFont(BOLD, 11.0)
    c.drawString(MARGIN, 107.0, pub.author)

    c.setStrokeColor(RULE)
    c.setLineWidth(1.0)
    c.line(MARGIN, 67.0, PAGE_W - MARGIN, 67.0)
    c.setFillColor(white)
    c.setFont(BOLD, 8.0)
    c.drawString(MARGIN, 45.0, pub.date)
    c.setFillColor(CONTACT)
    c.setFont(ROMAN, 8.0)
    c.drawRightString(PAGE_W - MARGIN, 45.0, "connect@monderman.com  •  www.monderman.com")
    c.showPage()
    c.save()
    return stream.getvalue()


def draw_footer(c: Canvas, date: str, page_number: int) -> None:
    c.setFillColor(white)
    c.rect(0, 0, PAGE_W, 61.0, stroke=0, fill=1)
    c.setFillColor(MUTED)
    c.setFont(ROMAN, 8.0)
    c.drawString(MARGIN, 45.0, date)
    c.setFillColor(INK)
    c.setFont(BOLD, 8.0)
    c.drawRightString(PAGE_W - MARGIN, 45.0, str(page_number))


def overlay_page(page, pub: Publication, page_number: int) -> None:
    stream = BytesIO()
    c = Canvas(stream, pagesize=letter, pageCompression=1)
    draw_footer(c, pub.date, page_number)
    c.save()
    stream.seek(0)
    page.merge_page(PdfReader(stream).pages[0], over=True)


def reference_documents(pub: Publication, first_page_number: int) -> list:
    style = ParagraphStyle(
        "reference", fontName=ROMAN, fontSize=8.6, leading=11.2,
        textColor=HexColor("#3A4348"), leftIndent=14.0, firstLineIndent=-14.0,
        rightIndent=0, alignment=TA_LEFT, splitLongWords=False, spaceAfter=7.0,
    )
    pages = []
    index = 0
    page_number = first_page_number
    while index < len(pub.manual_references):
        stream = BytesIO()
        c = Canvas(stream, pagesize=letter, pageCompression=1)
        c.setFillColor(white)
        c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
        tracked(c, "REFERENCES", MARGIN, 710.0, BOLD, 10.0, INK, 1.2)
        if page_number > first_page_number:
            tracked(c, "CONTINUED", 158.0, 710.2, BOLD, 7.4, INK, 0.8)
        y = 686.0
        while index < len(pub.manual_references):
            item = Paragraph(f"{index + 1}. {escape(pub.manual_references[index])}", style)
            _, h = item.wrap(BODY_W, y - 80.0)
            if y - h < 76.0:
                break
            y -= h
            item.drawOn(c, MARGIN, y)
            y -= style.spaceAfter
            index += 1
        draw_footer(c, pub.date, page_number)
        c.showPage()
        c.save()
        pages.append(PdfReader(BytesIO(stream.getvalue())).pages[0])
        page_number += 1
    return pages


def make_back(pub: Publication, page_number: int) -> bytes:
    # Clone the approved canonical closing page so every publication carries
    # the genuine embedded NHG 56 Italic/76 Bold Italic faces, not a synthetic
    # oblique or Roman fallback. Remove the canonical publication's footer text
    # from the content stream before applying the publication-specific folio;
    # a white rectangle alone would leave a hidden old date and page number.
    canonical_reader = PdfReader(CANONICAL_REFERENCE)
    canonical = deepcopy(canonical_reader.pages[-1])
    content = ContentStream(canonical.get_contents(), canonical_reader)
    operations = []
    text_block = None
    discard_block = False
    for operands, operator in content.operations:
        if operator == b"BT":
            text_block = [(operands, operator)]
            discard_block = False
            continue
        if text_block is not None:
            text_block.append((operands, operator))
            if operator in (b"Tm", b"Td", b"TD") and len(operands) >= 2:
                y_value = float(operands[5] if operator == b"Tm" else operands[1])
                if y_value >= 900.0:
                    discard_block = True
            if operator == b"ET":
                if not discard_block:
                    operations.extend(text_block)
                text_block = None
            continue
        operations.append((operands, operator))
    if text_block is not None and not discard_block:
        operations.extend(text_block)
    content.operations = operations
    canonical[NameObject("/Contents")] = content
    draw_stream = BytesIO()
    c = Canvas(draw_stream, pagesize=letter, pageCompression=1)
    draw_footer(c, pub.date, page_number)
    c.save()
    draw_stream.seek(0)
    canonical.merge_page(PdfReader(draw_stream).pages[0], over=True)
    writer = PdfWriter()
    writer.add_page(canonical)
    stream = BytesIO()
    writer.write(stream)
    return stream.getvalue()


def build(pub: Publication) -> tuple[int, Path]:
    source = ROOT / pub.filename
    backup = SOURCE_BACKUP / pub.filename
    backup.parent.mkdir(parents=True, exist_ok=True)
    if not backup.exists():
        shutil.copy2(source, backup)

    if pub.canonical:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(backup, source)
        shutil.copy2(backup, OUTPUT_DIR / pub.filename)
        return len(PdfReader(backup).pages), source

    reader = PdfReader(backup)
    writer = PdfWriter()
    writer.add_page(PdfReader(BytesIO(make_cover(pub))).pages[0])

    body_pages = {
        source_number: deepcopy(reader.pages[source_number - 1])
        for source_number in range(2, pub.body_last + 1)
    }
    if pub.filename == "Terminal_Fidelity.pdf":
        body_pages[3], body_pages[4] = reflow_terminal_opening(
            body_pages[3], body_pages[4], reader
        )

    page_number = 2
    for source_number in range(2, pub.body_last + 1):
        page = body_pages[source_number]
        normalize_body_typography(page, pub.filename, source_number, reader)
        overlay_page(page, pub, page_number)
        writer.add_page(page)
        page_number += 1

    if pub.manual_references:
        for page in reference_documents(pub, page_number):
            writer.add_page(page)
            page_number += 1
    else:
        for source_number in pub.reference_pages:
            page = reader.pages[source_number - 1]
            # These source pages already carry the approved REFERENCES heading
            # and 8.6-point entries. Preserve them verbatim; only normalize the
            # publication footer. A prior white mask clipped the first citation.
            overlay_page(page, pub, page_number)
            writer.add_page(page)
            page_number += 1

    writer.add_page(PdfReader(BytesIO(make_back(pub, page_number))).pages[0])
    if reader.metadata:
        writer.add_metadata(reader.metadata)

    staging = ROOT / "tmp" / "pdfs" / "house-style-final" / pub.filename
    staging.parent.mkdir(parents=True, exist_ok=True)
    with staging.open("wb") as handle:
        writer.write(handle)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(staging, source)
    shutil.copy2(staging, OUTPUT_DIR / pub.filename)
    return len(writer.pages), source


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--filename", help="Rebuild one configured publication only")
    args = parser.parse_args()

    publications = PUBLICATIONS
    if args.filename:
        publications = tuple(pub for pub in PUBLICATIONS if pub.filename == args.filename)
        if not publications:
            parser.error(f"Unknown configured publication: {args.filename}")

    register_fonts()
    for pub in publications:
        pages, path = build(pub)
        print(f"{path.name}: {pages} pages ({pub.category})")


if __name__ == "__main__":
    main()
