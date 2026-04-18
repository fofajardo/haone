<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Editor } from "@tiptap/core";
  import StarterKit from "@tiptap/starter-kit";
  import Link from "@tiptap/extension-link";
  import BulletList from "@tiptap/extension-bullet-list";
  import OrderedList from "@tiptap/extension-ordered-list";
  import ListItem from "@tiptap/extension-list-item";
  import Underline from "@tiptap/extension-underline";
  import Placeholder from "@tiptap/extension-placeholder";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    List,
    ListOrdered,
    Link as LinkIcon,
    Unlink,
    RotateCcw
  } from "lucide-svelte";

  let { content = $bindable(""), placeholder = "Start typing reminders…" } = $props<{
    content: string;
    placeholder?: string;
  }>();

  let element: HTMLElement;
  let editor: Editor | undefined = $state();
  let selectionState = $state(0);

  // Link Dialog State
  let linkDialogOpen = $state(false);
  let linkUrl = $state("");

  onMount(() => {
    editor = new Editor({
      element,
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
          class:
            "prose prose-sm max-w-none focus:outline-none min-h-[400px] p-6 text-sm text-foreground leading-relaxed"
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
  class="overflow-hidden rounded-xl border bg-card shadow-sm transition-all focus-within:ring-1 focus-within:ring-ring"
>
  <!-- Fixed Toolbar -->
  {#if editor}
    {#key selectionState}
      <div class="flex flex-wrap items-center gap-1 border-b bg-muted/50 p-2">
        <Button
          variant="ghost"
          size="sm"
          class="h-8 w-8 transition-colors {editor.isActive('bold')
            ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
          onclick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold class="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="h-8 w-8 transition-colors {editor.isActive('italic')
            ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
          onclick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic class="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="h-8 w-8 transition-colors {editor.isActive('underline')
            ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
          onclick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon class="h-3.5 w-3.5" />
        </Button>

        <div class="mx-1 h-4 w-[1px] bg-border"></div>

        <Button
          variant="ghost"
          size="sm"
          class="h-8 w-8 transition-colors {editor.isActive('bulletList')
            ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
          onclick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List class="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="h-8 w-8 transition-colors {editor.isActive('orderedList')
            ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
          onclick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered class="h-3.5 w-3.5" />
        </Button>

        <div class="mx-1 h-4 w-[1px] bg-border"></div>

        <Button
          variant="ghost"
          size="sm"
          class="h-8 w-8 transition-colors {editor.isActive('link')
            ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
          onclick={openLinkDialog}
        >
          <LinkIcon class="h-3.5 w-3.5" />
        </Button>
        {#if editor.isActive("link")}
          <Button
            variant="ghost"
            size="sm"
            class="h-8 w-8 text-destructive hover:bg-destructive/10"
            onclick={() => editor?.chain().focus().unsetLink().run()}
          >
            <Unlink class="h-3.5 w-3.5" />
          </Button>
        {/if}

        <div class="flex-grow"></div>

        <Button
          variant="ghost"
          size="sm"
          class="h-8 w-8 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onclick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
          title="Clear formatting"
        >
          <RotateCcw class="h-3.5 w-3.5" />
        </Button>
      </div>
    {/key}
  {/if}

  <!-- Editor Container -->
  <div bind:this={element} class="tiptap-container min-h-[400px] border-0"></div>
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
