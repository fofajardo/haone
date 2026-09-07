<script lang="ts">
  import { onMount } from "svelte";
  import { pageState } from "$state/page-info.svelte";
  import FridgeForm from "$components/fridge/FridgeForm.svelte";

  onMount(() => {
    pageState.title = "Add Item to Fridge";
  });
</script>

<FridgeForm isAdmin={true} />
