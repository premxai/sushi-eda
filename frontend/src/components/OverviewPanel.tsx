"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rows3, Columns3, HardDrive, CopyMinus, AlertTriangle } from "lucide-react";
import { BasicInfo } from "@/lib/types";

interface OverviewPanelProps {
  info: BasicInfo;
}

const statCards = (info: BasicInfo) => [
  { label: "Rows", value: info.rows.toLocaleString(), icon: Rows3, color: "text-blue-500" },
  { label: "Columns", value: info.columns.toLocaleString(), icon: Columns3, color: "text-violet-500" },
  { label: "Memory", value: `${info.memory_usage_mb} MB`, icon: HardDrive, color: "text-emerald-500" },
  { label: "Duplicates", value: info.duplicate_rows.toLocaleString(), icon: CopyMinus, color: "text-amber-500" },
  { label: "Missing Values", value: info.total_missing.toLocaleString(), icon: AlertTriangle, color: "text-rose-500" },
];

export function OverviewPanel({ info }: OverviewPanelProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {statCards(info).map((s) => (
          <Card key={s.label} className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg bg-muted p-2 ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-semibold tracking-tight">{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Data Types Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(info.dtypes_summary).map(([dtype, count]) => (
              <Badge key={dtype} variant="secondary" className="gap-1.5 text-sm">
                <span className="font-mono">{dtype}</span>
                <span className="rounded-full bg-background px-1.5 py-0.5 text-xs">{count}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
