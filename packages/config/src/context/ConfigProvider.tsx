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

// @cloud-dog/config — React context provider for runtime config.

import * as React from "react";
import type { z } from "zod";
import { BaseRuntimeConfigSchema } from "../schema";
import { readRuntimeConfig } from "../reader";
import { validateConfig } from "../validator";
import { ConfigError } from "../types";
import { ConfigContext } from "./ConfigContext";

export interface ConfigProviderProps<TSchema extends z.ZodTypeAny> {
  schema?: TSchema;
  children: React.ReactNode;
}

export function ConfigProvider<TSchema extends z.ZodTypeAny>({
  schema,
  children,
}: ConfigProviderProps<TSchema>) {
  const [error, setError] = React.useState<ConfigError | null>(null);
  const [value, setValue] = React.useState<z.infer<TSchema> | null>(null);

  React.useEffect(() => {
    try {
      const raw = readRuntimeConfig();
      const parsed = validateConfig(
        (schema ?? (BaseRuntimeConfigSchema as unknown as TSchema)) as z.ZodSchema<
          z.infer<TSchema>
        >,
        raw
      );
      setValue(parsed);
    } catch (e) {
      setError(e as ConfigError);
    }
    // Config is read once at startup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div role="alert" className="p-6 font-mono text-sm">
        <div className="mb-2 font-semibold">Invalid runtime configuration</div>
        <pre className="whitespace-pre-wrap">{error.message}</pre>
      </div>
    );
  }

  if (!value) return null;

  return (
    <ConfigContext.Provider value={value as unknown}>
      {children}
    </ConfigContext.Provider>
  );
}
