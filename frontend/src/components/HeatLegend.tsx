"use client";

export default function HeatLegend() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-600">Cool</span>
      <div className="w-16 h-2 rounded-full heat-bar" />
      <span className="text-xs text-slate-600">Hot</span>
    </div>
  );
}
