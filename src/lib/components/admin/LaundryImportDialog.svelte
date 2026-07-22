<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Label } from "$lib/components/ui/label";
  import { FileDown, ClipboardPaste, LoaderIcon } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import Papa from "papaparse";
  import { fetchUsers } from "$lib/logic/resident-logic";
  import { uiSettings } from "$lib/state/settings.svelte";
  import { appendSheetRow } from "$lib/services/google-sheets-service";
  import { LAUNDRY_COL } from "$lib/schemas";

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

          const rowsToAppend: string[][] = [];
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

            const row = new Array(7).fill("");
            row[LAUNDRY_COL.ID] = crypto.randomUUID();
            row[LAUNDRY_COL.RESIDENT_ID] = residentId;
            row[LAUNDRY_COL.DATE] = (item.DATE || "").trim();
            row[LAUNDRY_COL.TIME_START] = (item.TIME_START || "").trim();
            row[LAUNDRY_COL.TIME_END] = (item.TIME_END || "").trim();
            row[LAUNDRY_COL.STATUS] = (item.STATUS || "ACTIVE").trim().toUpperCase();
            row[LAUNDRY_COL.CANCEL_REASON] = (item.CANCEL_REASON || "").trim();

            rowsToAppend.push(row);
            progress.current++;
          }

          if (rowsToAppend.length > 0) {
            const spreadsheetId = uiSettings.sharedRecordsId;
            if (!spreadsheetId) throw new Error("Shared Records ID not configured");

            // Batch append in chunks of 50 to avoid request size limits if many
            const chunkSize = 50;
            for (let i = 0; i < rowsToAppend.length; i += chunkSize) {
              const chunk = rowsToAppend.slice(i, i + chunkSize);
              await appendSheetRow(spreadsheetId, "laundry!A:G", chunk);
            }
          }

          toast.success(
            `Imported ${rowsToAppend.length} records. Skipped ${skipped} due to missing users.`
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
