"use client";

import * as React from "react";
import { Suspense } from "react";
import { ChartSkeleton } from "./LoadingSkeleton";

interface LazyChartProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function LazyChart({ children, fallback }: LazyChartProps) {
  const [isInView, setIsInView] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "100px",
        threshold: 0.1,
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="min-h-[400px]">
      {isInView ? (
        <Suspense fallback={fallback || <ChartSkeleton />}>
          {children}
        </Suspense>
      ) : (
        fallback || <ChartSkeleton />
      )}
    </div>
  );
}
