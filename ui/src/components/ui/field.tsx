import type { VariantProps } from "class-variance-authority"
import type { ComponentProps, ReactNode } from "react"

import { cva } from "class-variance-authority"

import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const FieldSet = ({ className, ...props }: ComponentProps<"fieldset">) => (
  <fieldset
    className={cn(
      "flex flex-col gap-4 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
      className
    )}
    data-slot="field-set"
    {...props}
  />
)

const FieldLegend = ({
  className,
  variant = "legend",
  ...props
}: ComponentProps<"legend"> & { variant?: "legend" | "label" }) => (
  <legend
    className={cn(
      "mb-1.5 font-medium data-[variant=label]:text-sm data-[variant=legend]:text-base",
      className
    )}
    data-slot="field-legend"
    data-variant={variant}
    {...props}
  />
)

const FieldGroup = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    className={cn(
      "group/field-group @container/field-group flex w-full flex-col gap-5 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4",
      className
    )}
    data-slot="field-group"
    {...props}
  />
)

const fieldVariants = cva(
  "group/field flex w-full gap-2 data-[invalid=true]:text-destructive",
  {
    defaultVariants: {
      orientation: "vertical",
    },
    variants: {
      orientation: {
        horizontal:
          "flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        responsive:
          "flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        vertical: "flex-col *:w-full [&>.sr-only]:w-auto",
      },
    },
  }
)

const Field = ({
  className,
  orientation = "vertical",
  ...props
}: ComponentProps<"div"> & VariantProps<typeof fieldVariants>) => (
  <div
    className={cn(fieldVariants({ orientation }), className)}
    data-orientation={orientation}
    data-slot="field"
    {...props}
  />
)

const FieldContent = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    className={cn(
      "group/field-content flex flex-1 flex-col gap-0.5 leading-snug",
      className
    )}
    data-slot="field-content"
    {...props}
  />
)

const FieldLabel = ({ className, ...props }: ComponentProps<typeof Label>) => (
  <Label
    className={cn(
      "group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50 has-data-checked:border-primary/30 has-data-checked:bg-primary/5 has-[>[data-slot=field]]:rounded-lg has-[>[data-slot=field]]:border has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted/50 has-[>[data-slot=field]]:has-[:focus-visible]:border-ring has-[>[data-slot=field]]:has-[:focus-visible]:ring-3 has-[>[data-slot=field]]:has-[:focus-visible]:ring-ring/50 *:data-[slot=field]:p-2.5 dark:has-data-checked:border-primary/20 dark:has-data-checked:bg-primary/10",
      "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
      className
    )}
    data-slot="field-label"
    {...props}
  />
)

const FieldTitle = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    className={cn(
      "flex w-fit items-center gap-2 text-sm font-medium group-data-[disabled=true]/field:opacity-50",
      className
    )}
    data-slot="field-label"
    {...props}
  />
)

const FieldDescription = ({ className, ...props }: ComponentProps<"p">) => (
  <p
    className={cn(
      "text-left text-sm leading-normal font-normal text-muted-foreground group-has-data-horizontal/field:text-balance [[data-variant=legend]+&]:-mt-1.5",
      "last:mt-0 nth-last-2:-mt-1",
      "[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
      className
    )}
    data-slot="field-description"
    {...props}
  />
)

const FieldSeparator = ({
  children,
  className,
  ...props
}: ComponentProps<"div"> & { children?: ReactNode }) => (
  <div
    className={cn(
      "relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2",
      className
    )}
    data-content={children !== undefined && children !== null}
    data-slot="field-separator"
    {...props}
  >
    <Separator className="absolute inset-0 top-1/2" />
    {children === undefined || children === null ? null : (
      <span
        className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground"
        data-slot="field-separator-content"
      >
        {children}
      </span>
    )}
  </div>
)

interface FieldErrorProps extends ComponentProps<"div"> {
  errors?: ({ message?: string } | undefined)[]
}

const uniqueMessages = (errors: FieldErrorProps["errors"]): string[] => {
  const messages = new Set<string>()
  for (const error of errors ?? []) {
    if (error?.message !== undefined && error.message !== "") {
      messages.add(error.message)
    }
  }
  return [...messages]
}

const FieldError = ({
  className,
  children,
  errors,
  ...props
}: FieldErrorProps) => {
  const messages = uniqueMessages(errors)
  const hasChildren = children !== undefined && children !== null
  if (!hasChildren && messages.length === 0) {
    return null
  }
  let content: ReactNode = children
  if (!hasChildren) {
    content =
      messages.length === 1 ? (
        messages[0]
      ) : (
        <ul className="ml-4 flex list-disc flex-col gap-1">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )
  }
  return (
    <div
      className={cn("text-sm font-normal text-destructive", className)}
      data-slot="field-error"
      role="alert"
      {...props}
    >
      {content}
    </div>
  )
}

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
}
