import "./styles.css"

import { lazy, StrictMode, Suspense } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"

import { TooltipProvider } from "@/components/ui/tooltip"
import { createAppRouter } from "@/router"

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2 } },
})
const router = createAppRouter(queryClient)

/** Dev only: the whole devtools bundle stays out of the production build. */
const Devtools = import.meta.env.DEV
  ? lazy(async () => {
      const { AppDevtools } = await import("@/devtools")
      return { default: AppDevtools }
    })
  : () => null

const root = document.querySelector("#root")
if (!root) {
  throw new Error("Missing #root element")
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
      <Suspense fallback={null}>
        <Devtools router={router} />
      </Suspense>
    </QueryClientProvider>
  </StrictMode>
)
