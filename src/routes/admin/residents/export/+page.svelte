<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import { brandingState } from "$state/branding.svelte";
  import { settings } from "$state/settings.svelte";
  import { auth } from "$state/auth.svelte";
  import { AccountCombobox } from "$components/ui/haone";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Checkbox } from "$ui/checkbox";
  import * as RadioGroup from "$ui/radio-group";
  import {
    FileText,
    Download,
    CircleAlert,
    BookUser,
    ClipboardCheck,
    CreditCard,
    CheckCheck,
    X
  } from "@lucide/svelte";
  import { fetchJournalEntries } from "$api/controllers/journal-controller";
  import {
    matchesStatusFilter,
    fetchResidents,
    fetchUsers
  } from "$api/controllers/resident-controller";
  import type { ResidentRecord, OfficerRecord, UserRecord } from "$lib/types";
  import { translatePeriod } from "$utils/translators";
  import { exportReportPDF } from "$reports/report-pdf";
  import { fetchOfficers } from "$api/controllers/officer-controller";
  import { OfficerStatus } from "$lib/types";

  import { Combobox } from "$ui/combobox";
  import { getAllRooms, getUnits } from "$utils/rooms-utils";
  import { fly, fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  let isLoading = $state(true);
  let isProcessing = $state(false);
  let error = $state<string | null>(null);
  let allAccounts = $state<ResidentRecord[]>([]);
  let residents = $state<ResidentRecord[]>([]);
  let officers = $state<OfficerRecord[]>([]);
  let rawUsers = $state<UserRecord[]>([]);

  // Export Options
  let exportFormat = $state("pdf");
  let issuedBy = $state(auth.displayNameLastFirst || "");
  let issuedByEmail = $state(auth.user?.email || "");
  let assessedBy = $state("");
  let assessedByEmail = $state("");
  let certifiedBy = $state("");
  let certifiedByEmail = $state("");
  let periodStart = $state("");
  let periodEnd = $state("");
  let isPublic = $state(true);
  let hideSignatoryEmails = $state(false);
  let useLegalName = $state(true);
  let selectedUnit = $state("all");

  const reportTypes = [
    {
      id: "payment_status",
      label: "Payment Status",
      description: "Filter residents by payment status or clearance",
      icon: CreditCard
    },
    {
      id: "officers",
      label: "Active Officers",
      description: "Export current active dorm officers",
      icon: BookUser
    },
    {
      id: "attendance",
      label: "Attendance Sheet",
      description: "Generate room-by-room attendance sheet with signatures",
      icon: ClipboardCheck
    }
  ];

  const paymentStatuses = [
    { id: "fully_paid", label: "Fully Paid" },
    { id: "half_fully_paid", label: "Half-Fully Paid" },
    { id: "partially_paid", label: "Partially Paid" },
    { id: "no_payment", label: "No Payment" },
    { id: "cleared", label: "Cleared" }
  ];

  const allTypeDefinitions = [
    ...paymentStatuses,
    { id: "officers", label: "Active Officers", icon: BookUser },
    { id: "attendance", label: "Attendance Sheet", icon: ClipboardCheck }
  ];

  let eventName = $state("");
  let reportType = $state<"payment_status" | "officers" | "attendance">("payment_status");
  let selectedPaymentCategories = $state<string[]>(["fully_paid"]);

  const selectedCategories = $derived.by(() => {
    if (reportType === "officers") {
      return ["officers"];
    }
    if (reportType === "attendance") {
      return ["attendance"];
    }
    return selectedPaymentCategories;
  });

  const isExportBlocked = $derived(
    reportType === "payment_status" && selectedPaymentCategories.length === 0
  );

  const combinedCategoryLabel = $derived(
    allTypeDefinitions
      .filter((c) => selectedCategories.includes(c.id))
      .map((c) => c.label)
      .join(", ") || "None"
  );

  const availableUnits = $derived.by(() => {
    const unitsData = getUnits(brandingState.selectedKey);
    if (unitsData && unitsData.length > 0) {
      return unitsData.map((u) => u.name);
    }
    const units = new Set<string>();
    residents.forEach((r) => {
      if (!r.room) return;
      const match = r.room.match(/^(\d+)/);
      if (match) {
        units.add(`Unit ${match[1].slice(0, 1)}00s`);
      } else {
        const parts = r.room.split(/[-_\s]/);
        if (parts[0]) units.add(parts[0]);
      }
    });
    return Array.from(units).sort();
  });

  const unitOptions = $derived([
    { value: "all", label: "All Units" },
    ...availableUnits.map((u) => ({ value: u, label: u }))
  ]);

  function getNameToUse(residentId: string, legalName: string): string {
    if (useLegalName) {
      return legalName;
    }
    const user = rawUsers.find((u) => u.id === residentId);
    if (!user) {
      return legalName;
    }
    return user.overrideName || legalName;
  }

  function matchesUnitFilter(room: string): boolean {
    if (selectedUnit === "all" || !room) return true;
    const unitsData = getUnits(brandingState.selectedKey);
    const matchedUnitObj = unitsData.find((u) => u.name === selectedUnit);
    if (matchedUnitObj) {
      return room.toUpperCase().startsWith(matchedUnitObj.id.toUpperCase());
    }
    if (selectedUnit.startsWith("Unit ")) {
      const unitNum = selectedUnit.replace("Unit ", "").replace("00s", "");
      return room.startsWith(unitNum);
    }
    return room.startsWith(selectedUnit);
  }

  const filteredResidents = $derived.by(() => {
    const isAttendance =
      selectedCategories.length === 1 && selectedCategories.includes("attendance");

    if (isAttendance) {
      // Build slot grid from all rooms in rooms.json + residents
      const slotMap = new Map<
        string,
        ResidentRecord & { position?: string; isOfficer?: boolean }
      >();

      // 1. Populate standard room slots from rooms.json
      const configRooms = getAllRooms(brandingState.selectedKey);
      configRooms.forEach((r) => {
        if (r.unavailable_reason) return;
        if (!matchesUnitFilter(r.room_number)) return;
        r.slots.forEach((bed) => {
          const key = `${r.room_number.toUpperCase()}-${bed.toUpperCase()}`;
          slotMap.set(key, {
            email: "",
            period: settings.currentTerm,
            room: r.room_number.toUpperCase(),
            bed: bed.toUpperCase(),
            name: "",
            stno: "",
            waterBase: 0,
            waterPaid: 0,
            waterWaived: 0,
            waterBal: 0,
            assocBase: 0,
            assocPaid: 0,
            assocWaived: 0,
            assocBal: 0,
            totalBase: 0,
            paid: 0,
            waived: 0,
            bal: 0,
            isFullyPaid: true,
            notes: "",
            college: "",
            program: "",
            ceIssued: "",
            ceRefNo: "",
            ceLink: "",
            ceFullName: "",
            id: "",
            residentId: "",
            ledgerId: "",
            checkInDate: "",
            type: "",
            raw: [],
            isOfficer: false
          });
        });
      });

      // 2. Overlay assigned residents
      residents.forEach((r) => {
        if (!r.room || !r.bed) return;
        if (!matchesUnitFilter(r.room)) return;
        const key = `${r.room.toUpperCase()}-${r.bed.toUpperCase()}`;
        const nameToUse = getNameToUse(r.residentId, r.name);
        slotMap.set(key, {
          ...r,
          room: r.room.toUpperCase(),
          bed: r.bed.toUpperCase(),
          name: nameToUse,
          isOfficer: false
        });
      });

      const list = Array.from(slotMap.values());
      list.sort((a, b) => {
        const roomCompare = a.room.localeCompare(b.room, undefined, {
          numeric: true,
          sensitivity: "base"
        });
        if (roomCompare !== 0) return roomCompare;
        return a.bed.localeCompare(b.bed, undefined, { numeric: true, sensitivity: "base" });
      });

      return list;
    }

    let result: (ResidentRecord & { position?: string; isOfficer?: boolean })[] = [];

    if (selectedCategories.some((c) => c !== "officers" && c !== "attendance")) {
      result = residents
        .filter((r) => {
          if (!matchesUnitFilter(r.room)) return false;
          return selectedCategories.some(
            (cat) =>
              cat !== "officers" &&
              cat !== "attendance" &&
              matchesStatusFilter(r, cat.toUpperCase())
          );
        })
        .map((r) => ({ ...r, name: getNameToUse(r.residentId, r.name), isOfficer: false }));
    }

    if (selectedCategories.includes("officers")) {
      const currentTerm = settings.currentTerm.trim();
      const activeOfficers = officers.filter(
        (o) => o.status === OfficerStatus.ACTIVE && o.term === currentTerm
      );

      const officerEntries = activeOfficers
        .filter((o) => {
          const res = allAccounts.find((a) => a.residentId === o.residentId);
          return matchesUnitFilter(res?.room || "");
        })
        .map((o) => {
          const res = allAccounts.find((a) => a.residentId === o.residentId);
          const nameToUse = getNameToUse(o.residentId, o.name);
          return {
            email: o.email,
            period: o.term,
            room: res?.room || "N/A",
            bed: res?.bed || "N/A",
            name: nameToUse,
            stno: res?.stno || `OFF-${o.id}`,
            waterBase: res?.waterBase || 0,
            waterPaid: res?.waterPaid || 0,
            waterWaived: res?.waterWaived || 0,
            waterBal: res?.waterBal || 0,
            assocBase: res?.assocBase || 0,
            assocPaid: res?.assocPaid || 0,
            assocWaived: res?.assocWaived || 0,
            assocBal: res?.assocBal || 0,
            totalBase: res?.totalBase || 0,
            paid: res?.paid || 0,
            waived: res?.waived || 0,
            bal: res?.bal || 0,
            isFullyPaid: res?.isFullyPaid || false,
            notes: res?.notes || "",
            college: res?.college || "",
            program: res?.program || "",
            ceIssued: res?.ceIssued || "",
            ceRefNo: res?.ceRefNo || "",
            ceLink: res?.ceLink || "",
            ceFullName: res?.ceFullName || "",
            id: res?.id || "",
            residentId: res?.residentId || "",
            ledgerId: res?.ledgerId || "",
            checkInDate: res?.checkInDate || "",
            type: res?.type || "",
            raw: res?.raw || [],
            position: o.position,
            isOfficer: true
          };
        });
      result = [...result, ...officerEntries];
    }

    return result;
  });

  async function loadData(bypassCache = false) {
    isLoading = true;
    try {
      const [mapped, officerList, usersList] = await Promise.all([
        fetchResidents(bypassCache),
        fetchOfficers(bypassCache),
        fetchUsers(bypassCache)
      ]);

      allAccounts = mapped;
      residents = mapped.filter((r) => r.period === settings.currentTerm);
      officers = officerList;
      rawUsers = usersList;

      // Auto-Period
      const entries = await fetchJournalEntries(
        { term: settings.currentTerm },
        undefined,
        bypassCache
      );
      const journalList = Array.isArray(entries) ? entries : entries.items;
      const dates = journalList
        .map((j) => j.date)
        .filter(Boolean)
        .sort();

      if (dates.length > 0) {
        periodStart = dates[0];
        periodEnd = dates[dates.length - 1];
      }

      if (auth.user) {
        if (!issuedBy) {
          issuedBy = auth.displayNameLastFirst;
        }
        if (!issuedByEmail) {
          issuedByEmail = auth.user.email;
        }
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Export Residents";
  });

  $effect(() => {
    settings.currentTerm;
    loadData();
  });

  function downloadCSV() {
    const isPublicMode = isPublic;
    const isOfficerReport =
      selectedCategories.length === 1 && selectedCategories.includes("officers");
    const isAttendanceReport =
      selectedCategories.length === 1 && selectedCategories.includes("attendance");

    let headers = [];
    if (isAttendanceReport) {
      headers = ["Room", "Bed", "Resident Name", "Signature"];
    } else if (isOfficerReport) {
      headers = ["Position", "Name", "Room"];
    } else {
      headers = isPublicMode
        ? ["Name", "Room", "Bed"]
        : ["Name", "Email", "Room", "Bed", "Total Base", "Paid", "Waived", "Balance"];
    }

    const rows = filteredResidents.map((r) => {
      if (isAttendanceReport) return [r.room, r.bed, r.name, ""];
      if (isOfficerReport) return [r.position, r.name, r.room];
      if (isPublicMode) return [r.name, r.room, r.bed];
      return [r.name, r.email, r.room, r.bed, r.totalBase, r.paid, r.waived, r.bal];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `report_${selectedCategories.join("_")}_${settings.currentTerm}.csv`;
    link.click();
  }

  async function handleExportOfficers() {
    // Logic moved into categories
  }

  async function handleAction() {
    if (isExportBlocked) {
      return;
    }

    isProcessing = true;
    try {
      const isOfficerReport =
        selectedCategories.length === 1 && selectedCategories.includes("officers");
      const isAttendanceReport =
        selectedCategories.length === 1 && selectedCategories.includes("attendance");

      if (exportFormat === "pdf") {
        await exportReportPDF({
          residents: filteredResidents,
          categoryLabel: combinedCategoryLabel,
          semester: translatePeriod(settings.currentTerm),
          brandingKey: brandingState.selectedKey,
          isPublic: isPublic,
          isOfficerReport,
          isAttendanceReport,
          eventName: isAttendanceReport ? eventName.trim() : undefined,
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

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Export Residents"
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
  />

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
      <CircleAlert class="mx-auto mb-2 h-8 w-8 text-destructive" />
      <p class="text-sm font-medium text-destructive">{error}</p>
    </div>
  {:else}
    <div
      class="mx-auto max-w-2xl space-y-12 {isProcessing ? 'pointer-events-none opacity-50' : ''}"
    >
      <!-- Step 1: Type -->
      <section class="space-y-4">
        <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
          >1. Type</Label
        >
        <RadioGroup.Root bind:value={reportType} class="grid gap-3 sm:grid-cols-3">
          {#each reportTypes as rt}
            <RadioGroup.Card
              value={rt.id}
              title={rt.label}
              description={rt.description}
              icon={rt.icon}
              selected={reportType === rt.id}
            />
          {/each}
        </RadioGroup.Root>

        {#if reportType === "payment_status"}
          <div
            in:fly={{ y: 8, duration: 150, easing: cubicOut }}
            out:fade={{ duration: 100 }}
            class="grid gap-6 rounded-2xl border bg-muted/30 p-6"
          >
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <Label>Payment Categories</Label>
                <div class="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={CheckCheck}
                    onclick={() => {
                      selectedPaymentCategories = paymentStatuses.map((c) => c.id);
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={X}
                    onclick={() => {
                      selectedPaymentCategories = [];
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div class="grid gap-3 sm:grid-cols-2">
                {#each paymentStatuses as cat}
                  <div
                    class="flex items-center gap-3 rounded-xl border bg-card p-4 transition-all {selectedPaymentCategories.includes(
                      cat.id
                    )
                      ? 'border-primary/40 bg-primary/5'
                      : 'hover:bg-muted/50'}"
                  >
                    <Checkbox
                      id={cat.id}
                      class="h-5 w-5"
                      checked={selectedPaymentCategories.includes(cat.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          selectedPaymentCategories = [...selectedPaymentCategories, cat.id];
                        } else {
                          selectedPaymentCategories = selectedPaymentCategories.filter(
                            (id) => id !== cat.id
                          );
                        }
                      }}
                    />
                    <Label
                      for={cat.id}
                      class="flex flex-1 cursor-pointer items-center text-sm font-bold"
                    >
                      {cat.label}
                    </Label>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/if}

        {#if reportType === "attendance"}
          <div
            in:fly={{ y: 8, duration: 150, easing: cubicOut }}
            out:fade={{ duration: 100 }}
            class="grid gap-6 rounded-2xl border bg-muted/30 p-6"
          >
            <div class="space-y-2">
              <Label for="eventName">Event Name</Label>
              <Input
                id="eventName"
                bind:value={eventName}
                placeholder="General Assembly, Fire Drill, Activity…"
                class="bg-card"
              />
              <p class="text-xs text-muted-foreground">
                Printed on the header of the attendance sheet. Leave blank to print a blank line for
                writing.
              </p>
            </div>
          </div>
        {/if}
      </section>

      <!-- Step 2: Scope -->
      <section class="space-y-4">
        <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
          >2. Scope</Label
        >
        <div class="grid gap-6 rounded-2xl border bg-card p-6">
          <div class="flex flex-col gap-8">
            <div class="space-y-2">
              <Label>Academic Term</Label>
              <Input value={translatePeriod(settings.currentTerm)} readonly />
            </div>
            <div class="grid gap-6 sm:grid-cols-2">
              <div class="space-y-2">
                <Label>Period Start</Label>
                <Input type="date" bind:value={periodStart} />
              </div>
              <div class="space-y-2">
                <Label>Period End</Label>
                <Input type="date" bind:value={periodEnd} />
              </div>
            </div>

            <div class="grid gap-6 sm:grid-cols-2">
              <div class="space-y-2">
                <Label>Unit Filter</Label>
                <Combobox
                  bind:value={selectedUnit}
                  options={unitOptions}
                  placeholder="Select Unit..."
                  searchPlaceholder="Search Unit..."
                  class="w-full"
                />
              </div>
            </div>

            <div class="space-y-4">
              <Label>Privacy</Label>
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
                  <Checkbox id="useLegalNamePage" bind:checked={useLegalName} />
                  <div class="space-y-1">
                    <Label for="useLegalNamePage" class="cursor-pointer font-medium"
                      >Use Legal Name</Label
                    >
                    <p class="text-xs text-muted-foreground">
                      Format names as LAST NAME, FIRST NAME SUFFIX (ignore preferred names).
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
          >3. Export Format</Label
        >
        <RadioGroup.Root bind:value={exportFormat} class="grid gap-3 sm:grid-cols-2">
          <RadioGroup.Card
            value="pdf"
            title="PDF"
            description="Formatted PDF document ready for printing or archiving"
            icon={FileText}
            selected={exportFormat === "pdf"}
          />
          <RadioGroup.Card
            value="csv"
            title="CSV Sheet"
            description="Raw data in spreadsheet-compatible CSV file"
            icon={Download}
            selected={exportFormat === "csv"}
          />
        </RadioGroup.Root>
      </section>

      <section class="space-y-4">
        <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
          >4. Signatories</Label
        >
        <div class="grid gap-6 rounded-2xl border bg-card p-6">
          <!-- Issued By -->
          <div class="space-y-3">
            <AccountCombobox
              label="Issued By"
              accounts={allAccounts}
              bind:value={issuedBy}
              filter={(a) => a.period === settings.currentTerm}
              onSelect={(a) => {
                issuedBy = a.name;
                issuedByEmail = a.email;
              }}
            />
          </div>

          <!-- Assessed By -->
          <div class="space-y-3">
            <AccountCombobox
              label="Assessed By"
              accounts={allAccounts}
              bind:value={assessedBy}
              filter={(a) => a.period === settings.currentTerm}
              onSelect={(a) => {
                assessedBy = a.name;
                assessedByEmail = a.email;
              }}
            />
          </div>

          <!-- Certified By -->
          <div class="space-y-3">
            <AccountCombobox
              label="Certified By"
              accounts={allAccounts}
              bind:value={certifiedBy}
              filter={(a) => a.period === settings.currentTerm}
              onSelect={(a) => {
                certifiedBy = a.name;
                certifiedByEmail = a.email;
              }}
            />
          </div>
        </div>
      </section>

      <section>
        <Button
          size="lg"
          class="w-full font-bold"
          onclick={handleAction}
          isLoading={isProcessing}
          disabled={isExportBlocked}
          icon={Download}
        >
          Generate {exportFormat.toUpperCase()}
        </Button>
        {#if isExportBlocked}
          <p class="mt-3 text-center text-xs font-medium text-destructive">
            Please select at least one payment category to export.
          </p>
        {:else}
          <p class="mt-3 text-center text-xs">
            Processing <b>{filteredResidents.length}</b> records for <b>{combinedCategoryLabel}</b>
          </p>
        {/if}
      </section>
    </div>
  {/if}
</div>
