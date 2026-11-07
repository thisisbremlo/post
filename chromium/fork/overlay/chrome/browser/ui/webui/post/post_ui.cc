// Copyright 2026 the Post authors.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/ui/webui/post/post_ui.h"

#include <memory>

#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/webui/post/post_handler.h"
#include "chrome/grit/post_resources.h"
#include "chrome/grit/post_resources_map.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "content/public/common/url_constants.h"
#include "services/network/public/mojom/content_security_policy.mojom.h"
#include "ui/webui/webui_util.h"

PostUI::PostUI(content::WebUI* web_ui) : content::WebUIController(web_ui) {
  Profile* profile = Profile::FromWebUI(web_ui);
  content::WebUIDataSource* source =
      content::WebUIDataSource::CreateAndAdd(profile, kPostHost);

  // The same bundle the extension harness loads, with the shim that turns the
  // desk's chrome.* calls into chrome.send messages to PostHandler.
  webui::SetupWebUIDataSource(source, kPostResources, IDR_POST_UI_HTML);

  // The desk is local code and local fonts; nothing is loaded from the network.
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ScriptSrc,
      "script-src 'self' 'unsafe-inline';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::StyleSrc,
      "style-src 'self' 'unsafe-inline';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ImgSrc, "img-src 'self' data:;");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::FontSrc, "font-src 'self';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ConnectSrc, "connect-src 'none';");

  web_ui->AddMessageHandler(std::make_unique<PostHandler>());
}

PostUI::~PostUI() = default;

PostUIConfig::PostUIConfig()
    : DefaultWebUIConfig(content::kChromeUIScheme, kPostHost) {}
