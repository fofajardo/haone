<script lang="ts">
  import * as Card from "$ui/card";
  import { Badge } from "$ui/badge";
  import { Label } from "$ui/label";
  import { Button } from "$ui/button";
  import { ShieldCheck, ClipboardCheck, Calendar, Hash, ArrowUpRight } from "@lucide/svelte";
  import type { ResidentRecord } from "$lib/types";

  interface Props {
    account: ResidentRecord;
    class?: string;
    onClear?: () => void;
  }

  let { account, class: className, onClear }: Props = $props();

  const canClear = $derived(
    (!account.ceIssued || account.ceIssued === "" || account.ceIssued === "#N/A") &&
      account.bal <= 0 &&
      account.totalBase > 0
  );
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
  {#if (account.ceIssued && account.ceLink && account.ceLink !== "N/A" && account.ceLink !== "") || (canClear && onClear)}
    <Card.Footer class="flex flex-col gap-2">
      {#if canClear && onClear}
        <Button variant="secondary" size="sm" class="w-full" onclick={onClear} icon={ShieldCheck}>
          Mark as Cleared
        </Button>
      {/if}
      {#if account.ceIssued && account.ceLink && account.ceLink !== "N/A" && account.ceLink !== ""}
        <Button
          variant="secondary"
          size="sm"
          class="w-full"
          href={account.ceLink}
          target="_blank"
          icon={ArrowUpRight}
        >
          View Certificate
        </Button>
        {#if account.ceLink.includes("drive.google.com")}
          <p class="mt-2 text-center text-xs">
            The certificate is hosted on Google Drive. The password is either your student number or
            your full UP email address.
          </p>
        {/if}
      {/if}
    </Card.Footer>
  {/if}
</Card.Root>
