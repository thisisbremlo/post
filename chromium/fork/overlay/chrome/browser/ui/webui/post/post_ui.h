// Copyright 2026 the Post authors.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_UI_WEBUI_POST_POST_UI_H_
#define CHROME_BROWSER_UI_WEBUI_POST_POST_UI_H_

#include "content/public/browser/web_ui_controller.h"
#include "content/public/browser/webui_config.h"

namespace content {
class WebUI;
}

// The host the fork registers: chrome://post. Deliberately a literal instead of
// chrome/common/webui_url_constants.h so the overlay touches one file fewer and
// the constant cannot drift from the manifest of the page it serves.
inline constexpr char kPostHost[] = "post";

class PostUI : public content::WebUIController {
 public:
  explicit PostUI(content::WebUI* web_ui);
  PostUI(const PostUI&) = delete;
  PostUI& operator=(const PostUI&) = delete;
  ~PostUI() override;
};

class PostUIConfig : public content::DefaultWebUIConfig<PostUI> {
 public:
  PostUIConfig();
};

#endif  // CHROME_BROWSER_UI_WEBUI_POST_POST_UI_H_
