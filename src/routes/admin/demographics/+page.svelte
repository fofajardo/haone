<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import ContentHeader from "$components/ContentHeader.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import {
    RefreshCcw,
    GraduationCap,
    School,
    CalendarDays,
    Calendar,
    RotateCcwClockIcon
  } from "@lucide/svelte";
  import { Button } from "$ui/button";
  import { uiSettings } from "$state/settings.svelte";
  import * as Tabs from "$ui/tabs";
  import * as Card from "$ui/card";
  import * as Chart from "$ui/chart";
  import { PieChart, LineChart, Tooltip } from "layerchart";
  import { translateCollege, translateProgram, translatePeriod } from "$utils/translators";

  import { fetchResidents } from "$api/controllers/resident-controller";

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
  }

  interface HistoricalPoint {
    term: string;
    termLabel: string;
    [seriesKey: string]: any;
  }

  interface HistoricalData {
    collegesData: HistoricalPoint[];
    collegesSeries: { key: string; label: string; color: string }[];
    batchesData: HistoricalPoint[];
    batchesSeries: { key: string; label: string; color: string }[];
  }

  let activeTab = $state<"term" | "historical">("term");
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let reportData = $state<ReportData>({
    colleges: [],
    degrees: [],
    batches: []
  });

  let historicalData = $state<HistoricalData>({
    collegesData: [],
    collegesSeries: [],
    batchesData: [],
    batchesSeries: []
  });

  const chartConfig = {
    value: { label: "Residents" },
    "chart-1": { label: "Group 1", color: "var(--chart-1)" },
    "chart-2": { label: "Group 2", color: "var(--chart-2)" },
    "chart-3": { label: "Group 3", color: "var(--chart-3)" },
    "chart-4": { label: "Group 4", color: "var(--chart-4)" },
    "chart-5": { label: "Group 5", color: "var(--chart-5)" }
  } as const;

  const PALETTE = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#84cc16"
  ];

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;

    try {
      const allResidents = await fetchResidents(bypassCache);
      const accounts = allResidents.filter(
        (r) => !uiSettings.currentTerm || r.period === uiSettings.currentTerm
      );

      const totalResidents = accounts.length;
      if (totalResidents === 0) {
        reportData = { colleges: [], degrees: [], batches: [] };
      } else {
        const collegesMap: Record<string, number> = {};
        const degreesMap: Record<string, number> = {};
        const batchesMap: Record<string, number> = {};

        accounts.forEach((res) => {
          if (!res) {
            return;
          }

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
          batches: mapToItems(batchesMap).sort((a, b) => b.label.localeCompare(a.label))
        };
      }

      // ── Historical Processing across all terms ──
      const termResidentCounts: Record<string, number> = {};
      allResidents.forEach((r) => {
        const p = r.period?.trim();
        if (p) {
          termResidentCounts[p] = (termResidentCounts[p] || 0) + 1;
        }
      });

      // Exclude midyear terms (ends with _MY) and terms with <= 1 resident
      const sortedTerms = Object.keys(termResidentCounts)
        .filter((t) => !t.toUpperCase().endsWith("_MY") && !t.toUpperCase().includes("MIDYEAR"))
        .filter((t) => termResidentCounts[t] > 1)
        .sort();

      // Track totals by term for colleges, batches
      const termCollegeCounts: Record<string, Record<string, number>> = {};
      const termBatchCounts: Record<string, Record<string, number>> = {};

      const allCollegesSet = new Set<string>();
      const allBatchesSet = new Set<string>();

      sortedTerms.forEach((t) => {
        termCollegeCounts[t] = {};
        termBatchCounts[t] = {};
      });

      allResidents.forEach((res) => {
        const period = res.period?.trim();
        if (!period || !termCollegeCounts[period]) {
          return;
        }

        const collegesArr = translateCollege(res.college);
        const college = collegesArr[collegesArr.length - 1];
        if (college && college !== "—") {
          termCollegeCounts[period][college] = (termCollegeCounts[period][college] || 0) + 1;
          allCollegesSet.add(college);
        }

        const stno = res.stno?.trim() || "";
        if (stno.length >= 4) {
          const batch = stno.substring(0, 4);
          if (/^\d{4}$/.test(batch)) {
            termBatchCounts[period][batch] = (termBatchCounts[period][batch] || 0) + 1;
            allBatchesSet.add(batch);
          }
        }
      });

      const buildHistoricalData = (
        allKeys: string[],
        countsByTerm: Record<string, Record<string, number>>,
        topCount?: number
      ) => {
        const totalPerKey: Record<string, number> = {};
        allKeys.forEach((k) => {
          totalPerKey[k] = sortedTerms.reduce((sum, t) => sum + (countsByTerm[t]?.[k] || 0), 0);
        });
        const sortedKeys = [...allKeys].sort((a, b) => totalPerKey[b] - totalPerKey[a]);
        const primaryKeys = topCount ? sortedKeys.slice(0, topCount) : sortedKeys;

        const series = primaryKeys.map((key, i) => ({
          key,
          label: key,
          color: PALETTE[i % PALETTE.length]
        }));

        const data: HistoricalPoint[] = sortedTerms.map((term) => {
          const point: HistoricalPoint = {
            term,
            termLabel: translatePeriod(term)
          };
          primaryKeys.forEach((key) => {
            point[key] = countsByTerm[term]?.[key] || 0;
          });
          return point;
        });

        return { data, series };
      };

      const collegesHist = buildHistoricalData(Array.from(allCollegesSet), termCollegeCounts, 8);
      const batchesHist = buildHistoricalData(Array.from(allBatchesSet), termBatchCounts, 8);

      historicalData = {
        collegesData: collegesHist.data,
        collegesSeries: collegesHist.series,
        batchesData: batchesHist.data,
        batchesSeries: batchesHist.series
      };
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Demographics";
  });

  $effect(() => {
    uiSettings.currentTerm;
    loadData();
  });
