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

// @cloud-dog/auth — Route guard requiring a permission.

import * as React from "react";
import { useAuth } from "../context/useAuth";

export function RequirePermission(props: {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const auth = useAuth();
  if (!auth.hasPermission(props.permission)) {
    return <>{props.fallback ?? <div role="alert">Forbidden</div>}</>;
  }
  return <>{props.children}</>;
}
