// Copyright 2026 the Post authors.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_UI_WEBUI_POST_POST_HANDLER_H_
#define CHROME_BROWSER_UI_WEBUI_POST_POST_HANDLER_H_

#include <string>

#include "base/memory/raw_ptr.h"
#include "base/values.h"
#include "chrome/browser/ui/tabs/tab_strip_model_observer.h"
#include "content/public/browser/web_ui_message_handler.h"

class BrowserWindowInterface;
class Profile;
class TabStripModel;

// Answers the desk's chrome.* calls with Chromium's own state. The protocol is
// one message, `post.call`, carrying a method, a request id and a JSON payload;
// the answer comes back as `postReceive(id, json)`, and tab changes are pushed
// as `postTabs(json)`.
class PostHandler : public content::WebUIMessageHandler,
                    public TabStripModelObserver {
 public:
  PostHandler();
  PostHandler(const PostHandler&) = delete;
  PostHandler& operator=(const PostHandler&) = delete;
  ~PostHandler() override;

  // content::WebUIMessageHandler:
  void RegisterMessages() override;

  // TabStripModelObserver:
  void OnTabStripModelChanged(
      TabStripModel* tab_strip_model,
      const TabStripModelChange& change,
      const TabStripSelectionChange& selection) override;

 private:
  void HandleCall(const base::Value::List& args);

  // Chrome commands, reached by name from the desk.
  std::string Tabs();
  void Activate(int index);
  void Close(int index);
  void NewTab(const std::string& url);
  void Navigate(int index, const std::string& url);
  void NavigateHistory(int index, const std::string& direction);
  std::string ReadStorage(const std::string& key);
  void WriteStorage(const base::Value::Dict& values);

  void ObserveTabs();
  void SendTabs();

  // chrome.send lives on a non-const WebUI, so these are non-const too.
  BrowserWindowInterface* GetWindow();
  TabStripModel* GetTabStripModel();
  Profile* GetProfile();

  raw_ptr<TabStripModel> observed_model_ = nullptr;
};

#endif  // CHROME_BROWSER_UI_WEBUI_POST_POST_HANDLER_H_
