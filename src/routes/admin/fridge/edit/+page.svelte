<script lang="ts">
  import { onMount } from "svelte";
  import { pageState } from "$state/page-info.svelte";
  import { page } from "$app/state";
  import FridgeForm from "$components/forms/FridgeForm.svelte";

  const itemId = $derived(page.url.searchParams.get("id"));

  onMount(() => {
    pageState.title = "Edit Fridge Item";
  });
</script>

<FridgeForm {itemId} isAdmin={true} />
