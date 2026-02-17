"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-8">
          <AlertTriangle className="h-12 w-12 text-rose-500" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Something went wrong</h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <Button
            onClick={() => this.setState({ hasError: false, error: null })}
            variant="outline"
            className="mt-6"
          >
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
