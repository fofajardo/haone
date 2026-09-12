const DEFAULT_LABELS: { accept?: string; close?: string; cancel?: string } = {
  accept: "Accept",
  close: "Close",
  cancel: "Cancel"
};
type Callback = () => void | Promise<void>;

class DialogState {
  open = $state(false);
  title = $state("");
  description = $state("");
  onClose = $state<Callback | undefined>(undefined);
  onCancel = $state<Callback | undefined>(undefined);
  onAccept = $state<Callback | undefined>(undefined);
  type = $state<"info" | "confirm">("info");
  labels = $state<typeof DEFAULT_LABELS>(DEFAULT_LABELS);
  isLoading = $state(false);

  show(title: string, description: string, onClose?: () => void, labels?: typeof DEFAULT_LABELS) {
    this.title = title;
    this.description = description;
    this.onClose = onClose;
    this.onAccept = undefined;
    this.open = true;
    this.type = "info";
    this.labels = labels ? labels : DEFAULT_LABELS;
  }

  confirm(
    title: string,
    description: string,
    onClose?: () => void,
    onAccept?: () => void,
    onCancel?: () => void,
    labels?: typeof DEFAULT_LABELS
  ) {
    this.title = title;
    this.description = description;
    this.onClose = onClose;
    this.onAccept = onAccept;
    this.onCancel = onCancel;
    this.open = true;
    this.type = "confirm";
    this.labels = labels ? labels : DEFAULT_LABELS;
  }

  handleClose() {
    this.open = false;
    if (this.onClose) {
      const cb = this.onClose;
      this.onClose = undefined;
      cb();
    }
    if (this.onAccept) {
      this.onAccept = undefined;
    }
    if (this.onCancel) {
      this.onCancel = undefined;
    }
    this.isLoading = false;
  }

  async handleAccept() {
    this.isLoading = true;
    await this.onAccept?.();
    this.handleClose();
  }

  async handleCancel() {
    this.isLoading = true;
    await this.onCancel?.();
    this.handleClose();
  }
}

export const globalDialog = new DialogState();
