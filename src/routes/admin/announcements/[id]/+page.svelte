<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { auth } from "$lib/auth.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { ChevronLeft, Save, LoaderCircle } from "lucide-svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import RichEditor from "$lib/components/RichEditor.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import { fetchAnnouncements, updateAnnouncement } from "$lib/admin-logic";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";

  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);

  let formData = $state({
    title: "",
    content: "",
    startDate: "",
    expiryDate: "",
    isIndefinite: false,
    isAdminOnly: false,
    tags: ""
  });

  async function loadData() {
    const id = page.params.id;
    isLoading = true;
    try {
      const announcements = await fetchAnnouncements();
      const a = announcements.find((item) => item.id === id);
      if (!a) {
        error = "Announcement not found";
        return;
      }
      formData = {
        title: a.title,
        content: a.content,
        startDate: a.startDate,
        expiryDate: a.expiryDate,
        isIndefinite: a.isIndefinite,
        isAdminOnly: a.isAdminOnly,
        tags: a.tags
      };
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);

  async function handleSave() {
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const id = page.params.id;
    if (!id) return;

    isSubmitting = true;
    try {
      await updateAnnouncement(id, formData);
      toast.success("Announcement updated");
      goto("/admin/announcements");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="space-y-6">
  <SubpageHeader title="Edit Announcement">
    {#snippet actions()}
      <Button variant="outline" size="sm" onclick={() => goto("/admin/announcements")}>
        <ChevronLeft class="mr-2 h-4 w-4" /> Back
      </Button>
    {/snippet}
  </SubpageHeader>

  <div class="mx-auto max-w-3xl">
    {#if isLoading}
      <LoadingView text="Loading announcement..." />
    {:else if error}
      <ErrorView {error} />
    {:else}
      <div class="space-y-6 rounded-xl border bg-card p-6">
        <div class="space-y-2">
          <Label
            for="title"
            class="text-xs font-bold tracking-wider text-muted-foreground uppercase">Title</Label
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
              <Input
                type="date"
                id="end"
                bind:value={formData.expiryDate}
                disabled={isSubmitting}
              />
            </div>
          {/if}
        </div>

        <div class="flex items-center gap-8 py-2">
          <div class="flex items-center gap-2">
            <Checkbox
              id="indefinite"
              bind:checked={formData.isIndefinite}
              disabled={isSubmitting}
            />
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
              Updating…
            {:else}
              <Save class="mr-2 h-4 w-4" /> Update Announcement
            {/if}
          </Button>
        </div>
      </div>
    {/if}
  </div>
</div>
