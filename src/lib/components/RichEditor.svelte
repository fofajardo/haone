<script lang="ts">
  import { onMount } from "svelte";
  import { Editor } from "@tiptap/core";
  import StarterKit from "@tiptap/starter-kit";
  import Link from "@tiptap/extension-link";
  import BulletList from "@tiptap/extension-bullet-list";
  import OrderedList from "@tiptap/extension-ordered-list";
  import ListItem from "@tiptap/extension-list-item";
  import Underline from "@tiptap/extension-underline";
  import Placeholder from "@tiptap/extension-placeholder";
  import Image from "@tiptap/extension-image";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { transformGoogleDriveLink, compressImage, fetchServer } from "$lib/utils";
  import { toast } from "svelte-sonner";
  import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    List,
    ListOrdered,
    Link as LinkIcon,
    Unlink,
    RotateCcw,
    Image as ImageIcon
  } from "lucide-svelte";

  let {
    content = $bindable(""),
    placeholder = "Start typing reminders…",
    editable = true
  } = $props<{
    content: string;
    placeholder?: string;
    editable?: boolean;
  }>();

  let element: HTMLElement;
  let editor: Editor | undefined = $state();
  let selectionState = $state(0);

  // Link Dialog State
  let linkDialogOpen = $state(false);
  let linkUrl = $state("");

  // Image Dialog State
  let imageDialogOpen = $state(false);
  let imageUrl = $state("");

  function openImageDialog() {
    imageUrl = "";
    imageDialogOpen = true;
  }

  let fileInput: HTMLInputElement | undefined = $state();
  let isUploadingImage = $state(false);

  async function handleFileUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      isUploadingImage = true;
      try {
        const processedFile = await compressImage(file);
        const formData = new FormData();
        formData.append("file", processedFile, file.name);

        const data = await fetchServer("/api/upload?type=announcements", {
          method: "POST",
          body: formData
        });

        editor?.chain().focus().setImage({ src: data.url }).run();
        imageDialogOpen = false;
      } catch (err: any) {
        console.error(err);
        toast.error("Upload failed: " + err.message);
      } finally {
        isUploadingImage = false;
      }
    }
  }

  function applyImage() {
    if (imageUrl) {
      const finalUrl = transformGoogleDriveLink(imageUrl);
      editor?.chain().focus().setImage({ src: finalUrl }).run();
    }
    imageDialogOpen = false;
  }

  onMount(() => {
    editor = new Editor({
      element,
      editable,
      extensions: [
        StarterKit.configure({
          bulletList: false,
          orderedList: false,
          listItem: false
        }),
        BulletList.configure({
          HTMLAttributes: {
            style:
              "margin: 15px 0 15px 0; padding: 0 0 0 35px; display: block; list-style-position: outside; list-style-type: disc;"
          }
        }),
        OrderedList.configure({
          HTMLAttributes: {
            style:
              "margin: 15px 0 15px 0; padding: 0 0 0 35px; display: block; list-style-position: outside; list-style-type: decimal;"
          }
        }),
        ListItem.configure({
          HTMLAttributes: {
            style:
              "margin-bottom: 10px; list-style-type: inherit; line-height: 1.4; font-size: 14px;"
          }
        }),
        Underline,
        Image.configure({
          inline: false,
          HTMLAttributes: {
            style: "max-width: 100%; height: auto; border-radius: 0.5rem; margin: 1.5rem 0;"
          }
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            style: "color: var(--brand); text-decoration: underline; font-weight: 500;"
          }
        }),
        Placeholder.configure({
          placeholder
        })
      ],
      content,
      onUpdate: ({ editor }) => {
        content = editor.getHTML();
        selectionState++;
      },
      onSelectionUpdate: () => {
        selectionState++;
      },
      editorProps: {
        attributes: {
          class: `prose prose-sm max-w-none focus:outline-none ${editable ? "min-h-[400px] p-6" : "min-h-0 p-0"} text-sm text-foreground leading-relaxed`
        }
      }
    });

    return () => {
      editor?.destroy();
    };
  });

  function openLinkDialog() {
    linkUrl = editor?.getAttributes("link").href || "";
    linkDialogOpen = true;
  }

  function applyLink() {
    if (linkUrl === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor?.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
    }
    linkDialogOpen = false;
  }
</script>

<div
  class={editable
    ? "overflow-hidden rounded-xl border bg-card transition-all focus-within:ring-1 focus-within:ring-ring"
    : "w-full"}
