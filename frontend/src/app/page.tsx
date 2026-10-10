"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Thermometer, Droplets, Wind, Sun, Zap, MapPin } from "lucide-react";
import SearchPanel from "@/components/SearchPanel";
import RouteCard from "@/components/RouteCard";
import WeatherBadge from "@/components/WeatherBadge";
import HeatLegend from "@/components/HeatLegend";
import LoadingSpinner from "@/components/LoadingSpinner";
import { RouteResult, WeatherData } from "@/types";

// Dynamic import for Leaflet (SSR incompatible)
const HeatMap = dynamic(() => import("@/components/HeatMap"), { ssr: false });

export default function Home() {
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [origin, setOrigin] = useState<[number, number] | null>(null);
  const [destination, setDestination] = useState<[number, number] | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const handleSearch = async (
    originCoords: [number, number],
    destCoords: [number, number]
  ) => {
    setLoading(true);
    setError(null);
    setRoutes([]);
    setOrigin(originCoords);
    setDestination(destCoords);

    try {
      // Fetch routes and weather in parallel
      const [routesRes, weatherRes] = await Promise.all([
        fetch(`${API_URL}/api/routes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin_lat: originCoords[0],
            origin_lng: originCoords[1],
            dest_lat: destCoords[0],
            dest_lng: destCoords[1],
          }),
        }),
        fetch(
          `${API_URL}/api/weather?lat=${originCoords[0]}&lng=${originCoords[1]}`
        ),
      ]);

      if (!routesRes.ok) {
        const err = await routesRes.json();
        throw new Error(err.detail || "Failed to fetch routes");
      }

      const routeData: RouteResult[] = await routesRes.json();
      const weatherData: WeatherData = await weatherRes.json();

      setRoutes(routeData);
      setWeather(weatherData);
      setSelectedRoute(routeData[0]?.route_id || null); // select recommended by default
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const recommendedRoute = routes.find((r) => r.is_recommended);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950">
      {/* ── Header ── */}
      <header className="flex-none z-50 glass-card border-b border-slate-800 px-4 py-3">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                <Zap className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent leading-tight">
                HeatPath
              </h1>
              <p className="text-xs text-slate-400 leading-tight">
                Find the coolest walking route
              </p>
            </div>
          </div>

          {weather && (
            <div className="flex items-center gap-2">
              <WeatherBadge weather={weather} />
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="hidden sm:block">Powered by</span>
            <span className="px-2 py-1 rounded bg-[#FF9900]/10 text-[#FF9900] font-semibold border border-[#FF9900]/20">
              AWS Bedrock
            </span>
            <span className="px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
              OpenStreetMap
            </span>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel ── */}
        <aside className="w-full max-w-sm flex-none flex flex-col glass-card border-r border-slate-800 overflow-y-auto z-40">
          {/* Search */}
          <div className="p-4 border-b border-slate-800">
            <SearchPanel onSearch={handleSearch} loading={loading} />
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <LoadingSpinner />
              <div className="text-center">
                <p className="text-slate-300 font-medium">Analyzing routes...</p>
                <p className="text-slate-500 text-sm mt-1">
                  Fetching heat, shade & water data
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="m-4 p-4 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-sm">
              <p className="font-semibold mb-1">⚠️ Error</p>
              <p>{error}</p>
            </div>
          )}

          {/* Route Cards */}
          {!loading && routes.length > 0 && (
            <div className="flex-1 p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                  Routes ({routes.length} found)
                </h2>
                <HeatLegend />
              </div>

              {routes.map((route) => (
                <RouteCard
                  key={route.route_id}
                  route={route}
                  isSelected={selectedRoute === route.route_id}
                  onSelect={() => setSelectedRoute(route.route_id)}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && routes.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-500/20 flex items-center justify-center mb-4">
                <MapPin className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-slate-300 font-semibold mb-2">
                Ready to find your cool route?
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Enter your start and end locations above. HeatPath will analyze
                shade, heat exposure, and water points to find the coolest path.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3 w-full">
                {[
                  { icon: Sun, label: "Heat Map", color: "text-orange-400" },
                  { icon: Droplets, label: "Water Points", color: "text-blue-400" },
                  { icon: Wind, label: "Shade Analysis", color: "text-green-400" },
                ].map(({ icon: Icon, label, color }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-900 border border-slate-800"
                  >
                    <Icon className={`w-5 h-5 ${color}`} />
                    <span className="text-xs text-slate-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex-none p-4 border-t border-slate-800">
            <p className="text-xs text-slate-600 text-center">
              Data: Open-Meteo · OpenStreetMap · Overpass API
              <br />
              AI: AWS Bedrock (Claude) · AWS Hackathon 2024
            </p>
          </div>
        </aside>

        {/* ── Map ── */}
        <main className="flex-1 relative">
          <HeatMap
            routes={routes}
            selectedRouteId={selectedRoute}
            origin={origin}
            destination={destination}
            onRouteSelect={setSelectedRoute}
          />

          {/* Map overlay: recommended banner */}
          {recommendedRoute && !loading && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
              <div className="glass-card px-4 py-2 rounded-full border border-green-500/40 recommended-pulse">
                <p className="text-sm font-semibold text-green-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
                  Coolest Route: {recommendedRoute.label} —{" "}
                  {recommendedRoute.heat_exposure_score}/100 heat score
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
