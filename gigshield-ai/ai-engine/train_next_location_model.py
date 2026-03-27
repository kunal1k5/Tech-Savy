"""
Colab-ready training pipeline for next destination prediction.

Suggested Colab setup:
    !pip install kagglehub xgboost seaborn
    !python train_next_location_model.py
"""

from __future__ import annotations

import json
import re
import warnings
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import RandomizedSearchCV, train_test_split
from sklearn.preprocessing import LabelEncoder

DATASET_HANDLE = "vaishalij/san-francisco-caltrain-uber-movement-data"
DEFAULT_OUTPUT_DIR = Path.cwd()
FEATURE_COLUMNS = [
    "origin_id",
    "day_of_week",
    "hour_of_day",
    "travel_time_mean",
    "lower_bound",
    "upper_bound",
]
TARGET_COLUMN = "destination_encoded"


def load_dataset(dataset_path: str | None = None) -> Tuple[pd.DataFrame, Path]:
    if dataset_path:
        base_path = Path(dataset_path)
    else:
        import kagglehub

        base_path = Path(kagglehub.dataset_download(DATASET_HANDLE))

    csv_files = sorted(base_path.rglob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No CSV files were found under {base_path}")

    csv_path = csv_files[0]
    df = pd.read_csv(csv_path)
    print(f"Detected dataset: {csv_path}")
    print("Head:")
    print(df.head())
    return df, csv_path


def clean_column_name(column: str) -> str:
    cleaned = column.strip().lower()
    cleaned = re.sub(r"[\s/]+", "_", cleaned)
    cleaned = cleaned.replace("-", "_")
    cleaned = re.sub(r"[()]", "", cleaned)
    cleaned = re.sub(r"__+", "_", cleaned)
    return cleaned.strip("_")


def clean_dataset(df: pd.DataFrame) -> pd.DataFrame:
    cleaned = df.copy()
    cleaned.columns = [clean_column_name(column) for column in cleaned.columns]
    cleaned = cleaned.drop_duplicates().copy()

    numeric_columns = [
        "origin_movement_id",
        "destination_movement_id",
        "mean_travel_time_seconds",
        "range_lower_bound_travel_time_seconds",
        "range_upper_bound_travel_time_seconds",
    ]
    for column in numeric_columns:
        cleaned[column] = pd.to_numeric(cleaned[column], errors="coerce")

    cleaned = cleaned.dropna().reset_index(drop=True)
    return cleaned


def engineer_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, LabelEncoder, LabelEncoder]:
    engineered = df.copy()

    date_parts = engineered["date_range"].str.split(",", expand=True)
    date_window = date_parts[0].fillna("").str.strip()
    start_dates = pd.to_datetime(
        date_window.str.extract(r"^\s*(.*?)\s*-", expand=False),
        errors="coerce",
    )

    engineered["day_of_week"] = start_dates.dt.dayofweek.fillna(0).astype(int)
    engineered["hour_of_day"] = engineered["date_range"].apply(extract_hour_of_day).astype(int)
    engineered["travel_time_mean"] = engineered["mean_travel_time_seconds"].astype(float)
    engineered["lower_bound"] = engineered["range_lower_bound_travel_time_seconds"].astype(float)
    engineered["upper_bound"] = engineered["range_upper_bound_travel_time_seconds"].astype(float)
    engineered["travel_time_range"] = engineered["upper_bound"] - engineered["lower_bound"]

    origin_encoder = LabelEncoder()
    destination_encoder = LabelEncoder()

    engineered["origin_id"] = origin_encoder.fit_transform(
        engineered["origin_movement_id"].astype(str)
    )
    engineered["destination_encoded"] = destination_encoder.fit_transform(
        engineered["destination_movement_id"].astype(str)
    )

    return engineered, origin_encoder, destination_encoder


