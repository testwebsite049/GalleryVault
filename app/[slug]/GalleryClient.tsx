"use client";

import React, { useEffect, useState, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Folder, Image as ImageIcon, Download, Loader2, ArrowUp, Info } from "lucide-react";
import Lightbox from "@/components/gallery/Lightbox";
import { useToast } from "@/components/ui/Toast";

interface FolderInfo {
  _id: string;
  name: string;
  slug: string;
  description: string;
  coverImageUrl?: string | null;
  allowDownload: boolean;
  allowBulkZip: boolean;
  watermarkEnabled: boolean;
  watermarkText?: string | null;
  watermarkPosition?: string | null;
  totalImages: number;
}

interface ImageItem {
  _id: string;
  originalFilename: string;
  secureUrl: string;
  thumbnailUrl: string;
  mediumUrl: string;
  format: string;
  width: number;
  height: number;
  fileSize: number;
  altText?: string | null;
  caption?: string | null;
}

interface GalleryClientProps {
  folder: FolderInfo;
  initialImages: ImageItem[];
}

export default function GalleryClient({ folder, initialImages }: GalleryClientProps) {
  const toast = useToast();
  const [visitorId, setVisitorId] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [zipDownloading, setZipDownloading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const zipFormRef = useRef<HTMLFormElement>(null);

  // 1. Initialize Visitor ID and track Page View
  useEffect(() => {
    let vid = localStorage.getItem("imgweb_visitor_id");
    if (!vid) {
      vid = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem("imgweb_visitor_id", vid);
    }
    setVisitorId(vid);

    // Send page view analytics track event
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folderSlug: folder.slug,
        eventType: "folder_view",
        visitorId: vid,
      }),
    }).catch((err) => console.error("Track view failed:", err));

    // Show/hide scroll to top button
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. TanStack Query useInfiniteQuery for pagination
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["gallery", folder.slug],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await fetch(`/api/gallery/${folder.slug}?page=${pageParam}&limit=20`);
      if (!res.ok) throw new Error("Failed to fetch gallery images.");
      return res.json();
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    initialData: {
      pages: [
        {
          images: initialImages,
          folder,
          total: folder.totalImages,
          page: 1,
          limit: 20,
          hasMore: initialImages.length < folder.totalImages,
        },
      ],
      pageParams: [1],
    },
  });

  // Flatten images across all fetched pages
  const allImages = data?.pages.flatMap((page) => page.images) || initialImages;

  // 3. Intersection Observer for Infinite Scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => {
      if (sentinel) observer.unobserve(sentinel);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 4. Handle Image Click & Lightbox Open
  const handleImageClick = (index: number) => {
    setActiveImageIndex(index);
    const clickedImage = allImages[index];
    if (clickedImage) {
      // Send image view track event
      fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderSlug: folder.slug,
          eventType: "image_view",
          imageId: clickedImage._id,
          visitorId,
        }),
      }).catch((err) => console.error("Track image view failed:", err));
    }
  };

  // 5. Handle Single Image Download
  const handleDownloadImage = (e: React.MouseEvent | null, img: ImageItem) => {
    if (e) {
      e.stopPropagation(); // Stop Lightbox from opening
    }

    // Trigger visitor track download log
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folderSlug: folder.slug,
        eventType: "download",
        imageId: img._id,
        visitorId,
      }),
    }).catch((err) => console.error("Track download log failed:", err));

    // Open download endpoint link in standard browser session download dialog
    window.location.href = `/api/gallery/${folder.slug}/download/${img._id}`;
  };

  // 6. Handle Bulk ZIP download
  const handleZipDownload = (e: React.FormEvent) => {
    e.preventDefault();
    if (zipDownloading) return;

    if (folder.totalImages > 500) {
      toast.info(
        "Notice: This gallery contains over 500 images. Generating the ZIP file may take up to a minute. Please keep this tab open while downloading."
      );
    }

    setZipDownloading(true);
    
    // Submit hidden form containing POST parameters
    zipFormRef.current?.submit();

    // Reset loading state after estimated completion
    setTimeout(() => {
      setZipDownloading(false);
    }, 6000);
  };

  // Custom Cloudinary URL helper to inject watermark overlay at runtime
  const getDisplayUrl = (img: ImageItem) => {
    if (!folder.watermarkEnabled || !folder.watermarkText) {
      return img.mediumUrl;
    }

    const text = encodeURIComponent(folder.watermarkText);
    
    // Determine positioning overlay for Cloudinary
    let gravity = "south_east";
    if (folder.watermarkPosition === "bottom-left") gravity = "south_west";
    else if (folder.watermarkPosition === "top-right") gravity = "north_east";
    else if (folder.watermarkPosition === "top-left") gravity = "north_west";
    else if (folder.watermarkPosition === "center") gravity = "center";

    // Inject watermark parameters into Cloudinary URL:
    const transformation = `l_text:Arial_18_bold:${text},g_${gravity},x_12,y_12,o_50`;
    
    if (img.mediumUrl.includes("/upload/")) {
      return img.mediumUrl.replace("/upload/", `/upload/${transformation}/`);
    }
    return img.mediumUrl;
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col font-sans pb-16 relative">
      <main className="mx-auto max-w-[1960px] p-4 flex-1 w-full">
        {allImages.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {/* Intro Card */}
              <div className="after:content relative col-span-1 row-span-3 sm:col-span-2 lg:col-span-1 lg:row-span-2 flex flex-col items-center justify-end gap-4 overflow-hidden rounded-lg bg-zinc-900/30 px-6 pb-16 pt-64 text-center text-white shadow-highlight after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:shadow-highlight border border-white/5 min-h-[460px]">
                {/* Blurred Cover Image background if available */}
                {folder.coverImageUrl ? (
                  <img
                    src={folder.coverImageUrl}
                    alt="Cover background"
                    className="absolute inset-0 h-full w-full object-cover scale-105 blur-lg opacity-20 select-none pointer-events-none"
                  />
                ) : (
                  /* Abstract wireframe camera grid graphic */
                  <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                    <svg className="w-4/5 h-4/5 text-slate-500" fill="none" viewBox="0 0 100 100" stroke="currentColor">
                      <circle cx="50" cy="50" r="30" strokeWidth="0.5" />
                      <circle cx="50" cy="50" r="20" strokeWidth="0.5" />
                      <circle cx="50" cy="50" r="10" strokeWidth="0.5" />
                      <path d="M10 50 H90 M50 10 V90" strokeWidth="0.5" />
                    </svg>
                  </div>
                )}
                
                {/* Subtle camera lens overlay on top of cover image as well */}
                {folder.coverImageUrl && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none">
                    <svg className="w-1/2 h-1/2 text-cyan-400" fill="none" viewBox="0 0 100 100" stroke="currentColor">
                      <circle cx="50" cy="50" r="25" strokeWidth="0.5" />
                      <path d="M10 50 H90 M50 10 V90" strokeWidth="0.5" />
                    </svg>
                  </div>
                )}

                {/* Gradient fade to black at the bottom */}
                <span className="absolute left-0 right-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

                {/* Content container */}
                <div className="relative z-10 flex flex-col items-center justify-end h-full">
                  {/* Badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 text-slate-300 font-semibold text-[10px] uppercase tracking-wider rounded-full border border-white/5">
                    <ImageIcon className="h-3 w-3" />
                    <span>{folder.totalImages} photos</span>
                  </div>

                  <h1 className="mt-6 mb-3 text-2xl font-extrabold tracking-tight text-white line-clamp-2">
                    {folder.name}
                  </h1>

                  {folder.description && (
                    <p className="text-slate-400 text-xs leading-relaxed max-w-[24ch] line-clamp-3">
                      {folder.description}
                    </p>
                  )}

                  {/* Download ZIP CTA button */}
                  {folder.allowDownload && folder.allowBulkZip && (
                    <form
                      ref={zipFormRef}
                      action={`/api/gallery/${folder.slug}/zip`}
                      method="POST"
                      onSubmit={handleZipDownload}
                      className="w-full mt-2"
                    >
                      <input type="hidden" name="visitorId" value={visitorId} />
                      <button
                        type="submit"
                        disabled={zipDownloading}
                        className="z-10 mt-6 w-full rounded-lg border border-white bg-white px-4 py-2.5 text-xs font-bold text-black transition hover:bg-white/10 hover:text-white disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-800 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        {zipDownloading ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Preparing ZIP...</span>
                          </>
                        ) : (
                          <>
                            <Download className="h-3.5 w-3.5" />
                            <span>Download Album (ZIP)</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* Gallery Images Loop */}
              {allImages.map((img, index) => {
                const displayUrl = getDisplayUrl(img);
                return (
                  <a
                    key={img._id}
                    href={`#img-${index}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleImageClick(index);
                    }}
                    className="after:content group relative block w-full aspect-[3/2] cursor-zoom-in after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:shadow-highlight overflow-hidden rounded-lg bg-zinc-900 border border-white/5"
                  >
                    {/* eslint-disable-next-line @typescript-eslint/no-img-element */}
                    <img
                      src={displayUrl}
                      alt={img.altText || img.originalFilename}
                      loading={index < 8 ? "eager" : "lazy"}
                      className="transform rounded-lg brightness-90 transition duration-300 will-change-auto group-hover:brightness-110 group-hover:scale-[1.02] object-cover w-full h-full"
                    />
                  </a>
                );
              })}
            </div>

            {/* Sentinel element for infinite scroll */}
            <div ref={sentinelRef} className="h-12 w-full flex items-center justify-center pt-8">
              {isFetchingNextPage && <Loader2 className="h-6 w-6 animate-spin text-slate-600" />}
              {!hasNextPage && allImages.length > 20 && (
                <p className="text-slate-600 text-xs font-semibold">You&apos;ve reached the end of this gallery</p>
              )}
            </div>
          </>
        ) : (
          <div className="py-24 text-center text-slate-600 border border-dashed border-slate-900 rounded-2xl max-w-md mx-auto mt-20">
            <ImageIcon className="h-10 w-10 mx-auto text-slate-800 mb-3" />
            <h3 className="font-bold text-slate-400">Empty Album</h3>
            <p className="text-slate-500 text-xs mt-1">This gallery is published but contains no photos yet.</p>
          </div>
        )}
      </main>

      {/* Floating Scroll To Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 p-3 rounded-2xl bg-white hover:bg-slate-200 text-slate-950 font-bold transition shadow-lg z-30"
          title="Scroll to Top"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}

      {/* Lightbox / Viewer Portal */}
      {activeImageIndex !== null && (
        <Lightbox
          images={allImages}
          currentIndex={activeImageIndex}
          onClose={() => setActiveImageIndex(null)}
          onNavigate={(idx) => handleImageClick(idx)}
          allowDownload={folder.allowDownload}
          onDownload={(img) => handleDownloadImage(null, img)}
          watermarkEnabled={folder.watermarkEnabled}
          watermarkText={folder.watermarkText}
          watermarkPosition={folder.watermarkPosition}
        />
      )}
    </div>
  );
}
