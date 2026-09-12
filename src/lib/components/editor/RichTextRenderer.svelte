<script lang="ts">
  import { twMerge } from "tailwind-merge";
  import RichTextWrapper from "./RichTextWrapper.svelte";

  let { content = $bindable(), class: className } = $props<{ content: string; class?: string }>();
</script>

<RichTextWrapper>
  <div class={twMerge(className, "tiptap")}>
    {@html content}
  </div>
</RichTextWrapper>
