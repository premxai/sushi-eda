"use client";

import Image from "next/image";

export default function Navbar() {
  return (
    <nav className="w-full h-[72px] flex items-center container-apple">
      
      <div className="flex items-center gap-4">
        <Image 
          src="/sushi-logo.png" 
          alt="Sushi Logo" 
          width={56} 
          height={56} 
          className="w-14 h-14"
        />
        <span className="text-[28px] font-semibold tracking-tight">
          Sushi
        </span>
      </div>

    </nav>
  );
}
