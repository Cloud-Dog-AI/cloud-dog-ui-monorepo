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

// @cloud-dog/ui — Toast notification system.

import * as React from "react";
import { cn } from "../../utils/cn";
import { Button } from "../button/Button";

export type ToastVariant = "default" | "destructive" | "warning" | "success";

export type ToastItem = Readonly<{
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  timeoutMs: number;
}>;

type ToastContextValue = Readonly<{
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, "id"> & { id?: string }) => void;
  dismiss: (id: string) => void;
}>;

const ToastContext = React.createContext<ToastContextValue | null>(null);

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider(props: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const timeoutsRef = React.useRef<Map<string, number>>(new Map());

  const dismiss = React.useCallback((id: string) => {
    const t = timeoutsRef.current.get(id);
    if (t) window.clearTimeout(t);
    timeoutsRef.current.delete(id);
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = React.useCallback(
    (t: Omit<ToastItem, "id"> & { id?: string }) => {
      const id = t.id ?? createId();
      const item: ToastItem = {
        id,
        title: t.title,
        description: t.description,
        variant: t.variant,
        timeoutMs: t.timeoutMs,
      };
      setToasts((ts) => [item, ...ts].slice(0, 5));
      const timeoutId = window.setTimeout(() => dismiss(id), item.timeoutMs);
      timeoutsRef.current.set(id, timeoutId);
    },
    [dismiss]
  );

  React.useEffect(() => {
    return () => {
      for (const timeoutId of timeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      timeoutsRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>
      {props.children}
      <Toaster />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("ToastProvider is missing.");
  return ctx;
}

export function Toaster() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) return null;
  return (
    <div className="fixed right-4 top-4 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {ctx.toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-md border bg-background p-3 shadow-md",
            t.variant === "destructive" ? "border-destructive/30" : "",
            t.variant === "warning" ? "border-accent/30" : "",
            t.variant === "success" ? "border-primary/30" : ""
          )}
          role="status"
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{t.title}</div>
              {t.description ? (
                <div className="text-xs text-muted-foreground">{t.description}</div>
              ) : null}
            </div>
            <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={() => ctx.dismiss(t.id)}>
              ×
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
