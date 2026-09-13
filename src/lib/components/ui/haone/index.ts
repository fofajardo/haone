import StatisticCard from "./card-statistic.svelte";
import AccountCombobox from "./combobox-account.svelte";
import TermCombobox from "./combobox-term.svelte";
import ImageUpload from "./image-upload.svelte";
import Close from "./responsive-dialog-close.svelte";
import Content from "./responsive-dialog-content.svelte";
import Description from "./responsive-dialog-description.svelte";
import Footer from "./responsive-dialog-footer.svelte";
import Header from "./responsive-dialog-header.svelte";
import Root from "./responsive-dialog-root.svelte";
import Title from "./responsive-dialog-title.svelte";

export { AccountCombobox, ImageUpload, StatisticCard, TermCombobox };

export const ResponsiveDialog = { Root, Content, Header, Title, Description, Footer, Close };
