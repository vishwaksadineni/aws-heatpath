"""
HeatPath Backend - FastAPI Application
Finds the coolest walking routes using heat, shade, water data + AWS Bedrock AI
"""

import os
import json
import math
import asyncio
from typing import Optional
import httpx
import boto3
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from mangum import Mangum
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="HeatPath API",
    description="Find the coolest walking routes using Heat Maps, Water Points & AI",
    version="1.0.0"
)

# CORS — allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AWS clients
bedrock_client = boto3.client(
    "bedrock-runtime",
    region_name=os.getenv("AWS_REGION", "us-east-1"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
)

dynamodb = boto3.resource(
    "dynamodb",
    region_name=os.getenv("AWS_REGION", "us-east-1"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
)

# ─── Pydantic Models ───────────────────────────────────────────────────────────

class RouteRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    preferences: Optional[dict] = {}

class WaterPoint(BaseModel):
    lat: float
    lng: float
    name: str
    type: str  # fountain, tap, park, cooling_station

class RouteSegment(BaseModel):
    coords: list[list[float]]
    distance_m: float
    duration_s: float
    shade_score: float        # 0–1 (1 = fully shaded)
    heat_score: float         # 0–1 (1 = extremely hot)
    water_nearby: bool
    surface_temp: float       # °C estimated

class RouteResult(BaseModel):
    route_id: str
    label: str
    color: str
    polyline: list[list[float]]
    total_distance_m: float
    total_duration_s: float
    heat_exposure_score: float   # 0–100 (lower = cooler)
    shade_coverage: float        # 0–1
    water_points_on_route: list[WaterPoint]
    avg_surface_temp: float
    ai_explanation: str
    rank: int
    is_recommended: bool

# ─── Helper: Open-Meteo Weather ────────────────────────────────────────────────

async def get_weather(lat: float, lng: float) -> dict:
    """Fetch current temperature, humidity, UV index from Open-Meteo (free, no key)."""
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lng}"
        f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,"
        f"uv_index,wind_speed_10m,surface_pressure"
        f"&hourly=temperature_2m,uv_index"
        f"&forecast_days=1"
    )
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(url)
            r.raise_for_status()
            data = r.json()
            current = data.get("current", {})
            return {
                "temperature": current.get("temperature_2m", 30),
                "feels_like": current.get("apparent_temperature", 32),
                "humidity": current.get("relative_humidity_2m", 60),
                "uv_index": current.get("uv_index", 5),
                "wind_speed": current.get("wind_speed_10m", 10),
            }
        except Exception:
            # Fallback demo values
            return {
                "temperature": 32,
                "feels_like": 37,
                "humidity": 65,
                "uv_index": 7,
                "wind_speed": 8,
            }

# ─── Helper: OSRM Routing (OpenStreetMap) ──────────────────────────────────────

async def get_osrm_routes(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float,
    alternatives: int = 3
) -> list[dict]:
    """
    Fetch up to `alternatives` walking routes from the public OSRM demo server.
    Returns raw OSRM route objects.
    """
    url = (
        f"https://router.project-osrm.org/route/v1/foot/"
        f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
        f"?alternatives={alternatives}&geometries=geojson&steps=true&overview=full"
    )
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            r = await client.get(url)
            r.raise_for_status()
            data = r.json()
            return data.get("routes", [])
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Routing service error: {e}")

# ─── Helper: OSM Overpass — Water Points ───────────────────────────────────────

