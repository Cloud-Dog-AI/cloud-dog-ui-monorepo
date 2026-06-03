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

// @cloud-dog/app-notification-agent — Catch-all page for legacy paths now served by the SPA shell.

import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button, Card, CardContent, CardHeader } from '@cloud-dog/ui';

export function LegacyRoutePage() {
  const location = useLocation();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Route migrated into the SPA</h1>
        <p className="text-sm text-muted-foreground">
          The legacy path <code>{location.pathname}</code> now resolves inside the React shell.
        </p>
      </header>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Recommended destinations</h2>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/">Dashboard</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/admin/users">Users</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/groups">Groups</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/channels">Channels</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/messages">Messages</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/deliveries">Deliveries</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/jobs">Jobs</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/admin/api-keys">API Keys</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/settings">Settings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
