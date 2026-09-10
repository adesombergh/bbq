import { ASIDE_KINDS } from "@shared/types"
import { z } from "zod"

/**
 * Everything the UI needs to restore a view lives in the URL:
 * - q: the active (expanded) question; defaults to the first unanswered one
 * - pick: the option pointed at on the active question and not yet confirmed
 *   (an option id, or "recommended"); see
 *   docs/adr/0017-answering-takes-two-presses.md
 * - panel: the question whose asides are open in the side panel
 * - tab: which aside kind the panel shows; defaults to the newest
 * - dismissed: the newest aside id when the user closed the panel, so a
 *   closed panel does not reopen for an aside they already saw
 */
export const sessionSearchSchema = z.object({
  dismissed: z.string().optional(),
  panel: z.string().optional(),
  pick: z.string().optional(),
  q: z.string().optional(),
  tab: z.enum(ASIDE_KINDS).optional(),
})

export type SessionSearch = z.infer<typeof sessionSearchSchema>
