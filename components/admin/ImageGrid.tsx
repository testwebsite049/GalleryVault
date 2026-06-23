"use client";

import React, { useState } from "react";
import { Trash2, Edit3, Image as ImageIcon, Check, CheckSquare, Square, X, Info } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface ImageItem {
  _id: string;
  originalFilename: string;
  secureUrl: string;
  thumbnailUrl: string;
  format: string;
  width: number;
  height: number;
  fileSize: number;
  altText?: string | null;
  caption?: string | null;
}

interface ImageGridProps {
  images: ImageItem[];
  onRefresh: () => void;
}

export default function ImageGrid({ images, onRefresh }: ImageGridProps) {
  const toast = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Edit modal state
  const [editingImage, setEditingImage] = useState<ImageItem | null>(null);
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);

  // Bulk selection helpers
  const handleSelectToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === images.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(images.map((img) => img._id));
    }
  };

  // Delete handlers
  const handleDeleteSingle = async (id: string, filename: string) => {
    if (confirm(`Are you sure you want to delete the image "${filename}"?`)) {
      setDeletingIds((prev) => [...prev, id]);
      try {
        const res = await fetch(`/api/admin/images/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete image.");
        onRefresh();
        setSelectedIds((prev) => prev.filter((item) => item !== id));
        toast.success(`Image "${filename}" deleted successfully.`);
      } catch (err: any) {
        toast.error(err.message || "Failed to delete image.");
      } finally {
        setDeletingIds((prev) => prev.filter((item) => item !== id));
      }
    }
  };

  const handleDeleteBulk = async () => {
    const count = selectedIds.length;
    if (confirm(`Are you sure you want to delete the ${count} selected images?`)) {
      setDeletingIds((prev) => [...prev, ...selectedIds]);
      try {
        // Send delete requests in parallel
        const promises = selectedIds.map((id) =>
          fetch(`/api/admin/images/${id}`, { method: "DELETE" })
        );
        const results = await Promise.all(promises);
        
        const failedCount = results.filter((res) => !res.ok).length;
        if (failedCount > 0) {
          toast.warning(`Deleted some images, but ${failedCount} uploads failed to delete.`);
        } else {
          toast.success(`Successfully deleted ${count} images.`);
        }
        
        onRefresh();
        setSelectedIds([]);
      } catch (err: any) {
        toast.error(err.message || "Failed to complete bulk deletion.");
      } finally {
        setDeletingIds([]);
      }
    }
  };

  // Edit Handlers
  const openEditModal = (img: ImageItem) => {
    setEditingImage(img);
    setAltText(img.altText || "");
    setCaption(img.caption || "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingImage) return;

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/images/${editingImage._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          altText: altText || null,
          caption: caption || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to save changes.");

      setEditingImage(null);
      onRefresh();
      toast.success("Image settings saved successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update image settings.");
    } finally {
      setSavingEdit(false);
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  if (images.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl text-slate-500">
        <ImageIcon className="h-8 w-8 mx-auto text-slate-700 mb-2" />
        <p className="text-sm font-medium">No images uploaded yet</p>
        <p className="text-xs text-slate-600 mt-1">Use the upload zone above to add pictures to this album.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selection controls bar */}
      <div className="flex justify-between items-center bg-slate-900/10 border border-slate-900 px-4 py-3 rounded-xl">
        <button
          onClick={handleSelectAll}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition"
        >
          {selectedIds.length === images.length ? (
            <CheckSquare className="h-4 w-4 text-emerald-400" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          <span>
            {selectedIds.length === images.length ? "Deselect All" : "Select All"} ({selectedIds.length}/{images.length})
          </span>
        </button>

        {selectedIds.length > 0 && (
          <button
            onClick={handleDeleteBulk}
            disabled={deletingIds.length > 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-slate-950 font-bold rounded-lg transition text-xs border border-rose-500/20 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete Selected ({selectedIds.length})</span>
          </button>
        )}
      </div>

      {/* Images Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {images.map((img) => {
          const isSelected = selectedIds.includes(img._id);
          const isDeleting = deletingIds.includes(img._id);
          const hasMetadata = img.altText || img.caption;

          return (
            <div
              key={img._id}
              className={`group relative border rounded-xl overflow-hidden aspect-square bg-slate-950/50 flex flex-col justify-between transition-all duration-200 ${
                isSelected
                  ? "border-emerald-500 ring-2 ring-emerald-500/20"
                  : "border-slate-800 hover:border-slate-700/60"
              } ${isDeleting ? "opacity-40 pointer-events-none" : ""}`}
            >
              {/* Checkbox badge */}
              <button
                type="button"
                onClick={() => handleSelectToggle(img._id)}
                className="absolute top-2 left-2 z-10 p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-slate-300 transition"
              >
                {isSelected ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <div className="h-4 w-4 rounded-sm border border-slate-600 group-hover:border-slate-400" />
                )}
              </button>

              {/* Info Indicator (if alt text or caption is set) */}
              {hasMetadata && (
                <span className="absolute top-2 right-2 z-10 p-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Info className="h-3.5 w-3.5" />
                </span>
              )}

              {/* Main Image */}
              {/* eslint-disable-next-line @typescript-eslint/no-img-element */}
              <img
                src={img.thumbnailUrl}
                alt={img.altText || img.originalFilename}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-102 flex-1"
              />

              {/* Hover controls overlay */}
              <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-3">
                <div className="flex justify-end gap-1.5 self-end pt-1">
                  <button
                    onClick={() => openEditModal(img)}
                    className="p-1.5 bg-slate-900/90 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition"
                    title="Edit Alt Text / Caption"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSingle(img._id, img.originalFilename)}
                    className="p-1.5 bg-slate-900/90 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-rose-400 rounded-lg transition"
                    title="Delete Image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="min-w-0 text-left">
                  <p className="text-xs font-semibold text-slate-100 truncate">{img.originalFilename}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {img.width} × {img.height} • {formatBytes(img.fileSize)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Alt/Caption Modal */}
      {editingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Edit Image Details</h3>
                <p className="text-slate-500 text-xs mt-0.5 truncate max-w-xs">{editingImage.originalFilename}</p>
              </div>
              <button
                onClick={() => setEditingImage(null)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="flex gap-4 items-start pb-2">
                <div className="h-20 w-20 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @typescript-eslint/no-img-element */}
                  <img src={editingImage.thumbnailUrl} alt="Preview" className="h-full w-full object-cover" />
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <p><span className="font-semibold">Format:</span> {editingImage.format.toUpperCase()}</p>
                  <p><span className="font-semibold">Dimensions:</span> {editingImage.width} x {editingImage.height} px</p>
                  <p><span className="font-semibold">File Size:</span> {formatBytes(editingImage.fileSize)}</p>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1.5">
                  Alt Text (Screen Readers & SEO)
                </label>
                <input
                  type="text"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="e.g. Sunny beach with palm trees and ocean"
                  className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1.5 font-sans">
                  Caption (Shown in Lightbox Overlay)
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Describe this photo..."
                  rows={3}
                  className="block w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition text-sm resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingImage(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold rounded-xl transition duration-200 disabled:opacity-50 text-sm"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
