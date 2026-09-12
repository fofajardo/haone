import Action from "./attachment-action.svelte";
import Actions from "./attachment-actions.svelte";
import Content from "./attachment-content.svelte";
import Description from "./attachment-description.svelte";
import Group from "./attachment-group.svelte";
import Media from "./attachment-media.svelte";
import Title from "./attachment-title.svelte";
import Trigger from "./attachment-trigger.svelte";
import Root, {
  attachmentVariants,
  type AttachmentOrientation,
  type AttachmentSize,
  type AttachmentState
} from "./attachment.svelte";

export {
  Action,
  Actions,
  //
  Root as Attachment,
  Action as AttachmentAction,
  Actions as AttachmentActions,
  Content as AttachmentContent,
  Description as AttachmentDescription,
  Group as AttachmentGroup,
  Media as AttachmentMedia,
  Title as AttachmentTitle,
  Trigger as AttachmentTrigger,
  attachmentVariants,
  Content,
  Description,
  Group,
  Media,
  Root,
  Title,
  Trigger,
  type AttachmentOrientation,
  type AttachmentSize,
  type AttachmentState
};
