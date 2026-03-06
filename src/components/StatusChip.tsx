"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ChipVariant = "critical" | "warning" | "success" | "info" | "neutral" | "purple";

const variantStyles: Record<ChipVariant, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  success: "bg-emerald-100 text-emerald-800 border-emerald-200",
  info: "bg-blue-100 text-blue-800 border-blue-200",
  neutral: "bg-gray-100 text-gray-700 border-gray-200",
  purple: "bg-purple-100 text-purple-800 border-purple-200",
};

interface StatusChipProps {
  variant: ChipVariant;
  children: React.ReactNode;
  className?: string;
}

export default function StatusChip({ variant, children, className }: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
