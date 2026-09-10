import type { QueryClient } from "@tanstack/react-query"

import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router"

import { z } from "zod"

import { sessionSearchSchema } from "@/lib/search"
import { sessionQueryOptions } from "@/lib/session-query"
import { connectSession } from "@/lib/session-socket"
import { NoSession } from "@/routes/no-session"
import { SessionPage } from "@/routes/session-page"
import { Connecting, SessionError } from "@/routes/status-screens"

interface RouterContext {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
})

const indexRoute = createRoute({
  beforeLoad: ({ search }) => {
    if (search.session !== undefined) {
      redirect({
        params: { sessionId: search.session },
        throw: true,
        to: "/s/$sessionId",
      })
    }
  },
  component: NoSession,
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: z.object({ session: z.string().optional() }),
})

export const sessionRoute = createRoute({
  component: SessionPage,
  errorComponent: SessionError,
  getParentRoute: () => rootRoute,
  loader: async ({ context, params }) => {
    // Opening the socket here (not in an effect) means the first state frame
    // can arrive while the HTTP snapshot is still loading.
    connectSession(context.queryClient, params.sessionId)
    await context.queryClient.query(sessionQueryOptions(params.sessionId))
  },
  path: "/s/$sessionId",
  pendingComponent: Connecting,
  validateSearch: sessionSearchSchema,
})

export const routeTree = rootRoute.addChildren([indexRoute, sessionRoute])

export const createAppRouter = (queryClient: QueryClient) =>
  createRouter({
    context: { queryClient },
    defaultPreload: false,
    routeTree,
    scrollRestoration: false,
  })

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
