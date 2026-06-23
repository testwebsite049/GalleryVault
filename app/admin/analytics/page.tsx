"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Folder, Eye, Download, Image as ImageIcon, ArrowRight } from "lucide-react";
import AnalyticsCharts from "@/components/admin/AnalyticsCharts";

interface TopFolder {
  _id: string;
  name: string;
  slug: string;
  coverImageUrl?: string | null;
  totalImages: number;
  totalViews: number;
  totalDownloads: number;
}

interface GlobalAnalyticsData {
  dailyViews: any[];
  devices: any[];
  countries: any[];
  referrers: any[];
  topFolders: TopFolder[];
}

export default function GlobalAnalyticsPage() {
  const [data, setData] = useState<GlobalAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchGlobalAnalytics = async () => {
    try {
      const res = await fetch("/api/admin/global-analytics");
      if (!res.ok) throw new Error("Failed to load global analytics data");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 bg-slate-800 rounded w-48" />
        <div className="h-80 bg-slate-800 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-64 bg-slate-800 rounded-xl" />
          <div className="h-64 bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          Global Analytics
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Monitor total guest traffic, click patterns, and album popularity across all galleries.
        </p>
      </div>

      {/* Main Charts */}
      {data && (
        <AnalyticsCharts
          dailyViews={data.dailyViews}
          topImages={[]} // Top images are calculated folder-specifically in the standard component, we pass empty array or we can extend it
          devices={data.devices}
          countries={data.countries}
          referrers={data.referrers}
        />
      )}

      {/* Most Popular Albums */}
      <div className="bg-slate-900/20 border border-slate-900 p-6 rounded-2xl space-y-6">
        <div>
          <h3 className="font-bold text-slate-200 text-lg">Most Popular Albums</h3>
          <p className="text-slate-500 text-xs mt-0.5">Top 5 galleries with the highest traffic views</p>
        </div>

        {data?.topFolders && data.topFolders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 text-slate-500 text-xs font-semibold tracking-wider">
                  <th className="pb-3">Folder</th>
                  <th className="pb-3 text-center">Images</th>
                  <th className="pb-3 text-center">Downloads</th>
                  <th className="pb-3 text-right">Views</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-sm text-slate-300">
                {data.topFolders.map((folder) => (
                  <tr key={folder._id} className="hover:bg-slate-950/20 transition">
                    <td className="py-3 flex items-center gap-3">
                      <div className="h-10 w-10 rounded bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                        {folder.coverImageUrl ? (
                          // eslint-disable-next-line @typescript-eslint/no-img-element
                          <img src={folder.coverImageUrl} alt={folder.name} className="h-full w-full object-cover" />
                        ) : (
                          <Folder className="h-5 w-5 text-slate-600" />
                        )}
                      </div>
                      <div>
                        <Link href={`/admin/folders/${folder._id}`} className="font-bold text-slate-200 hover:text-emerald-400 transition">
                          {folder.name}
                        </Link>
                        <span className="text-xs text-slate-500 block font-mono">/{folder.slug}</span>
                      </div>
                    </td>
                    <td className="py-3 text-center font-semibold text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <ImageIcon className="h-3.5 w-3.5 text-slate-500" />
                        <span>{folder.totalImages}</span>
                      </span>
                    </td>
                    <td className="py-3 text-center font-semibold text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <Download className="h-3.5 w-3.5 text-slate-500" />
                        <span>{folder.totalDownloads}</span>
                      </span>
                    </td>
                    <td className="py-3 text-right font-bold text-emerald-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5 text-slate-500" />
                        <span>{folder.totalViews.toLocaleString()}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No albums view logs recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
