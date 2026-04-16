<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Editor } from "@tiptap/core";
  import StarterKit from "@tiptap/starter-kit";
  import Link from "@tiptap/extension-link";
  import Underline from "@tiptap/extension-underline";
  import Placeholder from "@tiptap/extension-placeholder";
  import { Button } from "$lib/components/ui/button";
  import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    List,
    ListOrdered,
    Link as LinkIcon,
    Unlink,
    Code,
    RotateCcw
  } from "lucide-svelte";

  let { content = $bindable(""), placeholder = "Start typing reminders..." } = $props<{
    content: string;
    placeholder?: string;
  }>();

  let element: HTMLElement;
  let editor: Editor | undefined = $state();

  onMount(() => {
    editor = new Editor({
      element,
      extensions: [
        StarterKit,
        Underline,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: "text-blue-600 underline"
          }
        }),
        Placeholder.configure({
          placeholder
        })
      ],
      content,
      onUpdate: ({ editor }) => {
        content = editor.getHTML();
      },
      editorProps: {
        attributes: {
          class:
            "prose prose-sm max-w-none focus:outline-none min-h-[300px] p-6 text-sm text-slate-800 leading-relaxed"
        }
      }
    });

    return () => {
      editor?.destroy();
    };
  });

  function setLink() {
    const previousUrl = editor?.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) return;
    if (url === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }
</script>

<div
  class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all focus-within:ring-1 focus-within:ring-slate-300"
>
  <!-- Toolbar -->
  {#if editor}
    <div class="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50/50 p-2">
      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8 {editor.isActive('bold') ? 'bg-slate-200 text-slate-900' : 'text-slate-500'}"
        onclick={() => editor?.chain().focus().toggleBold().run()}
      >
        <Bold class="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8 {editor.isActive('italic')
          ? 'bg-slate-200 text-slate-900'
          : 'text-slate-500'}"
        onclick={() => editor?.chain().focus().toggleItalic().run()}
      >
        <Italic class="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8 {editor.isActive('underline')
          ? 'bg-slate-200 text-slate-900'
          : 'text-slate-500'}"
        onclick={() => editor?.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon class="h-4 w-4" />
      </Button>

      <div class="mx-1 h-4 w-[1px] bg-slate-200"></div>

      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8 {editor.isActive('bulletList')
          ? 'bg-slate-200 text-slate-900'
          : 'text-slate-500'}"
        onclick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <List class="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8 {editor.isActive('orderedList')
          ? 'bg-slate-200 text-slate-900'
          : 'text-slate-500'}"
        onclick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered class="h-4 w-4" />
      </Button>

      <div class="mx-1 h-4 w-[1px] bg-slate-200"></div>

      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8 {editor.isActive('link') ? 'bg-slate-200 text-slate-900' : 'text-slate-500'}"
        onclick={setLink}
      >
        <LinkIcon class="h-4 w-4" />
      </Button>
      {#if editor.isActive("link")}
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 text-destructive"
          onclick={() => editor?.chain().focus().unsetLink().run()}
        >
          <Unlink class="h-4 w-4" />
        </Button>
      {/if}

      <div class="flex-grow"></div>

      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8 text-slate-400 hover:text-slate-900"
        onclick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
        title="Clear formatting"
      >
        <RotateCcw class="h-3.5 w-3.5" />
      </Button>
    </div>
  {/if}

  <!-- Editor Container -->
  <div bind:this={element} class="tiptap-container border-0"></div>
</div>

<style>
  :global(.tiptap p.is-editor-empty:first-child::before) {
    color: #adb5bd;
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }

  :global(.tiptap ul) {
    list-style-type: disc;
    padding-left: 1.5rem;
    margin: 1rem 0;
  }

  :global(.tiptap ol) {
    list-style-type: decimal;
    padding-left: 1.5rem;
    margin: 1rem 0;
  }

  :global(.tiptap li) {
    margin: 0.25rem 0;
  }

  :global(.tiptap a) {
    color: #0047ab;
    text-decoration: underline;
    font-weight: 500;
  }
</style>
