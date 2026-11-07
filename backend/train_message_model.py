"""Train and evaluate the TF-IDF SMS classifier using the UCI SMS Spam Collection."""

import argparse
import json
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB

from backend.message_analysis import MODEL_PATH, preprocess_message


def read_dataset(path: Path) -> tuple[list[str], list[str]]:
    texts, labels = [], []
    with path.open(encoding="utf-8", errors="replace") as source:
        for line_number, line in enumerate(source, 1):
            label, separator, text = line.rstrip("\r\n").partition("\t")
            if not separator or label not in {"ham", "spam"} or not text.strip():
                continue
            texts.append(preprocess_message(text)["normalized_text"])
            labels.append(label)
    if not texts or set(labels) != {"ham", "spam"}:
        raise ValueError("Dataset must be tab-separated rows with ham/spam label and message text")
    return texts, labels


def evaluate(model, train_x, test_x, train_y, test_y) -> dict:
    model.fit(train_x, train_y)
    predictions = model.predict(test_x)
    precision, recall, f1, _ = precision_recall_fscore_support(
        test_y, predictions, labels=["ham", "spam"], average="binary", pos_label="spam", zero_division=0)
    return {"accuracy": accuracy_score(test_y, predictions), "precision_spam": precision,
            "recall_spam": recall, "f1_spam": f1,
            "confusion_matrix_labels": ["ham", "spam"],
            "confusion_matrix": confusion_matrix(test_y, predictions, labels=["ham", "spam"]).tolist(),
            "classification_report": classification_report(test_y, predictions, labels=["ham", "spam"],
                                                            zero_division=0, output_dict=True)}


def train(dataset: Path, output: Path = MODEL_PATH, metrics_path: Path | None = None) -> dict:
    texts, labels = read_dataset(dataset)
    train_texts, test_texts, train_labels, test_labels = train_test_split(
        texts, labels, test_size=0.2, random_state=42, stratify=labels)
    vectorizer = TfidfVectorizer(lowercase=True, strip_accents="unicode", ngram_range=(1, 2),
                                 min_df=2, sublinear_tf=True)
    train_vectors = vectorizer.fit_transform(train_texts)
    test_vectors = vectorizer.transform(test_texts)
    candidates = {
        "LogisticRegression": LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42),
        "MultinomialNB": MultinomialNB(),
    }
    metrics = {name: evaluate(model, train_vectors, test_vectors, train_labels, test_labels)
               for name, model in candidates.items()}
    # Logistic Regression is the requested production model; NB is retained as a baseline.
    selected_name = "LogisticRegression"
    selected = candidates[selected_name]
    selected.fit(vectorizer.transform(texts), labels)
    output.parent.mkdir(parents=True, exist_ok=True)
    import joblib

    joblib.dump({"model": selected, "vectorizer": vectorizer, "model_name": selected_name,
                 "dataset": "UCI SMS Spam Collection", "label_mapping": {"ham": "ham", "spam": "spam"}}, output)
    result = {"dataset": "UCI SMS Spam Collection", "samples": len(texts), "train_samples": len(train_texts),
              "test_samples": len(test_texts), "split": {"test_size": 0.2, "random_state": 42, "stratified": True},
              "selected_model": selected_name, "models": metrics, "model_path": str(output)}
    if metrics_path:
        metrics_path.parent.mkdir(parents=True, exist_ok=True)
        metrics_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path, help="Path to UCI SMSSpamCollection TSV")
    parser.add_argument("--output", type=Path, default=MODEL_PATH)
    parser.add_argument("--metrics", type=Path, default=Path("data/message-model-metrics.json"))
    args = parser.parse_args()
    print(json.dumps(train(args.dataset, args.output, args.metrics), indent=2))


if __name__ == "__main__":
    main()
