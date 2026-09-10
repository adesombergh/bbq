import type { ErrorComponentProps } from "@tanstack/react-router"

import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"

export const Connecting = () => (
  <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
    <Skeleton className="h-6 w-1/2" />
    <Skeleton className="h-40 w-full" />
    <Skeleton className="h-40 w-full" />
  </div>
)

export const SessionError = ({ error }: ErrorComponentProps) => (
  <div className="grid h-full place-items-center p-6">
    <Alert className="max-w-md" variant="destructive">
      <AlertTriangle />
      <AlertTitle>Hub unreachable</AlertTitle>
      <AlertDescription>
        {error instanceof Error ? error.message : String(error)}. Is the MCP
        server still running?
      </AlertDescription>
    </Alert>
  </div>
)
