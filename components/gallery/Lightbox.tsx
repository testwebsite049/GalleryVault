"use client";

import React, { useEffect, useState, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Download, Maximize2, Minimize2 } from "lucide-react";

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

interface LightboxProps {
  images: ImageItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  allowDownload: boolean;
  onDownload: (img: ImageItem) => void;
  watermarkEnabled: boolean;
  watermarkText?: string | null;
  watermarkPosition?: string | null;
}

export default function Lightbox({
  images,
  currentIndex,
  onClose,
  onNavigate,
  allowDownload,
  onDownload,
  watermarkEnabled,
  watermarkText,
  watermarkPosition,
}: LightboxProps) {
  const currentImage = images[currentIndex];
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Mobile swipe coordinates
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
    } else {
      // Loop to end
      onNavigate(images.length - 1);
    }
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex < images.length - 1) {
      onNavigate(currentIndex + 1);
    } else {
      // Loop to start
      onNavigate(0);
    }
  };

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "ArrowRight") handleNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // Prevent scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Preload adjacent images
  useEffect(() => {
    const preload = (url: string) => {
      const img = new Image();
      img.src = url;
    };

    if (currentIndex > 0) {
      const prevImg = images[currentIndex - 1];
      if (prevImg) preload(getDisplayUrl(prevImg));
    }
    if (currentIndex < images.length - 1) {
      const nextImg = images[currentIndex + 1];
      if (nextImg) preload(getDisplayUrl(nextImg));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // Touch Swipe Listeners
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX || null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0]?.clientX || null;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50; // Minimum swipe distance in px
    
    if (diff > threshold) {
      handleNext(); // Swiped left
    } else if (diff < -threshold) {
      handlePrev(); // Swiped right
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error("Fullscreen error:", err);
      });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Custom Cloudinary URL helper to inject watermark overlay at runtime
  const getDisplayUrl = (img: ImageItem) => {
    if (!img) return "";
    if (!watermarkEnabled || !watermarkText) {
      return img.secureUrl; // Display high quality image in lightbox
    }

    const text = encodeURIComponent(watermarkText);
    
    let gravity = "south_east";
    if (watermarkPosition === "bottom-left") gravity = "south_west";
    else if (watermarkPosition === "top-right") gravity = "north_east";
    else if (watermarkPosition === "top-left") gravity = "north_west";
    else if (watermarkPosition === "center") gravity = "center";

    const transformation = `l_text:Arial_36_bold:${text},g_${gravity},x_25,y_25,o_50`;
    
    if (img.secureUrl.includes("/upload/")) {
      return img.secureUrl.replace("/upload/", `/upload/${transformation}/`);
    }
    return img.secureUrl;
  };

  if (!currentImage) return null;

  const displayUrl = getDisplayUrl(currentImage);

  return (
    <div
      ref={containerRef}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between select-none"
    >
      {/* Top Header Panel */}
      <header className="flex justify-between items-center px-6 py-4 bg-gradient-to-b from-slate-950/80 to-transparent z-10 w-full">
        {/* Count Badge */}
        <span className="text-sm font-semibold text-slate-400 font-mono">
          {currentIndex + 1} / {images.length}
        </span>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleFullscreen}
            className="p-2.5 bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-slate-100 rounded-xl transition duration-200"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
          
          {allowDownload && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(currentImage);
              }}
              className="p-2.5 bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-slate-100 rounded-xl transition duration-200"
              title="Download Image"
            >
              <Download className="h-5 w-5" />
            </button>
          )}

          <button
            onClick={onClose}
            className="p-2.5 bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-slate-100 rounded-xl transition duration-200"
            title="Close Lightbox (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Image Area */}
      <div 
        className="flex-1 flex items-center justify-center relative px-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Navigation Arrows */}
        <button
          onClick={handlePrev}
          className="absolute left-6 hidden md:flex items-center justify-center p-3 rounded-2xl bg-slate-900/40 hover:bg-slate-900 border border-slate-800/50 text-slate-400 hover:text-slate-100 transition duration-200"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        {/* Centered Image */}
        {/* eslint-disable-next-line @typescript-eslint/no-img-element */}
        <img
          src={displayUrl}
          alt={currentImage.altText || currentImage.originalFilename}
          onClick={(e) => e.stopPropagation()} // Prevent close on image click
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl animate-fade-in duration-300 pointer-events-auto"
        />

        <button
          onClick={handleNext}
          className="absolute right-6 hidden md:flex items-center justify-center p-3 rounded-2xl bg-slate-900/40 hover:bg-slate-900 border border-slate-800/50 text-slate-400 hover:text-slate-100 transition duration-200"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {/* Footer Info Panel */}
      <footer className="w-full bg-gradient-to-t from-slate-950/90 to-transparent py-6 px-8 text-center flex flex-col items-center gap-1.5 z-10">
        <p className="text-base font-bold text-slate-100 max-w-2xl truncate">
          {currentImage.caption || currentImage.originalFilename}
        </p>
        {currentImage.altText && (
          <p className="text-xs text-slate-400 max-w-xl font-medium truncate">{currentImage.altText}</p>
        )}
        <p className="text-[10px] text-slate-600 font-mono mt-1">
          {currentImage.width} x {currentImage.height} px • {(currentImage.fileSize / 1024 / 1024).toFixed(2)} MB
        </p>
      </footer>
    </div>
  );
}
