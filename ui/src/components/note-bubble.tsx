import { Md } from "@/components/md"

export const NoteBubble = ({ markdown }: { markdown: string }) => (
  <div className="flex gap-3">
    <div
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary"
    >
      C
    </div>
    <div className="max-w-[85%] rounded-2xl rounded-tl-sm border bg-secondary px-4 py-3">
      <Md text={markdown} />
    </div>
  </div>
)
