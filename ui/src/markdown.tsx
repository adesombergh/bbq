import { marked } from "marked";
import { useMemo } from "react";

marked.setOptions({ gfm: true, breaks: true });

export function Md({ text, className = "" }: { text: string; className?: string }) {
  const html = useMemo(() => marked.parse(text ?? "", { async: false }) as string, [text]);
  return <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
