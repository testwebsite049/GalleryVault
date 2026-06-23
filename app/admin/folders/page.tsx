"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Eye,
  Settings,
  Trash2,
  Lock,
  ExternalLink,
  HardDriveUpload,
  Calendar,
  AlertTriangle,
  FolderPlus,
  ArrowUpDown,
  BarChart3,
  Image as ImageIcon,
  Plus,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface FolderItem {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  coverImageUrl?: string | null;
  isPublished: boolean;
  passwordProtected: boolean;
  totalImages: number;
  totalViews: number;
  totalDownloads: number;
  createdAt: string;
}

export default function AdminFoldersPage() {
  const toast = useToast();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");

  // Create folder modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderSlug, setFolderSlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchFolders = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        search,
        filter,
        sort,
        order,
      });
      const res = await fetch(`/api/admin/folders?${queryParams}`);
      if (!res.ok) throw new Error("Failed to load folders");
      const json = await res.json();
      setFolders(json.folders || []);
    } catch (err: any) {
      setError(err.message || "Failed to load folders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchFolders();
    }, 300); // Debounce search changes

    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filter, sort, order]);

  const handleNameChange = (name: string) => {
    setFolderName(name);
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
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
      fetchFolders(); // Reload folders
    } catch (err: any) {
      setCreateError(err.message || "An error occurred.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteFolder = async (id: string, name: string) => {
    const confirmMessage = `WARNING: Are you sure you want to delete the folder "${name}"?\nThis will permanently delete ALL images in this folder from MongoDB and Cloudinary. This action CANNOT be undone!`;
    if (confirm(confirmMessage)) {
      try {
        const res = await fetch(`/api/admin/folders/${id}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error?.message || "Failed to delete folder");
        }

        // Remove from state
        setFolders(folders.filter((f) => f._id !== id));
        toast.success(`Folder "${name}" deleted successfully.`);
      } catch (err: any) {
        toast.error(err.message || "Failed to delete folder.");
      }
    }
  };

  const toggleSortOrder = () => {
    setOrder(order === "asc" ? "desc" : "asc");
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Manage Folders
          </h1>
          <p className="text-slate-400 text-sm mt-1">Publish albums, configure credentials, and manage images</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold rounded-xl transition duration-200 text-sm"
        >
          <FolderPlus className="h-5 w-5" />
          <span>New Folder</span>
        </button>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900/20 border border-slate-900 p-4 rounded-xl">
        <div className="relative w-full md:max-w-xs">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 border border-slate-800 rounded-xl">
            <Filter className="h-4 w-4 text-slate-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published Only</option>
              <option value="draft">Drafts Only</option>
              <option value="password">Password Protected</option>
            </select>
          </div>

          {/* Sort Filter */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 border border-slate-800 rounded-xl">
            <ArrowUpDown className="h-4 w-4 text-slate-500" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="createdAt">Date Created</option>
              <option value="name">Folder Name</option>
              <option value="views">Total Views</option>
              <option value="images">Image Count</option>
            </select>
          </div>

          {/* Asc/Desc Button */}
          <button
            onClick={toggleSortOrder}
            className="p-2 border border-slate-800 rounded-xl bg-slate-950 hover:bg-slate-800 transition text-slate-400 hover:text-slate-200 text-xs"
            title={`Sort ${order === "asc" ? "Ascending" : "Descending"}`}
          >
            {order === "asc" ? "ASC" : "DESC"}
          </button>
        </div>
      </div>

      {/* Main Table */}
      {error && (
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center gap-3">
          <AlertTriangle />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-10 bg-slate-800 rounded-lg" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-800 rounded-lg border border-slate-700/50" />
          ))}
        </div>
      ) : folders.length > 0 ? (
        <div className="bg-slate-900/10 border border-slate-900 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-950/30 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-4 px-6">Gallery</th>
                  <th className="py-4 px-6">Slug</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-center">Images</th>
                  <th className="py-4 px-6 text-center">Views</th>
                  <th className="py-4 px-6">Created Date</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-sm text-slate-300">
                {folders.map((folder) => (
                  <tr key={folder._id} className="hover:bg-slate-900/10 transition">
                    <td className="py-4 px-6 flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                        {folder.coverImageUrl ? (
                          // eslint-disable-next-line @typescript-eslint/no-img-element
                          <img src={folder.coverImageUrl} alt={folder.name} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-slate-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link href={`/admin/folders/${folder._id}`} className="font-bold text-slate-100 hover:text-emerald-400 transition truncate block">
                          {folder.name}
                        </Link>
                        <span className="text-xs text-slate-500 block truncate max-w-xs">{folder.description || "No description"}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-slate-400">
                      /{folder.slug}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex flex-col items-center gap-1.5 justify-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          folder.isPublished
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}>
                          {folder.isPublished ? "Published" : "Draft"}
                        </span>
                        {folder.passwordProtected && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 font-medium bg-cyan-500/5 px-1.5 py-0.5 rounded border border-cyan-500/10">
                            <Lock className="h-3 w-3" />
                            <span>Protected</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center font-bold text-slate-200">
                      {folder.totalImages}
                    </td>
                    <td className="py-4 px-6 text-center text-slate-400">
                      {folder.totalViews}
                    </td>
                    <td className="py-4 px-6 text-slate-400 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-600" />
                        <span>{new Date(folder.createdAt).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {folder.isPublished && (
                          <a
                            href={`/${folder.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-slate-100 rounded-lg transition"
                            title="View Public Gallery"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        <Link
                          href={`/admin/folders/${folder._id}`}
                          className="p-2 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-lg transition"
                          title="Folder Settings & Images"
                        >
                          <Settings className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDeleteFolder(folder._id, folder.name)}
                          className="p-2 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition"
                          title="Delete Folder"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="py-16 text-center border-2 border-dashed border-slate-900 rounded-2xl space-y-4">
          <HardDriveUpload className="h-10 w-10 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-bold text-slate-300">No Folders Found</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              Create your first folder to begin uploading and publishing your photo galleries.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold rounded-xl transition duration-200 text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Create Folder</span>
          </button>
        </div>
      )}

      {/* Create Folder Modal */}
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
                  <span className="absolute pl-3.5 text-xs text-slate-500 select-none">imgweb.in/</span>
                  <input
                    type="text"
                    required
                    value={folderSlug}
                    onChange={(e) => setFolderSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                    className="block w-full pl-20 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500/50 transition text-sm font-mono"
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