>
  <!-- Fixed Toolbar -->
  {#if editable && editor}
    {#key selectionState}
      <div class="flex flex-wrap items-center gap-1 border-b bg-muted/50 p-2">
        <Button
          variant="ghost"
          size="sm"
          class="size-8 transition-colors {editor.isActive('bold')
            ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
          onclick={() => editor?.chain().focus().toggleBold().run()}
          icon={Bold}
          iconClass="size-3.5"
        />
        <Button
          variant="ghost"
          size="sm"
          class="size-8 transition-colors {editor.isActive('italic')
            ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
          onclick={() => editor?.chain().focus().toggleItalic().run()}
          icon={Italic}
          iconClass="size-3.5"
        />
        <Button
          variant="ghost"
          size="sm"
          class="size-8 transition-colors {editor.isActive('underline')
            ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
          onclick={() => editor?.chain().focus().toggleUnderline().run()}
          icon={UnderlineIcon}
          iconClass="size-3.5"
        />

        <div class="mx-1 h-4 w-[1px] bg-border"></div>

        <Button
          variant="ghost"
          size="sm"
          class="size-8 transition-colors {editor.isActive('bulletList')
            ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
          onclick={() => editor?.chain().focus().toggleBulletList().run()}
          icon={List}
          iconClass="size-3.5"
        />
        <Button
          variant="ghost"
          size="sm"
          class="size-8 transition-colors {editor.isActive('orderedList')
            ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
          onclick={() => editor?.chain().focus().toggleOrderedList().run()}
          icon={ListOrdered}
          iconClass="size-3.5"
        />

        <div class="mx-1 h-4 w-[1px] bg-border"></div>

        <Button
          variant="ghost"
          size="sm"
          class="size-8 transition-colors {editor.isActive('link')
            ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
          onclick={openLinkDialog}
          icon={LinkIcon}
          iconClass="size-3.5"
        />
        {#if editor.isActive("link")}
          <Button
            variant="ghost"
            size="sm"
            class="size-8 text-destructive hover:bg-destructive/10"
            onclick={() => editor?.chain().focus().unsetLink().run()}
            icon={Unlink}
            iconClass="size-3.5"
          />
        {/if}

        <div class="flex-grow"></div>

        <Button
          variant="ghost"
          size="sm"
          class="size-8 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onclick={openImageDialog}
          icon={ImageIcon}
          iconClass="size-3.5"
          title="Insert Image"
        />

        <Button
          variant="ghost"
          size="sm"
          class="size-8 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onclick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
          title="Clear formatting"
          icon={RotateCcw}
          iconClass="size-3.5"
        />
      </div>
    {/key}
  {/if}

  <!-- Editor Container -->
  <div
    bind:this={element}
    class="tiptap-container border-0 {editable ? 'min-h-[400px]' : 'min-h-0'}"
  ></div>
</div>

<!-- Link Dialog -->
<Dialog.Root bind:open={linkDialogOpen}>
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <Dialog.Title>Edit Link</Dialog.Title>
      <Dialog.Description>
        Enter the URL for the selected text. Leave empty to remove link.
      </Dialog.Description>
    </Dialog.Header>
    <div class="grid gap-4 py-4">
      <div class="grid gap-2">
        <Label for="url">URL</Label>
        <Input
          id="url"
          placeholder="https://example.com"
          bind:value={linkUrl}
          onkeydown={(e) => e.key === "Enter" && applyLink()}
        />
      </div>
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (linkDialogOpen = false)}>Cancel</Button>
      <Button type="submit" onclick={applyLink}>Apply</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={imageDialogOpen}>
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <Dialog.Title>Insert Image</Dialog.Title>
      <Dialog.Description>Paste a direct link to an image.</Dialog.Description>
    </Dialog.Header>
    <div class="grid gap-4 py-4">
      <div class="grid gap-2">
        <Label for="imageUrl">URL</Label>
        <div class="flex gap-2">
          <Input
            id="imageUrl"
            placeholder="https://..."
            bind:value={imageUrl}
            onkeydown={(e) => e.key === "Enter" && applyImage()}
          />
          <Button
            variant="outline"
            onclick={() => fileInput?.click()}
            disabled={isUploadingImage}
            isLoading={isUploadingImage}
          >
            Upload
          </Button>
        </div>
        <p class="text-[10px] text-muted-foreground">Paste a link or upload an image.</p>
      </div>
    </div>
    <input
      type="file"
      bind:this={fileInput}
      accept="image/*"
      class="hidden"
      onchange={handleFileUpload}
    />
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (imageDialogOpen = false)}>Cancel</Button>
      <Button type="submit" onclick={applyImage}>Insert</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.tiptap p.is-editor-empty:first-child::before) {
    color: #adb5bd;
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }

  :global(.tiptap ul) {
    list-style-type: disc !important;
    padding-left: 1.5rem !important;
    margin: 1rem 0 !important;
  }

  :global(.tiptap ol) {
    list-style-type: decimal !important;
    padding-left: 1.5rem !important;
    margin: 1rem 0 !important;
  }

  :global(.tiptap li) {
    margin: 0.25rem 0 !important;
  }

  :global(.tiptap a) {
    color: var(--brand);
    text-decoration: underline;
    font-weight: 500;
  }
</style>
