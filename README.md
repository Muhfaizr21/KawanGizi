# MBG

Full-stack application project consisting of a Golang backend (MVC, Clean Code, SOLID, Swagger), a Python AI service (FastAPI + YOLOv8), a React frontend (Vite, Tailwind CSS v4), and an Expo mobile app.

## Project Structure

- **[backend/](backend)**: Golang REST API server built with MVC architecture, Clean Code & SOLID principles, documented with Swagger UI.
- **[backend/ai_service/](backend/ai_service)**: FastAPI AI service that runs the meal classifier and cooked-food freshness classifier on each scan.
- **[backend/data/](backend/data)**: Dataset files (CSV/JSON/XLSX) downloaded from Google Drive.
- **[frontend/](frontend)**: React + Vite web client styled with Tailwind CSS v4.
- **[mobile/](mobile)**: Expo (React Native) mobile client.

## Quick Start

### Backend
```bash
cd backend
go run main.go
```
- Server: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/swagger/index.html`

### AI Service (required for food scan)
```bash
cd backend
pip install -r requirements.txt
cd ai_service
uvicorn app.main:app --host 127.0.0.1 --port 8083
```
- Health: `http://127.0.0.1:8083/health`
- The gateway reads `AI_BACKEND_URL` (default `http://127.0.0.1:8083`).

### Frontend
```bash
cd frontend
npm install
npm run dev
```
- Dev Client: `http://localhost:5173`

### Mobile
```bash
cd mobile
npm install
npx expo start
```

## Food Scan API

`POST /api/scans` (permission `scan.submit`, role `validator`) accepts multipart `image`, a batch ID or `qrToken`, and measured `holdingTempC`/`releaseTempC`. The Go gateway runs both AI classifiers and looks up batch, SPPG, menu, and package nutrition in the production tables. When a recipe with measured ingredient weights is available it calculates nutrition from those items; otherwise it shows the package totals or reports the data as unavailable. Legacy mobile clients may still send `items` while transitioning.

The AI service loads `backend/model_ai/makanan_indo.pt` (29 Indonesian food classes) to name dishes and `backend/model_ai/objek_deteksi.pt` to localise food objects, plus `backend/model_ai/cooked_food_freshness_best.pt` for freshness. Override them with `AI_MENU_MODEL_PATH`, `AI_DETECTOR_MODEL_PATH`, and `AI_FRESHNESS_MODEL_PATH`. The detector finds every food region (including items the menu model alone would miss); each crop is then named in Indonesian by the menu model. Use batch menu data as the displayed canonical menu, and prefer retraining the menu model before relying on its visual labels for meals outside the 29 classes.
