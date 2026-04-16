import { browser } from "$app/environment";
import type { EmailTemplate, BrandingProfile } from "./templates/types";

export interface StagedEmail<T = any> {
  id: string;
  to: string;
  template: EmailTemplate<T>;
  data: T;
  branding: BrandingProfile;
  // Metadata for the UI
  recipientName: string;
  context?: string;
  // Execution data
  onSuccess?: () => Promise<void> | void;
}

class DispatcherState {
  queue = $state<StagedEmail[]>([]);
  customReminders = $state(""); // For Payment Status updates
  configType = $state<"reminders" | null>(null);
  batchType = $state<"ACKNOWLEDGMENT" | "REMINDER" | null>(null);

  push(email: StagedEmail) {
    this.queue.push(email);
  }

  pushBatch(emails: StagedEmail[]) {
    this.queue.push(...emails);
  }

  clear() {
    this.queue = [];
    this.customReminders = "";
    this.configType = null;
    this.batchType = null;
  }

  get total() {
    return this.queue.length;
  }
}

export const emailDispatcher = new DispatcherState();
