<script lang="ts">
  import { onMount } from "svelte";
  import { pageState } from "$state/page-info.svelte";
  import FridgeForm from "$components/fridge/FridgeForm.svelte";

  onMount(() => {
    pageState.title = "Store Item in Fridge";
  });
</script>

<FridgeForm />
