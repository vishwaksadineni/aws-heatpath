"use client";

import { useState, useCallback } from "react";
import { Search, MapPin, Navigation, Loader2 } from "lucide-react";
import { SearchLocation } from "@/types";

interface SearchPanelProps {
  onSearch: (origin: [number, number], destination: [number, number]) => void;
  loading: boolean;
}

// Nominatim geocoder (OpenStreetMap — free, no key needed)
async function geocode(query: string): Promise<SearchLocation[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    query
  )}&limit=5&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en", "User-Agent": "HeatPath/1.0" },
  });
  if (!res.ok) throw new Error("Geocoding failed");
  const data = await res.json();
  return data.map((d: any) => ({
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    display_name: d.display_name,
  }));
}

function LocationInput({
  label,
  icon: Icon,
  value,
  onChange,
  onSelect,
  placeholder,
  iconColor,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  onSelect: (loc: SearchLocation) => void;
  placeholder: string;
  iconColor: string;
}) {
  const [suggestions, setSuggestions] = useState<SearchLocation[]>([]);
  const [searching, setSearching] = useState(false);

  const handleChange = useCallback(
    async (val: string) => {
      onChange(val);
      if (val.length < 3) {
        setSuggestions([]);
        return;
      }
      setSearching(true);
      try {
        const results = await geocode(val);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    },
    [onChange]
  );

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      <div className="relative">
        <Icon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${iconColor}`} />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 animate-spin" />
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-all"
        />
      </div>

      {suggestions.length > 0 && (
        <div className="absolute z-[9999] w-full mt-1 glass-card rounded-xl border border-slate-700 overflow-hidden shadow-xl max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => {
                onChange(s.display_name.split(",").slice(0, 2).join(", "));
                onSelect(s);
                setSuggestions([]);
              }}
              className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 border-b border-slate-800 last:border-0 line-clamp-2 transition-colors"
            >
              <span className="text-slate-500 mr-1">📍</span>
              {s.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPanel({ onSearch, loading }: SearchPanelProps) {
  const [originText, setOriginText] = useState("");
  const [destText, setDestText] = useState("");
  const [originCoords, setOriginCoords] = useState<SearchLocation | null>(null);
  const [destCoords, setDestCoords] = useState<SearchLocation | null>(null);

  // Quick demo presets for hackathon demos
  const presets = [
    { label: "NYC Demo", origin: "Times Square, New York", dest: "Central Park, New York" },
    { label: "London", origin: "London Bridge, London", dest: "Hyde Park, London" },
    { label: "Sydney", origin: "Sydney Opera House", dest: "Bondi Beach, Sydney" },
  ];

  const handlePreset = async (preset: (typeof presets)[0]) => {
    setOriginText(preset.origin);
    setDestText(preset.dest);
    try {
      const [oResults, dResults] = await Promise.all([
        geocode(preset.origin),
        geocode(preset.dest),
      ]);
      if (oResults[0] && dResults[0]) {
        setOriginCoords(oResults[0]);
        setDestCoords(dResults[0]);
        onSearch([oResults[0].lat, oResults[0].lng], [dResults[0].lat, dResults[0].lng]);
      }
    } catch {}
  };

  const handleSearch = () => {
    if (!originCoords || !destCoords) return;
    onSearch([originCoords.lat, originCoords.lng], [destCoords.lat, destCoords.lng]);
  };

  const canSearch = !!originCoords && !!destCoords && !loading;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <Search className="w-4 h-4 text-green-400" />
        <h2 className="text-sm font-semibold text-slate-200">Find Cool Route</h2>
      </div>

      <LocationInput
        label="Start Location"
        icon={Navigation}
        value={originText}
        onChange={setOriginText}
        onSelect={setOriginCoords}
        placeholder="e.g. Times Square, NYC"
        iconColor="text-green-400"
      />

      <LocationInput
        label="Destination"
        icon={MapPin}
        value={destText}
        onChange={setDestText}
        onSelect={setDestCoords}
        placeholder="e.g. Central Park, NYC"
        iconColor="text-rose-400"
      />

      <button
        onClick={handleSearch}
        disabled={!canSearch}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
          canSearch
            ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-400 hover:to-emerald-500 shadow-lg shadow-green-500/20 hover:shadow-green-500/40"
            : "bg-slate-800 text-slate-500 cursor-not-allowed"
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing Heat...
          </>
        ) : (
          <>
            <Search className="w-4 h-4" />
            Find Coolest Route
          </>
        )}
      </button>

      {/* Quick presets */}
      <div>
        <p className="text-xs text-slate-600 mb-2">Quick Demo:</p>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => handlePreset(p)}
              disabled={loading}
              className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
