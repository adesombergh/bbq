---
status: accepted
---

# UI primitives are shadcn components generated on Base UI, not Radix

shadcn's default primitives library is Radix. We generate on `@base-ui/react` instead, because a sibling internal repo builds its component library on Base UI and agents move between the two repos; one primitives vocabulary (render props, `data-*` state attributes, Base UI's Tabs/Tooltip/ScrollArea) avoids two ways of doing the same thing. The generated components are copied into `ui/src/components/ui` and edited to the house rules, so the choice is ours to own; swapping the primitives layer later would mean regenerating every component.
