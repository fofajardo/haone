import { feeCodeService } from "$api/services/fee-code-service";
import type { FeeCode, FeeCodeConfig } from "$lib/types";

class FeeCodesState {
  list = $state<FeeCodeConfig[]>([]);
  loaded = $state(false);
  loading = $state(false);

  byCode = $derived(
    Object.fromEntries(this.list.map((c) => [c.id, c])) as unknown as Record<FeeCode, FeeCodeConfig>
  );

  codes = $derived(this.list.map((c) => c.id as unknown as FeeCode));

  labels = $derived(
    Object.fromEntries(this.list.map((c) => [c.id, c.label])) as unknown as Record<FeeCode, string>
  );

  async load(force = false) {
    if (this.loaded && !force) {
      return this.list;
    }
    this.loading = true;
    try {
      this.list = await feeCodeService.getFeeCodes();
      this.loaded = true;
    } finally {
      this.loading = false;
    }
    return this.list;
  }

  async upsert(
    config: Partial<FeeCodeConfig> & {
      label: string;
      shortLabel: string;
      color: string;
      canWaive: boolean;
    }
  ) {
    const saved = await feeCodeService.upsertFeeCode(config);
    await this.load(true);
    return saved;
  }

  async remove(id: string) {
    await feeCodeService.deleteFeeCode(id);
    await this.load(true);
  }
}

export const feeCodesState = new FeeCodesState();
