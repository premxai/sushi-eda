"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColumnAnalysis } from "@/lib/types";

interface ColumnAnalysisPanelProps {
  columns: ColumnAnalysis[];
}

export function ColumnAnalysisPanel({ columns }: ColumnAnalysisPanelProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Column</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Missing %</TableHead>
              <TableHead>Unique</TableHead>
              <TableHead className="hidden lg:table-cell">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {columns.map((col) => (
              <TableRow key={col.name}>
                <TableCell className="font-medium font-mono text-sm">
                  {col.name}
                </TableCell>
                <TableCell>
                  <Badge variant={col.is_numeric ? "default" : "secondary"} className="text-xs">
                    {col.dtype}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={col.missing_percent} className="h-2 w-16" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {col.missing_percent}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {col.unique_count.toLocaleString()}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {col.is_numeric && col.stats ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>mean: <strong className="text-foreground">{col.stats.mean}</strong></span>
                      <span>med: <strong className="text-foreground">{col.stats.median}</strong></span>
                      <span>std: <strong className="text-foreground">{col.stats.std}</strong></span>
                      <span>skew: <strong className="text-foreground">{col.stats.skewness}</strong></span>
                    </div>
                  ) : col.top_values ? (
                    <div className="flex flex-wrap gap-1">
                      {col.top_values.slice(0, 3).map((tv) => (
                        <Badge key={tv.value} variant="outline" className="text-xs font-normal">
                          {tv.value} ({tv.count})
                        </Badge>
                      ))}
                      {col.top_values.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{col.top_values.length - 3} more
                        </span>
                      )}
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Expandable detail cards for each column */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((col) => (
          <Card key={col.name}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-mono">{col.name}</CardTitle>
                <Badge variant={col.is_numeric ? "default" : "secondary"} className="text-xs">
                  {col.dtype}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-muted p-2">
                  <p className="text-muted-foreground">Missing</p>
                  <p className="font-semibold">{col.missing_percent}%</p>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <p className="text-muted-foreground">Unique</p>
                  <p className="font-semibold">{col.unique_count.toLocaleString()}</p>
                </div>
              </div>

              {col.is_numeric && col.stats && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {Object.entries(col.stats).map(([k, v]) => (
                    <div key={k} className="rounded-md bg-muted p-2">
                      <p className="text-muted-foreground">{k}</p>
                      <p className="font-semibold tabular-nums">{v}</p>
                    </div>
                  ))}
                </div>
              )}

              {!col.is_numeric && col.top_values && (
                <div className="space-y-1">
                  {col.top_values.map((tv) => (
                    <div key={tv.value} className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-[60%]">{tv.value}</span>
                      <span className="text-muted-foreground tabular-nums">{tv.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
