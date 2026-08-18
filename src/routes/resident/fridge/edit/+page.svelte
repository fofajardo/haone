<script lang="ts">
  import { page } from "$app/state";
  import FridgeForm from "$components/fridge/FridgeForm.svelte";

  const itemId = $derived(page.url.searchParams.get("id"));
</script>

<FridgeForm {itemId} />
