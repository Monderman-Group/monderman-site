import unittest
from spoken_years import candidates,normalize_calendar_years,spoken_year
class CalendarReadings(unittest.TestCase):
 def test_calendar_readings(self):
  for raw,want in {'1916':'nineteen sixteen','1968':'nineteen sixty eight','2026':'twenty twenty six','2100':'twenty one hundred','1905':'nineteen oh five','2000':'two thousand','2004':'two thousand four','1980s':'nineteen eighties','1900s':'nineteen hundreds','2010s':'twenty tens','2026’s':"twenty twenty six's"}.items():self.assertEqual(spoken_year(raw),want)
 def test_date_not_same_number_quantity(self):
  s='In 2026, 2026 workers paid $2,026.50 for model 2026. References: Smith (2026).'
  result,receipt=normalize_calendar_years(s,[candidates(s)[0]])
  self.assertEqual(result,'In twenty twenty six, 2026 workers paid $2,026.50 for model 2026. References: Smith (2026).');self.assertEqual(len(receipt),1)
 def test_range_decade_and_punctuation(self):
  s='From 1916–1968; the 1980s and 2026–27.'
  self.assertEqual(normalize_calendar_years(s,candidates(s))[0],'From nineteen sixteen–nineteen sixty eight; the nineteen eighties and twenty twenty six–27.')
 def test_reviewed_range_connector(self):
  s='In 2018–2021 and fiscal 2026–27; model 2026-27 remains an identifier.'
  spans=[dict(start=s.index(raw),end=s.index(raw)+len(raw),written=raw) for raw in ['2018–2021','2026–27']]
  result,receipt=normalize_calendar_years(s,spans)
  self.assertEqual(result,'In twenty eighteen to twenty twenty one and fiscal twenty twenty six to twenty seven; model 2026-27 remains an identifier.')
  self.assertEqual([r['written'] for r in receipt],['2018–2021','2026–27'])
 def test_unreviewed_unchanged(self):
  s='1,916 people; $2026; 2026.5; identifier X2026; 2026.'
  self.assertEqual(normalize_calendar_years(s,[])[0],s)
 def test_stale_or_partial_receipt_rejected(self):
  with self.assertRaises(ValueError):normalize_calendar_years('In 2026.',[dict(start=3,end=7,written='2025')])
  with self.assertRaises(ValueError):normalize_calendar_years('1232026',[dict(start=3,end=7,written='2026')])
if __name__=='__main__':unittest.main()