async def get_water_points(
    lat: float, lng: float, radius_m: int = 800
) -> list[WaterPoint]:
    """Fetch drinking water fountains, taps, cooling stations near a point."""
    query = f"""
    [out:json][timeout:10];
    (
      node["amenity"="drinking_water"](around:{radius_m},{lat},{lng});
      node["amenity"="water_point"](around:{radius_m},{lat},{lng});
      node["man_made"="water_tap"](around:{radius_m},{lat},{lng});
      node["leisure"="park"](around:{radius_m},{lat},{lng});
      node["amenity"="misting_station"](around:{radius_m},{lat},{lng});
    );
    out body;
    """
    url = "https://overpass-api.de/api/interpreter"
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            r = await client.post(url, data={"data": query})
            r.raise_for_status()
            elements = r.json().get("elements", [])
            points = []
            for el in elements:
                tags = el.get("tags", {})
                amenity = tags.get("amenity", tags.get("leisure", tags.get("man_made", "water")))
                type_map = {
                    "drinking_water": "fountain",
                    "water_point": "tap",
                    "water_tap": "tap",
                    "park": "park",
                    "misting_station": "cooling_station",
                }
                points.append(WaterPoint(
                    lat=el["lat"],
                    lng=el["lon"],
                    name=tags.get("name", amenity.replace("_", " ").title()),
                    type=type_map.get(amenity, "fountain"),
                ))
            return points[:20]  # Cap at 20 points
        except Exception:
            return _demo_water_points(lat, lng)

def _demo_water_points(lat: float, lng: float) -> list[WaterPoint]:
    """Demo water points when Overpass is unreachable."""
    return [
        WaterPoint(lat=lat + 0.002, lng=lng + 0.001, name="City Park Fountain", type="fountain"),
        WaterPoint(lat=lat - 0.001, lng=lng + 0.003, name="Water Tap", type="tap"),
        WaterPoint(lat=lat + 0.003, lng=lng - 0.002, name="Riverside Park", type="park"),
    ]

# ─── Helper: Tree/Shade Coverage (Overpass) ────────────────────────────────────

async def estimate_shade_along_route(coords: list[list[float]]) -> float:
    """
    Estimate shade coverage by querying tree canopy + parks along route.
    Returns 0–1 shade score.
    """
    if not coords:
        return 0.2
    # Sample midpoint of route
    mid_idx = len(coords) // 2
    mid_lat, mid_lng = coords[mid_idx][1], coords[mid_idx][0]

    query = f"""
    [out:json][timeout:8];
    (
      way["natural"="wood"](around:150,{mid_lat},{mid_lng});
      way["landuse"="forest"](around:150,{mid_lat},{mid_lng});
      way["leisure"="park"](around:150,{mid_lat},{mid_lng});
      node["natural"="tree"](around:30,{mid_lat},{mid_lng});
    );
    out count;
    """
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.post("https://overpass-api.de/api/interpreter", data={"data": query})
            r.raise_for_status()
            count = r.json().get("elements", [])
            # Heuristic: more trees/parks = more shade
            shade = min(1.0, len(count) * 0.15 + 0.1)
            return round(shade, 2)
        except Exception:
            return round(0.1 + (hash(str(coords[0])) % 100) / 200, 2)

# ─── Helper: Heat Exposure Score ───────────────────────────────────────────────

def compute_heat_score(
    temperature: float,
    feels_like: float,
    uv_index: float,
    humidity: float,
    shade_coverage: float,
    distance_m: float,
    duration_s: float,
    water_points: int,
) -> tuple[float, float]:
    """
    Compute a heat exposure score (0–100, lower = cooler/safer).
    Also returns estimated surface temperature.
    
    Formula weighs:
    - Apparent temperature (40%)
    - UV index (25%)
    - Humidity (15%)
    - Shade coverage (−20% reduction)
    - Water access (−5% per point, capped at 3)
    - Exposure time (distance/duration)
    """
    # Base temp component (normalise: 15°C = 0, 45°C = 40)
    temp_component = max(0, (feels_like - 15) / 30) * 40

    # UV component (UV 0–11+)
    uv_component = min(uv_index / 11, 1) * 25

    # Humidity component (40–100% range)
    humidity_component = max(0, (humidity - 40) / 60) * 15

    # Exposure duration bonus (longer walk = more cumulative solar exposure)
    duration_min = duration_s / 60
    duration_component = min(duration_min / 60, 1) * 15

    raw_score = temp_component + uv_component + humidity_component + duration_component

    # Shade reduction (up to 15 points)
    shade_reduction = shade_coverage * 15
    # Water reduction (up to 9 points)
    water_reduction = min(water_points, 3) * 3

    final_score = max(5, min(100, raw_score - shade_reduction - water_reduction))

    # Surface temperature estimate: asphalt absorbs ~15°C above air temp, shade reduces
    surface_temp = temperature + (15 * (1 - shade_coverage)) - (2 * min(water_points, 3))
    surface_temp = round(surface_temp, 1)

    return round(final_score, 1), surface_temp

