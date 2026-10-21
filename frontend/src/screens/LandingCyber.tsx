import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Menu, X, Shield, Terminal, Activity, FileCheck, Layers } from "lucide-react";

const VIDEO_URL = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_132544_b6ef0174-ed95-45ad-9a2f-ccb8acfbdce8.mp4";

export function LandingCyber({ onOpenApp }: { onOpenApp: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);

  // Sync background video loops
  useEffect(() => {
    const v1 = video1Ref.current;
    const v2 = video2Ref.current;
    if (!v1 || !v2) return;

    const onTimeUpdate = () => {
      if (Math.abs(v1.currentTime - v2.currentTime) > 0.15) {
        v2.currentTime = v1.currentTime;
      }
    };
    v1.addEventListener("timeupdate", onTimeUpdate);
    return () => v1.removeEventListener("timeupdate", onTimeUpdate);
  }, []);

  return (
    <div className="cyber-stage fixed inset-0 z-50 flex h-full w-full flex-col justify-between overflow-hidden bg-black text-white antialiased select-none font-['Space_Grotesk',sans-serif]">
      {/* SVG LUT Grade Filters */}
      <svg className="svgdefs absolute h-0 w-0 overflow-hidden" aria-hidden="true">
        <defs>
          <filter id="grade" colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="table" tableValues="0.0018 0.0105 0.0154 0.0228 0.0307 0.0404 0.0485 0.0585 0.0719 0.0923 0.1205 0.1466 0.1657 0.1866 0.2197 0.2405 0.2485 0.2921 0.3362 0.3465 0.3472 0.3781 0.3781 0.4078 0.4199 0.4391 0.4604 0.4763 0.4798 0.5197 0.5473 0.5720 0.5995 0.6048 0.6232 0.6322 0.6483 0.6734 0.7201 0.7201 0.7410 0.7707 0.7707 0.7790 0.8084 0.8084 0.8390 0.8595 0.8707 0.8870 0.8993 0.9085 0.9132 0.9132 0.9162 0.9162 0.9162 0.9162 0.9162 0.9162 0.9162 0.9162 0.9162 0.9238 0.9300"/>
              <feFuncG type="table" tableValues="0.0023 0.0106 0.0159 0.0250 0.0333 0.0445 0.0535 0.0620 0.0707 0.0827 0.0936 0.1063 0.1214 0.1402 0.1678 0.1727 0.2029 0.2176 0.2461 0.2757 0.2814 0.3050 0.3415 0.3692 0.3826 0.3884 0.4617 0.4617 0.4617 0.4643 0.4643 0.4808 0.5706 0.6005 0.6005 0.6390 0.6390 0.6390 0.6390 0.6390 0.6390 0.6390 0.6390 0.6390 0.6524 0.6664 0.6805 0.6945 0.7086 0.7227 0.7367 0.7508 0.7648 0.7789 0.7929 0.8070 0.8211 0.8351 0.8492 0.8632 0.8773 0.8913 0.9054 0.9195 0.9300"/>
              <feFuncB type="table" tableValues="0.0021 0.0110 0.0187 0.0311 0.0377 0.0466 0.0584 0.0706 0.0791 0.0924 0.1039 0.1145 0.1316 0.1464 0.1614 0.1719 0.1887 0.2014 0.2247 0.2458 0.2954 0.2954 0.3089 0.3938 0.3938 0.3988 0.3988 0.4581 0.4581 0.4762 0.4762 0.4763 0.5374 0.5560 0.5813 0.5813 0.5813 0.5813 0.5835 0.5969 0.6104 0.6238 0.6373 0.6507 0.6642 0.6777 0.6911 0.7046 0.7181 0.7315 0.7449 0.7584 0.7719 0.7853 0.7988 0.8123 0.8257 0.8391 0.8526 0.8661 0.8795 0.8930 0.9065 0.9199 0.9300"/>
            </feComponentTransfer>
          </filter>
          <filter id="grade2" colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="table" tableValues="0.0016 0.0092 0.0136 0.0201 0.0270 0.0356 0.0427 0.0515 0.0633 0.0812 0.1060 0.1290 0.1458 0.1642 0.1933 0.2116 0.2187 0.2570 0.2959 0.3049 0.3055 0.3327 0.3327 0.3589 0.3695 0.3864 0.4052 0.4191 0.4222 0.4573 0.4816 0.5034 0.5276 0.5322 0.5484 0.5563 0.5705 0.5926 0.6337 0.6337 0.6521 0.6782 0.6782 0.6855 0.7114 0.7114 0.7383 0.7564 0.7662 0.7806 0.7914 0.7995 0.8036 0.8036 0.8063 0.8063 0.8063 0.8063 0.8063 0.8063 0.8063 0.8063 0.8063 0.8129 0.8184"/>
              <feFuncG type="table" tableValues="0.0015 0.0069 0.0103 0.0163 0.0216 0.0289 0.0348 0.0403 0.0460 0.0538 0.0608 0.0691 0.0789 0.0911 0.1091 0.1123 0.1319 0.1414 0.1600 0.1792 0.1829 0.1983 0.2220 0.2400 0.2487 0.2525 0.3001 0.3001 0.3001 0.3018 0.3018 0.3125 0.3709 0.3903 0.3903 0.4153 0.4153 0.4153 0.4153 0.4153 0.4153 0.4153 0.4153 0.4153 0.4241 0.4332 0.4423 0.4514 0.4606 0.4698 0.4789 0.4880 0.4971 0.5063 0.5154 0.5246 0.5337 0.5428 0.5520 0.5611 0.5702 0.5793 0.5885 0.5977 0.6045"/>
              <feFuncB type="table" tableValues="0.0013 0.0066 0.0112 0.0187 0.0226 0.0280 0.0350 0.0424 0.0475 0.0554 0.0623 0.0687 0.0790 0.0878 0.0968 0.1031 0.1132 0.1208 0.1348 0.1475 0.1772 0.1772 0.1853 0.2363 0.2363 0.2393 0.2393 0.2749 0.2749 0.2857 0.2857 0.2858 0.3224 0.3336 0.3488 0.3488 0.3488 0.3488 0.3501 0.3581 0.3662 0.3743 0.3824 0.3904 0.3985 0.4066 0.4147 0.4228 0.4309 0.4389 0.4469 0.4550 0.4631 0.4712 0.4793 0.4874 0.4954 0.5035 0.5116 0.5197 0.5277 0.5358 0.5439 0.5519 0.5580"/>
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>

      {/* Atmospheric Background Video Loop Pass 1 */}
      <div className="bg pointer-events-none absolute inset-0 overflow-hidden" style={{ filter: "url(#grade)" }}>
        <video
          ref={video1Ref}
          src={VIDEO_URL}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover object-[center_top]"
        />
      </div>

      {/* Atmospheric Background Video Loop Pass 2 (Lifted Lower Half) */}
      <div
        className="bg2 pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          filter: "url(#grade2)",
          mixBlendMode: "plus-lighter",
          opacity: 0.35,
          maskImage: "linear-gradient(180deg, transparent 21.5%, #000 100%)",
          WebkitMaskImage: "linear-gradient(180deg, transparent 21.5%, #000 100%)",
        }}
      >
        <video
          ref={video2Ref}
          src={VIDEO_URL}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover object-[center_top]"
        />
      </div>

      {/* High-Contrast Vignette Scrim */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent lg:w-[65%]" />

      {/* Header Bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-6 lg:px-14">
        {/* Brand Mark */}
        <div className="flex items-center gap-4">
          <div className="procura-mark" aria-hidden="true">
            <span />
          </div>
          <div>
            <span className="font-['Space_Grotesk'] text-xl font-bold tracking-tight text-white">PROCURA</span>
            <span className="hidden font-['JetBrains_Mono'] text-[10px] text-slate-400 sm:inline-block sm:ml-2">
              v2.0.0 · Studionet (61999)
            </span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 font-['JetBrains_Mono'] text-xs text-slate-300 md:flex">
          <button onClick={onOpenApp} className="transition hover:text-white">Command Center</button>
          <button onClick={onOpenApp} className="transition hover:text-white">Tenders</button>
          <button onClick={onOpenApp} className="transition hover:text-white">Evaluation Matrix</button>
          <button onClick={onOpenApp} className="transition hover:text-white">Sealed Bids</button>
          <button onClick={onOpenApp} className="transition hover:text-white">Proof & Audit</button>
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenApp}
            className="hidden items-center gap-1.5 rounded-none bg-[#c81b1c] px-4 py-2 font-['Space_Grotesk'] text-xs font-bold uppercase tracking-wider text-white transition hover:brightness-110 sm:inline-flex"
          >
            Enter App
          </button>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-2 text-white md:hidden"
            aria-label="Toggle Menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 my-auto flex flex-col justify-center px-6 lg:px-14">
        <div className="max-w-2xl">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 font-['JetBrains_Mono'] text-xs font-semibold text-emerald-400 uppercase tracking-widest">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            GenLayer Intelligent Contract Protocol
          </div>

          {/* Left-Locked Headline */}
          <h1 className="mt-4 font-['Space_Grotesk'] text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Procurement you can prove.
          </h1>

          {/* Subcopy */}
          <p className="mt-5 font-['JetBrains_Mono'] text-sm leading-relaxed text-[#e6e6e6] sm:text-base">
            Institutional procurement with cryptographic proof on GenLayer Studionet. Freeze the requirement, commit sealed-bid RFQs, execute multi-vendor comparative AI consensus, and settle multi-tranche milestone escrow deterministically.
          </p>

          {/* Verification Badges */}
          <div className="mt-6 flex flex-wrap items-center gap-2 font-['JetBrains_Mono'] text-xs">
            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
              Requirement
            </span>
            <span className="rounded border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">
              Sealed Bid
            </span>
            <span className="rounded border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">
              Comparative Consensus
            </span>
            <span className="rounded border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">
              Milestone Escrow
            </span>
            <span className="rounded border border-emerald-500/40 bg-emerald-950/40 px-2.5 py-1 font-semibold text-emerald-400">
              COMPLIANT
            </span>
          </div>

          {/* Action CTA */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              onClick={onOpenApp}
              className="inline-flex items-center gap-3 bg-[#c81b1c] px-6 py-3.5 font-['Space_Grotesk'] text-sm font-bold uppercase tracking-wider text-white transition hover:brightness-110 shadow-lg shadow-red-950/40"
            >
              Open Procura <ArrowRight size={16} />
            </button>
            <a
              href="https://explorer-studio.genlayer.com/address/0xE8b7FCD95FA54B442e3ed114D6Cb1a016774b929"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 border border-white/20 bg-black/40 px-5 py-3.5 font-['JetBrains_Mono'] text-xs font-medium text-slate-300 backdrop-blur transition hover:border-white/40 hover:text-white"
            >
              Contract 0xE8b...929 <ArrowRight size={13} />
            </a>
          </div>
        </div>
      </main>

      {/* Bottom Telemetric Statistics Rail */}
      <footer className="relative z-10 border-t border-white/10 bg-black/60 backdrop-blur-md px-6 py-5 lg:px-14">
        <div className="grid grid-cols-2 gap-4 divide-y divide-white/10 sm:grid-cols-4 sm:divide-y-0 sm:divide-x sm:divide-white/10">
          <div className="pt-2 sm:pt-0 sm:pr-4">
            <div className="font-['JetBrains_Mono'] text-2xl font-bold text-white">04</div>
            <div className="font-['Space_Grotesk'] text-[11px] uppercase tracking-wider text-slate-400">
              Consensus Pillars
            </div>
            <div className="font-['JetBrains_Mono'] text-[9px] text-emerald-400 mt-0.5">COMPLIANT VERDICT</div>
          </div>

          <div className="pt-2 sm:pt-0 sm:px-4">
            <div className="font-['JetBrains_Mono'] text-2xl font-bold text-white">179</div>
            <div className="font-['Space_Grotesk'] text-[11px] uppercase tracking-wider text-slate-400">
              Contract Tests Passed
            </div>
            <div className="font-['JetBrains_Mono'] text-[9px] text-slate-400 mt-0.5">0 Regressions</div>
          </div>

          <div className="pt-2 sm:pt-0 sm:px-4">
            <div className="font-['JetBrains_Mono'] text-2xl font-bold text-white">61999</div>
            <div className="font-['Space_Grotesk'] text-[11px] uppercase tracking-wider text-slate-400">
              Studionet Chain ID
            </div>
            <div className="font-['JetBrains_Mono'] text-[9px] text-emerald-400 mt-0.5">RPC LIVE</div>
          </div>

          <div className="pt-2 sm:pt-0 sm:pl-4">
            <div className="font-['JetBrains_Mono'] text-2xl font-bold text-white">100%</div>
            <div className="font-['Space_Grotesk'] text-[11px] uppercase tracking-wider text-slate-400">
              Bytecode Parity
            </div>
            <div className="font-['JetBrains_Mono'] text-[9px] text-emerald-400 mt-0.5">SHA-256 Verified</div>
          </div>
        </div>
      </footer>

      {/* Mobile Drawer Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95 p-6 backdrop-blur-xl md:hidden">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <span className="font-['Space_Grotesk'] text-lg font-bold text-white">PROCURA NAVIGATION</span>
            <button onClick={() => setMenuOpen(false)} className="text-white">
              <X size={24} />
            </button>
          </div>
          <div className="flex flex-col gap-5 font-['Space_Grotesk'] text-lg font-bold text-slate-200">
            <button onClick={() => { setMenuOpen(false); onOpenApp(); }} className="text-left py-2 border-b border-white/5">
              Command Center
            </button>
            <button onClick={() => { setMenuOpen(false); onOpenApp(); }} className="text-left py-2 border-b border-white/5">
              Tenders Registry
            </button>
            <button onClick={() => { setMenuOpen(false); onOpenApp(); }} className="text-left py-2 border-b border-white/5">
              Comparative Matrix
            </button>
            <button onClick={() => { setMenuOpen(false); onOpenApp(); }} className="text-left py-2 border-b border-white/5">
              Sealed-Bid RFQ
            </button>
            <button onClick={() => { setMenuOpen(false); onOpenApp(); }} className="text-left py-2 border-b border-white/5">
              Proof & Audit Room
            </button>
          </div>
          <button
            onClick={() => { setMenuOpen(false); onOpenApp(); }}
            className="w-full bg-[#c81b1c] py-3.5 font-['Space_Grotesk'] text-sm font-bold uppercase tracking-wider text-white"
          >
            Enter Procura Workspace
          </button>
        </div>
      )}
    </div>
  );
}
