import type { Answer } from "@shared/types"

import { useState } from "react"
import { useForm } from "@tanstack/react-form"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError } from "@/components/ui/field"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Textarea } from "@/components/ui/textarea"

interface ManualAnswerProps {
  answer: Answer | undefined
  onAnswer: (answer: Omit<Answer, "answeredAt">) => void
}

const savedText = (answer: Answer | undefined): string =>
  answer?.kind === "text" ? answer.text : ""

/**
 * Free-text answer. The parent remounts this component (via `key`) whenever
 * the stored answer changes, so the form's default values are always current
 * without any synchronisation.
 */
export const ManualAnswer = ({ answer, onAnswer }: ManualAnswerProps) => {
  const [open, setOpen] = useState(answer?.kind === "text")
  const form = useForm({
    defaultValues: { text: savedText(answer) },
    onSubmit: ({ value }) => {
      onAnswer({ kind: "text", text: value.text.trim() })
    },
  })

  if (!open) {
    return (
      <Button
        className="mt-3 px-0 text-muted-foreground"
        onClick={() => {
          setOpen(true)
        }}
        variant="link"
      >
        Enter a manual answer…
      </Button>
    )
  }

  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.Field
        name="text"
        validators={{
          onChange: ({ value }) =>
            value.trim() === "" ? "Write your answer first." : undefined,
        }}
      >
        {(field) => (
          <Field data-invalid={field.state.meta.errors.length > 0}>
            <Textarea
              aria-invalid={field.state.meta.errors.length > 0}
              aria-label="Manual answer"
              autoFocus
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => {
                field.handleChange(event.target.value)
              }}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault()
                  void form.handleSubmit()
                }
              }}
              placeholder="Write your full answer."
              rows={4}
              value={field.state.value}
            />
            <FieldDescription className="flex items-center gap-1.5">
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>↵</Kbd>
              </KbdGroup>
              saves the answer
            </FieldDescription>
            <FieldError
              errors={field.state.meta.errors.map((message) => ({
                message: String(message),
              }))}
            />
          </Field>
        )}
      </form.Field>
      <div className="flex gap-2">
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isDirty] as const}
        >
          {([canSubmit, isDirty]) => (
            <Button disabled={!canSubmit || !isDirty} size="sm" type="submit">
              {answer?.kind === "text" ? "Update answer" : "Save answer"}
            </Button>
          )}
        </form.Subscribe>
        <Button
          onClick={() => {
            setOpen(false)
          }}
          size="sm"
          variant="ghost"
        >
          Close
        </Button>
      </div>
    </form>
  )
}
