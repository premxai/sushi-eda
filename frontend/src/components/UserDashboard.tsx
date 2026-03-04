"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  FileSpreadsheet,
  Clock,
  Star,
  TrendingUp,
  Database,
  ArrowRight,
  Sparkles,
  BarChart3,
  Loader2,
} from "lucide-react";
import { FileUpload } from "@/components/FileUpload";
import { DatasetSummary, listDatasets } from "@/lib/api";
import { cn } from "@/lib/utils";

interface UserDashboardProps {
  onFileAccepted: (file: File) => void;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  onClearError: () => void;
  onLoadSample: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const FORMAT_COLORS: Record<string, { bg: string; text: string }> = {
  csv: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
  xlsx: { bg: "bg-blue-500/10", text: "text-blue-500" },
  xls: { bg: "bg-blue-500/10", text: "text-blue-500" },
  parquet: { bg: "bg-violet-500/10", text: "text-violet-500" },
  json: { bg: "bg-amber-500/10", text: "text-amber-500" },
  tsv: { bg: "bg-teal-500/10", text: "text-teal-500" },
  sqlite: { bg: "bg-orange-500/10", text: "text-orange-500" },
  db: { bg: "bg-orange-500/10", text: "text-orange-500" },
};

export function UserDashboard({
  onFileAccepted,
  isUploading,
  uploadProgress,
  error,
  onClearError,
  onLoadSample,
}: UserDashboardProps) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [recentDatasets, setRecentDatasets] = useState<DatasetSummary[]>([]);
  const [starredDatasets, setStarredDatasets] = useState<DatasetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, starred: 0, thisWeek: 0 });

  const loadDatasets = useCallback(async () => {
    setLoading(true);
    try {
      const [all, starred] = await Promise.all([
        listDatasets("default", { archived: false }),
        listDatasets("default", { starred: true }),
      ]);
      setRecentDatasets(all.slice(0, 5));
      setStarredDatasets(starred.slice(0, 3));
      
      // Calculate stats
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const thisWeek = all.filter(d => new Date(d.created_at).getTime() > weekAgo).length;
      setStats({
        total: all.length,
        starred: starred.length,
        thisWeek,
      });
    } catch {
      // Silently fail - user might not have any datasets yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && user) {
      loadDatasets();
    }
  }, [isLoaded, user, loadDatasets]);

  const firstName = user?.firstName || user?.username || "there";

  const handleDatasetClick = (id: string) => {
    router.push(`/datasets/${id}`);
  };

  return (
    <div className="min-h-screen bg-[#0f1117]">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0f1117]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-white">Sushi</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link 
              href="/datasets" 
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              All Datasets
            </Link>
            <Link 
              href="/connectors" 
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Connectors
            </Link>
            <Link 
              href="/settings" 
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Settings
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Welcome Section */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">
            {getGreeting()}, {firstName}! 👋
          </h1>
          <p className="text-slate-400">
            Upload a dataset to get instant AI-powered insights, or continue where you left off.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-cyan-500/50 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-xs text-slate-400">Total Datasets</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-amber-500/50 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.starred}</p>
                <p className="text-xs text-slate-400">Starred</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-emerald-500/50 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.thisWeek}</p>
                <p className="text-xs text-slate-400">This Week</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">Upload New Dataset</h2>
            </div>
            
            <FileUpload
              onFileAccepted={onFileAccepted}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              error={error}
              onClearError={onClearError}
              onLoadSample={onLoadSample}
            />

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <Link
                href="/connectors"
                className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-violet-500/50 hover:bg-white/[0.07] transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
                  <Database className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Connect Database</p>
                  <p className="text-xs text-slate-500">PostgreSQL, MySQL</p>
                </div>
              </Link>
              <Link
                href="/pipelines"
                className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-emerald-500/50 hover:bg-white/[0.07] transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                  <BarChart3 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Pipelines</p>
                  <p className="text-xs text-slate-500">Automate workflows</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent & Starred Datasets */}
          <div className="space-y-6">
            {/* Recent Datasets */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-slate-400" />
                  <h2 className="text-lg font-semibold text-white">Recent Datasets</h2>
                </div>
                <Link 
                  href="/datasets" 
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
                </div>
              ) : recentDatasets.length === 0 ? (
                <div className="bg-white/5 border border-dashed border-white/20 rounded-xl p-8 text-center">
                  <FileSpreadsheet className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No datasets yet</p>
                  <p className="text-slate-500 text-xs mt-1">Upload your first file to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentDatasets.map((dataset) => {
                    const ext = dataset.original_filename.split(".").pop()?.toLowerCase() || "csv";
                    const colors = FORMAT_COLORS[ext] || FORMAT_COLORS.csv;
                    return (
                      <button
                        key={dataset.id}
                        onClick={() => handleDatasetClick(dataset.id)}
                        className="w-full flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg hover:border-cyan-500/50 hover:bg-white/[0.07] transition-all text-left group"
                      >
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", colors.bg)}>
                          <span className={cn("text-xs font-bold uppercase", colors.text)}>
                            {ext}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate group-hover:text-cyan-400 transition-colors">
                            {dataset.original_filename}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatBytes(dataset.file_size_bytes)} • {timeAgo(dataset.created_at)}
                          </p>
                        </div>
                        {dataset.is_starred && (
                          <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        )}
                        <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Starred Datasets */}
            {starredDatasets.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 text-amber-400" />
                  <h2 className="text-lg font-semibold text-white">Starred</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {starredDatasets.map((dataset) => {
                    const ext = dataset.original_filename.split(".").pop()?.toLowerCase() || "csv";
                    const colors = FORMAT_COLORS[ext] || FORMAT_COLORS.csv;
                    return (
                      <button
                        key={dataset.id}
                        onClick={() => handleDatasetClick(dataset.id)}
                        className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full hover:border-amber-500/50 hover:bg-amber-500/20 transition-all group"
                      >
                        <span className={cn("text-xs font-bold uppercase", colors.text)}>
                          {ext}
                        </span>
                        <span className="text-sm text-white truncate max-w-[120px]">
                          {dataset.original_filename.replace(/\.[^/.]+$/, "")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
