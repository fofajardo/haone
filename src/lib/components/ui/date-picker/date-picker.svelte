<script lang="ts">
  import * as Calendar from "$lib/components/ui/calendar/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { ChevronDown, Calendar as CalendarIcon } from "@lucide/svelte";
  import { getLocalTimeZone, CalendarDate, parseDate } from "@internationalized/date";
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    value: string;
  }

  let { value = $bindable(), class: className, ...rest }: Props = $props();

  let open = $state(false);

  let calendarValue = $state<CalendarDate | undefined>(value ? parseDate(value) : undefined);

  $effect(() => {
    if (calendarValue) {
      value = calendarValue.toString();
    }
  });

  $effect(() => {
    if (value && (!calendarValue || calendarValue.toString() !== value)) {
      try {
        calendarValue = parseDate(value);
      } catch (e) {}
    }
  });

  const id = Math.random().toString(36).substring(2, 9);
</script>

<div class={cn("flex flex-col gap-3", className)} {...rest}>
  <Popover.Root bind:open>
    <Popover.Trigger id="{id}-date">
      {#snippet child({ props })}
        <Button
          {...props}
          variant="outline"
          class={cn(
            "h-9 w-full justify-start gap-2 rounded-md border-muted-foreground/20 px-3 font-medium",
            !calendarValue && "text-muted-foreground"
          )}
        >
          <CalendarIcon class="h-4 w-4 text-muted-foreground" />
          {calendarValue
            ? calendarValue.toDate(getLocalTimeZone()).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric"
              })
            : "Select date"}
          <ChevronDown class="ml-auto h-4 w-4 opacity-50" />
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content class="w-auto overflow-hidden p-0" align="start">
      <Calendar.Calendar
        type="single"
        bind:value={calendarValue}
        onValueChange={() => {
          open = false;
        }}
        captionLayout="dropdown"
      />
    </Popover.Content>
  </Popover.Root>
</div>
