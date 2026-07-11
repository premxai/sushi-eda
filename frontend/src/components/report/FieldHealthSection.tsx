import React from "react";
import { ColumnAnalysis, flattenTypeSuggestions, TypeSuggestions } from "@/lib/types";
import { ColumnHealthCard } from "@/components/report/ColumnHealthCard";
import { ReportSectionHeading } from "@/components/report/ReportSectionHeading";
import { Columns3 } from "lucide-react";

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
      <ReportSectionHeading icon={Columns3} eyebrow="Column audit" title="Know every field." description="Review completeness, types, distributions, and practical cleanup suggestions column by column." />
      <div className="flex flex-col gap-2">
        {columns.map((col) => (
          <ColumnHealthCard key={col.name} column={col} totalRows={totalRows} datasetId={datasetId} typeSuggestion={suggestionByColumn.get(col.name)} />
        ))}
      </div>
    </div>
  );
}
