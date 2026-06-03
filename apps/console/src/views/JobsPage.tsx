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

// @cloud-dog/app-console — Jobs page scaffold.

import { Card, CardContent, CardHeader } from '@cloud-dog/ui';

export function JobsPage() {
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <h1 className="text-lg font-semibold">Jobs</h1>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-neutral-500">Starter page — implement job list + run details + retry/cancel.</p>
      </CardContent>
    </Card>
  );
}
