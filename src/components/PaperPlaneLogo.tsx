import React from "react";

interface LogoProps {
  className?: string;
  containerClassName?: string;
  iconSizeClassName?: string;
}

export default function PaperPlaneLogo({ 
  containerClassName = "w-10 h-10 bg-[#0B0F14] rounded-xl flex items-center justify-center shadow-md shrink-0 border border-neutral-800/20",
}: LogoProps) {
  return (
    <div className="w-10 h-10 bg-[#0B0F14] rounded-xl flex items-center justify-center shadow-md shrink-0 border border-neutral-800/10 font-sans select-none">
      <span className="text-sm font-extrabold tracking-tighter flex items-center justify-center">
        <span className="text-white">L</span>
        <span className="text-[#10B981]">P</span>
      </span>
    </div>
  );
}
