import React from "react";
import { ColumnAnalysis, flattenTypeSuggestions, TypeSuggestions } from "@/lib/types";
import { ColumnHealthCard } from "@/components/report/ColumnHealthCard";

interface FieldHealthSectionProps {
  columns: ColumnAnalysis[];
  typeSuggestions: TypeSuggestions;
  totalRows: number;
  datasetId: string | null;
}

export function FieldHealthSection({ columns, typeSuggestions, totalRows, datasetId }: FieldHealthSectionProps) {
  const suggestions = flattenTypeSuggestions(typeSuggestions);
  const suggestionByColumn = new Map(suggestions.map((s) => [s.column, s]));

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold text-ink">Field Health</h2>
        <p className="mt-0.5 text-[13px] text-ink-secondary">One card per column. Expand for the full picture.</p>
      </div>
      <div className="flex flex-col gap-2">
        {columns.map((col) => (
          <ColumnHealthCard key={col.name} column={col} totalRows={totalRows} datasetId={datasetId} typeSuggestion={suggestionByColumn.get(col.name)} />
        ))}
      </div>
    </div>
  );
}