# ─── Helper: Haversine Distance ────────────────────────────────────────────────

def haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def nearest_water_on_route(
    route_coords: list[list[float]], water_points: list[WaterPoint], threshold_m=200
) -> list[WaterPoint]:
    """Return water points within `threshold_m` of any route coordinate."""
    nearby = []
    for wp in water_points:
        for coord in route_coords[::5]:  # sample every 5th coord for speed
            d = haversine(coord[1], coord[0], wp.lat, wp.lng)
            if d <= threshold_m:
                nearby.append(wp)
                break
    return nearby

# ─── Helper: AWS Bedrock AI Explanation ────────────────────────────────────────

def get_ai_explanation(
    route_label: str,
    rank: int,
    total_distance_m: float,
    duration_s: float,
    heat_score: float,
    shade_coverage: float,
    water_count: int,
    avg_surface_temp: float,
    weather: dict,
    is_recommended: bool,
) -> str:
    """Call AWS Bedrock (Claude) to generate a human-friendly route explanation."""
    
    prompt = f"""You are HeatPath AI, an assistant that explains walking route recommendations based on real environmental data.

Route: {route_label}
Rank: #{rank} {"(RECOMMENDED - COOLEST ROUTE)" if is_recommended else ""}
Distance: {total_distance_m/1000:.2f} km
Walking Time: {int(duration_s/60)} minutes
Heat Exposure Score: {heat_score}/100 (lower = cooler and safer)
Shade Coverage: {shade_coverage*100:.0f}%
Water Points Nearby: {water_count}
Estimated Surface Temperature: {avg_surface_temp}°C
Current Air Temperature: {weather['temperature']}°C
Feels Like: {weather['feels_like']}°C
UV Index: {weather['uv_index']}
Humidity: {weather['humidity']}%

Write a concise, friendly 2-sentence explanation of why this route {"is recommended as the coolest option" if is_recommended else "ranks as option #" + str(rank)}. 
Focus on real data: shade, water access, surface temperature, and heat exposure. 
Do NOT invent data. Be specific and practical."""

    try:
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 150,
            "messages": [{"role": "user", "content": prompt}]
        })
        response = bedrock_client.invoke_model(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            body=body,
            contentType="application/json",
            accept="application/json",
        )
        result = json.loads(response["body"].read())
        return result["content"][0]["text"].strip()
    except Exception as e:
        # Graceful fallback if Bedrock isn't configured yet
        if is_recommended:
            return (
                f"This route is recommended as it offers {shade_coverage*100:.0f}% shade coverage "
                f"and {water_count} water points nearby, resulting in a lower heat exposure score of "
                f"{heat_score}/100. The estimated surface temperature is {avg_surface_temp}°C, "
                f"making it the coolest option available."
            )
        else:
            return (
                f"This route has a heat exposure score of {heat_score}/100 with "
                f"{shade_coverage*100:.0f}% shade coverage and {water_count} water points. "
                f"The estimated surface temperature is {avg_surface_temp}°C. "
                f"It ranks #{rank} compared to other available routes."
            )

# ─── Main Route Endpoint ────────────────────────────────────────────────────────

