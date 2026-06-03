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

// @cloud-dog/api-client — React hook for paginated queries.

import * as React from "react";
import type { ApiClient } from "../client/types";
import type { PaginatedResponse } from "./types";

export type PaginatedQueryState<T> = Readonly<{
  isLoading: boolean;
  error: unknown | null;
  data: PaginatedResponse<T> | null;
}>;

export function usePaginatedQuery<T>(opts: {
  client: ApiClient;
  path: string;
  page: number;
  perPage: number;
}): PaginatedQueryState<T> {
  const [state, setState] = React.useState<PaginatedQueryState<T>>({
    isLoading: true,
    error: null,
    data: null,
  });

  React.useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    void opts.client
      .get<PaginatedResponse<T>>(opts.path, {
        query: { page: opts.page, per_page: opts.perPage },
      })
      .then((data) => {
        if (!alive) return;
        setState({ isLoading: false, error: null, data });
      })
      .catch((error) => {
        if (!alive) return;
        setState({ isLoading: false, error, data: null });
      });
    return () => {
      alive = false;
    };
  }, [opts.client, opts.path, opts.page, opts.perPage]);

  return state;
}
