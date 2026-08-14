<script lang="ts">
  import type { AchievementRecord } from "$lib/types";
  import { Zap, Lock } from "@lucide/svelte";

  let {
    achievement,
    isEarned = true,
    percentage = 0,
    href,
    showStatusBadge = false,
    lockedCount = 0,
    unlockedAt
  } = $props<{
    achievement: AchievementRecord;
    isEarned?: boolean;
    percentage: number;
    href: string;
    showStatusBadge?: boolean;
    lockedCount?: number;
    unlockedAt?: string;
  }>();

  // Only navigate when earned (or not using status badge i.e. admin)
  const isClickable = $derived(!showStatusBadge || isEarned);
  const isConsolidated = $derived(lockedCount > 1);

  const formattedUnlockedAt = $derived.by(() => {
    if (!unlockedAt) {
      return "";
    }
    try {
      const d = new Date(unlockedAt);
      if (isNaN(d.getTime())) {
        return unlockedAt;
      }
      const day = d.getDate();
      const month = d.toLocaleDateString("en-US", { month: "short" });
      const year = d.getFullYear();

      const hasTime =
        unlockedAt.includes("T") || unlockedAt.includes(":") || unlockedAt.includes(" ");
      if (hasTime && (d.getHours() !== 0 || d.getMinutes() !== 0 || unlockedAt.includes(":"))) {
        const time = d
          .toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true
          })
          .toLowerCase();
        return `${day} ${month}, ${year} @ ${time}`;
      }
      return `${day} ${month}, ${year}`;
    } catch {
      return unlockedAt;
    }
  });
</script>

{#if isClickable}
  <a
    {href}
    class="group relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-md border border-border/40 bg-muted/40 p-3 transition-colors hover:border-border hover:bg-muted/60"
  >
    <!-- Steam-style Progress Bar Fill Background -->
    {#if percentage > 0}
      <div
        class="pointer-events-none absolute inset-y-0 left-0 bg-primary/10 transition-all duration-500 group-hover:bg-primary/15"
        style="width: {Math.min(100, Math.max(0, percentage))}%;"
      ></div>
    {/if}

    <!-- Left: Icon & Info -->
    <div class="relative z-10 flex min-w-0 items-center gap-3.5">
      <!-- Steam-style Achievement Icon Frame -->
      <div
        class="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-border/70 bg-background/90 text-2xl shadow-inner transition-transform group-hover:scale-105"
      >
        {#if achievement.icon}
          <span>{achievement.icon}</span>
        {:else}
          <Zap class="h-6 w-6 text-amber-500" />
        {/if}
      </div>

      <div class="min-w-0 flex-1 space-y-0.5">
        <span
          class="block truncate font-bold tracking-tight text-foreground group-hover:text-primary"
        >
          {achievement.name}
        </span>
        {#if achievement.description}
          <p class="line-clamp-2 text-xs text-muted-foreground">
            {achievement.description}
          </p>
        {/if}
      </div>
    </div>

    <!-- Right: XP Badge & Unlock Date / Percentage Stats -->
    <div class="relative z-10 flex shrink-0 flex-col items-end gap-1 text-right">
      {#if achievement.points}
        <span
          class="inline-flex items-center gap-0.5 rounded border border-border/50 bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
        >
          +{achievement.points} XP
        </span>
      {/if}
      {#if formattedUnlockedAt}
        <span class="text-xs whitespace-nowrap text-muted-foreground">
          Unlocked {formattedUnlockedAt}
        </span>
      {:else if percentage > 0}
        <span class="text-xs whitespace-nowrap text-muted-foreground">
          {percentage}% of residents
        </span>
      {/if}
    </div>
  </a>
{:else}
  <div
    class="flex w-full items-center justify-between gap-4 rounded-md border border-border/20 bg-muted/10 p-3 opacity-60"
  >
    <div class="flex min-w-0 items-center gap-3.5">
      <div
        class="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-border/30 bg-background/40 text-muted-foreground"
      >
        <Lock class="h-5 w-5" />
      </div>

      <div class="min-w-0 flex-1 space-y-0.5">
        <span class="block truncate font-semibold tracking-tight text-muted-foreground">
          {achievement.name ||
            (isConsolidated ? `${lockedCount} Hidden Achievements` : "Hidden Achievement")}
        </span>
        <p class="line-clamp-2 text-xs text-muted-foreground/80">
          {achievement.description ||
            (isConsolidated
              ? "Keep participating in dormitory activities to reveal…"
              : "Complete dormitory activities to unlock…")}
        </p>
      </div>
    </div>

    <!-- Right: XP Badge if present -->
    {#if achievement.points}
      <div class="shrink-0 text-right">
        <span
          class="inline-flex items-center gap-0.5 rounded border border-border/30 bg-background/40 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground/70"
        >
          +{achievement.points} XP
        </span>
      </div>
    {/if}
  </div>
{/if}
