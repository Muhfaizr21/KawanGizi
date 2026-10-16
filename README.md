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
- Root `/`: landing page bertema KawanGizi (popup sambutan + status layanan) untuk browser; respons JSON tetap dikembalikan ke client API/curl lewat content negotiation `Accept`.
- Swagger UI: `http://localhost:8080/swagger/index.html`

### AI Service (required for food scan)
```bash
cd backend/ai_service
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8083
```
- Health: `http://127.0.0.1:8083/health`
- The gateway reads `AI_BACKEND_URL` (default `http://127.0.0.1:8083`). Salin `backend/.env.example` ke `backend/.env` untuk melihat seluruh variabel yang dibutuhkan.

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

## Deployment

Scan is the one feature that needs **two** running services. The Go gateway never infers anything itself; it forwards each photo to the AI service. Deploying only the gateway leaves every `POST /api/scans` returning `502`, which is the single most common production failure here.

1. Deploy the AI service (FastAPI + YOLO) and point `AI_BACKEND_URL` at its base URL. Behind a container platform it must listen on `0.0.0.0`, not the loopback default.
2. Deploy the Go gateway with that same `AI_BACKEND_URL` plus `CORS_ORIGINS` for the web origin.
3. Build the frontend with `VITE_API_BASE_URL` set to the gateway URL. When omitted the client falls back to `<host>:8080`, which does not exist behind a CDN or reverse proxy.
4. `APP_ENV=production` makes the gateway refuse to start without an explicit `AI_BACKEND_URL`, a strong `JWT_SECRET`, and `DB_SSLMODE=require`.

`render.yaml` is a ready-to-use Render blueprint for both services.

### Verifying a deployment

```bash
curl -s https://<gateway>/api/health
```

`scanReady` is the field to watch. It is `true` only when the gateway can reach the AI service *and* the AI service reports its models loaded; the `ai` object carries the URL, the latency, and the exact failure otherwise. The gateway also probes the AI service at boot and prints a warning when scanning cannot work, so the cause shows up in the deploy logs before any user hits it.

### Timeouts

`AI_REQUEST_TIMEOUT_SECONDS` bounds one inference call; `SERVER_WRITE_TIMEOUT_SECONDS` bounds the HTTP response. The write timeout is silently raised to at least 30 s above the AI timeout, because closing the socket while the model is still running reaches the user as a bare network error instead of a scan result.

## Food Scan API

`POST /api/scans` (permission `scan.submit`, role `validator`) accepts multipart `image`, a batch ID or `qrToken`, and measured `holdingTempC`/`releaseTempC`. The Go gateway runs both AI classifiers and looks up batch, SPPG, menu, and package nutrition in the production tables. When a recipe with measured ingredient weights is available it calculates nutrition from those items; otherwise it shows the package totals or reports the data as unavailable. Legacy mobile clients may still send `items` while transitioning.

The AI service loads `backend/model_ai/makanan_minuman.pt` (34 Indonesian food and drink classes, including rice/noodle and milk) to name dishes and `backend/model_ai/objek_deteksi.pt` to localise food objects, plus `backend/model_ai/cooked_food_freshness_best.pt` for freshness. Fruits and vegetables are named by `backend/model_ai/buah.pt` (26 English produce classes, displayed in Indonesian) whenever the localised object is in the `buah`/`sayur` category; every other crop, including `minuman` and `makanan_pokok`, is named by `makanan_minuman.pt`. Objects belonging to people are dropped before naming using the COCO detector `backend/model_ai/orang.pt` (class `person`); any detection mostly covered by a person box is skipped so scans only surface food. Override them with `AI_MENU_MODEL_PATH`, `AI_DETECTOR_MODEL_PATH`, `AI_PRODUCE_MODEL_PATH`, `AI_PERSON_MODEL_PATH`, and `AI_FRESHNESS_MODEL_PATH` (person filter tuning via `AI_PERSON_CONF`, `AI_PERSON_OVERLAP`, `AI_PERSON_CLASS_ID`; the filter is skipped if the checkpoint is absent). The detector finds every food region; each crop is then named in Indonesian by exactly one authoritative model based on its category (`buah.pt` for fruit/vegetables, otherwise `makanan_minuman.pt`) so predictions from unrelated models cannot override the correct one. Crops are expanded by `AI_CROP_PAD` (default `0.3` of each side) before naming because the naming models are far more accurate with a little surrounding context. Use batch menu data as the displayed canonical menu, and prefer retraining the menu model before relying on its visual labels for meals outside the 34 classes.
