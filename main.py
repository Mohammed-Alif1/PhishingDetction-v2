
from pathlib import Path
from urllib.parse import urlsplit

import numpy as np
import xgboost as xgb

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from URLFeatureExtraction import (
    featureExtraction,
    FEATURE_NAMES
)

# ==========================================
# SENTINEL AI BACKEND
# ==========================================

app = FastAPI(title="SentinelAI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"]
)

# ==========================================
# FILE PATHS
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = BASE_DIR / "sentinel_model.json"

DASHBOARD_PATH = BASE_DIR / "dashboard" / "index.html"

# ==========================================
# LOAD XGBOOST MODEL
# ==========================================

model = xgb.Booster()
model.load_model(str(MODEL_PATH))


# ==========================================
# REQUEST MODEL
# ==========================================

class URLRequest(BaseModel):
    url: str


# ==========================================
# HOME ENDPOINT
# ==========================================

@app.get("/")
def home():
    return {
        "message": "SentinelAI Backend Running",
        "model": "XGBoost URL Classifier"
    }


# ==========================================
# DASHBOARD ENDPOINT
# ==========================================

@app.get("/dashboard", include_in_schema=False)
def open_dashboard():

    if not DASHBOARD_PATH.is_file():
        raise HTTPException(
            status_code=404,
            detail="SentinelAI dashboard not found"
        )

    return FileResponse(
        path=DASHBOARD_PATH,
        media_type="text/html"
    )


# ==========================================
# PHISHING DETECTION ENDPOINT
# ==========================================

@app.post("/scan")
def scan_website(request: URLRequest):

    url = request.url.strip()

    if len(url) > 8192:
        raise HTTPException(
            status_code=400,
            detail="URL is too long"
        )

    parsed = urlsplit(url)

    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(
            status_code=400,
            detail="A valid HTTP or HTTPS URL is required"
        )

    try:

        features = featureExtraction(url)

        data = np.array(
            [features],
            dtype=np.float32
        )

        matrix = xgb.DMatrix(
            data,
            feature_names=FEATURE_NAMES
        )

        probability = float(model.predict(matrix)[0])

        return {
            "url": url,
            "prediction": (
                "Phishing" if probability >= 0.5
                else "Legitimate"
            ),
            "risk_score": round(probability * 100, 2)
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )
