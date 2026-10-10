# 🌡️ HeatPath — Find the Coolest Walking Route

> **AWS Hackathon 2024** · Heat Maps + Water Points + AI Route Ranking

HeatPath analyzes real-time temperature, shade, and water access data to recommend the **coolest, safest walking route** between two points. Instead of the fastest route, HeatPath finds the one that keeps you coolest.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HeatPath Architecture                     │
├───────────────────┬─────────────────────────────────────────┤
│  Next.js Frontend │  Python FastAPI Backend                  │
│  (React + Leaflet)│  (AWS Lambda via Mangum)                │
│                   │                                          │
│  SearchPanel ───────→ POST /api/routes                       │
│  HeatMap     ←─────── Route scoring + AI explanation         │
│  RouteCard        │                                          │
│  WeatherBadge ─────→ GET /api/weather                        │
└───────────────────┴──────────────┬──────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
    ┌─────────────────┐  ┌──────────────────┐  ┌──────────────┐
    │  OSRM (OSM)     │  │  Open-Meteo      │  │  Overpass    │
    │  Walking routes │  │  Weather + UV    │  │  Water/Trees │
    │  (free, no key) │  │  (free, no key)  │  │  (free)      │
    └─────────────────┘  └──────────────────┘  └──────────────┘
              │                    │                    │
              └────────────────────┴────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
    ┌─────────────────┐  ┌──────────────────┐  ┌──────────────┐
    │  AWS Bedrock    │  │  AWS DynamoDB    │  │ CloudWatch   │
    │  Claude Haiku   │  │  Route cache +   │  │  Logs        │
    │  AI explanation │  │  Water points    │  │              │
    └─────────────────┘  └──────────────────┘  └──────────────┘
```

---

## 🌟 Features

| Feature | Details |
|---|---|
| 🗺️ **Multi-route comparison** | Up to 3 alternative walking routes |
| 🌡️ **Heat exposure scoring** | 0–100 score using temp, UV, humidity, shade, duration |
| 🌿 **Shade analysis** | Tree canopy + parks via Overpass API |
| 💧 **Water points** | Drinking fountains, taps, parks, cooling stations |
| 🤖 **AWS Bedrock AI** | Claude Haiku explains why each route is recommended |
| 🌤️ **Real weather** | Open-Meteo: temperature, feels-like, UV index, humidity |
| 🗺️ **Dark interactive map** | Leaflet + CartoDB dark tiles + clickable polylines |
| ⚡ **Serverless ready** | Mangum adapter for AWS Lambda deployment |

---

## 📊 Heat Exposure Score Formula

```
Heat Score = temp_component(40%) + uv_component(25%) + humidity_component(15%)
           + duration_bonus(10%) - shade_reduction(up to 20) - water_reduction(up to 15)

Surface Temp = air_temp + 15°C × (1 - shade_coverage) - 2 × water_stops
```

Lower score = cooler, safer walk.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- AWS account (for Bedrock + DynamoDB)

### 1. Clone & Configure

```bash
# Navigate to project
cd "AWS HEATPATH"

# Configure backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with your AWS credentials
```

### 2. Start Everything (One Command)

```bash
chmod +x start.sh
./start.sh
```

Or manually:

**Backend:**
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm install
npm run dev
```

### 3. Open the App

- **Frontend:** http://localhost:3000
- **API docs:** http://localhost:8000/docs
- **Health check:** http://localhost:8000/health

---

## 🐳 Docker

```bash
docker-compose up --build
```

---

## ☁️ AWS Setup

### 1. Enable Bedrock Model Access
Go to AWS Console → Bedrock → Model Access → Enable **Claude 3 Haiku**

### 2. Create Infrastructure
```bash
cd backend
python setup_aws.py
```

This creates:
- `heatpath-water-points` DynamoDB table
- `heatpath-route-cache` DynamoDB table (with TTL)
- Prints the least-privilege IAM policy

### 3. IAM Permissions Required
```json
{
  "bedrock:InvokeModel": "anthropic.claude-3-haiku",
  "dynamodb:*": "heatpath-* tables only",
  "logs:*": "CloudWatch logging"
}
```

---

## 📡 API Reference

### `POST /api/routes`
Find and rank walking routes by heat exposure.

```json
{
  "origin_lat": 40.7580,
  "origin_lng": -73.9855,
  "dest_lat": 40.7829,
  "dest_lng": -73.9654
}
```

Response: Array of `RouteResult` objects sorted coolest-first.

### `GET /api/weather?lat=40.75&lng=-73.98`
Current weather conditions.

### `GET /api/water-points?lat=40.75&lng=-73.98&radius=800`
Drinking water and cooling stations near a location.

---

## 🗂️ Project Structure

```
AWS HEATPATH/
├── backend/
│   ├── main.py           # FastAPI app + all endpoints
│   ├── setup_aws.py      # AWS infrastructure setup
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # Main page
│   │   │   ├── layout.tsx      # Root layout
│   │   │   └── globals.css     # Styles
│   │   ├── components/
│   │   │   ├── HeatMap.tsx     # Leaflet map
│   │   │   ├── SearchPanel.tsx # Location search
│   │   │   ├── RouteCard.tsx   # Route comparison card
│   │   │   ├── WeatherBadge.tsx
│   │   │   ├── HeatLegend.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   └── types/index.ts
│   ├── package.json
│   ├── next.config.js
│   └── Dockerfile
├── start.sh              # One-command local dev
├── docker-compose.yml
└── README.md
```

---

## 🔑 Data Sources

| Source | What We Use | Cost |
|---|---|---|
| [Open-Meteo](https://open-meteo.com) | Temperature, UV, humidity, wind | Free, no key |
| [OSRM](https://project-osrm.org) | Walking routes (OpenStreetMap) | Free, no key |
| [Overpass API](https://overpass-api.de) | Water points, trees, parks | Free, no key |
| [Nominatim](https://nominatim.org) | Geocoding (address → coords) | Free, no key |
| [CartoDB](https://carto.com) | Dark map tiles | Free |
| **AWS Bedrock** | Claude Haiku AI explanations | Pay-per-use |
| **AWS DynamoDB** | Route cache, water point cache | Pay-per-use |

---

## 🎯 Hackathon Judging Notes

- **Real data**: All heat scores use actual Open-Meteo weather data — no fabricated numbers
- **AWS integration**: Bedrock (AI), DynamoDB (caching), CloudWatch (logging), Lambda-ready (Mangum)
- **Least privilege IAM**: Setup script prints exact minimal policy
- **Working prototype**: Full end-to-end — search → route → score → AI explanation → map
- **Graceful fallback**: App works without Bedrock (uses data-driven fallback text)
- **No paid map keys**: OSRM + Nominatim + Overpass are all 100% free

---

## 👥 Team

Built for the AWS Hackathon 2024.
