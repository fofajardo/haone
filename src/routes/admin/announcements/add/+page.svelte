<script lang="ts">
  import { onMount } from "svelte";
  import { pageState } from "$state/page-info.svelte";
  import dayjs from "dayjs";
  import { auth } from "$state/auth.svelte";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Checkbox } from "$ui/checkbox";
  import { ChevronLeft, Save } from "@lucide/svelte";
  import ContentHeader from "$components/ContentHeader.svelte";
  import RichEditor from "$components/RichEditor.svelte";
  import { addAnnouncement } from "$api/controllers/announcement-controller";
  import { fetchUsers } from "$api/controllers/resident-controller";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { ANNOUNCEMENT_TAG_LIST } from "$lib/types";
  import { TagsInput } from "$ui/tags-input";
  import slugify from "slug";

  let isSubmitting = $state(false);
  let tagList = $state<string[]>([]);
  let isSlugManuallyEdited = $state(false);
  let editorActions: { uploadImages: () => Promise<void> } | undefined = $state();

  let formData = $state({
    title: "",
    slug: "",
    content: "",
    startDate: dayjs().format("YYYY-MM-DDTHH:mm"),
    expiryDate: "",
    isIndefinite: true,
    isAdminOnly: false,
    isUnlisted: false,
    tags: ""
  });

  $effect(() => {
    if (!isSlugManuallyEdited && formData.title) {
      formData.slug = slugify(formData.title, { lower: true });
    }
  });

  async function handleSave() {
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!formData.slug.trim()) {
      toast.error("Slug is required");
      return;
    }
    if (!formData.content.trim()) {
      toast.error("Content is required");
      return;
    }

    isSubmitting = true;
    try {
      if (editorActions) {
        await editorActions.uploadImages();
      }
      await addAnnouncement({
        id: crypto.randomUUID(),
        creatorId: auth.userId,
        dateCreated: dayjs().toISOString(),
        ...formData,
        startDate: formData.startDate ? dayjs(formData.startDate).toISOString() : "",
        expiryDate: formData.expiryDate ? dayjs(formData.expiryDate).toISOString() : "",
        tags: tagList.join(","),
        broadcastCount: 0
      });

      toast.success("Announcement created");
      goto("/admin/announcements");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSubmitting = false;
    }
  }

  onMount(() => {
    pageState.title = "Add Announcement";
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader title="Add Announcement" />

  <div class="mx-auto max-w-3xl">
    <div class="space-y-6 rounded-xl border bg-card p-6">
      <div class="space-y-2">
        <Label for="title">Title</Label>
        <Input
          id="title"
          bind:value={formData.title}
          placeholder="Announcement Title"
          disabled={isSubmitting}
        />
      </div>

      <div class="space-y-2">
        <Label for="slug">Slug</Label>
        <Input
          id="slug"
          bind:value={formData.slug}
          placeholder="announcement-slug"
          disabled={isSubmitting}
          oninput={() => (isSlugManuallyEdited = true)}
        />
        <p class="text-xs text-muted-foreground">This will be used for the announcement URL.</p>
      </div>

      <div class="space-y-2">
        <Label for="content">Content</Label>
        <RichEditor
          bind:content={formData.content}
          bind:actions={editorActions}
          placeholder="Announcement Details..."
          editable={!isSubmitting}
        />
      </div>

      <div class="grid gap-6 md:grid-cols-2">
        <div class="space-y-2">
          <Label for="start">Start Date & Time</Label>
          <Input
            type="datetime-local"
            id="start"
            bind:value={formData.startDate}
            disabled={isSubmitting}
          />
        </div>
        {#if !formData.isIndefinite}
          <div class="space-y-2">
            <Label for="end">Expiry Date & Time</Label>
            <Input
              type="datetime-local"
              id="end"
              bind:value={formData.expiryDate}
              disabled={isSubmitting}
            />
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
        <div class="flex items-center gap-2">
          <Checkbox id="unlisted" bind:checked={formData.isUnlisted} disabled={isSubmitting} />
          <Label for="unlisted" class="cursor-pointer font-bold">Unlisted</Label>
        </div>
      </div>

      <div class="space-y-2">
        <Label for="tags">Tags</Label>
        <TagsInput
          id="tags"
          bind:value={tagList}
          suggestions={ANNOUNCEMENT_TAG_LIST}
          placeholder="Add tags…"
          disabled={isSubmitting}
        />
      </div>

      <div class="flex justify-end gap-3 border-t pt-6">
        <Button onclick={handleSave} isLoading={isSubmitting} icon={Save} class="min-w-35">
          Save
        </Button>
      </div>
    </div>
  </div>
</div>
