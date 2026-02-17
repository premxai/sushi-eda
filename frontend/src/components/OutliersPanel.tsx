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
import { OutlierInfo } from "@/lib/types";

interface OutliersPanelProps {
  outliers: OutlierInfo[];
}

export function OutliersPanel({ outliers }: OutliersPanelProps) {
  if (outliers.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">No numeric columns to analyze for outliers.</p>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...outliers].sort((a, b) => b.outlier_percent - a.outlier_percent);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Outlier Detection (IQR Method)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Column</TableHead>
                  <TableHead>Outliers</TableHead>
                  <TableHead>Outlier %</TableHead>
                  <TableHead className="hidden md:table-cell">Lower Bound</TableHead>
                  <TableHead className="hidden md:table-cell">Upper Bound</TableHead>
                  <TableHead className="hidden lg:table-cell">IQR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((o) => (
                  <TableRow key={o.column}>
                    <TableCell className="font-medium font-mono text-sm">{o.column}</TableCell>
                    <TableCell>
                      <Badge
                        variant={o.outlier_count > 0 ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {o.outlier_count.toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={Math.min(o.outlier_percent, 100)} className="h-2 w-16" />
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {o.outlier_percent}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs tabular-nums">
                      {o.lower_bound}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs tabular-nums">
                      {o.upper_bound}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs tabular-nums">
                      {o.iqr}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
