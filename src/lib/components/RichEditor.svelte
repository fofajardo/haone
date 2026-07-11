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
  import { Table } from "@tiptap/extension-table";
  import { TableRow } from "@tiptap/extension-table-row";
  import { TableHeader } from "@tiptap/extension-table-header";
  import { TableCell } from "@tiptap/extension-table-cell";
  import { TextAlign } from "@tiptap/extension-text-align";
  import { Highlight } from "@tiptap/extension-highlight";
  import { TextStyle } from "@tiptap/extension-text-style";
  import { Color } from "@tiptap/extension-color";
  import { Subscript } from "@tiptap/extension-subscript";
  import { Superscript } from "@tiptap/extension-superscript";
  import { TaskList } from "@tiptap/extension-task-list";
  import { TaskItem } from "@tiptap/extension-task-item";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Popover from "$lib/components/ui/popover";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { transformGoogleDriveLink, compressImage, fetchServer } from "$lib/utils";
  import { uiSettings } from "$lib/settings.svelte";
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
    Image as ImageIcon,
    Highlighter,
    Subscript as SubscriptIcon,
    Superscript as SuperscriptIcon,
    Table as TableIcon,
    Palette,
    Trash2,
    TextAlignStart,
    TextAlignCenter,
    TextAlignEnd,
    TextAlignJustify,
    SquareCheckBig,
    Rows2,
    Columns2
  } from "@lucide/svelte";

  let {
    content = $bindable(),
    placeholder = "Start typing reminders…",
    editable = true,
    actions = $bindable()
  } = $props<{
    content: string;
    placeholder?: string;
    editable?: boolean;
    actions?: { uploadImages: () => Promise<void> };
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
  const pendingImages = new Map<string, Blob>();

  async function handleFileUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      isUploadingImage = true;
      try {
        const processedBlob = await compressImage(file);
        const blobUrl = URL.createObjectURL(processedBlob);
        pendingImages.set(blobUrl, processedBlob);
        editor?.chain().focus().setImage({ src: blobUrl }).run();
        imageDialogOpen = false;
      } catch (err: any) {
        console.error(err);
        toast.error("File processing failed: " + err.message);
      } finally {
        isUploadingImage = false;
      }
    }
  }

  async function uploadImages() {
    if (!editor) return;
    const content = editor.getHTML();
    if (!content.includes("blob:")) return;

    // Parse content to find all blob images
    const doc = new DOMParser().parseFromString(content, "text/html");
    const imgs = Array.from(doc.querySelectorAll("img[src^='blob:']"));

    if (imgs.length === 0) return;

    isUploadingImage = true;
    try {
      for (const img of imgs) {
        const blobUrl = img.getAttribute("src")!;
        const blob = pendingImages.get(blobUrl);
        if (blob) {
          const formData = new FormData();
          formData.append("file", blob, "announcement_image.jpg");

          const data = await fetchServer("/api/upload?type=announcements", {
            method: "POST",
            body: formData
          });

          img.setAttribute("src", data.url);
          pendingImages.delete(blobUrl);
          URL.revokeObjectURL(blobUrl);
        }
      }

      // Update editor with final content
      editor.commands.setContent(doc.body.innerHTML);
    } catch (err: any) {
      console.error(err);
      toast.error("Image upload failed: " + err.message);
      throw err;
    } finally {
      isUploadingImage = false;
    }
  }

  $effect(() => {
    actions = { uploadImages };
  });

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
        }),
        Table.configure({
          resizable: true,
          HTMLAttributes: {
            class: "border-collapse table-fixed w-full"
          }
        }),
        TableRow,
        TableHeader,
        TableCell,
        TextAlign.configure({
          types: ["heading", "paragraph"]
        }),
        Highlight.configure({ multicolor: true }),
        TextStyle,
        Color,
        Subscript,
        Superscript,
        TaskList,
        TaskItem.configure({
          nested: true
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

  $effect(() => {
    if (editor && content !== undefined && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
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
      <div class="flex flex-col border-b bg-muted/50">
        <!-- Text Formatting Toolbar -->
        <div class="flex flex-wrap items-center gap-1 p-2">
          <!-- History -->
          <Button
            variant="ghost"
            size="sm"
            class="size-8 text-muted-foreground hover:bg-muted hover:text-foreground"
            onclick={() => editor?.chain().focus().undo().run()}
            icon={RotateCcw}
            iconClass="size-3.5"
            title="Undo"
          />

          <div class="mx-1 h-4 w-[1px] bg-border"></div>

          <!-- Basic Marks -->
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive('bold')
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().toggleBold().run()}
            icon={Bold}
            iconClass="size-3.5"
            title="Bold"
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
            title="Italic"
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
            title="Underline"
          />

          <!-- Color & Highlight -->
          <Popover.Root>
            <Popover.Trigger>
              <Button
                variant="ghost"
                size="sm"
                class="size-8 transition-colors {editor.isActive('textStyle') &&
                editor.getAttributes('textStyle').color
                  ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                icon={Palette}
                iconClass="size-3.5"
                title="Text Color"
              />
            </Popover.Trigger>
            <Popover.Content class="w-40 p-2">
              <div class="grid grid-cols-5 gap-1">
                {#each ["inherit", "#ef4444", "#f97316", "#f59e0b", "#10b981", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#000000"] as color}
                  <button
                    class="size-6 rounded-md border border-border transition-transform hover:scale-110"
                    style="background-color: {color === 'inherit' ? 'transparent' : color}"
                    onclick={() => {
                      if (color === "inherit") {
                        editor?.chain().focus().unsetColor().run();
                      } else {
                        editor?.chain().focus().setColor(color).run();
                      }
                    }}
                    title={color}
                  >
                    {#if color === "inherit"}
                      <RotateCcw class="mx-auto size-3" />
                    {/if}
                  </button>
                {/each}
              </div>
            </Popover.Content>
          </Popover.Root>

          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive('highlight')
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().toggleHighlight().run()}
            icon={Highlighter}
            iconClass="size-3.5"
            title="Highlight"
          />

          <div class="mx-1 h-4 w-[1px] bg-border"></div>

          <!-- Script -->
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive('subscript')
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().toggleSubscript().run()}
            icon={SubscriptIcon}
            iconClass="size-3.5"
            title="Subscript"
          />
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive('superscript')
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().toggleSuperscript().run()}
            icon={SuperscriptIcon}
            iconClass="size-3.5"
            title="Superscript"
          />

          <div class="mx-1 h-4 w-[1px] bg-border"></div>

          <!-- Alignment -->
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive({ textAlign: 'left' })
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().setTextAlign("left").run()}
            icon={TextAlignStart}
            iconClass="size-3.5"
            title="Align Left"
          />
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive({ textAlign: 'center' })
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().setTextAlign("center").run()}
            icon={TextAlignCenter}
            iconClass="size-3.5"
            title="Align Center"
          />
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive({ textAlign: 'right' })
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().setTextAlign("right").run()}
            icon={TextAlignEnd}
            iconClass="size-3.5"
            title="Align Right"
          />
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive({ textAlign: 'justify' })
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().setTextAlign("justify").run()}
            icon={TextAlignJustify}
            iconClass="size-3.5"
            title="Justify"
          />

          <div class="flex-grow"></div>

          <!-- Utilities -->
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

        <!-- Content Elements Row -->
        <div class="flex flex-wrap items-center gap-1 border-t bg-muted/10 p-2">
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive('bulletList')
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().toggleBulletList().run()}
            icon={List}
            iconClass="size-3.5"
            title="Bullet List"
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
            title="Ordered List"
          />
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive('taskList')
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().toggleTaskList().run()}
            icon={SquareCheckBig}
            iconClass="size-3.5"
            title="Task List"
          />

          <div class="mx-1 h-4 w-[1px] bg-border"></div>

          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive('table')
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() =>
              editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            icon={TableIcon}
            iconClass="size-3.5"
            title="Insert Table"
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
            title="Link"
          />
          {#if editor.isActive("link")}
            <Button
              variant="ghost"
              size="sm"
              class="size-8 text-destructive hover:bg-destructive/10"
              onclick={() => editor?.chain().focus().unsetLink().run()}
              icon={Unlink}
              iconClass="size-3.5"
              title="Unlink"
            />
          {/if}

          <Button
            variant="ghost"
            size="sm"
            class="size-8 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onclick={openImageDialog}
            icon={ImageIcon}
            iconClass="size-3.5"
            title="Insert Image"
          />
        </div>

        <!-- Table Row Modification Row -->
        {#if editor.isActive("table")}
          <div class="flex flex-wrap items-center gap-1 border-t bg-muted/20 p-2">
            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-2 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onclick={() => editor?.chain().focus().addColumnBefore().run()}
            >
              <Columns2 class="size-3" /> Col Before
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-2 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onclick={() => editor?.chain().focus().addColumnAfter().run()}
            >
              <Columns2 class="size-3" /> Col After
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-2 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onclick={() => editor?.chain().focus().deleteColumn().run()}
            >
              <Trash2 class="size-3" /> Del Col
            </Button>

            <div class="mx-1 h-4 w-[1px] bg-border"></div>

            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-2 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onclick={() => editor?.chain().focus().addRowBefore().run()}
            >
              <Rows2 class="size-3" /> Row Before
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-2 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onclick={() => editor?.chain().focus().addRowAfter().run()}
            >
              <Rows2 class="size-3" /> Row After
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-2 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onclick={() => editor?.chain().focus().deleteRow().run()}
            >
              <Trash2 class="size-3" /> Del Row
            </Button>

            <div class="mx-1 h-4 w-[1px] bg-border"></div>

            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-2 px-2 text-xs text-destructive hover:bg-destructive/10"
              onclick={() => editor?.chain().focus().deleteTable().run()}
            >
              <Trash2 class="size-3" /> Delete Table
            </Button>
          </div>
        {/if}
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
          {#if uiSettings.firebaseEnabled}
            <Button
              variant="outline"
              onclick={() => fileInput?.click()}
              disabled={isUploadingImage}
              isLoading={isUploadingImage}
            >
              Upload
            </Button>
          {/if}
        </div>
        {#if uiSettings.firebaseEnabled}
          <p class="text-xs text-muted-foreground">
            Paste a link or upload an image. If using a Google Drive link, make sure it's shared
            with 'Anyone with the link' permission.
          </p>
        {:else}
          <p class="text-xs text-muted-foreground">
            If using a Google Drive link, make sure it's shared with 'Anyone with the link'
            permission.
          </p>
        {/if}
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

  :global(.tiptap table) {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
    margin: 0;
    overflow: hidden;
  }

  :global(.tiptap table td, .tiptap table th) {
    min-width: 1em;
    border: 1px solid var(--border);
    padding: 3px 5px;
    vertical-align: top;
    box-sizing: border-box;
    position: relative;
  }

  :global(.tiptap table td > *, .tiptap table th > *) {
    margin-bottom: 0;
  }

  :global(.tiptap table th) {
    font-weight: bold;
    text-align: left;
    background-color: var(--muted);
  }

  :global(.tiptap table .selectedCell:after) {
    z-index: 2;
    position: absolute;
    content: "";
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    background: rgba(200, 200, 255, 0.4);
    pointer-events: none;
  }

  :global(.tiptap table .column-resize-handle) {
    position: absolute;
    right: -2px;
    top: 0;
    bottom: -2px;
    width: 4px;
    background-color: var(--brand);
    pointer-events: none;
  }

  :global(.tiptap .tableWrapper) {
    overflow-x: auto;
    margin: 1.5rem 0;
  }

  :global(.tiptap ul[data-type="taskList"]) {
    list-style: none !important;
    padding: 0 !important;
  }

  :global(.tiptap ul[data-type="taskList"] li) {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.25rem !important;
  }

  :global(.tiptap ul[data-type="taskList"] li > label) {
    flex: 0 0 auto;
    user-select: none;
    margin-top: 0.25rem;
  }

  :global(.tiptap ul[data-type="taskList"] li > div) {
    flex: 1 1 auto;
  }

  :global(.tiptap ul[data-type="taskList"] input[type="checkbox"]) {
    cursor: pointer;
  }
</style>
