/**
 * The only place that knows which markdown renderer we use. Raw HTML in the
 * markdown stays escaped (`allowHtml` off); Claude's HTML asides go through
 * the sandboxed frame instead.
 *
 * Two entry points, deliberately: `Md` renders every surface (notes, intros,
 * question bodies, manual answers) and knows nothing about diagrams, so one
 * cannot appear in a round. `AsideMd` is the one the panel uses.
 */
import type { MarkdownComponents } from "@tanstack/markdown/react"
import type { ComponentProps } from "react"

import { parseMarkdown } from "@tanstack/markdown/parser"
import { Markdown, renderBlockReact } from "@tanstack/markdown/react"

import { Diagram } from "@/components/diagram"
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

/**
 * Markdown for the aside panel: the same renderer, except that a ```mermaid
 * block becomes a drawn diagram. Parsing here rather than overriding `pre`
 * keeps the mermaid source a string we were handed, not one dug out of a
 * rendered element.
 */
export const AsideMd = ({ text, className }: MdProps) => (
  <div className={cn("md", className)}>
    {parseMarkdown(text).children.map((node, index) => {
      const key = `b:${index}`
      if (node.type === "code" && node.lang === "mermaid") {
        return <Diagram key={key} source={node.value} />
      }
      return renderBlockReact(node, { components }, key)
    })}
  </div>
)
