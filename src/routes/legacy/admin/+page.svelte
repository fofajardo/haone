<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { FileText, Mail, ArrowRight, ShieldCheck } from "lucide-svelte";
  import { auth } from "$lib/auth.svelte";

  const tools = [
    {
      title: "Receipt Manager",
      description: "Process payment exports and generate secure receipt links.",
      href: "/legacy/admin/receipts",
      icon: FileText,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      title: "Email Manager",
      description: "Batch send receipts to residents using the Gmail API.",
      href: "/legacy/admin/emails",
      icon: Mail,
      color: "text-purple-500",
      bg: "bg-purple-500/10"
    }
  ];
</script>

<div class="space-y-10">
  <div class="space-y-2">
    <div
      class="flex items-center gap-2 text-sm font-semibold tracking-wider text-primary uppercase"
    >
      <ShieldCheck class="h-4 w-4" />
      Admin Console
    </div>
    <h1 class="text-4xl font-extrabold tracking-tight lg:text-5xl">
      Welcome back, {auth.user?.name.split(" ")[0]}
    </h1>
    <p class="max-w-[600px] text-xl text-muted-foreground">
      Manage receipts, communications, and associations from your centralized dashboard.
    </p>
  </div>

  <div class="grid gap-6 md:grid-cols-2">
    {#each tools as tool}
      <Card.Root
        class="group relative overflow-hidden border-2 shadow-sm transition-all duration-300 hover:border-primary/50 hover:shadow-xl"
      >
        <div
          class={`absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full ${tool.bg} blur-3xl transition-transform duration-500 group-hover:scale-150`}
        ></div>

        <Card.Header>
          <div class={`mb-4 w-fit rounded-xl ${tool.bg} p-3 ${tool.color}`}>
            <tool.icon class="h-8 w-8" />
          </div>
          <Card.Title class="text-2xl">{tool.title}</Card.Title>
          <Card.Description class="text-base leading-relaxed">
            {tool.description}
          </Card.Description>
        </Card.Header>

        <Card.Content>
          <Button
            href={tool.href}
            variant="ghost"
            class="group/btn p-0 font-semibold text-primary hover:bg-transparent"
          >
            Launch
            <ArrowRight class="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
          </Button>
        </Card.Content>

        <a href={tool.href} class="absolute inset-0"
          ><span class="sr-only">Go to {tool.title}</span></a
        >
      </Card.Root>
    {/each}
  </div>
</div>
