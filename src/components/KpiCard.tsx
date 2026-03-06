"use client";

import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  variant?: "default" | "danger" | "warning" | "success";
  className?: string;
}

const variantStyles = {
  default: "",
  danger: "border-red-200 bg-red-50/50",
  warning: "border-amber-200 bg-amber-50/50",
  success: "border-emerald-200 bg-emerald-50/50",
};

const iconVariantStyles = {
  default: "bg-primary/10 text-primary",
  danger: "bg-red-100 text-red-600",
  warning: "bg-amber-100 text-amber-600",
  success: "bg-emerald-100 text-emerald-600",
};

export default function KpiCard({
  title,
  value,
  subtitle,
  icon,
  variant = "default",
  className,
}: KpiCardProps) {
  return (
    <Card className={cn(variantStyles[variant], className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg", iconVariantStyles[variant])}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
