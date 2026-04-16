<script lang="ts">
  import { emailDispatcher } from "$lib/dispatcher.svelte";
  import { auth } from "$lib/auth.svelte";
  import { createEmail, sendEmail } from "$lib/gmail";
  import { goto } from "$app/navigation";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Progress } from "$lib/components/ui/progress";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import RichEditor from "$lib/components/RichEditor.svelte";
  import { formatCurrency, formatAmount } from "$lib/receipt-utils";
  import {
    Play,
    LoaderCircle,
    CircleCheckBig,
    CircleAlert,
    ChevronLeft,
    ChevronRight,
    Eye,
    Mail,
    Trash2,
    Info,
    Settings2,
    Calculator,
    Users
  } from "lucide-svelte";

  let isSending = $state(false);
  let isSuccess = $state(false);
  let error = $state<string | null>(null);
  let progress = $state(0);
  let previewIndex = $state(0);

  const currentEmail = $derived(emailDispatcher.queue[previewIndex]);

  const emailPreview = $derived.by(() => {
    if (!currentEmail) return { subject: "", body: "" };

    // Inject custom reminders if the data supports it
    const data = { ...currentEmail.data };
    if ("reminders" in data) {
      data.reminders = emailDispatcher.customReminders;
    }

    return {
      subject: currentEmail.template.subject(data, currentEmail.branding),
      body: currentEmail.template.generateHtml(data, currentEmail.branding)
    };
  });

  const batchSummary = $derived.by(() => {
    const totals: Record<string, number> = {};
    let grandTotal = 0;

    emailDispatcher.queue.forEach((item) => {
      const items = (item.data as any).items || [];
      items.forEach((f: { name: string; amount: number }) => {
        totals[f.name] = (totals[f.name] || 0) + f.amount;
        grandTotal += f.amount;
      });
    });

    return {
      items: Object.entries(totals).map(([name, amount]) => ({ name, amount })),
      total: grandTotal
    };
  });

  async function runBatch() {
    if (!auth.accessToken) {
      error = "Authentication required. Please refresh or sign in again.";
      return;
    }

    isSending = true;
    isSuccess = false;
    error = null;
    progress = 0;

    const total = emailDispatcher.queue.length;

    for (let i = 0; i < total; i++) {
      const item = emailDispatcher.queue[i];
      try {
        const data = { ...item.data };
        if ("reminders" in data) {
          data.reminders = emailDispatcher.customReminders;
        }

        const body = item.template.generateHtml(data, item.branding);
        const subject = item.template.subject(data, item.branding);
        const raw = createEmail(item.to, subject, body, item.branding.replyTo);

        await sendEmail(auth.accessToken, raw);

        // Execute post-send logic if any (e.g. updating sheets)
        if (item.onSuccess) {
          await item.onSuccess();
        }

        progress = Math.round(((i + 1) / total) * 100);
        // Throttle to avoid rate limits
        await new Promise((r) => setTimeout(r, 200));
      } catch (e: any) {
        error = `Failed at ${item.to}: ${e.message}`;
        isSending = false;
        return;
      }
    }

    isSuccess = true;
    isSending = false;
  }

  function handleBack() {
    if (isSending) return;
    emailDispatcher.clear();
    window.history.back();
  }
</script>

