<script lang="ts">
  let {
    title,
    description,
    href,
    icon: Icon
  } = $props<{
    title: string;
    description: string;
    href: string;
    icon: any;
  }>();
</script>

<a {href} class="group relative flex h-full gap-4 rounded-2xl border-2 border-transparent bg-card">
  <div
    class="h-fit w-fit shrink-0 rounded-xl bg-brand/10 p-2.5 text-brand transition-all duration-300 group-hover:bg-brand/20"
  >
    <Icon class="h-6 w-6" />
  </div>
  <div>
    <span class="font-bold text-foreground">{title}</span>
    <p class="line-clamp-1 text-sm text-muted-foreground md:line-clamp-2">
      {description}
    </p>
  </div>
</a>
