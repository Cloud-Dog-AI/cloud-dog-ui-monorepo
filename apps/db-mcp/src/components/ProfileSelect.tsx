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

import { Select } from "@cloud-dog/ui";
import { useDbMcpState } from "../state/AppState";

export function ProfileSelect(props: { id?: string; label?: string }) {
  const { profiles, profilesLoading, selectedProfileId, setSelectedProfileId } = useDbMcpState();

  return (
    <div className="space-y-2">
      <label htmlFor={props.id ?? "profile-select"} className="text-sm font-medium">
        {props.label ?? "Profile"}
      </label>
      <Select
        id={props.id ?? "profile-select"}
        value={selectedProfileId}
        onChange={(event) => setSelectedProfileId(event.target.value)}
        disabled={profilesLoading || profiles.length === 0}
      >
        {profiles.length > 0 ? <option value="">Select a profile</option> : null}
        {profiles.length === 0 ? <option value="">No profiles configured</option> : null}
        {profiles.map((profile) => (
          <option key={profile.profile_id} value={profile.profile_id}>
            {profile.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
