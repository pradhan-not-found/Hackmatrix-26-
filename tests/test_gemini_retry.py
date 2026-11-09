import unittest
from unittest.mock import patch

from backend import gemini

INVALID = {"status": "unavailable", "error_code": "invalid_response"}
DONE = {"status": "completed"}


class GeminiRetryTests(unittest.TestCase):
    def test_invalid_response_is_retried_once(self):
        with patch("backend.gemini._generate_insights", side_effect=[INVALID, DONE]) as generate:
            self.assertEqual(gemini.explain({}), DONE)
        self.assertEqual(generate.call_count, 2)

    def test_other_failures_are_not_retried(self):
        quota = {"status": "unavailable", "error_code": "quota_exceeded"}
        with patch("backend.gemini._generate_insights", return_value=quota) as generate:
            self.assertEqual(gemini.explain({}), quota)
        self.assertEqual(generate.call_count, 1)


if __name__ == "__main__":
    unittest.main()
