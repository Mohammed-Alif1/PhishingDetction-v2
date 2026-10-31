
import pandas as pd
import numpy as np
import xgboost as xgb

from urllib.parse import urlsplit
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)

from URLFeatureExtraction import featureExtraction, FEATURE_NAMES


RANDOM_STATE = 42

TRANCO_FILE = "DataFiles/tranco.csv"
BENIGN_FILE = "DataFiles/1.Benign_list_big_final.csv"
PHISHING_FILE = "DataFiles/2.online-valid.csv"

MODEL_FILE = "sentinel_model.json"


def hostname_of(url):
    try:
        return (urlsplit(url).hostname or "").lower()
    except ValueError:
        return ""


def prepare_urls():
    print("Loading Tranco domains...")

    tranco = pd.read_csv(
        TRANCO_FILE,
        header=None,
        names=["rank", "domain"],
        dtype={"domain": str}
    )

    tranco = tranco.dropna(subset=["domain"])
    tranco["domain"] = tranco["domain"].str.strip().str.lower()

    tranco = tranco[
        tranco["domain"].str.match(
            r"^[a-z0-9.-]+\.[a-z]{2,}$",
            na=False
        )
    ]

    tranco = tranco.head(20000)

    tranco_urls = pd.DataFrame({
        "url": "https://" + tranco["domain"],
        "label": 0
    })

    print("Loading existing legitimate URLs...")

    benign = pd.read_csv(
        BENIGN_FILE,
        header=None,
        names=["url"],
        on_bad_lines="skip"
    )

    benign = benign.sample(
        n=min(10000, len(benign)),
        random_state=RANDOM_STATE
    ).copy()

    benign["label"] = 0

    print("Loading phishing URLs...")

    phishing = pd.read_csv(
        PHISHING_FILE,
        on_bad_lines="skip"
    )

    phishing = phishing[["url"]].copy()
    phishing["label"] = 1

    data = pd.concat(
        [
            tranco_urls[["url", "label"]],
            benign[["url", "label"]],
            phishing[["url", "label"]]
        ],
        ignore_index=True
    )

    data = data.dropna(subset=["url"])
    data["url"] = data["url"].astype(str).str.strip()
    data = data[data["url"] != ""]

    data["hostname"] = data["url"].apply(hostname_of)
    data = data[data["hostname"] != ""]

    conflicting = (
        data.groupby("url")["label"]
        .nunique()
    )

    conflicting_urls = conflicting[conflicting > 1].index
    data = data[~data["url"].isin(conflicting_urls)]

    data = data.drop_duplicates(subset=["url"])

    print("\nDataset distribution:")
    print(data["label"].value_counts())

    return data


def train():
    data = prepare_urls()

    print("\nExtracting URL features...")

    features = []
    labels = []
    hostnames = []

    for row in data.itertuples(index=False):
        try:
            extracted = featureExtraction(row.url)
            features.append(extracted)
            labels.append(row.label)
            hostnames.append(row.hostname)
        except (ValueError, TypeError):
            continue

    X = pd.DataFrame(features, columns=FEATURE_NAMES)
    y = np.array(labels)
    groups = np.array(hostnames)

    print("Total usable URLs:", len(X))

    splitter = GroupShuffleSplit(
        n_splits=1,
        test_size=0.2,
        random_state=RANDOM_STATE
    )

    train_idx, test_idx = next(
        splitter.split(X, y, groups=groups)
    )

    X_train = X.iloc[train_idx]
    X_test = X.iloc[test_idx]

    y_train = y[train_idx]
    y_test = y[test_idx]

    print("\nTraining samples:", len(X_train))
    print("Testing samples:", len(X_test))

    print("\nTraining XGBoost model...")

    model = xgb.XGBClassifier(
        n_estimators=250,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=RANDOM_STATE,
        n_jobs=4
    )

    model.fit(X_train, y_train)

    predictions = model.predict(X_test)

    print("\nAccuracy:", accuracy_score(y_test, predictions))

    print("\nClassification Report:")
    print(classification_report(y_test, predictions))

    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, predictions))

    model.get_booster().save_model(MODEL_FILE)

    print("\nModel saved:", MODEL_FILE)

    print("\nSanity checks:")

    test_urls = [
        "https://github.com/",
        "https://www.google.com/",
        "https://example.com/",
        "https://www.wikipedia.org/"
    ]

    for url in test_urls:
        vector = featureExtraction(url)
        matrix = xgb.DMatrix(
            np.array([vector], dtype=np.float32),
            feature_names=FEATURE_NAMES
        )
        probability = float(
            model.get_booster().predict(matrix)[0]
        )
        print(
            f"{url} -> phishing score: {probability * 100:.2f}%"
        )


if __name__ == "__main__":
    train()
