<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import type { AchievementRecord } from "$lib/schemas";
  import { Zap } from "@lucide/svelte";

  let {
    achievement,
    isEarned = true,
    percentage = 0,
    earnersCount = 0,
    href,
    showStatusBadge = false,
    lockedCount = 0
  } = $props<{
    achievement: AchievementRecord;
    isEarned?: boolean;
    percentage: number;
    earnersCount?: number;
    href: string;
    showStatusBadge?: boolean;
    lockedCount?: number;
  }>();

  // Only navigate when earned (or not using status badge i.e. admin)
  const isClickable = $derived(!showStatusBadge || isEarned);
  const isConsolidated = $derived(lockedCount > 1);
</script>

{#if isClickable}
  <a {href} class="group block h-full">
    <Card.Root
      class="flex flex-col h-full transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
    >
      <Card.Header>
        <div class="flex items-center justify-between">
          <div class="text-5xl transition-transform duration-500 group-hover:scale-110">
            {achievement.icon || "🏆"}
          </div>
          <Badge variant="outline" class="gap-1 border-brand/30 bg-brand/5 text-brand">
            <Zap class="h-3.5 w-3.5" />
            {achievement.points || 0} XP
          </Badge>
        </div>
        <Card.Title class="mt-4 text-xl font-bold">{achievement.name}</Card.Title>
        <Card.Description class="mt-1 line-clamp-2">
          <div class="text-sm font-semibold">
            {percentage}% of residents have this achievement
          </div>
          <div>{achievement.description}</div>
        </Card.Description>
      </Card.Header>
    </Card.Root>
  </a>
{:else}
  <div class="h-full cursor-default select-none">
    <Card.Root class="flex flex-col h-full bg-black text-white border-neutral-800">
      <Card.Header>
        <div class="flex items-center justify-between">
          <div class="text-5xl">👀</div>
        </div>
        <Card.Title class="mt-4 text-xl font-bold text-white">
          {isConsolidated
            ? `${lockedCount} hidden achievement${lockedCount === 1 ? "" : "s"} remaining`
            : "???"}
        </Card.Title>
        <Card.Description class="mt-1 text-neutral-400">
          {isConsolidated ? "Keep participating to unlock them…" : "Earn this to reveal…"}
        </Card.Description>
      </Card.Header>
    </Card.Root>
  </div>
{/if}
