"use client"

import * as React from "react"
import { format, isValid, parse } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface DatePickerProps {
  /** ISO date string yyyy-MM-dd, or empty */
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  id?: string
  disabled?: boolean
  "aria-label"?: string
}

export function DatePicker({
  value,
  onChange,
  className,
  placeholder = "dd/mm/aaaa",
  id,
  disabled,
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined
  const hasDate = selected && isValid(selected)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "h-7 min-w-[7.5rem] justify-start px-2 text-left text-xs font-normal",
            !hasDate && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-60" />
          {hasDate ? format(selected, "dd/MM/yyyy", { locale: es }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={hasDate ? selected : undefined}
          onSelect={(day) => {
            if (day) {
              onChange(format(day, "yyyy-MM-dd"))
              setOpen(false)
            }
          }}
          locale={es}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
