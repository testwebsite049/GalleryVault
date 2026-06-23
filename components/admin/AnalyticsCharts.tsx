"use client";

import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Laptop, Smartphone, Tablet, HelpCircle, Eye, Download, Globe, Link as LinkIcon } from "lucide-react";

interface DailyView {
  date: string;
  views: number;
}

interface TopImage {
  name: string;
  downloads: number;
}

interface DeviceStat {
  name: string;
  value: number;
}

interface CountryStat {
  country: string;
  views: number;
}

interface ReferrerStat {
  referrer: string;
  views: number;
}

interface AnalyticsChartsProps {
  dailyViews: DailyView[];
  topImages: TopImage[];
  devices: DeviceStat[];
  countries: CountryStat[];
  referrers: ReferrerStat[];
}

const COLORS = ["#10b981", "#06b6d4", "#6366f1", "#a855f7", "#ec4899"];

export default function AnalyticsCharts({
  dailyViews,
  topImages,
  devices,
  countries,
  referrers,
}: AnalyticsChartsProps) {
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState<"7d" | "30d">("7d");

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-96 w-full flex items-center justify-center text-slate-500">
        Loading analytics charts...
      </div>
    );
  }

  // Filter daily views based on range
  const filteredDailyViews = dailyViews.slice(range === "7d" ? -7 : -30);

  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case "desktop":
        return <Laptop className="h-4 w-4 text-emerald-400" />;
      case "mobile":
        return <Smartphone className="h-4 w-4 text-cyan-400" />;
      case "tablet":
        return <Tablet className="h-4 w-4 text-indigo-400" />;
      default:
        return <HelpCircle className="h-4 w-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Daily views (Line Chart) */}
      <div className="bg-slate-900/20 border border-slate-900 p-6 rounded-2xl space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h3 className="font-bold text-slate-200 text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-indigo-400" />
              <span>Visitor Views over Time</span>
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">Track page load events on the public URL</p>
          </div>

          <div className="flex gap-1.5 bg-slate-950 p-1 border border-slate-800 rounded-xl">
            <button
              onClick={() => setRange("7d")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                range === "7d"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setRange("30d")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                range === "30d"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              Last 30 Days
            </button>
          </div>
        </div>

        <div className="h-72 w-full pt-4">
          {filteredDailyViews.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredDailyViews} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px" }}
                  labelStyle={{ color: "#94a3b8", fontWeight: "bold" }}
                  itemStyle={{ color: "#10b981" }}
                />
                <Line
                  type="monotone"
                  dataKey="views"
                  name="Page Views"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  activeDot={{ r: 6 }}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full flex items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
              No view statistics recorded in this range.
            </div>
          )}
        </div>
      </div>

      {/* 2. Side-by-Side: Downloads (Bar) & Devices (Pie) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Downloaded Images */}
        <div className="bg-slate-900/20 border border-slate-900 p-6 rounded-2xl space-y-4">
          <div>
            <h3 className="font-bold text-slate-200 text-lg flex items-center gap-2">
              <Download className="h-5 w-5 text-purple-400" />
              <span>Top Downloaded Images</span>
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">Top 10 downloads by image name</p>
          </div>

          <div className="h-64 w-full pt-4">
            {topImages.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topImages} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickFormatter={(name) => name.substring(0, 10) + "..."} />
                  <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px" }}
                    labelStyle={{ color: "#94a3b8" }}
                    itemStyle={{ color: "#06b6d4" }}
                  />
                  <Bar dataKey="downloads" name="Downloads" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No downloads recorded.
              </div>
            )}
          </div>
        </div>

        {/* Device Breakdown */}
        <div className="bg-slate-900/20 border border-slate-900 p-6 rounded-2xl space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-200 text-lg flex items-center gap-2">
              <Laptop className="h-5 w-5 text-emerald-400" />
              <span>Device Breakdown</span>
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">Distribution of visitor user agents</p>
          </div>

          {devices.length > 0 && devices.some((d) => d.value > 0) ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4 flex-1">
              <div className="h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={devices.filter((d) => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {devices.filter((d) => d.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px" }}
                      itemStyle={{ color: "#ffffff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 flex-1 w-full max-w-xs">
                {devices.map((device, index) => (
                  <div key={device.name} className="flex items-center justify-between p-2 bg-slate-950/40 border border-slate-900 rounded-lg">
                    <div className="flex items-center gap-2.5 text-xs text-slate-300 font-medium">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      {getDeviceIcon(device.name)}
                      <span className="capitalize">{device.name}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-100">{device.value} sessions</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-64 w-full flex items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
              No device analytics data yet.
            </div>
          )}
        </div>
      </div>

      {/* 3. Side-by-Side Tables: Geolocation & Referrers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Geolocation Table */}
        <div className="bg-slate-900/20 border border-slate-900 p-6 rounded-2xl space-y-4">
          <h3 className="font-bold text-slate-200 text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-indigo-400" />
            <span>Country Breakdown</span>
          </h3>

          <div className="max-h-60 overflow-y-auto">
            {countries.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-500 text-xs font-semibold tracking-wider">
                    <th className="pb-3 px-1">Country</th>
                    <th className="pb-3 text-right">Views</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-xs text-slate-300">
                  {countries.map((c) => (
                    <tr key={c.country} className="hover:bg-slate-950/20 transition">
                      <td className="py-2.5 px-1 font-bold text-slate-200">
                        {c.country === "unknown" ? "Unknown Origin" : c.country}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-slate-100">{c.views}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">No country statistics recorded.</div>
            )}
          </div>
        </div>

        {/* Referrers Table */}
        <div className="bg-slate-900/20 border border-slate-900 p-6 rounded-2xl space-y-4">
          <h3 className="font-bold text-slate-200 text-lg flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-teal-400" />
            <span>Top Traffic Referrers</span>
          </h3>

          <div className="max-h-60 overflow-y-auto">
            {referrers.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-500 text-xs font-semibold tracking-wider">
                    <th className="pb-3 px-1">Referrer Domain</th>
                    <th className="pb-3 text-right">Clicks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-xs text-slate-300">
                  {referrers.map((r) => (
                    <tr key={r.referrer} className="hover:bg-slate-950/20 transition">
                      <td className="py-2.5 px-1 truncate max-w-xs font-mono font-bold text-slate-400">
                        {r.referrer === "direct" ? "Direct Access (Typing Link)" : r.referrer}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-slate-100">{r.views}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">No referrer stats recorded.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
