<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { auth } from "$lib/auth.svelte";
  import AccountAutocomplete from "$lib/components/AccountAutocomplete.svelte";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import {
    FileText,
    FileSpreadsheet,
    Download,
    RefreshCcw,
    Clock,
    Ban,
    UserCheck,
    CircleAlert,
    CircleCheck,
    Trash2,
    ExternalLink,
    Copy
  } from "lucide-svelte";
  import {
    fetchSheetRowsRaw,
    updateSheetValue,
    createNewSpreadsheet,
    ensureSheetExists,
    formatReportSheet
  } from "$lib/google-sheets";
  import { loadGapiScript } from "$lib/gmail";
  import { matchesStatusFilter, fetchResidents } from "$lib/resident-logic";
  import type { ResidentRecord } from "$lib/schemas";
  import { translatePeriod } from "$lib/receipt-utils";
  import { exportReportPDF } from "$lib/report-pdf";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";

  let isLoading = $state(true);
  let isProcessing = $state(false);
  let error = $state<string | null>(null);
  let allAccounts = $state<ResidentRecord[]>([]);
  let residents = $state<ResidentRecord[]>([]);

  // Export Options
  let exportFormat = $state("pdf");
  let issuedBy = $state(auth.user?.name || "");
  let issuedByEmail = $state(auth.user?.email || "");
  let assessedBy = $state("");
  let assessedByEmail = $state("");
  let certifiedBy = $state("");
  let certifiedByEmail = $state("");
  let periodStart = $state("");
  let periodEnd = $state("");
  let isPublic = $state(true);
  let hideSignatoryEmails = $state(false);

  // Sheets specific
  let sheetsTarget = $state("new"); // "new", "existing"
  let existingSheetId = $state("");
  let selectedSheetName = $state("");
  let newSheetTitle = $state("");
  let successDialog = $state({
    open: false,
    title: "",
    message: "",
    url: ""
  });

  const categories = [
    { id: "fully_paid", label: "Fully Paid", icon: CircleCheck },
    { id: "half_fully_paid", label: "Half-Fully Paid", icon: Clock },
    { id: "partially_paid", label: "Partially Paid", icon: CircleAlert },
    { id: "no_payment", label: "No Payment", icon: Ban },
    { id: "cleared", label: "Cleared", icon: UserCheck }
  ];

  // Auto-generate title based on scope
  $effect(() => {
    if (sheetsTarget === "new" && selectedCategories.length > 0) {
      const labels = selectedCategories
        .map((id) => categories.find((c) => c.id === id)?.label)
        .filter(Boolean);

      const joinedLabels = labels.length > 3 ? "Consolidated" : labels.join(" & ");

      const semester = translatePeriod(uiSettings.currentTerm);
      const shortName = brandingState.profile.shortName;
      newSheetTitle = `[${shortName}] Resident List (${joinedLabels}) - ${semester}`;
    }
  });

  const categoryParam = page.url.searchParams.get("category") || "fully_paid";
  let selectedCategories = $state<string[]>([categoryParam]);

  const combinedCategoryLabel = $derived(
    categories
      .filter((c) => selectedCategories.includes(c.id))
      .map((c) => c.label)
      .join(", ") || "None"
  );

  const filteredResidents = $derived(
    residents.filter((r) => {
      return selectedCategories.some((cat) => matchesStatusFilter(r, cat.toUpperCase()));
    })
  );

  async function loadData() {
    if (!uiSettings.accountingWorkbookId) return;
    isLoading = true;
    try {
      const mapped = await fetchResidents();
      const currentSem = uiSettings.currentTerm.trim();

      allAccounts = mapped;
      residents = mapped.filter((r) => r.period === currentSem);

      // Auto-Period
      const journalRows = await fetchSheetRowsRaw(
        uiSettings.accountingWorkbookId,
        "journal_general!A:H"
      );
      const currentSemJournal = journalRows
        .slice(1)
        .filter((row) => row[7] === currentSem)
        .map((row) => row[0])
        .filter(Boolean)
        .sort();

      if (currentSemJournal.length > 0) {
        periodStart = currentSemJournal[0];
        periodEnd = currentSemJournal[currentSemJournal.length - 1];
      }

      if (auth.user) {
        if (!issuedBy) issuedBy = auth.user.name;
        if (!issuedByEmail) issuedByEmail = auth.user.email;
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);

  function downloadCSV() {
    const isPublicMode = isPublic;
    let headers = isPublicMode
      ? ["Name", "Room", "Bed"]
      : ["Name", "Email", "Room", "Bed", "Total Base", "Paid", "Waived", "Balance"];

    const rows = filteredResidents.map((r) => {
      if (isPublicMode) return [r.name, r.room, r.bed];
      return [r.name, r.email, r.room, r.bed, r.totalBase, r.paid, r.waived, r.bal];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `report_${selectedCategories.join("_")}_${uiSettings.currentTerm}.csv`;
    link.click();
  }

  async function openPicker() {
    try {
      if (!(window as any).gapi) {
        await loadGapiScript();
      }

      return new Promise<void>((resolve) => {
        (window as any).gapi.load("picker", {
          callback: () => {
            const view = new (window as any).google.picker.View(
              (window as any).google.picker.ViewId.SPREADSHEETS
            );
            const picker = new (window as any).google.picker.PickerBuilder()
              .enableFeature((window as any).google.picker.Feature.NAV_HIDDEN)
              .setAppId(brandingState.profile.googleClientId.split("-")[0])
              .setOAuthToken(auth.accessToken)
              .addView(view)
              .setCallback((data: any) => {
                if (data.action === (window as any).google.picker.Action.PICKED) {
                  const doc = data.docs[0];
                  existingSheetId = doc.id;
                  selectedSheetName = doc.name;
                  sheetsTarget = "existing";
                }
                if (
                  data.action === (window as any).google.picker.Action.CANCEL ||
                  data.action === (window as any).google.picker.Action.PICKED
                ) {
                  document
                    .querySelectorAll(".picker-dialog, .picker-dialog-bg")
                    .forEach((el) => el.remove());
                  resolve();
                }
              })
              .build();
            picker.setVisible(true);

            // Force manual positioning after a small delay
            setTimeout(() => {
              const dialog = document.querySelector(".picker-dialog") as HTMLElement;
              if (dialog) {
                const top = Math.max(0, window.innerHeight / 2 - dialog.clientHeight / 2);
                const left = Math.max(0, window.innerWidth / 2 - dialog.clientWidth / 2);
                dialog.style.zIndex = "100000";
                dialog.style.left = `${left}px`;
                dialog.style.top = `${top}px`;
                dialog.style.position = "fixed";
              }
            }, 50);
          }
        });
      });
    } catch (e: any) {
      alert("Failed to open picker: " + e.message);
    }
  }

  async function syncToSheets() {
    isProcessing = true;
    try {
      const baseName = `REPORT_${selectedCategories.join("_")}_${uiSettings.currentTerm}`;
      const sheetName = (isPublic ? `PUBLIC_${baseName}` : baseName).toUpperCase().slice(0, 31);

      let targetId = "";
      if (sheetsTarget === "new") {
        if (!newSheetTitle) throw new Error("Please provide a title for the new sheet");
        const createResp = await createNewSpreadsheet(newSheetTitle, sheetName);
        targetId = createResp.spreadsheetId;
      } else {
        if (!existingSheetId) throw new Error("Please provide a spreadsheet ID");
        targetId = existingSheetId;
        await ensureSheetExists(targetId, sheetName);
      }

      let headers = isPublic
        ? ["NAME", "ROOM", "BED"]
        : ["NAME", "EMAIL", "ROOM", "BED", "BASE", "PAID", "WAIVED", "BALANCE"];

      const rows = filteredResidents.map((r) => {
        if (isPublic) return [r.name, r.room, r.bed];
        return [r.name, r.email, r.room, r.bed, r.totalBase, r.paid, r.waived, r.bal];
      });

      await updateSheetValue(targetId, `${sheetName}!A1`, [headers, ...rows]);

      // Apply professional styling
      await formatReportSheet(targetId, sheetName, rows.length + 1, headers.length);

      const targetName = sheetsTarget === "new" ? newSheetTitle : selectedSheetName;

      successDialog = {
        open: true,
        title: "Sync Successful",
        message: `Your report with ${filteredResidents.length} residents has been successfully synced to "${targetName}".`,
        url: `https://docs.google.com/spreadsheets/d/${targetId}`
      };
    } catch (e: any) {
      error = "Sync failed: " + e.message;
    } finally {
      isProcessing = false;
    }
  }

  async function handleAction() {
    if (exportFormat === "sheets") {
      await syncToSheets();
      return;
    }

    isProcessing = true;
    try {
      if (exportFormat === "pdf") {
        await exportReportPDF({
          residents: filteredResidents,
          categoryLabel: combinedCategoryLabel,
          semester: translatePeriod(uiSettings.currentTerm),
          brandingKey: brandingState.selectedKey,
          isPublic: isPublic,
          issuedBy,
          issuedByEmail: hideSignatoryEmails ? "" : issuedByEmail,
          assessedBy,
          assessedByEmail: hideSignatoryEmails ? "" : assessedByEmail,
          certifiedBy,
          certifiedByEmail: hideSignatoryEmails ? "" : certifiedByEmail,
          periodCovered: `${new Date(periodStart).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} – ${new Date(periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
        });
      } else if (exportFormat === "csv") {
        downloadCSV();
      }
    } finally {
      isProcessing = false;
    }
  }
</script>

<div class="space-y-6 pb-20">
  <SubpageHeader title="Resident List" isTopLevel={true} />

  {#if isLoading && allAccounts.length === 0}
    <LoadingView />
  {:else if error}
    <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
      <CircleAlert class="mx-auto mb-2 h-8 w-8 text-destructive" />
      <p class="text-sm font-medium text-destructive">{error}</p>
      <Button
        variant="outline"
        size="sm"
        class="mt-4"
        onclick={loadData}
        {isLoading}
        icon={RefreshCcw}>Retry</Button
      >
    </div>
  {:else}
    <div
      class="mx-auto max-w-2xl space-y-12 {isProcessing ? 'pointer-events-none opacity-50' : ''}"
    >
      <!-- Step 1: Scope -->
      <section class="space-y-4">
        <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
          >1. Scope</Label
        >
        <div class="grid gap-6 rounded-2xl border bg-card p-6">
          <div class="flex flex-col gap-8">
            <TermFilter onSelect={() => loadData()} />

            <div class="space-y-3">
              <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                >Report Categories</Label
              >
              <div class="grid gap-3 sm:grid-cols-2">
                {#each categories as cat}
                  <div
                    class="flex items-center gap-3 rounded-xl border p-4 transition-all {selectedCategories.includes(
                      cat.id
                    )
                      ? 'border-primary/40 bg-primary/5'
                      : 'hover:bg-muted/50'}"
                  >
                    <Checkbox
                      id={cat.id}
                      class="h-5 w-5"
                      checked={selectedCategories.includes(cat.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          selectedCategories = [...selectedCategories, cat.id];
                        } else {
                          selectedCategories = selectedCategories.filter((id) => id !== cat.id);
                        }
                      }}
                    />
                    <Label
                      for={cat.id}
                      class="flex flex-1 cursor-pointer items-center gap-3 text-sm font-bold"
                    >
                      <cat.icon class="h-4 w-4 text-muted-foreground" />
                      {cat.label}
                    </Label>
                  </div>
                {/each}
              </div>
            </div>

            <div class="grid gap-6 sm:grid-cols-2">
              <div class="space-y-2">
                <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                  >Period Start</Label
                >
                <Input type="date" bind:value={periodStart} class="h-10 text-sm font-medium" />
              </div>
              <div class="space-y-2">
                <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                  >Period End</Label
                >
                <Input type="date" bind:value={periodEnd} class="h-10 text-sm font-medium" />
              </div>
            </div>

            <div class="space-y-4">
              <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                >Privacy</Label
              >
              <div class="flex flex-col gap-4">
                <div class="flex items-start gap-3">
                  <Checkbox id="isPublicPage" bind:checked={isPublic} />
                  <div class="space-y-1">
                    <Label for="isPublicPage" class="cursor-pointer font-medium">Public View</Label>
                    <p class="text-xs text-muted-foreground">
                      Exclude financial amounts and resident emails from the report.
                    </p>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <Checkbox id="hideEmailsPage" bind:checked={hideSignatoryEmails} />
                  <div class="space-y-1">
                    <Label for="hideEmailsPage" class="cursor-pointer font-medium"
                      >Hide Signatory Emails</Label
                    >
                    <p class="text-xs text-muted-foreground">
                      Omit email addresses for the signatories at the bottom.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-4">
        <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
          >2. Export Format</Label
        >
        <div class="grid grid-cols-3 gap-3">
          <button
            class="group relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all hover:bg-muted {exportFormat ===
            'pdf'
              ? 'border-primary bg-primary/5'
              : 'border-transparent bg-muted/50'}"
            onclick={() => (exportFormat = "pdf")}
          >
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-sm transition-transform group-hover:scale-110"
            >
              <FileText
                class="h-5 w-5 {exportFormat === 'pdf' ? 'text-primary' : 'text-muted-foreground'}"
              />
            </div>
            <span class="text-xs font-bold tracking-tight">PDF</span>
            {#if exportFormat === "pdf"}
              <div
                class="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary"
              >
                <CircleCheck class="h-3 w-3 text-primary-foreground" />
              </div>
            {/if}
          </button>
          <button
            class="group relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all hover:bg-muted {exportFormat ===
            'csv'
              ? 'border-primary bg-primary/5'
              : 'border-transparent bg-muted/50'}"
            onclick={() => (exportFormat = "csv")}
          >
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-sm transition-transform group-hover:scale-110"
            >
              <Download
                class="h-5 w-5 {exportFormat === 'csv' ? 'text-primary' : 'text-muted-foreground'}"
              />
            </div>
            <span class="text-xs font-bold tracking-tight">CSV Sheet</span>
            {#if exportFormat === "csv"}
              <div
                class="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary"
              >
                <CircleCheck class="h-3 w-3 text-primary-foreground" />
              </div>
            {/if}
          </button>
          <button
            class="group relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all hover:bg-muted {exportFormat ===
            'sheets'
              ? 'border-primary bg-primary/5'
              : 'border-transparent bg-muted/50'}"
            onclick={() => (exportFormat = "sheets")}
          >
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-sm transition-transform group-hover:scale-110"
            >
              <FileSpreadsheet
                class="h-5 w-5 {exportFormat === 'sheets'
                  ? 'text-primary'
                  : 'text-muted-foreground'}"
              />
            </div>
            <span class="text-xs font-bold tracking-tight">Google Sheets</span>
            {#if exportFormat === "sheets"}
              <div
                class="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary"
              >
                <CircleCheck class="h-3 w-3 text-primary-foreground" />
              </div>
            {/if}
          </button>
        </div>

        {#if exportFormat === "sheets"}
          <div
            class="mt-4 grid animate-in gap-6 rounded-2xl border bg-muted/30 p-6 fade-in slide-in-from-top-2"
          >
            <div class="space-y-3">
              <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                >Destination</Label
              >
              <div class="grid gap-2">
                <button
                  class="flex items-center gap-4 rounded-xl border bg-background p-4 text-left transition-all {sheetsTarget ===
                  'new'
                    ? 'border-primary ring-1 ring-primary'
                    : 'hover:bg-muted/50'}"
                  onclick={() => (sheetsTarget = "new")}
                >
                  <div
                    class="h-3 w-3 rounded-full {sheetsTarget === 'new'
                      ? 'bg-primary'
                      : 'bg-muted'}"
                  ></div>
                  <span class="text-sm font-bold">Create New Spreadsheet</span>
                </button>
                <button
                  class="flex items-center gap-4 rounded-xl border bg-background p-4 text-left transition-all {sheetsTarget ===
                  'existing'
                    ? 'border-primary ring-1 ring-primary'
                    : 'hover:bg-muted/50'}"
                  onclick={() => (sheetsTarget = "existing")}
                >
                  <div
                    class="h-3 w-3 rounded-full {sheetsTarget === 'existing'
                      ? 'bg-primary'
                      : 'bg-muted'}"
                  ></div>
                  <span class="text-sm font-bold">Use Existing Spreadsheet</span>
                </button>
              </div>
            </div>

            {#if sheetsTarget === "new"}
              <div class="animate-in space-y-2 fade-in slide-in-from-top-1">
                <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                  >New Spreadsheet Title</Label
                >
                <Input
                  placeholder="e.g., Resident List"
                  bind:value={newSheetTitle}
                  class="h-10 text-sm font-medium"
                />
              </div>
            {:else if sheetsTarget === "existing"}
              <div class="animate-in space-y-3 fade-in slide-in-from-top-1">
                <div class="flex items-center justify-between">
                  <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                    >Target Spreadsheet</Label
                  >
                  {#if existingSheetId}
                    <Button
                      variant="ghost"
                      size="sm"
                      class="font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                      onclick={() => {
                        existingSheetId = "";
                        selectedSheetName = "";
                      }}
                      icon={Trash2}
                    >
                      Reset Selection
                    </Button>
                  {/if}
                </div>
                <Button
                  variant="outline"
                  size="lg"
                  class="w-full gap-3 border-dashed bg-background font-bold transition-all hover:border-primary/50 hover:bg-primary/5"
                  onclick={openPicker}
                  icon={FileSpreadsheet}
                  iconClass="text-muted-foreground"
                >
                  {selectedSheetName || "Select from Google Drive…"}
                </Button>
              </div>
            {/if}
          </div>
        {/if}
      </section>

      <section class="space-y-4">
        <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
          >3. Signatories</Label
        >
        <div class="grid gap-6 rounded-2xl border bg-card p-6">
          <!-- Issued By -->
          <div class="space-y-3">
            <AccountAutocomplete
              label="Issued By"
              accounts={allAccounts}
              bind:value={issuedBy}
              filter={(a) => a.period === uiSettings.currentTerm}
              onSelect={(a) => {
                issuedBy = a.name;
                issuedByEmail = a.email;
              }}
            />
            <div
              class="flex items-center justify-between rounded-lg border border-dashed border-muted bg-muted/20 p-3"
            >
              <div class="flex flex-col">
                <span class="mb-1 text-xs leading-none font-bold text-muted-foreground uppercase"
                  >Current Selection</span
                >
                <span class="text-sm font-bold text-foreground/80"
                  >{issuedBy || "None selected"}</span
                >
                <span class="mt-0.5 font-mono text-xs text-muted-foreground"
                  >{issuedByEmail || "No email"}</span
                >
              </div>
            </div>
          </div>

          <!-- Assessed By -->
          <div class="space-y-3">
            <AccountAutocomplete
              label="Assessed By"
              accounts={allAccounts}
              bind:value={assessedBy}
              filter={(a) => a.period === uiSettings.currentTerm}
              onSelect={(a) => {
                assessedBy = a.name;
                assessedByEmail = a.email;
              }}
            />
            <div
              class="flex items-center justify-between rounded-lg border border-dashed border-muted bg-muted/20 p-3"
            >
              <div class="flex flex-col">
                <span class="mb-1 text-xs leading-none font-bold text-muted-foreground uppercase"
                  >Current Selection</span
                >
                <span class="text-xs font-bold text-foreground/80"
                  >{assessedBy || "None selected"}</span
                >
                <span class="mt-0.5 font-mono text-xs text-muted-foreground"
                  >{assessedByEmail || "No email"}</span
                >
              </div>
            </div>
          </div>

          <!-- Certified By -->
          <div class="space-y-3">
            <AccountAutocomplete
              label="Certified By"
              accounts={allAccounts}
              bind:value={certifiedBy}
              filter={(a) => a.period === uiSettings.currentTerm}
              onSelect={(a) => {
                certifiedBy = a.name;
                certifiedByEmail = a.email;
              }}
            />
            <div
              class="flex items-center justify-between rounded-lg border border-dashed border-muted bg-muted/20 p-3"
            >
              <div class="flex flex-col">
                <span class="mb-1 text-xs leading-none font-bold text-muted-foreground uppercase"
                  >Current Selection</span
                >
                <span class="text-xs font-bold text-foreground/80"
                  >{certifiedBy || "None selected"}</span
                >
                <span class="mt-0.5 font-mono text-xs text-muted-foreground"
                  >{certifiedByEmail || "No email"}</span
                >
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="pt-4">
        <Button
          size="lg"
          class="w-full font-bold"
          onclick={handleAction}
          isLoading={isProcessing}
          icon={exportFormat === "sheets" ? RefreshCcw : Download}
        >
          {#if exportFormat === "sheets"}
            Sync to Google Sheets
          {:else}
            Generate {exportFormat.toUpperCase()} Report
          {/if}
        </Button>
        <p class="mt-3 text-center text-xs text-muted-foreground">
          Processing <b>{filteredResidents.length}</b> records for <b>{combinedCategoryLabel}</b>
        </p>
      </section>
    </div>
  {/if}
</div>

<AlertDialog.Root bind:open={successDialog.open}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{successDialog.title}</AlertDialog.Title>
      <AlertDialog.Description>
        {successDialog.message}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Close</AlertDialog.Cancel>
      <Button
        variant="outline"
        onclick={() => {
          navigator.clipboard.writeText(successDialog.url);
        }}
        icon={Copy}
      >
        Copy Link
      </Button>
      <AlertDialog.Action onclick={() => window.open(successDialog.url, "_blank")} class="gap-2">
        <ExternalLink class="h-4 w-4" />
        Open Spreadsheet
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
