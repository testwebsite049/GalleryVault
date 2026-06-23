import Link from "next/link";
import { Image as ImageIcon, Shield, Sparkles, FolderLock, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background Neon Blur Nodes */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl" />

      {/* Header */}
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between w-full relative z-10">
        <div className="flex items-center gap-2 font-bold text-xl text-emerald-400">
          <ImageIcon className="h-6 w-6 text-emerald-400 animate-pulse" />
          <span>GalleryVault</span>
        </div>
        <Link
          href="/admin"
          className="flex items-center gap-1.5 px-4.5 py-2 border border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-slate-300 hover:text-slate-100 rounded-xl transition text-xs font-semibold"
        >
          <Shield className="h-3.5 w-3.5" />
          <span>Admin Portal</span>
        </Link>
      </header>

      {/* Main Hero */}
      <main className="max-w-4xl mx-auto px-6 py-20 text-center space-y-8 relative z-10 flex-1 flex flex-col justify-center items-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 font-semibold text-xs border border-emerald-500/20 rounded-full animate-fade-in">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Production-Ready Hosting Platform</span>
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight max-w-2xl bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
          Publish Stunning Photo Galleries Instantly.
        </h1>
        
        <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
          GalleryVault is a premium hosting and publishing platform for photographers. 
          Group photos into albums, enable custom watermarks, enforce password protection, and share them with the world.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 pt-4 justify-center">
          <Link
            href="/admin"
            className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl transition duration-200 text-sm shadow-lg shadow-emerald-500/15"
          >
            Manage Your Galleries
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3.5 border border-slate-850 hover:border-slate-700 bg-slate-900/10 hover:bg-slate-900/40 text-slate-300 hover:text-slate-100 rounded-xl transition text-sm font-semibold"
          >
            Documentation Docs
          </a>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-16 w-full max-w-3xl">
          {[
            { title: "Sleek Masonry", desc: "Responsive Pinterest-style columns with infinite scroll.", icon: Zap },
            { title: "Secure Lock", desc: "Password-protect private albums with session cookies.", icon: FolderLock },
            { title: "Dynamic Watermark", desc: "Protect your assets using CDN transformations.", icon: Sparkles }
          ].map((feat, i) => (
            <div key={i} className="bg-slate-900/20 border border-slate-900/60 p-5 rounded-2xl text-left hover:border-slate-800 transition duration-200">
              <div className="p-2.5 bg-slate-900 border border-slate-850 text-emerald-400 rounded-xl w-fit">
                <feat.icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-200 mt-4 text-sm">{feat.title}</h3>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600 relative z-10 w-full">
        <span>© {new Date().getFullYear()} GalleryVault Inc. All rights reserved.</span>
      </footer>
    </div>
  );
}
