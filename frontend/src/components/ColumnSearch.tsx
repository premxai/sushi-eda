"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ColumnSearchProps {
  onSearchChange: (term: string) => void;
  placeholder?: string;
  resultCount?: number;
}

export function ColumnSearch({ onSearchChange, placeholder = "Search columns...", resultCount }: ColumnSearchProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  const handleChange = (value: string) => {
    setSearchTerm(value);
    onSearchChange(value);
  };

  const handleClear = () => {
    setSearchTerm("");
    onSearchChange("");
  };

  return (
    <div className="relative mb-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => handleChange(e.target.value)}
          className="h-10 pl-10 pr-10 text-sm transition-all focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-400"
          aria-label="Search columns"
        />
        {searchTerm && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {searchTerm && resultCount !== undefined && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {resultCount} {resultCount === 1 ? "column" : "columns"} found
        </p>
      )}
    </div>
  );
}
