<script lang="ts">
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Checkbox } from "$ui/checkbox";
  import { Save } from "@lucide/svelte";
  import RichTextEditor from "$components/editor/RichTextEditor.svelte";
  import { ANNOUNCEMENT_TAG_LIST } from "$lib/types";
  import { TagsInput } from "$ui/tags-input";
  import type { Snippet } from "svelte";

  let {
    formData = $bindable(),
    tagList = $bindable(),
    isSubmitting = false,
    editorActions = $bindable(),
    onSave,
    submitLabel = "Save",
    extraActions
  }: {
    formData: {
      title: string;
      slug: string;
      content: string;
      startDate: string;
      expiryDate: string;
      isIndefinite: boolean;
      isAdminOnly: boolean;
      isUnlisted: boolean;
      tags: string;
    };
    tagList: string[];
    isSubmitting?: boolean;
    editorActions?: { uploadImages: () => Promise<void> };
    onSave: () => void;
    submitLabel?: string;
    extraActions?: Snippet;
  } = $props();
</script>

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
    />
    <p class="text-xs text-muted-foreground">This will be used for the announcement URL.</p>
  </div>

  <div class="space-y-2">
    <Label for="content">Content</Label>
    <RichTextEditor
      bind:content={formData.content}
      bind:actions={editorActions}
      placeholder="Announcement Details..."
      editable={!isSubmitting}
    />
  </div>

  <div class="grid gap-6 md:grid-cols-2">
    <div class="space-y-2">
      <Label for="start">Start Date &amp; Time</Label>
      <Input
        type="datetime-local"
        id="start"
        bind:value={formData.startDate}
        disabled={isSubmitting}
      />
    </div>
    {#if !formData.isIndefinite}
      <div class="space-y-2">
        <Label for="end">Expiry Date &amp; Time</Label>
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
    {@render extraActions?.()}
    <Button onclick={onSave} isLoading={isSubmitting} icon={Save} class="min-w-35">
      {submitLabel}
    </Button>
  </div>
</div>
