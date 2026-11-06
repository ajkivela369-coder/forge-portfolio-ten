"""Dependency-free integrity checks on the generated showcase."""
import json
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class ShowcaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest=json.loads((ROOT/'portfolio-manifest.json').read_text('utf-8'))
        cls.home=(ROOT/'site'/'index.html').read_text('utf-8')
    def test_ten_unique_projects(self):
        ids=[p['id'] for p in self.manifest['projects']]
        self.assertEqual(len(ids),10)
        self.assertEqual(len(set(ids)),10)
    def test_ten_working_links(self):
        for p in self.manifest['projects']:
            with self.subTest(p=p['id']):
                self.assertIn(f'apps/{p["id"]}/index.html',self.home)
                self.assertTrue((ROOT/'site'/'apps'/p['id']/'index.html').is_file())
    def test_ten_distinct_icon_assets(self):
        icons=[(ROOT/'site'/'assets'/'icons'/f'{p["id"]}.svg').read_text('utf-8') for p in self.manifest['projects']]
        self.assertEqual(len(set(icons)),10)
        self.assertTrue(all('<svg ' in text for text in icons))
    def test_every_detail_has_evidence_and_roadmap(self):
        for p in self.manifest['projects']:
            page=(ROOT/'site'/'apps'/p['id']/'index.html').read_text('utf-8')
            with self.subTest(p=p['id']):
                self.assertIn('Implemented skills',page)
                self.assertIn('Next technologies',page)
                self.assertIn('not a publicly deployed full application',page)
                self.assertIn(p['title'],page)
    def test_filters_and_accessibility(self):
        self.assertIn('aria-pressed=',self.home)
        self.assertIn('role="status"',self.home)
        self.assertIn('id="search"',self.home)
        self.assertIn('prefers-reduced-motion',(ROOT/'site'/'assets'/'style.css').read_text('utf-8'))
    def test_test_total_verified(self):
        self.assertEqual(self.manifest['top_level_passing_tests'],188)
        self.assertEqual(sum(p.get('top_level_tests_passed',0) for p in self.manifest['projects']),188)
if __name__=='__main__':unittest.main()
