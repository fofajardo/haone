<script lang="ts">
  import dayjs from "dayjs";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { ChevronLeft, Save, Archive, Trash2 } from "lucide-svelte";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { auth } from "$lib/auth.svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import RichEditor from "$lib/components/RichEditor.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import {
    fetchAnnouncements,
    updateAnnouncement,
    expireAnnouncement,
    deleteAnnouncement,
    getAnnouncementStatus
  } from "$lib/admin-logic";
  import { AnnouncementStatus, type AnnouncementRecord } from "$lib/schemas";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { ANNOUNCEMENT_TAG_LIST } from "$lib/schemas";
  import { TagsInput } from "$lib/components/ui/tags-input";

  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);
  let isExpiring = $state(false);
  let isDeleting = $state(false);
  let showExpireDialog = $state(false);
  let showDeleteDialog = $state(false);

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
      const announcements = await fetchAnnouncements();
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

  onMount(loadData);

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

  async function handleExpire() {
    const id = page.params.id;
    if (!id) return;
    isExpiring = true;
    try {
      await expireAnnouncement(id);
      toast.success("Announcement expired");
      showExpireDialog = false;
      await loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isExpiring = false;
    }
  }

  async function handleDelete() {
    const id = page.params.id;
    if (!id) return;
    isDeleting = true;
    try {
      await deleteAnnouncement(id, auth.accessToken!);
      toast.success("Announcement deleted");
      goto("/admin/announcements");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isDeleting = false;
    }
  }
</script>

<div class="space-y-6">
  <SubpageHeader title="Edit Announcement">
    {#snippet actions()}
      <div class="flex gap-2">
        {#if isActive}
          <Button
            variant="secondary"
            size="sm"
            onclick={() => (showExpireDialog = true)}
            isLoading={isExpiring}
            icon={Archive}
          >
            Expire
          </Button>
        {/if}
        <Button
          variant="destructive"
          size="sm"
          onclick={() => (showDeleteDialog = true)}
          isLoading={isDeleting}
          icon={Trash2}
        >
          Delete
        </Button>
      </div>
    {/snippet}
  </SubpageHeader>

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
          <Label for="slug" class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
            >Slug</Label
          >
          <Input
            id="slug"
            bind:value={formData.slug}
            placeholder="announcement-slug"
            disabled={isSubmitting}
          />
          <p class="text-[10px] text-muted-foreground italic">
            This will be used for the announcement URL.
          </p>
        </div>

        <div class="space-y-2">
          <Label
            for="content"
            class="text-xs font-bold tracking-wider text-muted-foreground uppercase">Content</Label
          >
          <RichEditor
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
          <Button
            variant="outline"
            onclick={() => goto("/admin/announcements")}
            disabled={isSubmitting}>Cancel</Button
          >
          <Button onclick={handleSave} isLoading={isSubmitting} icon={Save} class="min-w-[140px]">
            Update
          </Button>
        </div>
      </div>
    {/if}
  </div>
</div>

<AlertDialog.Root bind:open={showExpireDialog}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Expire Announcement</AlertDialog.Title>
      <AlertDialog.Description>
        Are you sure you want to expire this announcement? It will no longer be visible to
        residents.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <Button onclick={handleExpire} isLoading={isExpiring}>Expire</Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={showDeleteDialog}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete Announcement</AlertDialog.Title>
      <AlertDialog.Description>
        Are you sure you want to permanently delete this announcement and all its uploaded images?
        This action cannot be undone.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <Button onclick={handleDelete} variant="destructive" isLoading={isDeleting}>Delete</Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
