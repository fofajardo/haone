<script lang="ts">
  import { auth } from "$lib/auth.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { ChevronLeft, Save, LoaderCircle } from "lucide-svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import RichEditor from "$lib/components/RichEditor.svelte";
  import { addAnnouncement } from "$lib/admin-logic";
  import { fetchUsers } from "$lib/resident-logic";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";

  let isSubmitting = $state(false);
  let formData = $state({
    title: "",
    content: "",
    startDate: new Date().toISOString().split("T")[0],
    expiryDate: "",
    isIndefinite: true,
    isAdminOnly: false,
    tags: ""
  });

  async function handleSave() {
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!formData.content.trim()) {
      toast.error("Content is required");
      return;
    }

    isSubmitting = true;
    try {
      const allUsers = await fetchUsers();
      const me = allUsers.find(
        (u) => u.email.toLowerCase() === (auth.user?.email || "").toLowerCase()
      );
      await addAnnouncement({
        id: crypto.randomUUID(),
        creatorId: me?.id || "",
        dateCreated: new Date().toISOString(),
        ...formData
      });
      toast.success("Announcement created");
      goto("/admin/announcements");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="space-y-6">
  <SubpageHeader title="New Announcement">
    {#snippet actions()}
      <Button variant="outline" size="sm" onclick={() => goto("/admin/announcements")}>
        <ChevronLeft class="mr-2 h-4 w-4" /> Back
      </Button>
    {/snippet}
  </SubpageHeader>

  <div class="mx-auto max-w-3xl">
    <div class="space-y-6 rounded-xl border bg-card p-6">
      <div class="space-y-2">
        <Label for="title" class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
          >Title</Label
        >
        <Input
          id="title"
          bind:value={formData.title}
          placeholder="Announcement Title"
          disabled={isSubmitting}
        />
      </div>

      <div class="space-y-2">
        <Label
          for="content"
          class="text-xs font-bold tracking-wider text-muted-foreground uppercase">Content</Label
        >
        <RichEditor
          bind:content={formData.content}
          placeholder="Announcement Details..."
          editable={!isSubmitting}
        />
      </div>

      <div class="grid gap-6 md:grid-cols-2">
        <div class="space-y-2">
          <Label
            for="start"
            class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
            >Start Date</Label
          >
          <Input type="date" id="start" bind:value={formData.startDate} disabled={isSubmitting} />
        </div>
        {#if !formData.isIndefinite}
          <div class="space-y-2">
            <Label
              for="end"
              class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
              >Expiry Date</Label
            >
            <Input type="date" id="end" bind:value={formData.expiryDate} disabled={isSubmitting} />
          </div>
        {/if}
      </div>

      <div class="flex items-center gap-8 py-2">
        <div class="flex items-center gap-2">
          <Checkbox id="indefinite" bind:checked={formData.isIndefinite} disabled={isSubmitting} />
          <Label for="indefinite" class="cursor-pointer font-bold">Indefinite</Label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox id="adminOnly" bind:checked={formData.isAdminOnly} disabled={isSubmitting} />
          <Label for="adminOnly" class="cursor-pointer font-bold">Admin Only</Label>
        </div>
      </div>

      <div class="space-y-2">
        <Label for="tags" class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
          >Tags (comma-separated)</Label
        >
        <Input
          id="tags"
          bind:value={formData.tags}
          placeholder="Important, News, Maintenance"
          disabled={isSubmitting}
        />
      </div>

      <div class="flex justify-end gap-3 border-t pt-6">
        <Button
          variant="outline"
          onclick={() => goto("/admin/announcements")}
          disabled={isSubmitting}>Cancel</Button
        >
        <Button onclick={handleSave} disabled={isSubmitting} class="min-w-[140px]">
          {#if isSubmitting}
            <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
            Saving…
          {:else}
            <Save class="mr-2 h-4 w-4" /> Save
          {/if}
        </Button>
      </div>
    </div>
  </div>
</div>
