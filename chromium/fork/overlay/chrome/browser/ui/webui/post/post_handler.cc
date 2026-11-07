// Copyright 2026 the Post authors.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/ui/webui/post/post_handler.h"

#include <memory>
#include <utility>

#include "base/functional/bind.h"
#include "base/json/json_reader.h"
#include "base/json/json_writer.h"
#include "base/strings/utf_string_conversions.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_commands.h"
#include "chrome/browser/ui/browser_finder.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "components/prefs/pref_service.h"
#include "content/public/browser/navigation_controller.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_ui.h"
#include "ui/base/page_transition_types.h"
#include "ui/base/window_open_disposition.h"
#include "url/gurl.h"

namespace {

// The desk keeps one JSON value per key; Chromium keeps one string pref per key.
constexpr char kStoragePrefix[] = "post.storage.";

std::string TabsJson(TabStripModel* model, int self_index) {
  base::Value::List tabs;
  for (int index = 0; index < model->count(); ++index) {
    content::WebContents* contents = model->GetWebContentsAt(index);
    if (!contents) {
      continue;
    }
    base::Value::Dict tab;
    // Index is the identity the desk uses: it is what TabStripModel commands
    // take, and every change is followed by a fresh snapshot.
    tab.Set("id", index);
    tab.Set("index", index);
    tab.Set("active", index == model->active_index());
    tab.Set("url", contents->GetLastCommittedURL().spec());
    tab.Set("title", base::UTF16ToUTF8(contents->GetTitle()));
    tabs.Append(std::move(tab));
  }

  base::Value::Dict payload;
  payload.Set("self", self_index);
  payload.Set("tabs", std::move(tabs));
  std::string json;
  base::JSONWriter::Write(base::Value(std::move(payload)), &json);
  return json;
}

}  // namespace

PostHandler::PostHandler() = default;

PostHandler::~PostHandler() {
  if (observed_model_) {
    observed_model_->RemoveObserver(this);
  }
}

void PostHandler::RegisterMessages() {
  web_ui()->RegisterMessageCallback(
      "post.call", base::BindRepeating(&PostHandler::HandleCall,
                                       base::Unretained(this)));
}

void PostHandler::OnTabStripModelChanged(
    TabStripModel* tab_strip_model,
    const TabStripModelChange& change,
    const TabStripSelectionChange& selection) {
  SendTabs();
}

void PostHandler::HandleCall(const base::Value::List& args) {
  if (args.size() < 3) {
    return;
  }
  const std::string method = args[0].GetString();
  const int request_id = args[1].GetInt();

  base::Value::Dict payload;
  if (const std::string* raw = args[2].GetIfString()) {
    if (auto parsed = base::JSONReader::Read(*raw); parsed && parsed->is_dict()) {
      payload = std::move(parsed->GetDict());
    }
  }

  ObserveTabs();

  std::string result = "null";
  if (!GetTabStripModel() && method != "storage.read" &&
      method != "storage.write") {
    result = "null";
  } else if (method == "tabs") {
    result = Tabs();
  } else if (method == "activate") {
    Activate(payload.FindInt("index").value_or(-1));
    result = Tabs();
  } else if (method == "close") {
    Close(payload.FindInt("index").value_or(-1));
    result = Tabs();
  } else if (method == "new") {
    NewTab(payload.FindString("url") ? *payload.FindString("url") : "");
    result = Tabs();
  } else if (method == "navigate") {
    Navigate(payload.FindInt("index").value_or(-1),
             payload.FindString("url") ? *payload.FindString("url") : "");
    result = Tabs();
  } else if (method == "nav") {
    NavigateHistory(payload.FindInt("index").value_or(-1),
                    payload.FindString("direction")
                        ? *payload.FindString("direction")
                        : "");
    result = Tabs();
  } else if (method == "storage.read") {
    result = ReadStorage(payload.FindString("key")
                             ? *payload.FindString("key")
                             : "");
  } else if (method == "storage.write") {
    if (const base::Value::Dict* values = payload.FindDict("values")) {
      WriteStorage(*values);
    }
    result = "null";
  }

  CallJavascriptFunctionUnsafe("postReceive", base::Value(request_id),
                               base::Value(result));
}

