// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// @cloud-dog/ui — Tabs component.

import * as React from "react";
import { cn } from "../../utils/cn";

type TabsContextValue = Readonly<{
  value: string;
  setValue: (v: string) => void;
}>;

const TabsContext = React.createContext<TabsContextValue | null>(null);

export function Tabs(props: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <TabsContext.Provider value={{ value: props.value, setValue: props.onValueChange }}>
      <div>{props.children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} role="tablist" className={cn("inline-flex rounded-md bg-muted p-1", props.className)} />;
}

export type TabsTriggerProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "type" | "role" | "aria-selected"> & {
  value: string;
};

export function TabsTrigger({ value, className, children, onClick, ...buttonProps }: TabsTriggerProps) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsContext missing");
  const active = ctx.value === value;
  return (
    <button
      {...buttonProps}
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        "px-3 py-1.5 text-sm rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-background shadow-sm" : "text-slate-700 hover:text-foreground",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          ctx.setValue(value);
        }
      }}
    >
      {children}
    </button>
  );
}

export type TabsContentProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string;
};

export function TabsContent({ value, children, className, ...divProps }: TabsContentProps) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsContext missing");
  const active = ctx.value === value;
  return active ? <div {...divProps} role="tabpanel" className={cn("mt-4", className)}>{children}</div> : null;
}