def extract_hour_of_day(date_range: str) -> int:
    if not isinstance(date_range, str):
        return 12

    time_match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)", date_range, flags=re.IGNORECASE)
    if time_match:
        hour = int(time_match.group(1)) % 12
        if time_match.group(3).upper() == "PM":
            hour += 12
        return hour

    numeric_hour = re.search(r"\b([01]?\d|2[0-3]):[0-5]\d\b", date_range)
    if numeric_hour:
        return int(numeric_hour.group(1))

    return 12


def analyze_dataset(df: pd.DataFrame) -> Dict[str, object]:
    target_counts = df["destination_movement_id"].value_counts()
    warnings_list: List[str] = []

    if df["origin_movement_id"].nunique() <= 1:
        warnings_list.append(
            "The dataset contains only one origin movement ID, so origin-based generalization is limited."
        )
    if df["date_range"].nunique() <= 1:
        warnings_list.append(
            "The dataset contains only one date range, so temporal features are effectively constant."
        )
    if int(target_counts.max()) <= 1:
        warnings_list.append(
            "Each destination appears only once. A true holdout multiclass evaluation will not be statistically reliable."
        )

    return {
        "row_count": int(len(df)),
        "column_count": int(df.shape[1]),
        "missing_values": df.isna().sum().to_dict(),
        "duplicate_rows": int(df.duplicated().sum()),
        "origin_count": int(df["origin_movement_id"].nunique()),
        "destination_count": int(df["destination_movement_id"].nunique()),
        "date_range_count": int(df["date_range"].nunique()),
        "warnings": warnings_list,
    }


def split_features(engineered: pd.DataFrame):
    X = engineered[FEATURE_COLUMNS].copy()
    y = engineered[TARGET_COLUMN].copy()
    target_counts = y.value_counts()
    supports_stratify = int(target_counts.min()) >= 2 and y.nunique() < len(y)

    if supports_stratify:
        return train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=42,
            stratify=y,
        ), "stratified_holdout"

    warnings.warn(
        "Destination labels do not have enough repeated samples for a stratified split. "
        "The holdout metrics below are only feasibility checks, not reliable generalization estimates.",
        stacklevel=2,
    )
    return train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    ), "non_stratified_holdout"


def build_model_candidates(random_state: int = 42):
    models = {
        "random_forest": RandomForestClassifier(
            n_estimators=200,
            random_state=random_state,
            class_weight="balanced_subsample",
            n_jobs=-1,
        ),
        "gradient_boosting": GradientBoostingClassifier(random_state=random_state),
    }

    try:
        from xgboost import XGBClassifier

        models["xgboost"] = XGBClassifier(
            objective="multi:softprob",
            eval_metric="mlogloss",
            learning_rate=0.05,
            max_depth=8,
            n_estimators=300,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=random_state,
            tree_method="hist",
        )
    except Exception:
        models["xgboost"] = None

    return models


def maybe_tune_model(name: str, model, X_train: pd.DataFrame, y_train: pd.Series):
    min_class_count = int(y_train.value_counts().min())
    supports_cv = min_class_count >= 3 and y_train.nunique() < 300

    if not supports_cv:
        model.fit(X_train, y_train)
        return model, {"search": "skipped", "reason": "insufficient class support for CV"}

    if name == "random_forest":
        param_distributions = {
            "n_estimators": [200, 300, 500],
            "max_depth": [10, 20, None],
            "min_samples_split": [2, 5, 10],
            "min_samples_leaf": [1, 2, 4],
        }
    elif name == "gradient_boosting":
        param_distributions = {
            "n_estimators": [100, 200, 300],
            "learning_rate": [0.03, 0.05, 0.1],
            "max_depth": [2, 3, 4],
        }
    elif name == "xgboost":
        param_distributions = {
            "n_estimators": [200, 300, 500],
            "max_depth": [6, 8, 10],
            "learning_rate": [0.03, 0.05, 0.1],
            "subsample": [0.8, 0.9, 1.0],
            "colsample_bytree": [0.8, 0.9, 1.0],
        }
    else:
        model.fit(X_train, y_train)
        return model, {"search": "skipped", "reason": "no tuning configuration"}

    search = RandomizedSearchCV(
        estimator=model,
        param_distributions=param_distributions,
        n_iter=5,
        scoring="f1_weighted",
        cv=3,
        random_state=42,
        n_jobs=-1,
        verbose=0,
    )
    search.fit(X_train, y_train)
    return search.best_estimator_, {
        "search": "randomized",
        "best_params": search.best_params_,
        "best_score": float(search.best_score_),
    }


