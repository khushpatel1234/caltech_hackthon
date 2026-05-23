# 🧪 ChronosLayer

Advanced longevity clinic project scaffold featuring a high-performance **FastAPI** Python analysis engine and an interactive **Next.js 14** React web dashboard.

---

## 🏗️ Architecture

```
├── backend/               # FastAPI Python 3.11 Microservice
│   ├── main.py            # API endpoints, SQLAlchemy schemas & database engine
│   └── requirements.txt   # Python dependency manifest
│
├── frontend/              # Next.js 14 Web Application (App Router)
│   ├── app/               # Landing page, layout wrappers and global styles
│   ├── package.json       # Node package manager manifest
│   └── tailwind.config.ts # Custom clinical-slate visual theme
│
├── docker-compose.yml     # Complete root-level local orchestration config
└── README.md              # Setup & deployment guidelines (This file)
```

---

## ⚡ Quick Start: Running with Docker Compose (Under 1 Minute)

Run both the FastAPI backend and Next.js frontend in isolated containers instantly:

```bash
docker-compose up --build
```

- **Next.js Web Client**: [http://localhost:3000](http://localhost:3000) (mounted to port `3001` via compose)
- **FastAPI Core**: [http://localhost:8000](http://localhost:8000)
- **API Health Check**: [http://localhost:8000/health](http://localhost:8000/health)
- **Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🛠️ Manual Step-by-Step Local Run (Under 2 Minutes)

If you prefer running services directly on your host machine:

### 1. Launch the FastAPI Backend

Open a terminal window and run:

```bash
# Navigate to backend 
cd backend

# Create a virtual environment (optional but recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows, use `venv\Scripts\activate`

# Install required numerical analysis and FastAPI dependencies
pip install -r requirements.txt

# Boot up the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Launch the Next.js Frontend

Open a second terminal window, and run:

```bash
# Navigate to frontend
cd frontend

# Install packages
npm install

# Run the local development server
npm run dev
```

The app will now be running on [http://localhost:3000](http://localhost:3000).

---

## 🧬 Biomarker & Database Specifications

Out-of-the-box, the backend is loaded with a fully structured **SQLite database** using **SQLAlchemy** ORM model mapping.
- **Biomarkers Tracked**: Biological Age, Chronological Age, VO2 Max (ml/kg/min), hs-CRP Inflammation levels (mg/L), and Methylation Index.
- **Auto-Fallbacks**: If the FastAPI backend is not started, the Next.js visual landing page automatically falls back to secure client-side simulations to protect the operator interface.

---

## 🧪 API Endpoint Testing Guide

You can easily query and test all the newly added ChronosLayer clinical cohort and patient trajectory endpoints running on `http://localhost:8000`.

### 1. Register a New Patient
Registers an experimental patient. If fields are omitted, standard clinical demographics and mock structures are seeded.
* **HTTPie**:
  ```bash
  http POST http://localhost:8000/api/patient/new name="Jane Doe" chronological_age=48.5 sex="Female" lifestyle_score=7.8
  ```
* **CURL**:
  ```bash
  curl -X POST http://localhost:8000/api/patient/new \
    -H "Content-Type: application/json" \
    -d '{"name": "Jane Doe", "chronological_age": 48.5, "sex": "Female", "lifestyle_score": 7.8}'
  ```

### 2. Retrieve Patient Medical Records & AI Diagnosis
Fetches details for a patient by ID (including our reference case `"hero"`), returning demographics, latest clock scores, and generative AI analysis.
* **HTTPie**:
  ```bash
  http GET http://localhost:8000/api/patient/hero
  ```
* **CURL**:
  ```bash
  curl -X GET http://localhost:8000/api/patient/hero
  ```

### 3. Fetch Patient Longitudinal Trajectory Mapping
Generates linear slope fits, Bayesian consensus age lines, and detects changepoints ready for interactive medical charts.
* **HTTPie**:
  ```bash
  http GET http://localhost:8000/api/patient/hero/trajectory
  ```
* **CURL**:
  ```bash
  curl -X GET http://localhost:8000/api/patient/hero/trajectory
  ```

### 4. Record a New Longevity Intervention
Logs a therapy (e.g. Rapamycin, Metformin) and causes the system to run the multivariate biological simulator to create updated decelerated trends.
* **HTTPie**:
  ```bash
  http POST http://localhost:8000/api/patient/hero/intervention name="Metformin (Therapeutic)" start_date="Month 12"
  ```
* **CURL**:
  ```bash
  curl -X POST http://localhost:8000/api/patient/hero/intervention \
    -H "Content-Type: application/json" \
    -d '{"name": "Metformin (Therapeutic)", "start_date": "Month 12"}'
  ```

### 5. Inquire of the Copilot Chat Channel
Asks arbitrary diagnostic or evidence-based follow-up questions from the clinical interpreter regarding the de-identified patient case.
* **HTTPie**:
  ```bash
  http POST http://localhost:8000/api/patient/hero/followup question="Will adding Metformin further slow down PhenoAge progression?"
  ```
* **CURL**:
  ```bash
  curl -X POST http://localhost:8000/api/patient/hero/followup \
    -H "Content-Type: application/json" \
    -d '{"question": "Will adding Metformin further slow down PhenoAge progression?"}'
  ```

### 6. View Cohort Register (Auto-Seeds 50 Patients on First Load)
Returns summary index cards for the registered patients, together with aggregate summary averages (chronological age, DunedinPACE rate, intervention prevalences).
* **HTTPie**:
  ```bash
  http GET http://localhost:8000/api/cohort
  ```
* **CURL**:
  ```bash
  curl -X GET http://localhost:8000/api/cohort
  ```

### 7. Core Cohort Advanced Aggregations
Requests detailed visual statistical markers distributions (e.g. clock correlations, age groupings, decelerator-vs-accelerator counts).
* **HTTPie**:
  ```bash
  http GET http://localhost:8000/api/cohort/stats
  ```
* **CURL**:
  ```bash
  curl -X GET http://localhost:8000/api/cohort/stats
  ```

