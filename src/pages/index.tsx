import { internalPageOf } from "../lib/url";
import { HistoryPage } from "./HistoryPage";
import { PasswordsPage } from "./PasswordsPage";
import { SettingsPage } from "./SettingsPage";
import { ShelfPage } from "./ShelfPage";
import { SittingsPage } from "./SittingsPage";
import { StartPage } from "./StartPage";

export function PageByUrl({ url, title }: { url: string; title: string }) {
  switch (internalPageOf(url)) {
    case "history":
      return <HistoryPage />;
    case "shelf":
      return <ShelfPage />;
    case "sittings":
      return <SittingsPage />;
    case "passwords":
      return <PasswordsPage />;
    case "settings":
      return <SettingsPage />;
    case "start":
    default:
      return <StartPage key={title} />;
  }
}
