"use client";

import { RouteResult } from "@/types";
import {
  Thermometer,
  Droplets,
  TreePine,
  Clock,
  Route,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";

interface RouteCardProps {
  route: RouteResult;
  isSelected: boolean;
  onSelect: () => void;
}

function HeatScoreBar({ score }: { score: number }) {
  // Map score 0–100 to a colour
  const color =
    score < 35 ? "#22c55e" : score < 65 ? "#f59e0b" : "#ef4444";
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>Heat Exposure</span>
        <span style={{ color }} className="font-semibold">
          {score}/100
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function RouteCard({ route, isSelected, onSelect }: RouteCardProps) {
  const distKm = (route.total_distance_m / 1000).toFixed(2);
  const durationMin = Math.round(route.total_duration_s / 60);
  const shadePercent = (route.shade_coverage * 100).toFixed(0);

  return (
    <button
      onClick={onSelect}
      className={clsx(
        "w-full text-left rounded-2xl border transition-all duration-200 p-4 space-y-2",
        isSelected
          ? "border-green-500/50 bg-slate-800/80 shadow-lg shadow-green-500/10"
          : "border-slate-700/50 bg-slate-900/60 hover:bg-slate-800/50 hover:border-slate-600"
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Color dot */}
          <div
            className="w-3 h-3 rounded-full flex-none mt-0.5"
            style={{ backgroundColor: route.color }}
          />
          <div>
            <p className="text-sm font-semibold text-slate-100">{route.label}</p>
            {route.is_recommended && (
              <span className="inline-flex items-center gap-1 text-xs bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded-full border border-green-500/20 recommended-pulse">
                <Sparkles className="w-3 h-3" />
                Coolest Route
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-slate-500 flex-none">#{route.rank}</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-1.5">
        <Stat icon={Route} label="Distance" value={`${distKm} km`} color="text-slate-400" />
        <Stat icon={Clock} label="Walk time" value={`${durationMin} min`} color="text-slate-400" />
        <Stat
          icon={TreePine}
          label="Shade"
          value={`${shadePercent}%`}
          color="text-green-400"
        />
        <Stat
          icon={Droplets}
          label="Water points"
          value={`${route.water_points_on_route.length}`}
          color="text-blue-400"
        />
        <Stat
          icon={Thermometer}
          label="Surface temp"
          value={`${route.avg_surface_temp}°C`}
          color="text-orange-400"
        />
      </div>

      {/* Heat score bar */}
      <HeatScoreBar score={route.heat_exposure_score} />

      {/* AI Explanation */}
      <div
        className={clsx(
          "rounded-xl p-3 mt-2 transition-all",
          route.is_recommended
            ? "bg-green-950/40 border border-green-900/50"
            : "bg-slate-800/40 border border-slate-700/50"
        )}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles className="w-3 h-3 text-[#FF9900]" />
          <span className="text-xs font-medium text-[#FF9900]">AWS Bedrock AI</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{route.ai_explanation}</p>
      </div>

      {isSelected && (
        <p className="text-xs text-green-400 flex items-center gap-1 pt-1">
          <ChevronRight className="w-3 h-3" />
          Highlighted on map · {route.water_points_on_route.length} water stop
          {route.water_points_on_route.length !== 1 ? "s" : ""} shown
        </p>
      )}
    </button>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-800/50 rounded-lg px-2 py-1.5">
      <Icon className={`w-3.5 h-3.5 flex-none ${color}`} />
      <div className="min-w-0">
        <p className="text-xs text-slate-500 leading-none truncate">{label}</p>
        <p className="text-xs font-semibold text-slate-200 leading-tight">{value}</p>
      </div>
    </div>
  );
}