std::string PostHandler::Tabs() {
  TabStripModel* model = GetTabStripModel();
  if (!model) {
    return "null";
  }
  const int self_index =
      model->GetIndexOfWebContents(web_ui()->GetWebContents());
  return TabsJson(model, self_index);
}

void PostHandler::Activate(int index) {
  TabStripModel* model = GetTabStripModel();
  if (!model || index < 0 || index >= model->count()) {
    return;
  }
  model->ActivateTabAt(index);
}

void PostHandler::Close(int index) {
  Browser* browser = GetBrowser();
  TabStripModel* model = GetTabStripModel();
  if (!browser || !model || index < 0 || index >= model->count()) {
    return;
  }
  chrome::CloseWebContents(browser, model->GetWebContentsAt(index),
                           /*add_to_history=*/true);
}

void PostHandler::NewTab(const std::string& url) {
  Browser* browser = GetBrowser();
  if (!browser) {
    return;
  }
  chrome::NewTab(browser);
  if (!url.empty()) {
    Navigate(browser->tab_strip_model()->active_index(), url);
  }
}

void PostHandler::Navigate(int index, const std::string& url) {
  TabStripModel* model = GetTabStripModel();
  if (!model || index < 0 || index >= model->count()) {
    return;
  }
  content::WebContents* contents = model->GetWebContentsAt(index);
  if (!contents) {
    return;
  }
  content::OpenURLParams params(GURL(url), content::Referrer(),
                                WindowOpenDisposition::CURRENT_TAB,
                                ui::PAGE_TRANSITION_TYPED,
                                /*is_renderer_initiated=*/false);
  contents->OpenURL(params, /*navigation_handle_callback=*/{});
}

void PostHandler::NavigateHistory(int index, const std::string& direction) {
  TabStripModel* model = GetTabStripModel();
  if (!model || index < 0 || index >= model->count()) {
    return;
  }
  content::WebContents* contents = model->GetWebContentsAt(index);
  if (!contents) {
    return;
  }
  content::NavigationController& controller = contents->GetController();
  if (direction == "back") {
    if (controller.CanGoBack()) {
      controller.GoBack();
    }
  } else if (direction == "forward") {
    if (controller.CanGoForward()) {
      controller.GoForward();
    }
  } else if (direction == "reload") {
    controller.Reload(content::ReloadType::NORMAL, /*check_for_repost=*/false);
  }
}

std::string PostHandler::ReadStorage(const std::string& key) {
  Profile* profile = GetProfile();
  if (!profile || key.empty()) {
    return "{}";
  }
  const std::string stored =
      profile->GetPrefs()->GetString(kStoragePrefix + key);
  base::Value::Dict reply;
  if (!stored.empty()) {
    if (auto parsed = base::JSONReader::Read(stored)) {
      reply.Set(key, std::move(*parsed));
    }
  }
  std::string json;
  base::JSONWriter::Write(base::Value(std::move(reply)), &json);
  return json;
}

void PostHandler::WriteStorage(const base::Value::Dict& values) {
  Profile* profile = GetProfile();
  if (!profile) {
    return;
  }
  PrefService* prefs = profile->GetPrefs();
  for (const auto& entry : values) {
    std::string json;
    base::JSONWriter::Write(entry.second, &json);
    prefs->SetString(kStoragePrefix + entry.first, json);
  }
}

void PostHandler::ObserveTabs() {
  TabStripModel* model = GetTabStripModel();
  if (!model || model == observed_model_) {
    return;
  }
  if (observed_model_) {
    observed_model_->RemoveObserver(this);
  }
  observed_model_ = model;
  observed_model_->AddObserver(this);
}

void PostHandler::SendTabs() {
  TabStripModel* model = GetTabStripModel();
  if (!model) {
    return;
  }
  CallJavascriptFunctionUnsafe("postTabs", base::Value(Tabs()));
}

Browser* PostHandler::GetBrowser() {
  return chrome::FindBrowserWithTab(web_ui()->GetWebContents());
}

TabStripModel* PostHandler::GetTabStripModel() {
  Browser* browser = GetBrowser();
  return browser ? browser->tab_strip_model() : nullptr;
}

Profile* PostHandler::GetProfile() {
  return Profile::FromWebUI(web_ui());
}
