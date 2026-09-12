<script lang="ts">
  import { onMount } from "svelte";
  import { pageState } from "$state/page-info.svelte";
  import FridgeForm from "$components/forms/FridgeForm.svelte";

  onMount(() => {
    pageState.title = "Store Item in Fridge";
  });
</script>

<FridgeForm />
