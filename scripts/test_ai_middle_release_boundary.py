"""Small mutation checks for the exact census/media admission primitive."""
from pathlib import Path
import tempfile
import unittest
from ai_middle_release_20261028_contract import file_row, rows_exact


class Boundary(unittest.TestCase):
    def test_unknown_source_and_changed_audio_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);(root/'article.html').write_text('<p>Reviewed prose.</p>')
            (root/'audio.m4a').write_bytes(b'reviewed encoded media')
            names=['article.html','audio.m4a'];rows=[file_row(root,n) for n in names]
            self.assertTrue(rows_exact(root,rows,names))
            (root/'unknown.html').write_text('unreviewed')
            self.assertFalse(rows_exact(root,rows,names+['unknown.html']))
            (root/'audio.m4a').write_bytes(b'reviewed encoded media changed')
            self.assertFalse(rows_exact(root,rows,names))
            (root/'audio.m4a').write_bytes(b'reviewed encoded media')
            self.assertTrue(rows_exact(root,rows,names))
            (root/'article.html').chmod(0o755)
            self.assertFalse(rows_exact(root,rows,names))


if __name__=='__main__': unittest.main()
