import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.main import app
from backend.message_analysis import analyze_message, load_model, preprocess_message
from backend.train_message_model import train


class MessagePreprocessingTests(unittest.TestCase):
    def test_extracts_links_phone_email_and_normalizes_whitespace(self):
        result = preprocess_message("  Visit https://example.test/path, call +1 234 567 8901\n or mail a@b.test ")
        self.assertEqual(result["normalized_text"], "Visit https://example.test/path, call +1 234 567 8901 or mail a@b.test")
        self.assertEqual(result["urls"], ["https://example.test/path"])
        self.assertTrue(result["phone_numbers"])
        self.assertEqual(result["email_addresses"], ["a@b.test"])

    def test_empty_and_oversized_messages_are_rejected(self):
        for value in ("", " \n\t ", "x" * 10001):
            with self.subTest(length=len(value)), self.assertRaises(ValueError):
                preprocess_message(value)


class MessageAnalysisTests(unittest.TestCase):
    def test_promotional_chain_spam_detects_reward_urgency_forwarding_and_link_context(self):
        message = ("You have been selected as today's LUCKY WINNER! Get an exclusive ₹50,000 shopping voucher absolutely FREE! "
                   "Limited slots available! Claim your reward NOW before midnight! "
                   "Visit: https://super-deals.example.com/reward "
                   "Forward this message to 15 friends to unlock your bonus gift!")
        with patch("backend.message_analysis._model_prediction", return_value={
                "status": "available", "label": "spam", "confidence": 0.97, "model": "LogisticRegression"}):
            report = analyze_message(message)
        codes = {item["code"] for item in report["indicators"]}
        self.assertTrue({"lottery_prize", "promotional_reward", "urgency_pressure",
                         "forwarding_incentive", "promotion_related_url"} <= codes)
        self.assertEqual(report["extracted_urls"], ["https://super-deals.example.com/reward"])
        self.assertGreater(report["heuristic_risk_score"], 24)
        self.assertGreaterEqual(report["heuristic_risk_score"], 42)
        self.assertEqual(report["classification"], "Likely scam or spam")

    def test_promotional_reward_overlaps_are_grouped_not_double_counted(self):
        from backend.message_analysis import calculate_heuristic_risk_score
        indicators = [
            {"code": "lottery_prize"}, {"code": "promotional_reward"},
            {"code": "message_url"}, {"code": "promotion_related_url"},
        ]
        # Keep the stronger signal per reward and link family: 20 + 18.
        self.assertEqual(calculate_heuristic_risk_score(indicators), 38)

    def test_bank_kyc_phishing_score_remains_ninety(self):
        message = ("Dear customer, your bank account is blocked. Complete KYC immediately. "
                   "Verify your account at https://bank.example.com/kyc and send your OTP, "
                   "password, CVV, and PIN number.")
        with patch("backend.message_analysis._model_prediction", return_value={
                "status": "available", "label": "spam", "confidence": 0.91, "model": "LogisticRegression"}):
            report = analyze_message(message)
        self.assertEqual(report["heuristic_risk_score"], 90)
        self.assertEqual(report["classification"], "Likely scam or spam")

    def test_indicators_are_separate_from_model_prediction(self):
        with patch("backend.message_analysis._model_prediction", return_value={
                "status": "available", "label": "ham", "confidence": 0.8, "model": "LogisticRegression"}):
            report = analyze_message("Your bank account is blocked. Verify your KYC immediately. https://bit.ly/test")
        codes = {indicator["code"] for indicator in report["indicators"]}
        self.assertIn("banking_kyc", codes)
        self.assertIn("urgency_pressure", codes)
        self.assertIn("shortened_url", codes)
        self.assertEqual(report["model_prediction"]["label"], "ham")
        self.assertGreater(report["heuristic_risk_score"], 0)
        self.assertEqual(report["extracted_urls"], ["https://bit.ly/test"])

    def test_legitimate_message_and_model_unavailable(self):
        with patch("backend.message_analysis._model_prediction", return_value={
                "status": "unavailable", "label": None, "confidence": None, "model": None}):
            report = analyze_message("Thanks, see you at the library at six.")
        self.assertEqual(report["risk_level"], "Unknown")
        self.assertEqual(report["indicators"], [])
        self.assertEqual(report["model_prediction"]["status"], "unavailable")

    def test_mixed_message_reports_independent_heuristic_and_model_outputs(self):
        with patch("backend.message_analysis._model_prediction", return_value={
                "status": "available", "label": "spam", "confidence": 0.91, "model": "LogisticRegression"}):
            report = analyze_message("Your parcel is delayed. For help, pay the delivery fee now.")
        self.assertEqual(report["model_prediction"]["label"], "spam")
        self.assertEqual(report["classification"], "Likely scam or spam")
        self.assertIn("payment_request", {i["code"] for i in report["indicators"]})

    def test_prize_job_payment_credential_and_impersonation_patterns(self):
        message = ("Dear customer, you are a lottery winner. Claim your prize now. "
                   "We offer a work from home job; pay the registration fee and send your password and CVV.")
        with patch("backend.message_analysis._model_prediction", return_value={
                "status": "available", "label": "spam", "confidence": 0.88, "model": "LogisticRegression"}):
            report = analyze_message(message)
        codes = {indicator["code"] for indicator in report["indicators"]}
        self.assertTrue({"lottery_prize", "job_offer", "payment_request", "credential_harvesting", "impersonation"} <= codes)

    def test_corrupt_or_missing_model_does_not_break_analysis(self):
        with patch("backend.message_analysis.MODEL_PATH", Path("missing-message-model.joblib")):
            load_model.cache_clear()
            try:
                with self.assertRaises(FileNotFoundError):
                    load_model()
                report = analyze_message("Hello, are we still meeting?")
                self.assertEqual(report["model_prediction"]["status"], "unavailable")
            finally:
                load_model.cache_clear()


