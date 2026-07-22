<script lang="ts">
  import { Button } from "$ui/button";
  import { Save } from "@lucide/svelte";
  import { uiSettings } from "$state/settings.svelte";
  import { auth } from "$state/auth.svelte";
  import { fetchUsers } from "$logic/resident-logic";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  let isSaving = $state(false);
  let residentId = $state("");

  async function save() {
    isSaving = true;
    try {
      const id = residentId || auth.user?.email || "";
      await uiSettings.save(id);
      toast.success("Settings saved to account");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSaving = false;
    }
  }

  onMount(async () => {
    if (auth.authType === "admin") {
      const users = await fetchUsers();
      const me = users.find(
        (u) => u.email.toLowerCase() === (auth.user?.email || "").toLowerCase()
      );
      residentId = me?.id || "";
    }
  });
</script>

<Button size="lg" onclick={save} isLoading={isSaving} icon={Save} class="w-full font-bold">
  Save
</Button>
