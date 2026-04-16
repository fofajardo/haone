<script lang="ts">
  import { encryptJSON } from "$lib/crypto";
  import { translatePeriod, parseCSVAmount } from "$lib/receipt-utils";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Label } from "$lib/components/ui/label";
  import * as Table from "$lib/components/ui/table";
  import { Upload, FileJson, CheckCircle2 } from "lucide-svelte";
  import Papa from "papaparse";
  import { brandingState } from "$lib/branding.svelte";
  import type { ReceiptData, ReceiptItem } from "$lib/types";

  let csvData = $state<any[]>([]);
  let headers = $state<string[]>([]);
  let isProcessing = $state(false);
  let status = $state("");

  async function handleFileUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const text = await file.text();

    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        headers = results.meta.fields || [];
        csvData = results.data;
        status = `Imported ${csvData.length} records.`;
      },
      error: (err: any) => {
        status = `Error parsing CSV: ${err.message}`;
      }
    });
  }

  async function generateAndExport() {
    if (csvData.length === 0) {
      alert("Please import a CSV first!");
      return;
    }
    isProcessing = true;
    status = "Generating receipts...";

    const baseUrl = window.location.origin + "/legacy/receipt";
    const exportedData = [];

    for (const row of csvData) {
      const prRefNo = row.PR_REFNO || crypto.randomUUID();

      const receipt: ReceiptData = {
        dateIssued: row.PR_DATE_ISSUED || new Date().toISOString().split("T")[0],
        paymentDate: row.DATE,
        processor: row.MOP,
        referenceNumber: row.MOP_REFNO || "N/A",
        period: row.PERIOD,
        seriesNumber: prRefNo,
        receivedFrom: row.ACCOUNT_FULL_NAME,
        receivedBy: row.CREATOR_FULL_NAME,
        notes: row.NOTES,
        transactionType: row.TYPE,
        branding: brandingState.selectedKey,
        items: [
          { name: "Water Fee", amount: parseCSVAmount(row.WATER_FEE) },
          { name: "Association Fee", amount: parseCSVAmount(row.ASSOC_FEE) },
          { name: "Miscellaneous", amount: parseCSVAmount(row.MISC) }
        ].filter((item: ReceiptItem) => item.amount !== 0)
      };

      const stNo = row.ACCOUNT_STNO ? row.ACCOUNT_STNO.toString().trim() : "N/A";
      const encrypted = await encryptJSON(receipt, stNo);
      const url = `${baseUrl}?data=${encrypted}`;

      exportedData.push({
        ...row,
        PR_REFNO: prRefNo,
        RECEIPT_URL: url
      });
    }

    const exportHeaders = [...headers, "RECEIPT_URL"];
    if (!headers.includes("PR_REFNO")) exportHeaders.push("PR_REFNO");

    const csvContent = [
      exportHeaders.join(","),
      ...exportedData.map((row) => exportHeaders.map((h) => `"${row[h] || ""}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipts_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();

    isProcessing = false;
    status = "Export complete!";
  }
</script>

<div class="space-y-8">
  <header>
    <h1 class="text-3xl font-bold tracking-tight">Receipt Manager</h1>
    <p class="text-muted-foreground">
      Process payment exports and generate encrypted receipt links.
    </p>
  </header>

  <Card.Root>
    <Card.Header>
      <Card.Title class="text-lg text-primary/80">Batch Import</Card.Title>
      <Card.Description>Select a payment CSV to process receipts.</Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      <div class="group relative">
        <input
          type="file"
          accept=".csv"
          onchange={handleFileUpload}
          class="absolute inset-0 z-10 cursor-pointer opacity-0"
        />
        <div
          class="rounded-lg border-2 border-dashed p-10 text-center transition-all group-hover:bg-muted/50"
        >
          <Upload class="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p class="text-sm font-medium">Click to select CSV</p>
          <p class="mt-1 text-xs text-muted-foreground italic">
            Processing is done 100% in-browser.
          </p>
        </div>
      </div>
    </Card.Content>
  </Card.Root>

  {#if csvData.length > 0}
    <Card.Root class="overflow-hidden shadow-md">
      <Card.Header class="flex flex-row items-center justify-between bg-muted/20">
        <div>
          <Card.Title class="text-base">Importer Preview</Card.Title>
          <Card.Description class="text-xs">{csvData.length} records found.</Card.Description>
        </div>
        <Button onclick={generateAndExport} disabled={isProcessing} size="sm">
          {#if isProcessing}
            Processing
          {:else}
            <FileJson class="mr-2 h-3.5 w-3.5" />
            Sign & Export
          {/if}
        </Button>
      </Card.Header>
      <Card.Content class="p-0">
        <Table.Root>
          <Table.Header>
            <Table.Row class="bg-muted/20">
              <Table.Head>Account</Table.Head>
              <Table.Head>Period</Table.Head>
              <Table.Head class="text-right">Water</Table.Head>
              <Table.Head class="text-right">Assoc</Table.Head>
              <Table.Head class="text-right">Misc</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each csvData.slice(0, 10) as row}
              <Table.Row class="transition-colors hover:bg-muted/10">
                <Table.Cell class="max-w-[150px] truncate font-medium"
                  >{row.ACCOUNT_FULL_NAME || "---"}</Table.Cell
                >
                <Table.Cell class="text-muted-foreground">{row.PERIOD || "---"}</Table.Cell>
                <Table.Cell class="text-right font-mono text-[11px] tabular-nums"
                  >{parseCSVAmount(row.WATER_FEE) || "0"}</Table.Cell
                >
                <Table.Cell class="text-right font-mono text-[11px] tabular-nums"
                  >{parseCSVAmount(row.ASSOC_FEE) || "0"}</Table.Cell
                >
                <Table.Cell class="text-right font-mono text-[11px] tabular-nums"
                  >{parseCSVAmount(row.MISC) || "0"}</Table.Cell
                >
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
        {#if csvData.length > 10}
          <div class="border-t bg-muted/5 p-3 text-center text-[10px] text-muted-foreground italic">
            Showing first 10 rows for verification.
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  {/if}

  {#if status}
    <div
      class="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs font-semibold text-primary"
    >
      <CheckCircle2 class="h-4 w-4" />
      {status}
    </div>
  {/if}
</div>