class MessageApiTests(unittest.TestCase):
    def test_endpoint_accepts_message_and_returns_structured_result(self):
        with patch("backend.message_analysis._model_prediction", return_value={
                "status": "available", "label": "spam", "confidence": 0.95, "model": "LogisticRegression"}):
            with TestClient(app) as client:
                response = client.post("/api/analyze-message", json={"message": "Claim your prize immediately"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("classification", body)
        self.assertIn("risk_level", body)
        self.assertIn("confidence", body)
        self.assertIn("indicators", body)
        self.assertIn("explanation", body)
        self.assertIn("recommendation", body)

    def test_empty_oversized_and_malformed_requests_return_422(self):
        with TestClient(app) as client:
            self.assertEqual(client.post("/api/analyze-message", json={"message": ""}).status_code, 422)
            self.assertEqual(client.post("/api/analyze-message", json={"message": "x" * 10001}).status_code, 422)
            self.assertEqual(client.post("/api/analyze-message", json={}).status_code, 422)

    def test_training_compares_models_and_saves_logistic_regression(self):
        rows = ["ham\tHello, how are you?", "spam\tClaim your cash prize now", "ham\tMeet me at the station",
                "spam\tWin a free prize today", "ham\tAre we meeting later", "spam\tUrgent claim your reward",
                "ham\tThanks for calling", "spam\tFree cash offer click now", "ham\tSee you tomorrow",
                "spam\tYou have won a cash reward"]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dataset = root / "messages.tsv"
            dataset.write_text("\n".join(rows) + "\n", encoding="utf-8")
            result = train(dataset, root / "model.joblib")
            self.assertEqual(result["selected_model"], "LogisticRegression")
            self.assertEqual(set(result["models"]), {"LogisticRegression", "MultinomialNB"})
            self.assertIn("confusion_matrix", result["models"]["LogisticRegression"])


if __name__ == "__main__":
    unittest.main()
