"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type ClientDetailTab = {
  id: string;
  label: string;
  description: string;
  count?: number;
};

type ClientDetailTabsProps = {
  tabs: ClientDetailTab[];
  children: ReactNode;
};

const ClientDetailTabsContext = createContext<string>("");

export function ClientDetailTabs({ tabs, children }: ClientDetailTabsProps) {
  const tabIds = useMemo(() => new Set(tabs.map((tab) => tab.id)), [tabs]);
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    const hashTab = window.location.hash.replace("#", "");

    if (hashTab && tabIds.has(hashTab)) {
      setActiveTab(hashTab);
    }
  }, [tabIds]);

  const selectedTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  function selectTab(tabId: string) {
    setActiveTab(tabId);
    window.history.replaceState(null, "", `#${tabId}`);
  }

  if (!selectedTab) {
    return null;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div
          role="tablist"
          aria-label="Seções do cadastro do cliente"
          className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6"
        >
          {tabs.map((tab) => {
            const isActive = tab.id === selectedTab.id;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`client-tab-panel-${tab.id}`}
                id={`client-tab-${tab.id}`}
                onClick={() => selectTab(tab.id)}
                className={`min-h-20 rounded-lg border px-4 py-3 text-left transition ${
                  isActive
                    ? "border-teal-600 bg-teal-700 text-white shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-200 hover:bg-teal-50"
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{tab.label}</span>
                  {typeof tab.count === "number" ? (
                    <span
                      className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
                        isActive
                          ? "bg-white/15 text-white"
                          : "bg-white text-slate-600"
                      }`}
                    >
                      {tab.count}
                    </span>
                  ) : null}
                </span>
                <span
                  className={`mt-1 block text-xs leading-5 ${
                    isActive ? "text-teal-50" : "text-slate-500"
                  }`}
                >
                  {tab.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div
        role="tabpanel"
        id={`client-tab-panel-${selectedTab.id}`}
        aria-labelledby={`client-tab-${selectedTab.id}`}
      >
        <ClientDetailTabsContext.Provider value={selectedTab.id}>
          {children}
        </ClientDetailTabsContext.Provider>
      </div>
    </div>
  );
}

export function ClientTabPanel({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const activeTab = useContext(ClientDetailTabsContext);

  if (activeTab !== id) {
    return null;
  }

  return <>{children}</>;
}