</script>

<Tabs.Root bind:value={activeTab} class="space-y-4">
  <div class="mx-auto max-w-7xl space-y-3">
    <ContentHeader
      title="Demographics"
      isTopLevel={true}
      onRefresh={() => loadData(true)}
      isRefreshing={isLoading}
    >
      {#snippet tabs()}
        <Tabs.List>
          <Tabs.Trigger value="term" class="flex items-center gap-1.5">
            <Calendar class="h-3.5 w-3.5" />
            Term
          </Tabs.Trigger>
          <Tabs.Trigger value="historical" class="flex items-center gap-1.5">
            <RotateCcwClockIcon class="h-3.5 w-3.5" />
            Historical
          </Tabs.Trigger>
        </Tabs.List>
      {/snippet}
    </ContentHeader>

    {#if isLoading}
      <LoadingView />
    {:else if error}
      <ErrorView {error}>
        <Button
          variant="outline"
          size="sm"
          class="mt-2"
          onclick={() => loadData()}
          {isLoading}
          icon={RefreshCcw}>Try Again</Button
        >
      </ErrorView>
    {:else}
      <!-- Term Tab -->
      <Tabs.Content value="term" class="space-y-6">
        <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
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
              <Chart.Container config={chartConfig} class="mx-auto aspect-square max-h-75">
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
                      <span
                        class="truncate text-xs font-semibold text-foreground/80"
                        title={item.label}>{item.label}</span
                      >
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                      <span class="text-xs font-bold text-foreground">{item.value}</span>
                      <span class="text-xs text-muted-foreground">({item.percentage})</span>
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
              <Chart.Container config={chartConfig} class="mx-auto aspect-square max-h-75">
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
                      <span class="truncate text-xs font-semibold text-foreground/80"
                        >{item.label}</span
                      >
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                      <span class="text-xs font-bold text-foreground">{item.value}</span>
                      <span class="text-xs text-muted-foreground">({item.percentage})</span>
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
                  class="mx-auto aspect-square w-full max-w-87.5"
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
                        <div
                          class="h-2 w-2 rounded-full"
                          style="background-color: {item.fill}"
                        ></div>
                        <span
                          class="truncate text-xs font-semibold text-foreground/80"
                          title={item.label}>{item.label}</span
                        >
                      </div>
                      <div class="flex shrink-0 items-center gap-2">
                        <span class="text-xs font-bold text-foreground">{item.value}</span>
                        <span class="text-xs text-muted-foreground">({item.percentage})</span>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            </Card.Content>
          </Card.Root>
        </div>
      </Tabs.Content>

      <!-- Historical Tab -->
      <Tabs.Content value="historical" class="space-y-6">
        <!-- Historical Colleges -->
        <Card.Root>
          <Card.Header>
            <Card.Title class="flex items-center gap-2 text-lg">
              <School class="h-5 w-5" />
              Resident Colleges Trend
            </Card.Title>
            <Card.Description>Resident count per college across academic terms</Card.Description>
          </Card.Header>
          <Card.Content class="space-y-6">
            {#if historicalData.collegesData.length > 0}
              <div class="h-80 w-full">
                <LineChart
                  data={historicalData.collegesData}
                  x="term"
                  series={historicalData.collegesSeries}
                  props={{
                    xAxis: {
                      format: (d) => translatePeriod(d)
                    }
                  }}
                >
                  {#snippet tooltip({ context })}
                    <Tooltip.Root {context}>
                      <Tooltip.Header
                        value={context.tooltip.data
                          ? translatePeriod(context.tooltip.data.term)
                          : ""}
                      />
                      <Tooltip.List>
                        {#each context.tooltip.series.filter((s) => s.visible) as s}
                          {#if context.series.isHighlighted(s.key, true)}
                            <Tooltip.Item
                              label={s.label}
                              value={s.value}
                              color={s.color}
                              data-highlighted={context.series.isHighlighted(s.key, true)}
                              valueAlign="right"
                              onpointerenter={() => (context.series.highlightKey = s.key)}
                              onpointerleave={() => (context.series.highlightKey = null)}
                            />
                          {/if}
                        {/each}
                      </Tooltip.List>
                    </Tooltip.Root>
                  {/snippet}
                </LineChart>
              </div>

              <div class="flex flex-wrap gap-3 pt-2">
                {#each historicalData.collegesSeries as s}
                  <div
                    class="flex items-center gap-1.5 rounded-md border bg-muted/20 px-2.5 py-1 text-xs"
                  >
                    <span class="h-2.5 w-2.5 rounded-full" style="background-color: {s.color}"
                    ></span>
                    <span class="font-medium text-foreground">{s.label}</span>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="py-12 text-center text-xs text-muted-foreground">
                No historical records available.
              </div>
            {/if}
          </Card.Content>
        </Card.Root>

        <!-- Historical Batches -->
        <Card.Root>
          <Card.Header>
            <Card.Title class="flex items-center gap-2 text-lg">
              <CalendarDays class="h-5 w-5" />
              Resident Batches Trend
            </Card.Title>
            <Card.Description>Admission batch trends across academic terms</Card.Description>
          </Card.Header>
          <Card.Content class="space-y-6">
            {#if historicalData.batchesData.length > 0}
              <div class="h-80 w-full">
                <LineChart
                  data={historicalData.batchesData}
                  x="term"
                  series={historicalData.batchesSeries}
                  props={{
                    xAxis: {
                      format: (d) => translatePeriod(d)
                    }
                  }}
                >
                  {#snippet tooltip({ context })}
                    <Tooltip.Root {context}>
                      <Tooltip.Header
                        value={context.tooltip.data
                          ? translatePeriod(context.tooltip.data.term)
                          : ""}
                      />
                      <Tooltip.List>
                        {#each context.tooltip.series.filter((s) => s.visible) as s}
                          {#if context.series.isHighlighted(s.key, true)}
                            <Tooltip.Item
                              label={`Batch ${s.label}`}
                              value={s.value}
                              color={s.color}
                              data-highlighted={context.series.isHighlighted(s.key, true)}
                              valueAlign="right"
                              onpointerenter={() => (context.series.highlightKey = s.key)}
                              onpointerleave={() => (context.series.highlightKey = null)}
                            />
                          {/if}
                        {/each}
                      </Tooltip.List>
                    </Tooltip.Root>
                  {/snippet}
                </LineChart>
              </div>

              <div class="flex flex-wrap gap-3 pt-2">
                {#each historicalData.batchesSeries as s}
                  <div
                    class="flex items-center gap-1.5 rounded-md border bg-muted/20 px-2.5 py-1 text-xs"
                  >
                    <span class="h-2.5 w-2.5 rounded-full" style="background-color: {s.color}"
                    ></span>
                    <span class="font-medium text-foreground">Batch {s.label}</span>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="py-12 text-center text-xs text-muted-foreground">
                No historical records available.
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </Tabs.Content>
    {/if}
  </div>
</Tabs.Root>
