import unittest

from backend.url_analysis import analyze_url


def strengths(url):
    return {item["code"]: item["strength"] for item in analyze_url(url)["indicators"]}


class BrandDetectionTests(unittest.TestCase):
    def test_indian_bank_name_with_login_wording_is_significant(self):
        self.assertEqual(strengths("http://secure-sbi-kyc-update.xyz/login")["brand_in_unrelated_hostname"], "moderate")

    def test_misspelled_brand_inside_a_hyphenated_name_is_found(self):
        self.assertEqual(strengths("https://paypa1-account-verify.com/login")["brand_typo"], "moderate")

    def test_official_domains_are_not_flagged(self):
        for url in ("https://www.onlinesbi.com/login", "https://netbanking.hdfcbank.com/verify", "https://paytm.com/login"):
            with self.subTest(url=url):
                self.assertEqual(strengths(url), {})

    def test_short_brands_and_common_words_are_not_treated_as_typos(self):
        self.assertNotIn("brand_typo", strengths("https://obi-store.example/login"))
        self.assertNotIn("brand_typo", strengths("https://apply-account.example/login"))


if __name__ == "__main__":
    unittest.main()
