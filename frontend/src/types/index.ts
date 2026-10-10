// Shared TypeScript types for HeatPath

export interface WaterPoint {
  lat: number;
  lng: number;
  name: string;
  type: "fountain" | "tap" | "park" | "cooling_station";
}

export interface RouteResult {
  route_id: string;
  label: string;
  color: string;
  polyline: [number, number][];          // [lat, lng] pairs
  total_distance_m: number;
  total_duration_s: number;
  heat_exposure_score: number;           // 0–100
  shade_coverage: number;               // 0–1
  water_points_on_route: WaterPoint[];
  avg_surface_temp: number;
  ai_explanation: string;
  rank: number;
  is_recommended: boolean;
}

export interface WeatherData {
  temperature: number;
  feels_like: number;
  humidity: number;
  uv_index: number;
  wind_speed: number;
}

export interface SearchLocation {
  lat: number;
  lng: number;
  display_name: string;
}
