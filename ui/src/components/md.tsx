/**
 * The only place that knows which markdown renderer we use. Raw HTML in the
 * markdown stays escaped (`allowHtml` off); Claude's HTML asides go through
 * the sandboxed frame instead.
 */
import type { MarkdownComponents } from "@tanstack/markdown/react"
import type { ComponentProps } from "react"

import { Markdown } from "@tanstack/markdown/react"

import { cn } from "@/lib/utils"

const ExternalLink = (props: ComponentProps<"a">) => (
  <a {...props} rel="noopener noreferrer" target="_blank">
    {props.children}
  </a>
)

const components: MarkdownComponents = { a: ExternalLink }

interface MdProps {
  text: string
  className?: string
}

export const Md = ({ text, className }: MdProps) => (
  <div className={cn("md", className)}>
    <Markdown components={components}>{text}</Markdown>
  </div>
)
