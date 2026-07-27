<script lang="ts">
  import * as Dialog from "$ui/dialog";
  import { Button } from "$ui/button";
  import { Textarea } from "$ui/textarea";
  import { Label } from "$ui/label";
  import { FileDown, ClipboardPaste, LoaderIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import Papa from "papaparse";
  import { fetchUsers } from "$api/controllers/resident-controller";
  import { addLaundryReservationsBatch } from "$api/controllers/laundry-controller";
  import { LAUNDRY_COL } from "$lib/types";

  interface Props {
    open: boolean;
    onComplete: () => void;
  }

  let { open = $bindable(), onComplete }: Props = $props();

  let csvData = $state("");
  let isImporting = $state(false);
  let progress = $state({ current: 0, total: 0 });

  async function handleImport() {
    if (!csvData.trim()) {
      toast.error("Please paste CSV data first");
      return;
    }

    isImporting = true;
    try {
      const users = await fetchUsers(true);
      const userMap = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));

      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const data = results.data as any[];
          progress.total = data.length;

          const entriesToAppend: any[] = [];
          let skipped = 0;

          for (const item of data) {
            const email = (item.EMAIL || "").trim().toLowerCase();
            const residentId = userMap.get(email);

            if (!residentId) {
              console.warn(`User not found: ${email}`);
              skipped++;
              progress.current++;
              continue;
            }

            entriesToAppend.push({
              id: crypto.randomUUID(),
              residentId,
              date: (item.DATE || "").trim(),
              timeStart: (item.TIME_START || "").trim(),
              timeEnd: (item.TIME_END || "").trim(),
              status: (item.STATUS || "ACTIVE").trim().toUpperCase(),
              cancelReason: (item.CANCEL_REASON || "").trim()
            });
            progress.current++;
          }

          if (entriesToAppend.length > 0) {
            await addLaundryReservationsBatch(entriesToAppend);
          }

          toast.success(
            `Imported ${entriesToAppend.length} records. Skipped ${skipped} due to missing users.`
          );
          isImporting = false;
          csvData = "";
          open = false;
          onComplete();
        },
        error: (err: any) => {
          toast.error(`CSV Parse Error: ${err.message}`);
          isImporting = false;
        }
      });
    } catch (e: any) {
      toast.error(e.message);
      isImporting = false;
    }
  }

  function downloadTemplate() {
    const csv =
      "EMAIL,DATE,TIME_START,TIME_END,STATUS,CANCEL_REASON\nuser@up.edu.ph,2024-05-20,08:00,10:00,ACTIVE,";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "laundry_import_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>Import Laundry Records</Dialog.Title>
      <Dialog.Description
        >Paste CSV data below to batch import laundry reservations. Emails will be automatically
        mapped to internal IDs.</Dialog.Description
      >
    </Dialog.Header>

    <div class="space-y-6 pb-4">
      <div
        class="space-y-4 rounded-2xl border border-dashed border-muted-foreground/20 bg-muted/50 p-4"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
            >CSV Format Header</span
          >
          <Button
            variant="ghost"
            size="sm"
            class="h-7 text-xs font-bold tracking-tighter uppercase"
            onclick={downloadTemplate}
            icon={FileDown}
          >
            Get Template
          </Button>
        </div>
        <div
          class="truncate rounded border bg-background p-2 font-mono text-xs text-muted-foreground"
        >
          EMAIL,DATE,TIME_START,TIME_END,STATUS,CANCEL_REASON
        </div>
      </div>

      <div class="space-y-2">
        <Label for="csv">Paste CSV Content</Label>
        <Textarea
          id="csv"
          placeholder="Paste CSV rows here (including header)..."
          class="h-48 font-mono text-xs"
          bind:value={csvData}
          disabled={isImporting}
        />
      </div>

      {#if isImporting}
        <div class="space-y-2">
          <div
            class="flex items-center justify-between text-xs font-bold tracking-tighter uppercase"
          >
            <span class="flex items-center gap-2"
              ><LoaderIcon class="h-3 w-3 animate-spin" /> Processing...</span
            >
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div class="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              class="h-full bg-primary transition-all duration-300"
              style="width: {(progress.current / progress.total) * 100}%"
            ></div>
          </div>
        </div>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (open = false)} isLoading={isImporting}
        >Cancel</Button
      >
      <Button onclick={handleImport} isLoading={isImporting} icon={ClipboardPaste}>
        Import Data
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
