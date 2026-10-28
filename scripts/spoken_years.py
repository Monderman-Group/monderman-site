"""Calendar-year readings for explicitly reviewed prose spans only.

Numbers are never automatically assumed to be dates. Callers review candidates
outside bibliography/metadata; every other source character remains unchanged.
"""
from __future__ import annotations
import re
SMALL='zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS='zero ten twenty thirty forty fifty sixty seventy eighty ninety'.split()
CANDIDATE=re.compile(r"(?<![\w,.])(?:1\d{3}|20\d{2}|2100)(?:s|[’']s)?(?![\w]|[,.]\d)",re.I)
def under100(n):
    return SMALL[n] if n<20 else TENS[n//10]+(' '+SMALL[n%10] if n%10 else '')
def spoken_year(token):
    interval=re.fullmatch(r'(1\d{3}|20\d{2}|2100)[–-](\d{2}|1\d{3}|20\d{2}|2100)',token)
    if interval:
        endpoint=interval[2]
        ending=spoken_year(endpoint) if len(endpoint)==4 else (under100(int(endpoint)) if int(endpoint)>=10 else 'oh '+SMALL[int(endpoint)])
        return spoken_year(interval[1])+' to '+ending
    m=re.fullmatch(r"(1\d{3}|20\d{2}|2100)(s|[’']s)?",token,re.I)
    if not m:raise ValueError('Expected a reviewed calendar year: '+token)
    year=int(m[1]);suffix=m[2] or '';century,last=divmod(year,100)
    if year==1000:words='one thousand'
    elif 2000<=year<=2009:words='two thousand'+(' '+SMALL[last] if last else '')
    elif not last:words=under100(century)+' hundred'
    elif last<10:words=under100(century)+' oh '+SMALL[last]
    else:words=under100(century)+' '+under100(last)
    if suffix.lower()=='s':
        if year%10:raise ValueError('A decade must end in zero')
        words=words[:-1]+'ies' if words.endswith('y') else words+'s'
    elif suffix:words+="'s"
    return words
def candidates(text):
    return [dict(start=m.start(),end=m.end(),written=m.group()) for m in CANDIDATE.finditer(text)]
def normalize_calendar_years(text,reviewed_spans):
    entries=[];last=-1
    for item in sorted(reviewed_spans,key=lambda x:x['start']):
        start,end=item['start'],item['end'];written=item.get('written',item.get('year'))
        if not(last<=start<end<=len(text)) or text[start:end]!=written:
            raise ValueError('Calendar receipt does not match this exact source')
        explicit_range=re.fullmatch(r'(?:1\d{3}|20\d{2}|2100)[–-](?:\d{2}|1\d{3}|20\d{2}|2100)',written)
        if not any(m.start()==start and m.end()==end for m in CANDIDATE.finditer(text)) and not (explicit_range and (start==0 or not text[start-1].isalnum()) and (end==len(text) or not text[end].isalnum())):
            raise ValueError('Year span is not a complete standalone candidate')
        entries.append(dict(start=start,end=end,written=written,spoken=spoken_year(written)));last=end
    result=text
    for item in reversed(entries):result=result[:item['start']]+item['spoken']+result[item['end']:]
    offset=0;locations=[]
    for item in entries:
        start=item['start']+offset;locations.append((start,start+len(item['spoken']),item['written']))
        offset+=len(item['spoken'])-(item['end']-item['start'])
    recovered=result
    for start,end,written in reversed(locations):recovered=recovered[:start]+written+recovered[end:]
    assert recovered==text,'Calendar pronunciation changed other prose'
    return result,entries
