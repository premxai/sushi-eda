"use client";

import Image from "next/image";
import { Github, Sparkles } from "lucide-react";

interface NavbarProps {
  onTryDemo?: () => void;
  isDemoLoading?: boolean;
}

export default function Navbar({ onTryDemo, isDemoLoading }: NavbarProps) {
  return (
    <nav className="w-full h-[72px] flex items-center justify-between container-apple">

      <div className="flex items-center gap-3">
        <Image
          src="/sushi-logo.png"
          alt="Sushi Logo"
          width={40}
          height={40}
          className="w-10 h-10"
        />
        <span className="text-[22px] font-semibold tracking-tight">
          Sushi
        </span>
      </div>

      <div className="flex items-center gap-3">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        >
          <Github className="h-4 w-4" />
          <span className="hidden sm:inline">GitHub</span>
        </a>

        {onTryDemo && (
          <button
            onClick={onTryDemo}
            disabled={isDemoLoading}
            className="flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-neutral-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isDemoLoading ? "Loading..." : "Try Demo"}
          </button>
        )}
      </div>

    </nav>
  );
}
