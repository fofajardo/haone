<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import dayjs from "dayjs";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Checkbox } from "$ui/checkbox";
  import { Save, Archive, Trash2 } from "@lucide/svelte";
  import ContentHeader, { type HeaderAction } from "$components/content/ContentHeader.svelte";
  import RichTextEditor from "$components/editor/RichTextEditor.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import {
    fetchAdminAnnouncements,
    updateAnnouncement,
    expireAnnouncement,
    deleteAnnouncement,
    getAnnouncementStatus
  } from "$api/controllers/announcement-controller";
  import { AnnouncementStatus, type AnnouncementRecord } from "$lib/types";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { ANNOUNCEMENT_TAG_LIST } from "$lib/types";
  import { TagsInput } from "$ui/tags-input";
  import { globalDialog } from "$state/dialog.svelte";

  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);

  let announcement = $state<AnnouncementRecord | null>(null);
  let isActive = $derived(
    announcement ? getAnnouncementStatus(announcement) === AnnouncementStatus.ACTIVE : false
  );
  let editorActions: { uploadImages: () => Promise<void> } | undefined = $state();

  let tagList = $state<string[]>([]);
  let formData = $state({
    title: "",
    slug: "",
    content: "",
    startDate: "",
    expiryDate: "",
    isIndefinite: false,
    isAdminOnly: false,
    isUnlisted: false,
    tags: ""
  });

  async function loadData() {
    const id = page.params.id;
    isLoading = true;
    try {
      const announcements = await fetchAdminAnnouncements();
      const a = announcements.find((item) => item.id === id);
      if (!a) {
        error = "Announcement not found";
        return;
      }
      announcement = a;
      formData = {
        title: a.title,
        slug: a.slug,
        content: a.content,
        startDate: a.startDate ? dayjs(a.startDate).format("YYYY-MM-DDTHH:mm") : "",
        expiryDate: a.expiryDate ? dayjs(a.expiryDate).format("YYYY-MM-DDTHH:mm") : "",
        isIndefinite: a.isIndefinite,
        isAdminOnly: a.isAdminOnly,
        isUnlisted: a.isUnlisted,
        tags: a.tags
      };
      tagList = Array.from(
        new Set(
          (a.tags || "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        )
      );
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Edit Announcement";
    loadData();
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
    const id = page.params.id;
    if (!id) return;

    isSubmitting = true;
    try {
      if (editorActions) {
        await editorActions.uploadImages();
      }
      await updateAnnouncement(id, {
        ...formData,
        startDate: formData.startDate ? dayjs(formData.startDate).toISOString() : "",
        expiryDate: formData.expiryDate ? dayjs(formData.expiryDate).toISOString() : "",
        tags: tagList.join(","),
        broadcastCount: announcement?.broadcastCount || 0
      });
      toast.success("Announcement updated");
      goto("/admin/announcements");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSubmitting = false;
    }
  }

  async function confirmExpire() {
    const id = page.params.id;
    if (!id) {
      toast.error("Announcement not found.");
      return;
    }

    globalDialog.confirm(
      "Expire announcement?",
      "This announcement will no longer be visible to residents.",
      undefined,
      async () => {
        try {
          await expireAnnouncement(id);
          toast.success("Announcement expired");
          await loadData();
        } catch (e: any) {
          toast.error(e.message);
        }
      },
      undefined,
      {
        accept: "Expire",
        cancel: "Cancel"
      }
    );
  }

  async function confirmDelete() {
    const id = page.params.id;
    if (!id) {
      toast.error("Announcement not found.");
      return;
    }

    globalDialog.confirm(
      "Delete announcement?",
      "This announcement and all uploaded images will be permanently deleted.",
      undefined,
      async () => {
        try {
          await deleteAnnouncement(id);
          toast.success("Announcement deleted.");
          goto("/admin/announcements");
        } catch (e: any) {
          toast.error(e.message);
        }
      },
      undefined,
      {
        accept: "Delete",
        cancel: "Cancel"
      }
    );
  }
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Edit Announcement"
    isRefreshing={isLoading}
    href="/admin/announcements"
    actions={[
      ...(!isLoading && !error && isActive
        ? [
            {
              label: "Expire",
              variant: "secondary",
              onclick: () => confirmExpire(),
              icon: Archive
            }
          ]
        : []),
      ...(!isLoading && !error
        ? [
            {
              label: "Delete",
              variant: "destructive",
              onclick: () => confirmDelete(),
              icon: Trash2
            }
          ]
        : [])
    ] as HeaderAction[]}
  />

  <div class="mx-auto max-w-3xl">
    {#if isLoading}
      <LoadingView />
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
          <Label>Slug</Label>
          <Input
            id="slug"
            bind:value={formData.slug}
            placeholder="announcement-slug"
            disabled={isSubmitting}
          />
          <p class="text-xs text-muted-foreground">This will be used for the announcement URL.</p>
        </div>

        <div class="space-y-2">
          <Label
            for="content"
            class="text-xs font-bold tracking-wider text-muted-foreground uppercase">Content</Label
          >
          <RichTextEditor
            bind:content={formData.content}
            bind:actions={editorActions}
            placeholder="Announcement Details..."
            editable={!isSubmitting}
          />
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <div class="space-y-2">
            <Label
              for="start"
              class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
              >Start Date & Time</Label
            >
            <Input
              type="datetime-local"
              id="start"
              bind:value={formData.startDate}
              disabled={isSubmitting}
            />
          </div>
          {#if !formData.isIndefinite}
            <div class="space-y-2">
              <Label
                for="end"
                class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                >Expiry Date & Time</Label
              >
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
          <div class="flex items-center gap-2">
            <Checkbox id="unlisted" bind:checked={formData.isUnlisted} disabled={isSubmitting} />
            <Label for="unlisted" class="cursor-pointer font-bold">Unlisted</Label>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="tags" class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
            >Tags</Label
          >
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
            Update
          </Button>
        </div>
      </div>
    {/if}
  </div>
</div>