<div class="space-y-4">
  <SubpageHeader title="Email Dispatcher" onBack={handleBack}>
    {#snippet actions()}
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onclick={() => emailDispatcher.clear()}
          disabled={isSending || isSuccess}
        >
          <Trash2 class="mr-2 h-4 w-4" /> Clear Queue
        </Button>
        <Button
          onclick={runBatch}
          disabled={isSending || isSuccess || emailDispatcher.queue.length === 0}
          size="sm"
          class="min-w-[120px]"
        >
          {#if isSending}
            <LoaderCircle class="mr-2 h-4 w-4 animate-spin" /> Sending...
          {:else if isSuccess}
            <CircleCheckBig class="mr-2 h-4 w-4" /> Sent
          {:else}
            <Play class="mr-2 h-4 w-4" /> Run Batch
          {/if}
        </Button>
      </div>
    {/snippet}
  </SubpageHeader>

  {#if emailDispatcher.queue.length === 0 && !isSuccess}
    <div
      class="flex h-80 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed bg-muted/10"
    >
      <Mail class="h-8 w-8 text-muted-foreground" />
      <div class="text-center">
        <p class="font-semibold text-foreground">Queue is empty.</p>
        <p class="text-xs text-muted-foreground">
          Select records from Resident Directory or Pending Receipts to begin.
        </p>
      </div>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Info Panel -->
      <div class="space-y-6 lg:col-span-1">
        <Card.Root>
          <Card.Header class="pb-2">
            <Card.Title class="flex items-center gap-2 text-lg">
              <Info class="h-5 w-5 text-primary" /> Batch Information
            </Card.Title>
          </Card.Header>
          <Card.Content class="space-y-4">
            <div class="rounded-lg border bg-muted/20 p-4">
              <p class="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
                Emails in Queue
              </p>
              <p class="text-2xl font-bold text-foreground">{emailDispatcher.queue.length}</p>
            </div>

            {#if isSending || isSuccess}
              <div class="space-y-2">
                <div class="flex items-center justify-between text-xs font-medium">
                  <span>Dispatch Progress</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            {/if}

            {#if error}
              <div
                class="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-xs font-medium text-destructive"
              >
                <CircleAlert class="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            {/if}

            {#if isSuccess}
              <div
                class="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-xs font-bold text-green-700"
              >
                <CircleCheckBig class="h-4 w-4" />
                <span>All emails dispatched successfully.</span>
              </div>
            {/if}
          </Card.Content>
        </Card.Root>

        {#if emailDispatcher.batchType === "REMINDER"}
          <Card.Root>
            <Card.Header class="pb-2">
              <Card.Title class="flex items-center gap-2 text-lg">
                <Settings2 class="h-5 w-5 text-primary" /> Blast Customization
              </Card.Title>
            </Card.Header>
            <Card.Content>
              <RichEditor bind:content={emailDispatcher.customReminders} />
              <p class="mt-2 text-[10px] text-muted-foreground italic">
                Globally applied to this batch.
              </p>
            </Card.Content>
          </Card.Root>
        {/if}

        {#if emailDispatcher.batchType === "ACKNOWLEDGMENT" && batchSummary.items.length > 0}
          <Card.Root>
            <Card.Header class="pb-2">
              <Card.Title class="flex items-center gap-2 text-lg">
                <Calculator class="h-5 w-5 text-primary" /> Batch Fee Breakdown
              </Card.Title>
            </Card.Header>
            <Card.Content class="space-y-4">
              <div
                class="divide-y divide-border overflow-hidden rounded-xl border border-border bg-muted/20"
              >
                {#each batchSummary.items as fee}
                  <div class="flex items-center justify-between px-4 py-3">
                    <span class="text-xs font-semibold text-muted-foreground">{fee.name}</span>
                    <span class="font-mono text-xs font-semibold text-foreground"
                      >{formatAmount(fee.amount)}</span
                    >
                  </div>
                {/each}
              </div>

              <div class="rounded-xl border border-border bg-muted/30 p-4">
                <p class="text-[9px] font-medium tracking-widest text-muted-foreground uppercase">
                  Total Batch Confirmation
                </p>
                <p class="text-2xl font-bold text-foreground tabular-nums">
                  {formatCurrency(batchSummary.total)}
                </p>
              </div>
            </Card.Content>
          </Card.Root>
        {/if}

        <Card.Root>
          <Card.Header class="pb-2">
            <Card.Title class="flex items-center gap-2 text-lg">
              <Users class="h-5 w-5 text-primary" /> Recipients
            </Card.Title>
          </Card.Header>
          <Card.Content class="p-0">
            <div class="max-h-[400px] divide-y overflow-auto">
              {#each emailDispatcher.queue as item, i}
                <button
                  class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 {previewIndex ===
                  i
                    ? 'border-l-4 border-primary bg-muted'
                    : ''}"
                  onclick={() => (previewIndex = i)}
                  disabled={isSending || isSuccess}
                >
                  <div class="flex min-w-0 flex-col">
                    <span class="truncate text-xs font-bold">{item.recipientName}</span>
                    <span class="truncate text-[10px] text-muted-foreground">{item.to}</span>
                  </div>
                </button>
              {/each}
            </div>
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Preview Panel -->
      <div class="lg:col-span-2">
        <Card.Root>
          <Card.Header class="flex flex-row items-center justify-between">
            <Card.Title class="flex items-center gap-2 text-lg">
              <Eye class="h-5 w-5" /> Email Preview
            </Card.Title>
            <div class="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                class="h-7 w-7"
                disabled={previewIndex === 0 || isSending || isSuccess}
                onclick={() => previewIndex--}
              >
                <ChevronLeft class="h-4 w-4" />
              </Button>
              <span class="text-[10px] font-bold tabular-nums"
                >{previewIndex + 1} / {emailDispatcher.queue.length}</span
              >
              <Button
                variant="outline"
                size="icon"
                class="h-7 w-7"
                disabled={previewIndex === emailDispatcher.queue.length - 1 ||
                  isSending ||
                  isSuccess}
                onclick={() => previewIndex++}
              >
                <ChevronRight class="h-4 w-4" />
              </Button>
            </div>
          </Card.Header>
          <Card.Content>
            {#if currentEmail}
              <div class="mb-4 space-y-2 rounded-md border bg-muted/20 p-3">
                <div class="flex justify-between">
                  <span class="text-xs font-bold tracking-tighter text-muted-foreground uppercase"
                    >Recipient</span
                  >
                  <span class="text-xs font-bold text-foreground">{currentEmail.to}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-xs font-bold tracking-tighter text-muted-foreground uppercase"
                    >Subject</span
                  >
                  <span class="text-xs font-semibold text-foreground">{emailPreview.subject}</span>
                </div>
              </div>

              <div
                class="max-h-[600px] overflow-auto rounded-lg border bg-background text-foreground shadow-inner"
              >
                {@html emailPreview.body}
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </div>
    </div>
  {/if}
</div>
