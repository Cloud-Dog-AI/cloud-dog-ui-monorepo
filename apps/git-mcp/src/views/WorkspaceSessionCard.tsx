import * as React from "react";
import { Button, Card, CardContent, CardHeader, Input, Label, Select } from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";

export type WorkspaceSessionState = Readonly<{
  profile: string;
  setProfile: React.Dispatch<React.SetStateAction<string>>;
  repoSource: string;
  setRepoSource: React.Dispatch<React.SetStateAction<string>>;
  sessionId: string;
  setSessionId: React.Dispatch<React.SetStateAction<string>>;
  refType: string;
  setRefType: React.Dispatch<React.SetStateAction<string>>;
  refName: string;
  setRefName: React.Dispatch<React.SetStateAction<string>>;
  workspaceId: string;
  setWorkspaceId: (workspaceId: string) => void;
}>;

export function useWorkspaceSession(defaultRefName = "main"): WorkspaceSessionState {
  const app = useGitMcpState();
  const [profile, setProfile] = React.useState(app.defaultProfile);
  const [repoSource, setRepoSource] = React.useState(app.remoteRepoUrl);
  const [sessionId, setSessionId] = React.useState(`ui-${Date.now()}`);
  const [refType, setRefType] = React.useState("branch");
  const [refName, setRefName] = React.useState(defaultRefName);

  return {
    profile,
    setProfile,
    repoSource,
    setRepoSource,
    sessionId,
    setSessionId,
    refType,
    setRefType,
    refName,
    setRefName,
    workspaceId: app.workspaceId,
    setWorkspaceId: app.setWorkspaceId,
  };
}

export function buildWorkspaceOpenArgs(state: WorkspaceSessionState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    profile: state.profile.trim(),
    repo_source: state.repoSource.trim(),
    session_id: state.sessionId.trim() || `ui-${Date.now()}`,
    workspace_mode: "ephemeral",
  };
  if (state.refName.trim()) {
    payload.ref = { type: state.refType, name: state.refName.trim() };
  }
  return payload;
}

export function WorkspaceSessionCard(props: Readonly<{
  state: WorkspaceSessionState;
  onOpenWorkspace: () => Promise<void>;
  status?: string;
  error?: string | null;
  actions?: React.ReactNode;
  title?: string;
}>) {
  const { state } = props;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{props.title ?? "Workspace session"}</h2>
          <Button onClick={() => void props.onOpenWorkspace()}>Open workspace</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.error ? <p role="alert" className="text-sm text-destructive">{props.error}</p> : null}
        {props.status ? <p role="status" className="text-sm text-foreground/80">{props.status}</p> : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-2">
            <Label htmlFor="workspace-profile">Profile</Label>
            <Input id="workspace-profile" value={state.profile} onChange={(event) => state.setProfile(event.target.value)} />
          </label>
          <label className="space-y-2">
            <Label htmlFor="workspace-repo-source">Repo source</Label>
            <Input id="workspace-repo-source" value={state.repoSource} onChange={(event) => state.setRepoSource(event.target.value)} />
          </label>
          <label className="space-y-2">
            <Label htmlFor="workspace-session-id">Session ID</Label>
            <Input id="workspace-session-id" value={state.sessionId} onChange={(event) => state.setSessionId(event.target.value)} />
          </label>
          <label className="space-y-2">
            <Label htmlFor="workspace-ref-type">Ref type</Label>
            <Select id="workspace-ref-type" value={state.refType} onChange={(event) => state.setRefType(event.target.value)}>
              <option value="branch">branch</option>
              <option value="tag">tag</option>
              <option value="commit">commit</option>
            </Select>
          </label>
          <label className="space-y-2">
            <Label htmlFor="workspace-ref-name">Ref name</Label>
            <Input id="workspace-ref-name" value={state.refName} onChange={(event) => state.setRefName(event.target.value)} />
          </label>
          <label className="space-y-2">
            <Label htmlFor="workspace-id">Workspace ID</Label>
            <Input id="workspace-id" value={state.workspaceId} onChange={(event) => state.setWorkspaceId(event.target.value)} />
          </label>
        </div>
        {props.actions ? <div className="flex flex-wrap gap-2">{props.actions}</div> : null}
      </CardContent>
    </Card>
  );
}
