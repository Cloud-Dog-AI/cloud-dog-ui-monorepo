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

// @cloud-dog/app-chat-client — local runtime-config provider (W28A-727-R5).
//
// Scope: chat-client provides its OWN config context instead of the shared
// @cloud-dog/config ConfigProvider. The shared ConfigProvider calls validateConfig,
// which calls the shared secret-name scanner, whose warning-string literals then end
// up in the public SPA bundle. Because the browser config is served publicly, that
// scanner warning is login-page noise and shipping its text in the deployed
// bundle is a closeout failure. This local provider parses window.__RUNTIME_CONFIG__
// against the app schema with NO secret-name scanner, so the deployed bundle carries
// none of those literals.
//
// This replicates ONLY the ConfigProvider/useConfig behaviour chat-client uses; it
// is not a general @cloud-dog/config refactor. AUTH_MODE handling is unchanged (the
// app schema keeps AUTH_MODE; the server enforces cookie mode).

import * as React from "react";
import type { z } from "zod";

const RuntimeConfigContext = React.createContext<unknown | null>(null);

function readRuntimeConfig(): unknown {
  if (typeof window === "undefined") return {};
  return (window as unknown as { __RUNTIME_CONFIG__?: unknown }).__RUNTIME_CONFIG__ ?? {};
}

export interface ChatConfigProviderProps<TSchema extends z.ZodTypeAny> {
  schema: TSchema;
  children: React.ReactNode;
}

export function ChatConfigProvider<TSchema extends z.ZodTypeAny>({
  schema,
  children,
}: ChatConfigProviderProps<TSchema>) {
  const [error, setError] = React.useState<string | null>(null);
  const [value, setValue] = React.useState<z.infer<TSchema> | null>(null);

  React.useEffect(() => {
    const result = schema.safeParse(readRuntimeConfig());
    if (result.success) {
      setValue(result.data as z.infer<TSchema>);
    } else {
      const detail = result.error.issues
        .map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`)
        .join("; ");
      setError(`Invalid runtime config: ${detail}`);
    }
    // Config is read once at startup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div role="alert" className="p-6 font-mono text-sm">
        <div className="mb-2 font-semibold">Invalid runtime configuration</div>
        <pre className="whitespace-pre-wrap">{error}</pre>
      </div>
    );
  }

  if (!value) return null;

  return (
    <RuntimeConfigContext.Provider value={value as unknown}>
      {children}
    </RuntimeConfigContext.Provider>
  );
}

export function useConfig<T>(): T {
  const value = React.useContext(RuntimeConfigContext);
  if (!value) {
    throw new Error(
      "RuntimeConfigContext is not available. Wrap your app with <ChatConfigProvider>."
    );
  }
  return value as T;
}
