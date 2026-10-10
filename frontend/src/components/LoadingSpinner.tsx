"use client";

export default function LoadingSpinner() {
  return (
    <div className="relative w-16 h-16">
      {/* Outer ring */}
      <div className="absolute inset-0 rounded-full border-2 border-slate-700" />
      {/* Spinning ring */}
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-green-400 animate-spin" />
      {/* Inner pulse */}
      <div className="absolute inset-3 rounded-full bg-green-500/10 animate-pulse flex items-center justify-center">
        <div className="w-3 h-3 rounded-full bg-green-400" />
      </div>
    </div>
  );
}
