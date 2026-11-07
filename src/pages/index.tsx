import { internalPageOf } from "../lib/url";
import { HistoryPage } from "./HistoryPage";
import { SettingsPage } from "./SettingsPage";
import { ShelfPage } from "./ShelfPage";
import { SittingsPage } from "./SittingsPage";
import { StartPage } from "./StartPage";
import { TurboPage } from "./TurboPage";
import { UpdatesPage } from "./UpdatesPage";

export function PageByUrl({ url, title }: { url: string; title: string }) {
  switch (internalPageOf(url)) {
    case "history":
      return <HistoryPage />;
    case "shelf":
      return <ShelfPage />;
    case "sittings":
      return <SittingsPage />;
    case "turbo":
      return <TurboPage />;
    case "settings":
      return <SettingsPage />;
    case "updates":
      return <UpdatesPage />;
    case "start":
    default:
      return <StartPage key={title} />;
  }
}
