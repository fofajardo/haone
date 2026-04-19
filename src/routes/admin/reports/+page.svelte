<script lang="ts">
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import { HandCoins, Users, ChartPie, ArrowRight } from "lucide-svelte";

  const reports = [
    {
      title: "Financial Report",
      description:
        "Generate a comprehensive financial statement with account summaries, collection breakdowns, and transaction details.",
      href: "/admin/reports/financial-report",
      icon: HandCoins,
      color: "text-brand",
      bg: "bg-brand/10"
    },
    {
      title: "Resident List",
      description:
        "Export lists of residents filtered by payment status to PDF, CSV, or Google Sheets.",
      href: "/admin/reports/resident-list",
      icon: Users,
      color: "text-brand",
      bg: "bg-brand/10"
    },
    {
      title: "Demographics",
      description:
        "Analyze resident distribution by college, program, and year level with visual charts and trends.",
      href: "/admin/reports/demographics",
      icon: ChartPie,
      color: "text-brand",
      bg: "bg-brand/10"
    }
  ];
</script>

<div class="space-y-6">
  <SubpageHeader title="Reports" isTopLevel={true} />

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each reports as report}
      <a
        href={report.href}
        class="group relative flex h-full flex-col gap-3 rounded-2xl border-2 bg-card p-5 transition-all duration-300 hover:border-brand/50 hover:shadow-xl"
      >
        <div class={`w-fit rounded-xl ${report.bg} p-2.5 ${report.color}`}>
          <report.icon class="h-6 w-6" />
        </div>
        <div>
          <h3 class="font-bold text-foreground">{report.title}</h3>
          <p class="mt-1 text-sm text-muted-foreground">
            {report.description}
          </p>
        </div>
        <div
          class="absolute right-5 bottom-5 translate-x-4 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
        >
          <ArrowRight class={`h-5 w-5 ${report.color}`} />
        </div>
      </a>
    {/each}
  </div>
</div>
