<script lang="ts">
  import { ArrowRight } from "lucide-svelte";

  let {
    title,
    description,
    href,
    icon: Icon,
    color = "text-brand",
    bg = "bg-brand/10",
    border = "hover:border-brand/50"
  } = $props<{
    title: string;
    description: string;
    href: string;
    icon: any;
    color?: string;
    bg?: string;
    border?: string;
  }>();
</script>

<a
  {href}
  class="group relative flex flex-col gap-3 rounded-2xl border-2 bg-card p-5 transition-all duration-300 hover:shadow-xl {border}"
>
  <div class="w-fit rounded-xl {bg} p-2.5 {color}">
    <Icon class="h-6 w-6" />
  </div>
  <div class="pr-8">
    <h3 class="font-bold text-foreground">{title}</h3>
    <p class="mt-1 line-clamp-2 text-sm text-muted-foreground">
      {description}
    </p>
  </div>
  <div
    class="absolute right-5 bottom-5 translate-x-4 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
  >
    <ArrowRight class="h-5 w-5 {color}" />
  </div>
</a>
