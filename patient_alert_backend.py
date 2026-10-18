# SERVER APPLICATION CODE
# This cell contains only the code that Uvicorn should run.

from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel, Field
from winotify import Notification, audio
from fastapi.middleware.cors import CORSMiddleware

# ==================================================
# 1. LOAD THE EXISTING MODEL
# ==================================================

BASE_DIR = Path(r"D:\patient_alert_system")
MODEL_PATH = BASE_DIR / "models" / "lifeguard_isolation_forest.joblib"

if not MODEL_PATH.is_file():
    raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

bundle = joblib.load(MODEL_PATH)

model = bundle["model"]
imputer = bundle["imputer"]
scaler = bundle["scaler"]
feature_columns = bundle["feature_columns"]


# ==================================================
# 2. CREATE FASTAPI APPLICATION
# ==================================================

app = FastAPI(
    title="LifeGuard AI Patient Alert System",
    description="Detects statistical anomalies in patient measurements.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================================================
# 3. DEFINE API INPUT
# ==================================================

class PredictionRequest(BaseModel):
    patient_id: str = Field(min_length=1)

    heart_rate: float = Field(gt=0)
    respiratory_rate: float = Field(gt=0)
    body_temperature: float
    oxygen_saturation: float = Field(ge=0, le=100)

    systolic_bp: float = Field(gt=0)
    diastolic_bp: float = Field(gt=0)

    age: float = Field(gt=0)
    weight: float = Field(gt=0)
    height: float = Field(gt=0)

    derived_hrv: float
    gender: str


# ==================================================
# 4. WINDOWS NOTIFICATION
# ==================================================

def send_windows_notification(patient_id, anomaly_score):
    toast = Notification(
        app_id="LifeGuard AI",
        title="PATIENT ANOMALY ALERT",
        msg=(
            f"Patient {patient_id}: unusual measurement pattern detected. "
            f"Model decision score: {anomaly_score:.4f}. "
            "Review the readings and follow appropriate clinical procedures."
        ),
        duration="long"
    )

    toast.set_audio(audio.Default, loop=False)
    toast.show()


# ==================================================
# 5. HOME ENDPOINT
# ==================================================

@app.get("/")
def home():
    return {
        "message": "LifeGuard AI API is running",
        "status": "success",
        "model_loaded": True
    }


# ==================================================
# 6. PREDICTION ENDPOINT
# ==================================================

@app.post("/predict")
def predict_risk(data: PredictionRequest):

    # Calculate derived features in the same way as the model interface.
    bmi = data.weight / (data.height ** 2)
    pulse_pressure = data.systolic_bp - data.diastolic_bp
    mean_arterial_pressure = (
        data.systolic_bp + 2 * data.diastolic_bp
    ) / 3

    if data.systolic_bp <= data.diastolic_bp:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=422,
            detail="Systolic blood pressure must exceed diastolic pressure."
        )

    if data.gender not in ["Male", "Female"]:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=422,
            detail="gender must be 'Male' or 'Female'."
        )

    # Construct the input features.
    patient = pd.DataFrame([{
        "Heart Rate": data.heart_rate,
        "Respiratory Rate": data.respiratory_rate,
        "Body Temperature": data.body_temperature,
        "Oxygen Saturation": data.oxygen_saturation,
        "Systolic Blood Pressure": data.systolic_bp,
        "Diastolic Blood Pressure": data.diastolic_bp,
        "Age": data.age,
        "Weight (kg)": data.weight,
        "Height (m)": data.height,
        "Derived_HRV": data.derived_hrv,
        "Derived_Pulse_Pressure": pulse_pressure,
        "Derived_BMI": bmi,
        "Derived_MAP": mean_arterial_pressure,
        "Gender_Female": int(data.gender == "Female"),
        "Gender_Male": int(data.gender == "Male")
    }])

    # Match the model's required feature names and order.
    try:
        patient = patient[feature_columns]
    except KeyError as exc:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail=(
                "The API input features do not match the saved model. "
                "Check the model's training feature columns."
            )
        ) from exc

    # Apply the saved preprocessing objects.
    patient_imputed = pd.DataFrame(
        imputer.transform(patient),
        columns=feature_columns
    )

    patient_scaled = scaler.transform(patient_imputed)

    # Run the existing Isolation Forest.
    prediction = int(model.predict(patient_scaled)[0])
    anomaly_score = float(model.decision_function(patient_scaled)[0])

    anomaly_detected = prediction == -1

    # Notify only when the model flags an anomaly.
    if anomaly_detected:
        send_windows_notification(data.patient_id, anomaly_score)

    return {
        "patient_id": data.patient_id,
        "prediction": prediction,
        "result": (
            "ANOMALY_DETECTED"
            if anomaly_detected
            else "NO_STATISTICAL_ANOMALY_DETECTED"
        ),
        "anomaly_score": anomaly_score,
        "notification_triggered": anomaly_detected,
        "bmi": round(bmi, 2),
        "pulse_pressure": round(pulse_pressure, 2),
        "mean_arterial_pressure": round(mean_arterial_pressure, 2),
        "notice": (
            "This statistical anomaly result is not a medical diagnosis "
            "or a validated prediction of patient deterioration."
        )
    }
