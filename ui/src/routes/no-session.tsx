import { Flame } from "lucide-react"

export const NoSession = () => (
  <div className="grid h-full place-items-center text-muted-foreground">
    <div className="max-w-md space-y-2 text-center">
      <Flame aria-hidden className="mx-auto size-8 text-primary" />
      <p>
        No session in the URL. Ask Claude to call <code>open_session</code>; it
        opens the right link.
      </p>
    </div>
  </div>
)
