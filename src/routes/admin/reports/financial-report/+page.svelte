<script lang="ts">
  import { onMount } from "svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { RefreshCcw, FileDown, TrendingUp, TrendingDown, Wallet } from "@lucide/svelte";
  import {
    formatAccounting,
    translateMop,
    translateType,
    getJournalDateRange
  } from "$lib/receipt-utils";
  import type { JournalRecord, ResidentRecord } from "$lib/schemas";
  import * as Table from "$lib/components/ui/table";
  import { computeFinancialReportData, fetchFinancialReportData } from "$lib/financial-report-pdf";
  import * as Chart from "$lib/components/ui/chart";
  import { PieChart } from "layerchart";

  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let allJournal = $state<JournalRecord[]>([]);
  let allAccounts = $state<ResidentRecord[]>([]);
  let availableMops = $state<{ value: string; label: string }[]>([]);
  let transactionTypes = $state<{ value: string; label: string }[]>([]);
  let periodStart = $state("");
  let periodEnd = $state("");

  let periodCovered = $derived.by(() => {
    if (!periodStart || !periodEnd) {
      return "N/A";
    }
    try {
      const start = new Date(periodStart).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      });
      const end = new Date(periodEnd).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      });
      return `${start} to ${end}`;
    } catch (e) {
      return `${periodStart} to ${periodEnd}`;
    }
  });

  // Derived data computations using shared computeFinancialReportData
  let reportData = $derived(
    computeFinancialReportData(
      allJournal.filter((j) => {
        return j.period === uiSettings.currentTerm.trim() && j.type !== "EOS";
      }),
      allAccounts.filter((r) => {
        return r.period === uiSettings.currentTerm.trim();
      }),
      availableMops
    )
  );

  let processedJournal = $derived(reportData.processedJournal);
  let totalIncoming = $derived(
    processedJournal.reduce((s, j) => {
      return s + j.incoming;
    }, 0)
  );
  let totalOutgoing = $derived(
    processedJournal.reduce((s, j) => {
      return s + j.outgoing;
    }, 0)
  );
  let netBalance = $derived(totalIncoming - totalOutgoing);
  let mopSummary = $derived(reportData.mopSummary);
  let fundSummary = $derived({
    feeSummary: reportData.feeSummary,
    feeTypeMopSummary: reportData.feeTypeMopSummary
  });
  let waterColl = $derived(reportData.waterColl);
  let assocColl = $derived(reportData.assocColl);

  const chartConfig = {
    value: { label: "Amount" },
    "chart-1": { label: "Group 1", color: "var(--chart-1)" },
    "chart-2": { label: "Group 2", color: "var(--chart-2)" },
    "chart-3": { label: "Group 3", color: "var(--chart-3)" },
    "chart-4": { label: "Group 4", color: "var(--chart-4)" },
    "chart-5": { label: "Group 5", color: "var(--chart-5)" }
  } as const;

  // Disbursements grouped by transaction type for the chart
  let disbursementChartData = $derived.by(() => {
    const groupMap: Record<string, number> = {};
    processedJournal.forEach((j) => {
      if (j.outgoing > 0) {
        const typeLabel = translateType(j.type, transactionTypes) || j.type;
        groupMap[typeLabel] = (groupMap[typeLabel] || 0) + j.outgoing;
      }
    });

    const entries = Object.entries(groupMap)
      .map(([label, value]) => {
        return {
          label,
          value,
          percentage: totalOutgoing > 0 ? ((value / totalOutgoing) * 100).toFixed(1) + "%" : "0%"
        };
      })
      .sort((a, b) => {
        return b.value - a.value;
      });

    return entries.map((item, i) => {
      return {
        ...item,
        fill: `var(--chart-${(i % 5) + 1})`
      };
    });
  });

  async function loadData() {
    if (!uiSettings.accountingWorkbookId) {
      return;
    }
    isLoading = true;
    error = null;

    try {
      const data = await fetchFinancialReportData(uiSettings.accountingWorkbookId);
      allJournal = data.allJournal;
      allAccounts = data.allAccounts;
      transactionTypes = data.transactionTypes;
      availableMops = data.availableMops;

      // Auto-Period
      const range = getJournalDateRange(processedJournal);
      if (range.start && range.end) {
        periodStart = range.start;
        periodEnd = range.end;
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);
</script>

<div class="space-y-6 pb-20">
  <SubpageHeader title="Financial Report" isTopLevel={true}>
    {#snippet actions()}
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onclick={() => {
            return loadData();
          }}
          {isLoading}
          icon={RefreshCcw}
        />
        <Button size="sm" href="/admin/reports/financial-report/export" icon={FileDown}>
          Export PDF
        </Button>
      </div>
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button
        variant="outline"
        size="sm"
        class="mt-2"
        onclick={() => {
          return loadData();
        }}
        {isLoading}
        icon={RefreshCcw}>Try Again</Button
      >
    </ErrorView>
  {:else}
    <div class="mx-auto max-w-5xl space-y-6">
      <!-- Scope / Term filter -->
      <div class="max-w-xs">
        <TermFilter
          onSelect={() => {
            return loadData();
          }}
        />
      </div>

      <!-- KPI Grid -->
      <div class="grid gap-4 sm:grid-cols-3">
        <!-- Incoming -->
        <Card.Root class="flex flex-col gap-3">
          <Card.Header class="flex flex-row items-center justify-between pb-0">
            <Card.Title class="text-sm font-semibold">Incoming</Card.Title>
            <div
              class="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-sm [&>svg]:h-[18px] [&>svg]:w-[18px]"
            >
              <TrendingUp />
            </div>
          </Card.Header>
          <Card.Content>
            <p class="text-3xl font-semibold tracking-tight">₱{formatAccounting(totalIncoming)}</p>
          </Card.Content>
        </Card.Root>

        <!-- Outgoing -->
        <Card.Root class="flex flex-col gap-3">
          <Card.Header class="flex flex-row items-center justify-between pb-0">
            <Card.Title class="text-sm font-semibold">Outgoing</Card.Title>
            <div
              class="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-sm [&>svg]:h-[18px] [&>svg]:w-[18px]"
            >
              <Wallet />
            </div>
          </Card.Header>
          <Card.Content>
            <p class="text-3xl font-semibold tracking-tight">₱{formatAccounting(totalOutgoing)}</p>
          </Card.Content>
        </Card.Root>

        <!-- Balance -->
        <Card.Root class="flex flex-col gap-3">
          <Card.Header class="flex flex-row items-center justify-between pb-0">
            <Card.Title class="text-sm font-semibold">Balance</Card.Title>
            <div
              class="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-sm [&>svg]:h-[18px] [&>svg]:w-[18px]"
            >
              {#if netBalance >= 0}
                <TrendingUp />
              {:else}
                <TrendingDown />
              {/if}
            </div>
          </Card.Header>
          <Card.Content>
            <p class="text-3xl font-semibold tracking-tight">₱{formatAccounting(netBalance)}</p>
          </Card.Content>
        </Card.Root>
      </div>

      <!-- ACCOUNT SUMMARY (Summary of Funds) -->
      <div class="space-y-3">
        <h3 class="text-base font-bold uppercase text-foreground">Account Summary</h3>

        <div class="space-y-6">
          <!-- Table 1: BY MODE OF PAYMENT -->
          <div class="rounded-xl border overflow-hidden">
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.Head>BY MODE OF PAYMENT¹</Table.Head>
                  <Table.Head class="text-right">INCOMING</Table.Head>
                  <Table.Head class="text-right">OUTGOING</Table.Head>
                  <Table.Head class="text-right">BALANCE</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each Object.entries(mopSummary) as [mop, data]}
                  <Table.Row>
                    <Table.Cell class="uppercase"
                      >{availableMops.find((m) => m.value === mop)?.label ||
                        translateMop(mop)}</Table.Cell
                    >
                    <Table.Cell class="text-right">{formatAccounting(data.incoming)}</Table.Cell>
                    <Table.Cell class="text-right">{formatAccounting(data.outgoing)}</Table.Cell>
                    <Table.Cell class="text-right"
                      >{formatAccounting(data.incoming - data.outgoing)}</Table.Cell
                    >
                  </Table.Row>
                {/each}
                <Table.Row class="font-bold bg-muted/30">
                  <Table.Cell>ENDING BALANCE</Table.Cell>
                  <Table.Cell class="text-right"></Table.Cell>
                  <Table.Cell class="text-right"></Table.Cell>
                  <Table.Cell class="text-right">{formatAccounting(netBalance)}</Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Root>
          </div>

          <!-- Table 2: BY FEE TYPE -->
          <div class="rounded-xl border overflow-hidden">
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.Head>BY FEE TYPE¹</Table.Head>
                  <Table.Head class="text-right">INCOMING</Table.Head>
                  <Table.Head class="text-right">OUTGOING</Table.Head>
                  <Table.Head class="text-right">BALANCE</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                <!-- WATER FEE Group -->
                <Table.Row class="font-bold">
                  <Table.Cell>WATER FEE</Table.Cell>
                  <Table.Cell class="text-right"
                    >{formatAccounting(fundSummary.feeSummary.WATER.incoming)}</Table.Cell
                  >
                  <Table.Cell class="text-right"
                    >{formatAccounting(fundSummary.feeSummary.WATER.outgoing)}</Table.Cell
                  >
                  <Table.Cell class="text-right"
                    >{formatAccounting(
                      fundSummary.feeSummary.WATER.incoming - fundSummary.feeSummary.WATER.outgoing
                    )}</Table.Cell
                  >
                </Table.Row>
                {#each Object.entries(fundSummary.feeTypeMopSummary.WATER) as [mop, data]}
                  <Table.Row>
                    <Table.Cell class="pl-6 uppercase"
                      >{availableMops.find((m) => m.value === mop)?.label ||
                        translateMop(mop)}</Table.Cell
                    >
                    <Table.Cell class="text-right">{formatAccounting(data.incoming)}</Table.Cell>
                    <Table.Cell class="text-right">{formatAccounting(data.outgoing)}</Table.Cell>
                    <Table.Cell class="text-right"
                      >{formatAccounting(data.incoming - data.outgoing)}</Table.Cell
                    >
                  </Table.Row>
                {/each}

                <!-- ASSOCIATION FEE Group -->
                <Table.Row class="font-bold">
                  <Table.Cell>ASSOCIATION FEE</Table.Cell>
                  <Table.Cell class="text-right"
                    >{formatAccounting(fundSummary.feeSummary.ASSOC.incoming)}</Table.Cell
                  >
                  <Table.Cell class="text-right"
                    >{formatAccounting(fundSummary.feeSummary.ASSOC.outgoing)}</Table.Cell
                  >
                  <Table.Cell class="text-right"
                    >{formatAccounting(
                      fundSummary.feeSummary.ASSOC.incoming - fundSummary.feeSummary.ASSOC.outgoing
                    )}</Table.Cell
                  >
                </Table.Row>
                {#each Object.entries(fundSummary.feeTypeMopSummary.ASSOC) as [mop, data]}
                  <Table.Row>
                    <Table.Cell class="pl-6 uppercase"
                      >{availableMops.find((m) => m.value === mop)?.label ||
                        translateMop(mop)}</Table.Cell
                    >
                    <Table.Cell class="text-right">{formatAccounting(data.incoming)}</Table.Cell>
                    <Table.Cell class="text-right">{formatAccounting(data.outgoing)}</Table.Cell>
                    <Table.Cell class="text-right"
                      >{formatAccounting(data.incoming - data.outgoing)}</Table.Cell
                    >
                  </Table.Row>
                {/each}

                <!-- MISCELLANEOUS Group -->
                <Table.Row class="font-bold">
                  <Table.Cell>MISCELLANEOUS</Table.Cell>
                  <Table.Cell class="text-right"
                    >{formatAccounting(fundSummary.feeSummary.MISC.incoming)}</Table.Cell
                  >
                  <Table.Cell class="text-right"
                    >{formatAccounting(fundSummary.feeSummary.MISC.outgoing)}</Table.Cell
                  >
                  <Table.Cell class="text-right"
                    >{formatAccounting(
                      fundSummary.feeSummary.MISC.incoming - fundSummary.feeSummary.MISC.outgoing
                    )}</Table.Cell
                  >
                </Table.Row>
                {#each Object.entries(fundSummary.feeTypeMopSummary.MISC) as [mop, data]}
                  <Table.Row>
                    <Table.Cell class="pl-6 uppercase"
                      >{availableMops.find((m) => m.value === mop)?.label ||
                        translateMop(mop)}</Table.Cell
                    >
                    <Table.Cell class="text-right">{formatAccounting(data.incoming)}</Table.Cell>
                    <Table.Cell class="text-right">{formatAccounting(data.outgoing)}</Table.Cell>
                    <Table.Cell class="text-right"
                      >{formatAccounting(data.incoming - data.outgoing)}</Table.Cell
                    >
                  </Table.Row>
                {/each}

                <!-- ENDING BALANCE final row -->
                <Table.Row class="font-bold bg-muted/30">
                  <Table.Cell>ENDING BALANCE</Table.Cell>
                  <Table.Cell class="text-right"></Table.Cell>
                  <Table.Cell class="text-right"></Table.Cell>
                  <Table.Cell class="text-right">{formatAccounting(netBalance)}</Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Root>
          </div>
        </div>
      </div>

      <!-- COLLECTION SUMMARY -->
      <div class="space-y-3">
        <h3 class="text-base font-bold uppercase text-foreground">Collection Summary</h3>
        <div class="rounded-xl border overflow-hidden">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head class="w-[180px]">CATEGORY</Table.Head>
                <Table.Head>DETAILS</Table.Head>
                <Table.Head class="text-right">AMOUNT</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              <!-- WATER FEE Group -->
              <Table.Row>
                <Table.Cell
                  rowspan={waterColl.aquaAltria > 0 ? 10 : 9}
                  class="font-bold align-middle border-r">WATER FEE</Table.Cell
                >
                <Table.Cell class="text-foreground">TARGET</Table.Cell>
                <Table.Cell class="text-right">{formatAccounting(waterColl.target)}</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell class="text-foreground">LESS: WAIVED</Table.Cell>
                <Table.Cell class="text-right">{formatAccounting(waterColl.waived)}</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell class="text-foreground">TOTAL COLLECTION FROM RESIDENTS</Table.Cell>
                <Table.Cell class="text-right">{formatAccounting(waterColl.resident)}</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell class="text-foreground">LESS: COLLECTION REFUNDS</Table.Cell>
                <Table.Cell class="text-right">{formatAccounting(waterColl.refunds)}</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell class="text-foreground">TOTAL COLLECTION FROM UHO</Table.Cell>
                <Table.Cell class="text-right">{formatAccounting(waterColl.uho)}</Table.Cell>
              </Table.Row>
              <Table.Row class="bg-muted/30 font-bold">
                <Table.Cell>TOTAL COLLECTION</Table.Cell>
                <Table.Cell class="text-right"
                  >{formatAccounting(
                    waterColl.resident - waterColl.refunds + waterColl.uho
                  )}</Table.Cell
                >
              </Table.Row>
              <Table.Row class="font-bold">
                <Table.Cell>OVERDUE ACCOUNTS²</Table.Cell>
                <Table.Cell class="text-right">{formatAccounting(waterColl.overdue)}</Table.Cell>
              </Table.Row>
              {#if waterColl.aquaAltria > 0}
                <Table.Row>
                  <Table.Cell class="text-foreground"
                    >PAID TO WATER SUPPLIER (AQUA ALTRIA)³</Table.Cell
                  >
                  <Table.Cell class="text-right"
                    >{formatAccounting(waterColl.aquaAltria)}</Table.Cell
                  >
                </Table.Row>
              {/if}
              <Table.Row>
                <Table.Cell class="text-foreground">PAID TO WATER SUPPLIER³</Table.Cell>
                <Table.Cell class="text-right">{formatAccounting(waterColl.paidToWater)}</Table.Cell
                >
              </Table.Row>
              <Table.Row class="bg-muted/40 font-bold">
                <Table.Cell>PAID TO WATER SUPPLIER (TOTAL)³</Table.Cell>
                <Table.Cell class="text-right"
                  >{formatAccounting(waterColl.aquaAltria + waterColl.paidToWater)}</Table.Cell
                >
              </Table.Row>

              <!-- ASSOCIATION FEE Group -->
              {#if assocColl.target > 0}
                <Table.Row class="border-t">
                  <Table.Cell rowspan={5} class="font-bold align-middle border-r"
                    >ASSOCIATION FEE</Table.Cell
                  >
                  <Table.Cell class="text-foreground">TARGET</Table.Cell>
                  <Table.Cell class="text-right">{formatAccounting(assocColl.target)}</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell class="text-foreground">LESS: WAIVED</Table.Cell>
                  <Table.Cell class="text-right">{formatAccounting(assocColl.waived)}</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell class="text-foreground">TOTAL COLLECTION FROM RESIDENTS</Table.Cell>
                  <Table.Cell class="text-right">{formatAccounting(assocColl.resident)}</Table.Cell>
                </Table.Row>
                <Table.Row class="font-bold">
                  <Table.Cell>LESS: COLLECTION REFUNDS</Table.Cell>
                  <Table.Cell class="text-right"
                    >{formatAccounting(assocColl.resident - assocColl.refunds)}</Table.Cell
                  >
                </Table.Row>
                <Table.Row class="font-bold">
                  <Table.Cell>OVERDUE ACCOUNTS²</Table.Cell>
                  <Table.Cell class="text-right">{formatAccounting(assocColl.overdue)}</Table.Cell>
                </Table.Row>
              {/if}
            </Table.Body>
          </Table.Root>
        </div>
      </div>

      <!-- DISBURSEMENT BY TYPE CHART -->
      {#if disbursementChartData.length > 0}
        <Card.Root>
          <Card.Header>
            <Card.Title class="flex items-center gap-2 text-lg">
              <TrendingDown class="h-5 w-5" />
              Disbursements by Transaction Type
            </Card.Title>
          </Card.Header>
          <Card.Content class="space-y-6">
            <Chart.Container config={chartConfig} class="mx-auto aspect-square max-h-[300px]">
              <PieChart
                data={disbursementChartData}
                key="label"
                value="value"
                c="fill"
                innerRadius={-20}
                cornerRadius={4}
                padAngle={0.02}
              />
            </Chart.Container>

            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {#each disbursementChartData as item}
                <div
                  class="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
                >
                  <div class="flex items-center gap-2 truncate">
                    <div class="h-2 w-2 rounded-full" style="background-color: {item.fill}"></div>
                    <span
                      class="truncate text-xs font-semibold text-foreground/80"
                      title={item.label}
                    >
                      {item.label}
                    </span>
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    <span class="text-xs font-bold text-foreground"
                      >₱{formatAccounting(item.value)}</span
                    >
                    <span class="text-xs text-muted-foreground">({item.percentage})</span>
                  </div>
                </div>
              {/each}
            </div>
          </Card.Content>
        </Card.Root>
      {/if}

      <!-- FOOTNOTES -->
      <div class="space-y-1.5 pt-6 text-xs text-foreground/80 leading-relaxed border-t mt-6">
        <p>
          ¹ Amounts may appear inflated due to internal transfers between accounts (e.g., Cash to
          GCash).
        </p>
        <p>
          ² Residents who have not settled their accounts by the due date and are considered to be
          in arrears.
        </p>
        <p>³ Period covered: {periodCovered} (excluding transaction fees).</p>
      </div>
    </div>
  {/if}
</div>