def evaluate_model(
    name: str,
    model,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    label_encoder: LabelEncoder,
) -> Dict[str, object]:
    predictions = model.predict(X_test)
    accuracy = float(accuracy_score(y_test, predictions))
    weighted_f1 = float(f1_score(y_test, predictions, average="weighted", zero_division=0))
    macro_f1 = float(f1_score(y_test, predictions, average="macro", zero_division=0))

    labels_in_report = sorted(set(y_test.tolist()) | set(predictions.tolist()))
    limited_labels = labels_in_report[:25]
    label_names = label_encoder.inverse_transform(limited_labels).tolist()
    report = classification_report(
        y_test,
        predictions,
        labels=limited_labels,
        target_names=[str(name) for name in label_names],
        zero_division=0,
        output_dict=True,
    )

    return {
        "model_name": name,
        "accuracy": accuracy,
        "weighted_f1": weighted_f1,
        "macro_f1": macro_f1,
        "classification_report_preview": report,
        "predictions": predictions,
    }


def train_models(
    engineered: pd.DataFrame,
    destination_encoder: LabelEncoder,
) -> Tuple[
    object,
    Dict[str, object],
    Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series],
    str,
    np.ndarray,
]:
    split_result, split_mode = split_features(engineered)
    X_train, X_test, y_train, y_test = split_result
    candidates = build_model_candidates()
    target_is_high_cardinality = y_train.nunique() > 200 or int(y_train.value_counts().max()) <= 1

    results = []
    fitted_models = {}
    tuning_details = {}

    for name, model in candidates.items():
        if model is None:
            results.append(
                {
                    "model_name": name,
                    "status": "skipped",
                    "reason": "xgboost is not installed",
                }
            )
            continue

        if name != "random_forest" and target_is_high_cardinality:
            results.append(
                {
                    "model_name": name,
                    "status": "skipped",
                    "reason": (
                        "skipped for this dataset because the target has too many classes "
                        "with too few repeated samples"
                    ),
                }
            )
            continue

        tuned_model, tuning_info = maybe_tune_model(name, model, X_train, y_train)
        evaluation = evaluate_model(name, tuned_model, X_test, y_test, destination_encoder)
        evaluation["status"] = "ok"
        evaluation["tuning"] = tuning_info
        results.append(evaluation)
        fitted_models[name] = tuned_model
        tuning_details[name] = tuning_info

    successful = [result for result in results if result.get("status") == "ok"]
    best_result = max(successful, key=lambda item: (item["weighted_f1"], item["accuracy"]))
    best_model = fitted_models[best_result["model_name"]]
    report = {
        "split_mode": split_mode,
        "results": [
            {key: value for key, value in result.items() if key != "predictions"}
            for result in results
        ],
        "best_model_name": best_result["model_name"],
        "best_accuracy": best_result["accuracy"],
        "best_weighted_f1": best_result["weighted_f1"],
        "best_macro_f1": best_result["macro_f1"],
    }
    return (
        best_model,
        report,
        (X_train, X_test, y_train, y_test),
        best_result["model_name"],
        np.array(best_result["predictions"]),
    )


def fit_deployment_model(best_model, engineered: pd.DataFrame):
    X_full = engineered[FEATURE_COLUMNS]
    y_full = engineered[TARGET_COLUMN]
    best_model.fit(X_full, y_full)
    return best_model


