"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FolderOpen,
  Image as ImageIcon,
  Eye,
  Download,
  Plus,
  ArrowRight,
  Clock,
  Globe,
  AlertTriangle,
} from "lucide-react";

interface UploadedImage {
  _id: string;
  originalFilename: string;
  secureUrl: string;
  thumbnailUrl: string;
  uploadedAt: string;
  folderSlug: string;
}

interface VisitorEvent {
  _id: string;
  eventType: string;
  folderSlug: string;
  ip: string;
  country: string | null;
  device: string;
  timestamp: string;
}

interface DashboardData {
  totalFolders: number;
  totalImages: number;
  totalViews: number;
  totalDownloads: number;
  recentUploads: UploadedImage[];
  recentEvents: VisitorEvent[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create folder modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderSlug, setFolderSlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchDashboardData = async () => {
    try {
      const res = await fetch("/api/admin/dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard data");
      const json = await res.ok ? await res.json() : {};
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Auto-generate slug from folder name
  const handleNameChange = (name: string) => {
    setFolderName(name);
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "") // Remove invalid characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-"); // Collapse multiple hyphens
    setFolderSlug(slug);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError("");

    try {
      const res = await fetch("/api/admin/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderName, slug: folderSlug }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to create folder");
      }

      setIsModalOpen(false);
      setFolderName("");
      setFolderSlug("");
      // Redirect to the newly created folder details page
      router.push(`/admin/folders/${json.folder._id}`);
    } catch (err: any) {
      setCreateError(err.message || "An error occurred.");
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-slate-800 rounded w-48" />
          <div className="h-10 bg-slate-800 rounded w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-800 rounded-xl border border-slate-700/50" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-96 bg-slate-800 rounded-xl border border-slate-700/50" />
          <div className="h-96 bg-slate-800 rounded-xl border border-slate-700/50" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center gap-3">
        <AlertTriangle />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">Overview of your photo galleries and traffic metrics</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold rounded-xl transition duration-200 hover:shadow-lg hover:shadow-emerald-500/10 text-sm self-start sm:self-auto"
        >
          <Plus className="h-5 w-5 font-bold" />
          <span>Create Folder</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Folders", value: data?.totalFolders || 0, icon: FolderOpen, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Total Images", value: data?.totalImages || 0, icon: ImageIcon, color: "text-cyan-400", bg: "bg-cyan-500/10" },
          { label: "Total Views", value: data?.totalViews || 0, icon: Eye, color: "text-indigo-400", bg: "bg-indigo-500/10" },
          { label: "Total Downloads", value: data?.totalDownloads || 0, icon: Download, color: "text-purple-400", bg: "bg-purple-500/10" },
        ].map((card, i) => (
          <div
            key={i}
            className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-xl flex items-center justify-between hover:border-slate-700/50 transition duration-200"
          >
            <div>
              <p className="text-slate-400 text-sm font-medium">{card.label}</p>
              <h3 className="text-3xl font-bold text-slate-100 mt-2">{card.value}</h3>
            </div>
            <div className={`p-3.5 rounded-xl ${card.bg} ${card.color}`}>
              <card.icon className="h-6 w-6" />
            </div>
          </div>
        ))}
      </div>

      {/* Layout Split: Recent Uploads & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Uploads */}
        <div className="lg:col-span-2 bg-slate-900/20 border border-slate-900 p-6 rounded-xl space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg text-slate-200">Recent Uploads</h3>
            <Link href="/admin/folders" className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition">
              <span>View Folders</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {data?.recentUploads && data.recentUploads.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {data.recentUploads.map((image) => (
                <div key={image._id} className="group relative rounded-lg overflow-hidden aspect-square border border-slate-800/80 bg-slate-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.thumbnailUrl}
                    alt={image.originalFilename}
                    className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent opacity-0 group-hover:opacity-100 transition duration-200 flex flex-col justify-end p-2">
                    <p className="text-xs font-medium text-slate-200 truncate">{image.originalFilename}</p>
                    <span className="text-[10px] text-slate-400 truncate">/{image.folderSlug}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center border border-dashed border-slate-800 rounded-xl text-slate-500">
              No recent uploads. Create a folder and upload images!
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="bg-slate-900/20 border border-slate-900 p-6 rounded-xl space-y-6">
          <h3 className="font-bold text-lg text-slate-200">Recent Activity</h3>
          
          {data?.recentEvents && data.recentEvents.length > 0 ? (
            <div className="flow-root">
              <ul className="-mb-8">
                {data.recentEvents.map((event, eventIdx) => {
                  let eventLabel = "Visitor activity";
                  let eventIconColor = "bg-slate-800 text-slate-400";
                  
                  if (event.eventType === "folder_view") {
                    eventLabel = `Viewed folder /${event.folderSlug}`;
                    eventIconColor = "bg-indigo-500/10 text-indigo-400";
                  } else if (event.eventType === "download") {
                    eventLabel = `Downloaded image in /${event.folderSlug}`;
                    eventIconColor = "bg-purple-500/10 text-purple-400";
                  } else if (event.eventType === "password_attempt") {
                    eventLabel = `Password attempt /${event.folderSlug}`;
                    eventIconColor = "bg-rose-500/10 text-rose-400";
                  }

                  return (
                    <li key={event._id}>
                      <div className="relative pb-8">
                        {eventIdx !== data.recentEvents.length - 1 ? (
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-800" aria-hidden="true" />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-slate-950 ${eventIconColor}`}>
                              {event.eventType === "folder_view" && <Eye className="h-4 w-4" />}
                              {event.eventType === "download" && <Download className="h-4 w-4" />}
                              {event.eventType === "password_attempt" && <Clock className="h-4 w-4" />}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-slate-300">{eventLabel}</p>
                            </div>
                            <div className="text-right text-xs whitespace-nowrap text-slate-500 flex flex-col items-end gap-1">
                              <time dateTime={event.timestamp}>
                                {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </time>
                              {event.country && (
                                <span className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  <span>{event.country}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500">
              No recent visitor activity recorded.
            </div>
          )}
        </div>
      </div>

      {/* Quick Create Folder Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-100">Create New Folder</h3>
              <p className="text-slate-400 text-xs mt-1">Folders group together images published under a unique url.</p>
            </div>

            {createError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1.5">Folder Name</label>
                <input
                  type="text"
                  required
                  value={folderName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Goa Trip 2026"
                  className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1.5">URL Slug (Auto-generated)</label>
                <div className="relative flex items-center">
                  <span className="absolute pl-3.5 text-xs text-slate-500 select-none">galleryvault.in/</span>
                  <input
                    type="text"
                    required
                    value={folderSlug}
                    onChange={(e) => setFolderSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                    className="block w-full pl-28 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 transition text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold rounded-xl transition duration-200 disabled:opacity-50 text-sm"
                >
                  {isCreating ? "Creating..." : "Create Folder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
