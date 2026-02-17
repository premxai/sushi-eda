"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DataPreviewProps {
  preview: Record<string, unknown>[];
}

export function DataPreview({ preview }: DataPreviewProps) {
  if (preview.length === 0) return null;

  const columns = Object.keys(preview[0]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Data Preview</CardTitle>
          <span className="text-xs text-muted-foreground">
            Showing first {preview.length} rows
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[500px] overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                {columns.map((col) => (
                  <TableHead key={col} className="whitespace-nowrap font-mono text-xs">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                    {idx + 1}
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell key={col} className="max-w-[200px] truncate text-xs tabular-nums">
                      {String(row[col] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
