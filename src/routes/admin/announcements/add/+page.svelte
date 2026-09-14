<script lang="ts">
  import { onMount } from "svelte";
  import { pageState } from "$state/page-info.svelte";
  import dayjs from "dayjs";
  import { auth } from "$state/auth.svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import { addAnnouncement } from "$api/controllers/announcement-controller";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import slugify from "slug";
  import AnnouncementForm from "$components/forms/AnnouncementForm.svelte";

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
    <AnnouncementForm
      bind:formData
      bind:tagList
      bind:editorActions
      {isSubmitting}
      onSave={handleSave}
      submitLabel="Save"
    />
  </div>
</div>
