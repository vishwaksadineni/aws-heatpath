"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  Circle,
  useMap,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { RouteResult, WaterPoint } from "@/types";

// Fix Leaflet default icon paths (Next.js issue)
if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

// Custom icons
const createColorIcon = (color: string, size = 14) =>
  L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    className: "",
  });

const originIcon = L.divIcon({
  html: `<div style="
    width:20px;height:20px;
    background:#22c55e;
    border:3px solid white;
    border-radius:50%;
    box-shadow:0 2px 12px rgba(34,197,94,0.6);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  className: "",
});

const destIcon = L.divIcon({
  html: `<div style="
    width:20px;height:20px;
    background:#f43f5e;
    border:3px solid white;
    border-radius:50%;
    box-shadow:0 2px 12px rgba(244,63,94,0.6);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  className: "",
});

const waterIconHtml = (type: WaterPoint["type"]) => {
  const emojis: Record<WaterPoint["type"], string> = {
    fountain: "💧",
    tap: "🚰",
    park: "🌳",
    cooling_station: "❄️",
  };
  return L.divIcon({
    html: `<div style="
      font-size:18px;
      filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));
      cursor:pointer;
    ">${emojis[type] || "💧"}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    className: "",
  });
};

// Auto-fit map to bounds when routes load
function BoundsController({
  routes,
  origin,
  destination,
}: {
  routes: RouteResult[];
  origin: [number, number] | null;
  destination: [number, number] | null;
}) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [];
    if (origin) points.push(origin);
    if (destination) points.push(destination);
    routes.forEach((r) => points.push(...r.polyline));
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], animate: true });
    }
  }, [routes, origin, destination, map]);
  return null;
}

interface HeatMapProps {
  routes: RouteResult[];
  selectedRouteId: string | null;
  origin: [number, number] | null;
  destination: [number, number] | null;
  onRouteSelect: (id: string) => void;
}

export default function HeatMap({
  routes,
  selectedRouteId,
  origin,
  destination,
  onRouteSelect,
}: HeatMapProps) {
  const center: [number, number] = origin || [40.7128, -74.006]; // Default: NYC

  return (
    <MapContainer
      center={center}
      zoom={13}
      className="w-full h-full"
      zoomControl={false}
      style={{ background: "#0f172a" }}
    >
      {/* OpenStreetMap tile layer (darkened via CSS filter) */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />

      <ZoomControl position="bottomright" />
      <BoundsController routes={routes} origin={origin} destination={destination} />

      {/* Route polylines */}
      {routes.map((route) => {
        const isSelected = selectedRouteId === route.route_id;
        const isRecommended = route.is_recommended;
        return (
          <Polyline
            key={route.route_id}
            positions={route.polyline}
            pathOptions={{
              color: route.color,
              weight: isSelected ? 7 : isRecommended ? 6 : 4,
              opacity: isSelected ? 1 : 0.65,
              dashArray: isSelected ? undefined : route.rank > 1 ? "8 4" : undefined,
              lineCap: "round",
              lineJoin: "round",
            }}
            eventHandlers={{ click: () => onRouteSelect(route.route_id) }}
          >
            <Popup className="heatpath-popup">
              <div className="p-2 min-w-[200px]">
                <p className="font-bold text-gray-900">{route.label}</p>
                <p className="text-sm text-gray-600 mt-1">
                  🌡 Heat score: <strong>{route.heat_exposure_score}/100</strong>
                </p>
                <p className="text-sm text-gray-600">
                  🌿 Shade: <strong>{(route.shade_coverage * 100).toFixed(0)}%</strong>
                </p>
                <p className="text-sm text-gray-600">
                  💧 Water points: <strong>{route.water_points_on_route.length}</strong>
                </p>
                <p className="text-sm text-gray-600">
                  🛣 {(route.total_distance_m / 1000).toFixed(2)} km ·{" "}
                  {Math.round(route.total_duration_s / 60)} min
                </p>
                {route.is_recommended && (
                  <p className="text-xs font-semibold text-green-600 mt-2">
                    ✅ Recommended — Coolest Route
                  </p>
                )}
              </div>
            </Popup>
          </Polyline>
        );
      })}

      {/* Water points for selected route */}
      {routes
        .filter((r) => r.route_id === selectedRouteId)
        .flatMap((r) => r.water_points_on_route)
        .map((wp, i) => (
          <Marker
            key={`wp-${i}`}
            position={[wp.lat, wp.lng]}
            icon={waterIconHtml(wp.type)}
          >
            <Popup>
              <div className="p-1">
                <p className="font-semibold text-gray-900">{wp.name}</p>
                <p className="text-xs text-gray-500 capitalize">{wp.type.replace("_", " ")}</p>
              </div>
            </Popup>
          </Marker>
        ))}

      {/* Origin marker */}
      {origin && (
        <Marker position={origin} icon={originIcon}>
          <Popup>
            <div className="p-1">
              <p className="font-semibold text-green-700">📍 Start</p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Destination marker */}
      {destination && (
        <Marker position={destination} icon={destIcon}>
          <Popup>
            <div className="p-1">
              <p className="font-semibold text-red-700">🏁 Destination</p>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}


