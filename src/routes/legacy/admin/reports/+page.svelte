<script lang="ts">
  import { onMount } from "svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import { RefreshCcw, GraduationCap, School, CalendarDays, CircleDollarSign } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";
  import { uiSettings } from "$lib/settings.svelte";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import * as Card from "$lib/components/ui/card";
  import * as Chart from "$lib/components/ui/chart";
  import { PieChart } from "layerchart";
  import ChartPie from "lucide-svelte/icons/chart-pie";
  import { translateCollege, translateProgram, parseCSVAmount } from "$lib/receipt-utils";

  import { ACCOUNT_COL as ACC } from "$lib/schemas";
  import { mapRowToResident } from "$lib/resident-logic";

  interface DataItem {
    label: string;
    value: number;
    percentage: string;
    fill?: string;
  }

  interface ReportData {
    colleges: DataItem[];
    degrees: DataItem[];
    batches: DataItem[];
    paymentStatus: DataItem[];
  }

  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let reportData = $state<ReportData>({
    colleges: [],
    degrees: [],
    batches: [],
    paymentStatus: []
  });

  const chartConfig = {
    value: { label: "Residents" },
    "chart-1": { label: "Group 1", color: "var(--chart-1)" },
    "chart-2": { label: "Group 2", color: "var(--chart-2)" },
    "chart-3": { label: "Group 3", color: "var(--chart-3)" },
    "chart-4": { label: "Group 4", color: "var(--chart-4)" },
    "chart-5": { label: "Group 5", color: "var(--chart-5)" }
  } as const;

  async function loadData(forceRefresh = false) {
    if (!brandingState.spreadsheetId) return;
    isLoading = true;
    error = null;

    try {
      const rows = await fetchSheetRowsRaw(
        brandingState.spreadsheetId,
        "accounts!A:AD",
        forceRefresh
      );
      const accounts = rows
        .slice(1)
        .map((row) => mapRowToResident(row))
        .filter(
          (r) =>
            r.email &&
            r.email !== "_vacant" &&
            (!uiSettings.currentSemester || r.period === uiSettings.currentSemester)
        );

      const totalResidents = accounts.length;
      if (totalResidents === 0) {
        reportData = { colleges: [], degrees: [], batches: [], paymentStatus: [] };
        return;
      }

      const collegesMap: Record<string, number> = {};
      const degreesMap: Record<string, number> = {};
      const batchesMap: Record<string, number> = {};
      const paidMap: Record<string, number> = {
        "Fully Paid": 0,
        "Partial Payment": 0,
        "No Payment": 0
      };

      accounts.forEach((res) => {
        // College translation & merging
        const translatedColleges = translateCollege(res.college);
        const college = translatedColleges[translatedColleges.length - 1]; // Take last
        collegesMap[college] = (collegesMap[college] || 0) + 1;

        // Degree translation & merging
        const translatedDegrees = translateProgram(res.program);
        const degree = translatedDegrees[translatedDegrees.length - 1]; // Take last
        degreesMap[degree] = (degreesMap[degree] || 0) + 1;

        // Batch processing
        const stno = res.stno.trim();
        if (stno && stno.length >= 4) {
          const batch = stno.substring(0, 4);
          if (/^\d{4}$/.test(batch)) {
            batchesMap[batch] = (batchesMap[batch] || 0) + 1;
          }
        }

        // Payment status processing
        let status = "No Payment";
        if (res.isFullyPaid) {
          status = "Fully Paid";
        } else if (res.paid > 0) {
          status = "Partial Payment";
        }
        paidMap[status]++;
      });

      const mapToItems = (map: Record<string, number>, limit = 0) => {
        let items = Object.entries(map)
          .map(([label, value]) => ({
            label,
            value,
            percentage: ((value / totalResidents) * 100).toFixed(1) + "%"
          }))
          .sort((a, b) => b.value - a.value);

        if (limit > 0) items = items.slice(0, limit);

        return items.map((item, i) => ({
          ...item,
          fill: `var(--chart-${(i % 5) + 1})`
        }));
      };

      reportData = {
        colleges: mapToItems(collegesMap),
        degrees: mapToItems(degreesMap),
        batches: mapToItems(batchesMap).sort((a, b) => b.label.localeCompare(a.label)),
        paymentStatus: mapToItems(paidMap).sort((a, b) => b.label.localeCompare(a.label)) // Pending then Fully Paid or vice versa
      };
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);
</script>

<div class="space-y-3">
  <SubpageHeader title="Reports">
    {#snippet actions()}
      <Button variant="outline" size="sm" onclick={() => loadData(true)} disabled={isLoading}>
        <RefreshCcw class="h-4 w-4 sm:mr-2 {isLoading ? 'animate-spin' : ''}" />
        <span class="hidden sm:inline">Refresh</span>
      </Button>
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView text="Generating reports..." />
  {:else if error}
    <div
      class="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm font-medium text-destructive"
    >
      {error}
    </div>
  {:else}
    <div class="mb-3 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
      <TermFilter onSelect={() => loadData()} />
    </div>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <!-- Payment Status -->
      <Card.Root class="xl:col-span-2">
        <Card.Header>
          <Card.Title class="flex items-center gap-2 text-lg">
            <CircleDollarSign class="h-5 w-5" />
            Settlement Status
          </Card.Title>
          <Card.Description>Resident Payment Progress</Card.Description>
        </Card.Header>
        <Card.Content class="space-y-6">
          <Chart.Container config={chartConfig} class="mx-auto aspect-square max-h-[300px]">
            <PieChart
              data={reportData.paymentStatus}
              key="label"
              value="value"
              c="fill"
              innerRadius={-20}
              cornerRadius={4}
              padAngle={0.02}
            />
          </Chart.Container>

          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {#each reportData.paymentStatus as item}
              <div
                class="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
              >
                <div class="flex items-center gap-2 truncate">
                  <div class="h-2 w-2 rounded-full" style="background-color: {item.fill}"></div>
                  <span class="truncate text-xs font-semibold text-foreground/80" title={item.label}
                    >{item.label}</span
                  >
                </div>
                <div class="flex shrink-0 items-center gap-2 italic">
                  <span class="text-xs font-bold text-foreground">{item.value}</span>
                  <span class="text-[10px] text-muted-foreground">({item.percentage})</span>
                </div>
              </div>
            {/each}
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Colleges -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2 text-lg">
            <School class="h-5 w-5" />
            Resident Colleges
          </Card.Title>
          <Card.Description>Distribution by Academic Unit</Card.Description>
        </Card.Header>
        <Card.Content class="space-y-6">
          <Chart.Container config={chartConfig} class="mx-auto aspect-square max-h-[300px]">
            <PieChart
              data={reportData.colleges}
              key="label"
              value="value"
              c="fill"
              innerRadius={-20}
              cornerRadius={4}
              padAngle={0.02}
            />
          </Chart.Container>

          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {#each reportData.colleges as item}
              <div
                class="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
              >
                <div class="flex items-center gap-2 truncate">
                  <div class="h-2 w-2 rounded-full" style="background-color: {item.fill}"></div>
                  <span class="truncate text-xs font-semibold text-foreground/80" title={item.label}
                    >{item.label}</span
                  >
                </div>
                <div class="flex shrink-0 items-center gap-2 italic">
                  <span class="text-xs font-bold text-foreground">{item.value}</span>
                  <span class="text-[10px] text-muted-foreground">({item.percentage})</span>
                </div>
              </div>
            {/each}
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Batches -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2 text-lg">
            <CalendarDays class="h-5 w-5" />
            Resident Batches
          </Card.Title>
          <Card.Description>Distribution by Admission Year</Card.Description>
        </Card.Header>
        <Card.Content class="space-y-6">
          <Chart.Container config={chartConfig} class="mx-auto aspect-square max-h-[300px]">
            <PieChart
              data={reportData.batches}
              key="label"
              value="value"
              c="fill"
              innerRadius={-20}
              cornerRadius={4}
              padAngle={0.02}
            />
          </Chart.Container>

          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {#each reportData.batches as item}
              <div
                class="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
              >
                <div class="flex items-center gap-2 truncate">
                  <div class="h-2 w-2 rounded-full" style="background-color: {item.fill}"></div>
                  <span class="truncate text-xs font-semibold text-foreground/80">{item.label}</span
                  >
                </div>
                <div class="flex shrink-0 items-center gap-2 italic">
                  <span class="text-xs font-bold text-foreground">{item.value}</span>
                  <span class="text-[10px] text-muted-foreground">({item.percentage})</span>
                </div>
              </div>
            {/each}
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Degrees -->
      <Card.Root class="xl:col-span-2">
        <Card.Header>
          <Card.Title class="flex items-center gap-2 text-lg">
            <GraduationCap class="h-5 w-5" />
            Resident Degree Programs
          </Card.Title>
          <Card.Description>All Programs</Card.Description>
        </Card.Header>
        <Card.Content class="space-y-8">
          <div class="flex flex-col gap-8 lg:flex-row lg:items-center">
            <Chart.Container
              config={chartConfig}
              class="mx-auto aspect-square w-full max-w-[350px]"
            >
              <PieChart
                data={reportData.degrees}
                key="label"
                value="value"
                c="fill"
                innerRadius={-20}
                cornerRadius={4}
                padAngle={0.02}
              />
            </Chart.Container>

            <div class="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
              {#each reportData.degrees as item}
                <div
                  class="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
                >
                  <div class="flex items-center gap-2 truncate">
                    <div class="h-2 w-2 rounded-full" style="background-color: {item.fill}"></div>
                    <span
                      class="truncate text-[11px] font-semibold text-foreground/80"
                      title={item.label}>{item.label}</span
                    >
                  </div>
                  <div class="flex shrink-0 items-center gap-2 italic">
                    <span class="text-xs font-bold text-foreground">{item.value}</span>
                    <span class="text-[10px] text-muted-foreground">({item.percentage})</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </Card.Content>
      </Card.Root>
    </div>
  {/if}
</div>
