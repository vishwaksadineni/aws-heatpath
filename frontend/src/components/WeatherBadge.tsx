"use client";

import { WeatherData } from "@/types";
import { Thermometer, Droplets, Wind, Sun } from "lucide-react";

interface WeatherBadgeProps {
  weather: WeatherData;
}

function uvLabel(uv: number): string {
  if (uv <= 2) return "Low";
  if (uv <= 5) return "Moderate";
  if (uv <= 7) return "High";
  if (uv <= 10) return "Very High";
  return "Extreme";
}

function uvColor(uv: number): string {
  if (uv <= 2) return "text-green-400";
  if (uv <= 5) return "text-yellow-400";
  if (uv <= 7) return "text-orange-400";
  return "text-red-400";
}

export default function WeatherBadge({ weather }: WeatherBadgeProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700">
      <div className="flex items-center gap-1.5">
        <Thermometer className="w-3.5 h-3.5 text-orange-400" />
        <span className="text-xs font-semibold text-slate-200">
          {weather.temperature}°C
        </span>
        <span className="text-xs text-slate-500">
          / feels {weather.feels_like}°C
        </span>
      </div>
      <div className="w-px h-4 bg-slate-700" />
      <div className="flex items-center gap-1">
        <Sun className={`w-3.5 h-3.5 ${uvColor(weather.uv_index)}`} />
        <span className={`text-xs font-medium ${uvColor(weather.uv_index)}`}>
          UV {weather.uv_index} — {uvLabel(weather.uv_index)}
        </span>
      </div>
      <div className="w-px h-4 bg-slate-700" />
      <div className="flex items-center gap-1">
        <Droplets className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-xs text-slate-400">{weather.humidity}%</span>
      </div>
      <div className="flex items-center gap-1">
        <Wind className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-400">{weather.wind_speed} km/h</span>
      </div>
    </div>
  );
}
