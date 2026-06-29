<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Label } from "$lib/components/ui/label";
  import { Button } from "$lib/components/ui/button";
  import { ShieldCheck, ClipboardCheck, Calendar, Hash, ArrowUpRight } from "@lucide/svelte";
  import type { ResidentRecord } from "$lib/schemas";

  interface Props {
    account: ResidentRecord;
    class?: string;
  }

  let { account, class: className }: Props = $props();
</script>

<Card.Root class="flex h-full flex-col {className}">
  <Card.Header>
    <Card.Title class="flex items-center gap-2 text-lg {account.ceIssued ? 'text-primary' : ''}">
      <ShieldCheck class="h-5 w-5" />
      Clearance
    </Card.Title>
  </Card.Header>
  <Card.Content class="flex-1 space-y-4">
    {#if account.ceIssued}
      <div class="space-y-3">
        <div class="flex flex-col gap-1">
          <Label
            class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
          >
            <ClipboardCheck class="h-3 w-3" /> Verification Status
          </Label>
          <Badge
            class="w-fit border-transparent bg-primary px-3 py-1 text-xs font-black text-primary-foreground"
            >VERIFIED</Badge
          >
        </div>
        <div class="flex flex-col gap-1 pt-2">
          <Label
            class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
          >
            <Calendar class="h-3 w-3" /> Issued Date
          </Label>
          <span class="text-sm font-bold text-foreground">{account.ceIssued}</span>
        </div>
        <div class="flex flex-col gap-1 pt-2">
          <Label
            class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
          >
            <Hash class="h-3 w-3" /> Reference Number
          </Label>
          <span class="font-mono text-sm font-black text-foreground">{account.ceRefNo || "—"}</span>
        </div>
      </div>
    {:else}
      <div class="space-y-4">
        <div class="flex flex-col gap-1">
          <Label
            class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
          >
            <ClipboardCheck class="h-3 w-3" /> Verification Status
          </Label>
          <Badge
            class="w-fit border-transparent bg-destructive px-3 py-1 text-xs font-black text-white"
            >NOT CLEARED</Badge
          >
        </div>
      </div>
    {/if}
  </Card.Content>
  {#if account.ceIssued && account.ceLink && account.ceLink !== "N/A" && account.ceLink !== ""}
    <Card.Footer>
      <Button
        variant="secondary"
        size="sm"
        class="h-10 w-full"
        href={account.ceLink}
        target="_blank"
      >
        View Certificate <ArrowUpRight class="ml-2 h-4 w-4" />
      </Button>
    </Card.Footer>
  {/if}
</Card.Root>