@app.post("/api/routes", response_model=list[RouteResult])
async def find_coolest_routes(req: RouteRequest):
    """
    Core endpoint: find and rank walking routes by heat exposure.
    Returns up to 3 routes, sorted from coolest to hottest.
    """
    # 1. Fetch weather at origin
    weather = await get_weather(req.origin_lat, req.origin_lng)

    # 2. Fetch walking routes from OSRM
    raw_routes = await get_osrm_routes(
        req.origin_lat, req.origin_lng,
        req.dest_lat, req.dest_lng,
        alternatives=3,
    )

    if not raw_routes:
        raise HTTPException(status_code=404, detail="No routes found between these locations.")

    # 3. Fetch water points around the midpoint of the area
    mid_lat = (req.origin_lat + req.dest_lat) / 2
    mid_lng = (req.origin_lng + req.dest_lng) / 2
    all_water = await get_water_points(mid_lat, mid_lng, radius_m=1000)

    # 4. Score each route concurrently
    shade_tasks = []
    for route in raw_routes:
        coords = route["geometry"]["coordinates"]
        shade_tasks.append(estimate_shade_along_route(coords))

    shade_scores = await asyncio.gather(*shade_tasks)

    COLORS = ["#22c55e", "#f59e0b", "#ef4444"]  # green, amber, red
    LABELS = ["Route A (Green)", "Route B (Amber)", "Route C (Red)"]

    scored_routes = []
    for i, (route, shade) in enumerate(zip(raw_routes, shade_scores)):
        coords = route["geometry"]["coordinates"]
        distance = route["distance"]       # metres
        raw_duration = route["duration"]   # seconds
        # Calibrate duration: ensure walking speed (~4.8 km/h or 1.33 m/s) if server returned vehicle times
        duration = max(raw_duration, distance / 1.33) if raw_duration < (distance / 1.5) else raw_duration

        water_on_route = nearest_water_on_route(coords, all_water)
        heat_score, surface_temp = compute_heat_score(
            temperature=weather["temperature"],
            feels_like=weather["feels_like"],
            uv_index=weather["uv_index"],
            humidity=weather["humidity"],
            shade_coverage=shade,
            distance_m=distance,
            duration_s=duration,
            water_points=len(water_on_route),
        )

        scored_routes.append({
            "route": route,
            "shade": shade,
            "heat_score": heat_score,
            "surface_temp": surface_temp,
            "water_on_route": water_on_route,
            "distance": distance,
            "duration": duration,
            "coords": coords,
            "label": LABELS[i],
            "color": COLORS[i],
        })

    # 5. Sort by heat score ascending (coolest first)
    scored_routes.sort(key=lambda x: x["heat_score"])

    # 6. Build final results with AI explanations
    results = []
    for rank, sr in enumerate(scored_routes, start=1):
        is_recommended = (rank == 1)

        # Convert [lng, lat] coords to [lat, lng] for Leaflet
        polyline = [[c[1], c[0]] for c in sr["coords"]]

        ai_text = get_ai_explanation(
            route_label=sr["label"],
            rank=rank,
            total_distance_m=sr["distance"],
            duration_s=sr["duration"],
            heat_score=sr["heat_score"],
            shade_coverage=sr["shade"],
            water_count=len(sr["water_on_route"]),
            avg_surface_temp=sr["surface_temp"],
            weather=weather,
            is_recommended=is_recommended,
        )

        results.append(RouteResult(
            route_id=f"route_{rank}",
            label=sr["label"],
            color=sr["color"] if not is_recommended else "#22c55e",
            polyline=polyline,
            total_distance_m=sr["distance"],
            total_duration_s=sr["duration"],
            heat_exposure_score=sr["heat_score"],
            shade_coverage=sr["shade"],
            water_points_on_route=sr["water_on_route"],
            avg_surface_temp=sr["surface_temp"],
            ai_explanation=ai_text,
            rank=rank,
            is_recommended=is_recommended,
        ))

    return results


# ─── Weather Endpoint ───────────────────────────────────────────────────────────

@app.get("/api/weather")
async def current_weather(
    lat: float = Query(...),
    lng: float = Query(...)
):
    """Return current weather conditions for a location."""
    return await get_weather(lat, lng)


# ─── Water Points Endpoint ──────────────────────────────────────────────────────

@app.get("/api/water-points")
async def water_points_near(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: int = Query(800, le=2000),
):
    """Return drinking water and cooling stations near a location."""
    points = await get_water_points(lat, lng, radius)
    return {"water_points": [p.dict() for p in points], "count": len(points)}


# ─── Health Check ───────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "HeatPath API", "version": "1.0.0"}


# ─── AWS Lambda Handler ─────────────────────────────────────────────────────────

handler = Mangum(app)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
