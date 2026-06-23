"use client";

import React, { useState } from "react";
import { Lock, AlertTriangle, Key } from "lucide-react";

interface PasswordGateProps {
  slug: string;
  folderName: string;
  onSuccess: () => void;
}

export default function PasswordGate({ slug, folderName, onSuccess }: PasswordGateProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/gallery/${slug}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || "Incorrect password.");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Decorative Blur Gradients */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 translate-y-1/2 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />

      <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-slate-900 p-8 rounded-2xl shadow-2xl relative z-10 text-center space-y-6">
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 animate-bounce">
            <Lock className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">{folderName}</h2>
          <p className="text-slate-400 text-xs mt-1.5">This photo gallery is password protected.</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2 justify-center">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
              <Key className="h-4 w-4" />
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter gallery password"
              className="block w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition text-sm text-center font-sans tracking-widest"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold rounded-xl transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? "Verifying..." : "Access Gallery"}
          </button>
        </form>
      </div>
    </div>
  );
}
