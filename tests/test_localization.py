import unittest
import requests

class TestArtexWebLocalization(unittest.TestCase):
    BASE_URL = "http://localhost:8787"

    def test_login_page_loads(self):
        resp = requests.get(f"{self.BASE_URL}/login")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("ARTEX", resp.text)

    def test_dashboard_endpoint_exists(self):
        resp = requests.get(f"{self.BASE_URL}/dashboard")
        # Dashboard requires auth redirect or page load
        self.assertIn(resp.status_code, [200, 301, 302, 401])

if __name__ == "__main__":
    unittest.main()
