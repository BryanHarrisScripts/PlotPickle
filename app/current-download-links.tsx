"use client";

import { useEffect } from "react";

const OLD_RELEASE_URL = "https://github.com/BryanHarrisScripts/PlotPickle/releases/latest";
const CURRENT_DOWNLOAD_URL = "https://github.com/BryanHarrisScripts/PlotPickle/archive/refs/heads/main.zip";

export default function CurrentDownloadLinks() {
  useEffect(() => {
    function updateLinks() {
      document.querySelectorAll<HTMLAnchorElement>(`a[href="${OLD_RELEASE_URL}"]`).forEach((link) => {
        link.href = CURRENT_DOWNLOAD_URL;
        link.dataset.downloadSource = "current-main";

        const detail = link.querySelector("small");
        if (detail?.textContent?.includes("GitHub Releases")) {
          detail.textContent = "Fresh copy from the current version";
        }
      });
    }

    updateLinks();
    const observer = new MutationObserver(updateLinks);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
