"use client";

import { useReportWebVitals } from "next/web-vitals";
import posthog from "posthog-js";

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

type ConnectionWithHints = {
  effectiveType?: string;
  saveData?: boolean;
};

const TOKEN_ROUTE_PATTERNS = [
  { pattern: /^\/s\/[^/]+$/, route: "/s/[token]" },
  { pattern: /^\/claim\/[^/]+$/, route: "/claim/[token]" },
  { pattern: /^\/listen\/[^/]+$/, route: "/listen/[id]" },
  { pattern: /^\/admin\/runs\/[^/]+$/, route: "/admin/runs/[id]" },
];

function getDeviceClass(width: number): "mobile" | "tablet" | "desktop" {
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

export function sanitizeRouteName(pathname: string): string {
  for (const entry of TOKEN_ROUTE_PATTERNS) {
    if (entry.pattern.test(pathname)) return entry.route;
  }

  return pathname || "/";
}

function getConnectionHints(): { effectiveType: string | null; saveData: boolean | null } {
  const nav = navigator as Navigator & { connection?: ConnectionWithHints };
  const connection = nav.connection;

  return {
    effectiveType: connection?.effectiveType ?? null,
    saveData: typeof connection?.saveData === "boolean" ? connection.saveData : null,
  };
}

const reportMobileWebVitals: ReportWebVitalsCallback = (metric) => {
  const route = sanitizeRouteName(window.location.pathname);
  const width = window.innerWidth;
  const connection = getConnectionHints();

  posthog.capture("web_vital_reported", {
    metric_id: metric.id,
    metric_name: metric.name,
    metric_value: Math.round(metric.value),
    metric_delta: Math.round(metric.delta),
    metric_rating: metric.rating,
    navigation_type: metric.navigationType,
    route,
    device_class: getDeviceClass(width),
    viewport_width: width,
    viewport_height: window.innerHeight,
    connection_effective_type: connection.effectiveType,
    connection_save_data: connection.saveData,
  });
};

export function MobileWebVitals() {
  useReportWebVitals(reportMobileWebVitals);

  return null;
}
