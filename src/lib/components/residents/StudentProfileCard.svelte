<script lang="ts">
  import * as Card from "$ui/card";
  import { Label } from "$ui/label";
  import {
    Mail,
    Send,
    IdCard,
    Clock,
    GraduationCap,
    AwardIcon,
    MapPin,
    Bed as BedIcon,
    Calendar
  } from "@lucide/svelte";
  import { translateCollege, translateProgram } from "$utils/translators";
  import type { ResidentRecord } from "$lib/types";

  interface Props {
    account: ResidentRecord;
    semesterCount?: number;
    class?: string;
  }

  let { account, semesterCount, class: className }: Props = $props();

  const qualifications = $derived(
    account
      ? translateCollege(account.college).map((col, i) => {
          const programs = translateProgram(account.program);
          return {
            college: col,
            program: programs[i] || "—"
          };
        })
      : []
  );
</script>

<Card.Root class="flex h-full flex-col {className}">
  <Card.Header>
    <Card.Title class="flex items-center gap-2 text-lg">
      <IdCard class="h-5 w-5" />
      Student Profile
    </Card.Title>
  </Card.Header>
  <Card.Content class="flex-1 space-y-4">
    <div class="space-y-1">
      <Label
        class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
        ><Mail class="h-3 w-3" /> Email Address</Label
      >
      <div class="flex items-center gap-2">
        <p class="text-sm font-semibold text-foreground">{account.email}</p>
        <a
          href="mailto:{account.email}"
          class="text-muted-foreground transition-colors hover:text-primary"
          title="Send Email"
        >
          <Send class="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
    <div class="space-y-1">
      <Label
        class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
        ><IdCard class="h-3 w-3" /> Student Number</Label
      >
      <p class="text-sm font-semibold">{account.stno}</p>
    </div>

    {#if semesterCount !== undefined}
      <div class="space-y-1">
        <Label
          class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
          ><Clock class="h-3 w-3" /> Terms Active</Label
        >
        <div class="text-sm font-semibold">
          {semesterCount}
          {semesterCount === 1 ? "Term" : "Terms"}
        </div>
      </div>
    {/if}

    <div class="space-y-4">
      <Label
        class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
      >
        <GraduationCap class="h-3 w-3" /> Academic Program
      </Label>
      <div
        class="relative mt-2 space-y-6 before:absolute before:top-2 before:left-[11px] before:h-[calc(100%-16px)] before:w-px before:bg-border"
      >
        {#each qualifications as q}
          <div class="relative flex items-start gap-4 pl-8">
            <div
              class="absolute left-0 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border-4 border-background bg-muted shadow-sm ring-1 ring-border"
            >
              <AwardIcon class="h-2.5 w-2.5 text-muted-foreground" />
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="text-xs font-bold tracking-widest text-primary uppercase opacity-80"
                >{q.college}</span
              >
              <p class="text-sm leading-tight font-bold text-foreground">
                {q.program}
              </p>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
      <div class="space-y-1">
        <Label
          class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
          ><MapPin class="h-3 w-3" /> Room</Label
        >
        <div class="text-sm font-semibold">{account.room}</div>
      </div>
      <div class="space-y-1">
        <Label
          class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
          ><BedIcon class="h-3 w-3" /> Bed</Label
        >
        <p class="text-sm font-semibold">{account.bed}</p>
      </div>
      {#if account.checkInDate}
        <div class="space-y-1 sm:col-span-2">
          <Label
            class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
            ><Calendar class="h-3 w-3" /> Check-in Date</Label
          >
          <p class="text-sm font-semibold">{account.checkInDate}</p>
        </div>
      {/if}
    </div>
  </Card.Content>
</Card.Root>
