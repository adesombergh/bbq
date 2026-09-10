import type { createAppRouter } from "@/router"

import { TanStackDevtools } from "@tanstack/react-devtools"
import { formDevtoolsPlugin } from "@tanstack/react-form-devtools"
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"

interface AppDevtoolsProps {
  router: ReturnType<typeof createAppRouter>
}

export const AppDevtools = ({ router }: AppDevtoolsProps) => (
  <TanStackDevtools
    plugins={[
      { name: "Query", render: <ReactQueryDevtoolsPanel /> },
      {
        name: "Router",
        render: <TanStackRouterDevtoolsPanel router={router} />,
      },
      formDevtoolsPlugin(),
    ]}
  />
)