def save_reference_file(
    output_dir: Path,
    df: pd.DataFrame,
) -> Path:
    reference = (
        df[["destination_movement_id", "destination_display_name"]]
        .drop_duplicates()
        .sort_values("destination_movement_id")
        .reset_index(drop=True)
    )
    reference.insert(0, "encoded_destination_id", reference.index)
    reference_path = output_dir / "next_location_reference.csv"
    reference.to_csv(reference_path, index=False)
    return reference_path


def save_confusion_matrix(
    output_dir: Path,
    y_test: pd.Series,
    predictions: np.ndarray,
    destination_encoder: LabelEncoder,
) -> Path:
    combined = pd.Series(y_test).value_counts().head(15).index.tolist()
    labels = sorted(set(combined))
    if not labels:
        raise ValueError("No labels were available to render the confusion matrix.")

    label_names = destination_encoder.inverse_transform(labels)
    matrix = confusion_matrix(y_test, predictions, labels=labels)

    plt.figure(figsize=(12, 8))
    sns.heatmap(
        matrix,
        annot=False,
        cmap="Blues",
        xticklabels=label_names,
        yticklabels=label_names,
    )
    plt.title("Confusion Matrix (Top 15 Holdout Destinations)")
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.tight_layout()

    output_path = output_dir / "next_location_confusion_matrix.png"
    plt.savefig(output_path, dpi=150)
    plt.close()
    return output_path


def save_report(
    output_dir: Path,
    dataset_info: Dict[str, object],
    training_report: Dict[str, object],
    in_sample_metrics: Dict[str, float],
) -> Path:
    report_path = output_dir / "next_location_report.json"
    report = {
        "dataset_info": dataset_info,
        "training_report": training_report,
        "in_sample_metrics": in_sample_metrics,
    }
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report_path


def evaluate_in_sample(model, engineered: pd.DataFrame) -> Dict[str, float]:
    X_full = engineered[FEATURE_COLUMNS]
    y_full = engineered[TARGET_COLUMN]
    predictions = model.predict(X_full)
    return {
        "accuracy": float(accuracy_score(y_full, predictions)),
        "weighted_f1": float(f1_score(y_full, predictions, average="weighted", zero_division=0)),
        "macro_f1": float(f1_score(y_full, predictions, average="macro", zero_division=0)),
    }


def run_pipeline(dataset_path: str | None = None, output_dir: str | None = None) -> Dict[str, object]:
    output_path = Path(output_dir) if output_dir else DEFAULT_OUTPUT_DIR
    output_path.mkdir(parents=True, exist_ok=True)

    raw_df, csv_path = load_dataset(dataset_path)
    cleaned_df = clean_dataset(raw_df)
    engineered_df, origin_encoder, destination_encoder = engineer_features(cleaned_df)

    dataset_info = analyze_dataset(cleaned_df)
    dataset_info["csv_path"] = str(csv_path)

    best_model, training_report, split_data, best_model_name, holdout_predictions = train_models(
        engineered_df,
        destination_encoder,
    )
    X_train, X_test, y_train, y_test = split_data

    deployment_model = fit_deployment_model(best_model, engineered_df)

    model_path = output_path / "next_location_model.pkl"
    joblib.dump(deployment_model, model_path)
    reference_path = save_reference_file(output_path, cleaned_df)
    confusion_matrix_path = save_confusion_matrix(
        output_path,
        y_test,
        holdout_predictions,
        destination_encoder,
    )
    in_sample_metrics = evaluate_in_sample(deployment_model, engineered_df)
    report_path = save_report(output_path, dataset_info, training_report, in_sample_metrics)

    print(f"Saved model: {model_path}")
    print(f"Saved reference file: {reference_path}")
    print(f"Saved report: {report_path}")
    print(f"Saved confusion matrix: {confusion_matrix_path}")
    print(json.dumps(training_report, indent=2))

    return {
        "model_path": str(model_path),
        "reference_path": str(reference_path),
        "report_path": str(report_path),
        "best_model_name": best_model_name,
        "in_sample_metrics": in_sample_metrics,
        "dataset_info": dataset_info,
    }


if __name__ == "__main__":
    run_pipeline()
