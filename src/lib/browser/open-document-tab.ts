"use client";

export function prepareDocumentTab() {
  const tab = window.open("about:blank", "_blank");

  if (tab) {
    tab.opener = null;
  }

  return tab;
}

export function openPreparedDocumentTab(url: string, tab: Window | null) {
  if (tab && !tab.closed) {
    try {
      tab.location.replace(url);
      return;
    } catch {
      tab.close();
    }
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

export function closePreparedDocumentTab(tab: Window | null) {
  if (tab && !tab.closed) {
    tab.close();
  }
}
