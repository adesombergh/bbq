import { Md } from "../markdown.tsx";

export function NoteBubble({ markdown }: { markdown: string }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 size-8 rounded-full bg-accent-soft text-accent grid place-items-center text-sm">C</div>
      <div className="rounded-2xl rounded-tl-sm bg-panel border border-line px-4 py-3 max-w-[85%]">
        <Md text={markdown} />
      </div>
    </div>
  );
}
