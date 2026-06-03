// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// PS-76 v2 Job Control WebUI — file-mcp-server
// JW2 exact 12 columns. JW3 badge colours. JW4 7-tab detail dialog. W28A-620 pagination.

import * as React from "react";
import { Badge, Button, DataTable, EntityDialog, Input, JsonBlock, MetricCard, Select, type BulkAction, type DataColumn } from "@cloud-dog/ui";
import { useFileMcpState } from "../state/AppState";
import { isAdminUser } from "../lib/rbac";
import type { JobSummary, QueueStatus } from "../lib/types";

const CANCELLABLE = new Set(["created","validated","queued","scheduled","dispatched","running","blocked","paused"]);
const RETRYABLE = new Set(["failed","cancelled","timed_out","timeout","dead_lettered"]);
const TERMINAL = new Set(["completed","succeeded","failed","cancelled","timed_out","timeout","dead_lettered","ttl_expired","archived"]);

function ns(status?: string|null): string { return String(status ?? "unknown").trim().toLowerCase(); }
function trunc(v: unknown, max=60): string { const t=String(v??"").trim(); if(!t) return "\u2014"; return t.length>max?`${t.slice(0,max-1)}\u2026`:t; }

function statusBadge(status?: string|null): {variant:"default"|"secondary"|"destructive";className?:string} {
  const v=ns(status);
  if(["succeeded","completed"].includes(v)) return {variant:"default",className:"bg-emerald-600 text-white border-emerald-700"};
  if(["failed","dead_lettered"].includes(v)) return {variant:"destructive",className:"font-semibold"};
  if(["timed_out","timeout"].includes(v)) return {variant:"destructive"};
  if(["retry_wait","blocked","paused"].includes(v)) return {variant:"secondary",className:"bg-amber-100 text-amber-900 border-amber-200"};
  if(v==="scheduled") return {variant:"secondary",className:"bg-sky-100 text-sky-900 border-sky-200"};
  if(v==="cancelled") return {variant:"secondary",className:"line-through opacity-80"};
  if(v==="ttl_expired") return {variant:"secondary",className:"text-red-700 opacity-80"};
  if(v==="archived") return {variant:"secondary",className:"opacity-70"};
  return {variant:"secondary"};
}

function fmtDur(job: JobSummary): string {
  const val=Number(job.duration_seconds??job.duration_s??NaN);
  if(Number.isNaN(val)||val<0) return "\u2014";
  if(val<60) return `${Math.round(val)}s`;
  const m=Math.floor(val/60), s=Math.round(val%60);
  if(m<60) return s>0?`${m}m ${s}s`:`${m}m`;
  const h=Math.floor(m/60), rm=m%60;
  return rm>0?`${h}h ${rm}m`:`${h}h`;
}

function fmtTs(ts?: string|null): React.ReactNode {
  if(!ts) return "\u2014";
  return <span className="text-xs" title={ts}>{new Date(ts).toLocaleString()}</span>;
}

function matchSearch(job: JobSummary, q: string): boolean {
  return [job.job_id,job.job_type,job.status,job.request_auth_identity,job.user_id,job.correlation_id,job.outcome].map(v=>String(v??"").toLowerCase()).join(" ").includes(q.toLowerCase());
}

type DetailTab = "overview"|"parameters"|"input"|"result"|"thinking"|"lifecycle"|"raw";
const TABS: {id:DetailTab;label:string}[] = [
  {id:"overview",label:"Overview"},{id:"parameters",label:"Parameters"},{id:"input",label:"Input ref"},
  {id:"result",label:"Result / Output"},{id:"thinking",label:"Thinking"},{id:"lifecycle",label:"Lifecycle log"},{id:"raw",label:"Raw"},
];

type PA = Readonly<{action:"cancel"|"retry"|"delete";jobIds:string[];label:string}>;

export function JobsPage() {
  const app=useFileMcpState();
  const {api}=app;
  const isAdmin=isAdminUser(app.currentUser);
  const [jobs,setJobs]=React.useState<JobSummary[]>([]);
  const [queue,setQueue]=React.useState<QueueStatus|null>(null);
  const [sel,setSel]=React.useState<JobSummary|null>(null);
  const [tab,setTab]=React.useState<DetailTab>("overview");
  const [loading,setLoading]=React.useState(true);
  const [error,setError]=React.useState<string|null>(null);
  const [statusMsg,setStatusMsg]=React.useState<string|null>(null);
  const [page,setPage]=React.useState(1);
  const [pageSize,setPageSize]=React.useState(25);
  const [query,setQuery]=React.useState("");
  const [statusFilter,setStatusFilter]=React.useState("all");
  const [pending,setPending]=React.useState<PA|null>(null);

  const refresh=React.useCallback(async()=>{
    setError(null);setLoading(true);
    try{
      const[j,q]=await Promise.all([api.listJobs(),api.getQueueStatus()]);
      const requestedJobId=typeof window==="undefined"?"":new URLSearchParams(window.location.search).get("job_id")??"";
      let nextJobs=j;
      if(requestedJobId&&!j.some(x=>x.job_id===requestedJobId)){
        const linked=await api.getJob(requestedJobId).catch(()=>null);
        if(linked) nextJobs=[linked,...j];
      }
      setJobs(nextJobs);setQueue(q);setSel(c=>c?nextJobs.find(x=>x.job_id===c.job_id)??c:c);
    }
    catch(e){setError(e instanceof Error?e.message:"Failed to load jobs.");}
    finally{setLoading(false);}
  },[api]);

  React.useEffect(()=>{void refresh();},[refresh]);
  React.useEffect(()=>{setPage(1);},[query,statusFilter,jobs.length]);

  const filtered=React.useMemo(()=>jobs.filter(j=>{
    if(statusFilter!=="all"&&ns(j.status)!==statusFilter) return false;
    if(query.trim()&&!matchSearch(j,query.trim())) return false;
    return true;
  }).sort((a,b)=>String(b.created_at??"").localeCompare(String(a.created_at??""))),[jobs,query,statusFilter]);

  const metrics=React.useMemo(()=>({
    total:jobs.length,
    queueDepth:Number(queue?.queue_depth??jobs.filter(j=>["queued","scheduled","created"].includes(ns(j.status))).length),
    active:Number(queue?.active_jobs??jobs.filter(j=>["running","dispatched"].includes(ns(j.status))).length),
    failed24h:Number(queue?.failed_24h??jobs.filter(j=>ns(j.status)==="failed"&&j.created_at&&Date.now()-new Date(j.created_at).getTime()<86400000).length),
  }),[jobs,queue]);

  const openDetail=React.useCallback((j:JobSummary)=>{setSel(j);setTab("overview");},[]);

  const doAction=React.useCallback(async(action:PA["action"],ids:string[])=>{
    setError(null);let n=0;
    for(const id of ids){const j=filtered.find(x=>x.job_id===id);if(!j)continue;try{
      if(action==="cancel"&&CANCELLABLE.has(ns(j.status))){await api.cancelJob(id);n++;}
      else if(action==="retry"&&RETRYABLE.has(ns(j.status))){await api.retryJob(id);n++;}
      else if(action==="delete"&&TERMINAL.has(ns(j.status))){await api.deleteJob(id);n++;}
    }catch(e){setError(e instanceof Error?e.message:`${action} failed`);break;}}
    setPending(null);setStatusMsg(n>0?`${action} completed for ${n} job(s).`:`No eligible jobs for ${action}.`);await refresh();
  },[api,filtered,refresh]);

  // PS-76 v2 JW2 — 12 mandatory columns in exact order
  const cols=React.useMemo<DataColumn<JobSummary>[]>(()=>[
    {id:"job_id",header:"Job ID",cell:(j)=>(<span className="inline-flex items-center gap-1"><Button type="button" className="font-mono text-xs text-sky-700 hover:underline" onClick={()=>openDetail(j)} title={`View ${j.job_id}`}>{j.job_id}</Button><Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0" title="Copy Job ID" onClick={e=>{e.stopPropagation();void navigator.clipboard.writeText(j.job_id);}}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path d="M4 2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm8 0H6v8h6V2zM2 4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1h-2v1H2V6h1V4H2z"/></svg></Button></span>),sortable:true,sortValue:j=>j.job_id},
    {id:"job_type",header:"Type",cell:j=>trunc(j.job_type,32),sortable:true,sortValue:j=>j.job_type},
    {id:"status",header:"Status",cell:j=>{const b=statusBadge(j.status);return <Badge variant={b.variant} className={b.className}>{j.status}</Badge>;},sortable:true,sortValue:j=>j.status},
    {id:"created_at",header:"Created",cell:j=>fmtTs(j.created_at),sortable:true,sortValue:j=>String(j.created_at??"")},
    {id:"started_at",header:"Started",cell:j=>fmtTs(j.started_at),sortable:true,sortValue:j=>String(j.started_at??"")},
    {id:"updated_at",header:"Updated",cell:j=>fmtTs(j.updated_at),sortable:true,sortValue:j=>String(j.updated_at??"")},
    {id:"completed_at",header:"Completed",cell:j=>fmtTs(j.finished_at??j.completed_at),sortable:true,sortValue:j=>String(j.finished_at??j.completed_at??"")},
    {id:"actor",header:"Actor",cell:j=>trunc(j.request_auth_identity??j.user_id??"\u2014",24),sortable:true,sortValue:j=>String(j.request_auth_identity??j.user_id??"")},
    {id:"duration",header:"Duration",cell:j=>fmtDur(j),sortable:true,sortValue:j=>Number(j.duration_seconds??j.duration_s??-1)},
    {id:"result_link",header:"Result",cell:j=>(<Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" title="View result" onClick={()=>{setSel(j);setTab("result");}}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></Button>)},
    {id:"log_link",header:"Log",cell:j=>(<Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" title="View log" onClick={()=>{setSel(j);setTab("lifecycle");}}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></Button>)},
    {id:"retry_count",header:"Retry count",cell:j=>String(j.attempt??0),sortable:true,sortValue:j=>Number(j.attempt??0)},
    // JW11 extensions
    {id:"file_path",header:"File Path",cell:j=>trunc(String((j.payload as Record<string,unknown>)?.path??"\u2014"),40),sortable:true,sortValue:j=>String((j.payload as Record<string,unknown>)?.path??"")},
    {id:"actions",header:"",cell:j=>(<div className="flex flex-wrap gap-1"><Button type="button" variant="ghost" size="sm" onClick={()=>openDetail(j)}>Detail</Button><Button type="button" variant="ghost" size="sm" disabled={!CANCELLABLE.has(ns(j.status))} onClick={()=>setPending({action:"cancel",jobIds:[j.job_id],label:`Cancel job ${j.job_id.slice(0,8)}?`})}>Cancel</Button><Button type="button" variant="ghost" size="sm" disabled={!RETRYABLE.has(ns(j.status))} onClick={()=>setPending({action:"retry",jobIds:[j.job_id],label:`Retry job ${j.job_id.slice(0,8)}?`})}>Retry</Button><Button type="button" variant="ghost" size="sm" disabled={!TERMINAL.has(ns(j.status))} onClick={()=>setPending({action:"delete",jobIds:[j.job_id],label:`Delete job ${j.job_id.slice(0,8)}?`})}>Delete</Button></div>)},
  ],[openDetail]);

  const bulkActions=React.useMemo<BulkAction[]>(()=>[{label:"Cancel Selected",action:"cancel"},{label:"Retry Selected",action:"retry"},...(isAdmin?[{label:"Delete Selected",action:"delete"}]:[]),{label:"Export Selected",action:"export"}],[isAdmin]);
  const statusOpts=React.useMemo(()=>{const v=new Set<string>();for(const j of jobs)v.add(ns(j.status));return["all",...Array.from(v).filter(Boolean).sort()];},[jobs]);

  function renderTab(j:JobSummary,t:DetailTab):React.ReactNode{
    if(t==="overview") return(<div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm"><span className="font-medium">Job ID</span><span className="font-mono text-xs">{j.job_id}</span><span className="font-medium">Type</span><span>{j.job_type}</span><span className="font-medium">Status</span><span><Badge {...statusBadge(j.status)}>{j.status}</Badge></span><span className="font-medium">Actor</span><span>{j.request_auth_identity??j.user_id??"\u2014"}</span><span className="font-medium">Created</span><span>{j.created_at??"\u2014"}</span><span className="font-medium">Started</span><span>{j.started_at??"\u2014"}</span><span className="font-medium">Updated</span><span>{j.updated_at??"\u2014"}</span><span className="font-medium">Completed</span><span>{j.finished_at??j.completed_at??"\u2014"}</span><span className="font-medium">Duration</span><span>{fmtDur(j)}</span><span className="font-medium">Retry count</span><span>{j.attempt??0}</span>{j.last_error?<><span className="font-medium text-red-700">Last error</span><span className="text-red-700">{typeof j.last_error==="string"?j.last_error:JSON.stringify(j.last_error)}</span></>:null}<span className="font-medium">Correlation ID</span><span className="font-mono text-xs">{j.correlation_id??"\u2014"}</span></div>);
    if(t==="parameters") return j.payload?<JsonBlock title="Request Parameters" value={j.payload} defaultCollapsed={false}/>:<p className="text-sm text-muted-foreground">No parameters.</p>;
    if(t==="input") return j.payload?<JsonBlock title="Input Reference" value={j.payload} defaultCollapsed={false}/>:<p className="text-sm text-muted-foreground">No input ref.</p>;
    if(t==="result") return j.outcome?<JsonBlock title="Result" value={typeof j.outcome==="string"?{result:j.outcome}:j.outcome} defaultCollapsed={false}/>:<p className="text-sm text-muted-foreground">No result.</p>;
    if(t==="thinking") return <p className="text-sm text-muted-foreground">No thinking info for this job type.</p>;
    if(t==="lifecycle") return(<div className="space-y-2"><div className="rounded border text-sm"><div className="grid grid-cols-3 gap-2 border-b bg-muted/30 px-3 py-1 font-medium"><span>Timestamp</span><span>State</span><span>Details</span></div>{j.created_at?<div className="grid grid-cols-3 gap-2 border-b px-3 py-1"><span className="text-xs">{j.created_at}</span><span>created</span><span>Submitted</span></div>:null}{j.started_at?<div className="grid grid-cols-3 gap-2 border-b px-3 py-1"><span className="text-xs">{j.started_at}</span><span>running</span><span>Started</span></div>:null}{(j.finished_at??j.completed_at)?<div className="grid grid-cols-3 gap-2 px-3 py-1"><span className="text-xs">{j.finished_at??j.completed_at}</span><span>{j.status}</span><span>Completed</span></div>:null}</div></div>);
    if(t==="raw") return <JsonBlock title="Full Record" value={j as unknown as Record<string,unknown>} defaultCollapsed={false}/>;
    return null;
  }

  return (
    <div className="space-y-6">
      <header><h1 className="text-2xl font-semibold">Jobs</h1></header>
      {error?<p role="alert" className="text-sm text-destructive">{error}</p>:null}
      {statusMsg?<p role="status" className="text-sm text-foreground/80">{statusMsg}</p>:null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Jobs" value={String(metrics.total)}/>
        <MetricCard label="Queue Depth" value={String(metrics.queueDepth)}/>
        <MetricCard label="Active Jobs" value={String(metrics.active)}/>
        <MetricCard label="Failed (24h)" value={String(metrics.failed24h)}/>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm"><span className="font-medium">Search</span><Input className="rounded-md border px-3 py-2" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by Job ID"/></label>
          <label className="flex flex-col gap-1 text-sm md:w-56"><span className="font-medium">Status</span><Select className="rounded-md border px-3 py-2" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>{statusOpts.map(v=><option key={v} value={v}>{v==="all"?"All statuses":v}</option>)}</Select></label>
          <Button type="button" variant="outline" onClick={()=>void refresh()}>Refresh</Button>
        </div>
        {filtered.length===0&&!loading?<p className="text-sm text-muted-foreground">No jobs matched the current filters.</p>:(
          <>
          <DataTable columns={cols} rows={filtered} totalRows={filtered.length} emptyMessage="No jobs found." getRowId={j=>j.job_id} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} selectable selectionColumnPosition="end" bulkActions={bulkActions} onBulkAction={(a,ids)=>{if(a==="export"){const s=filtered.filter(j=>ids.includes(j.job_id));const b=new Blob([JSON.stringify(s,null,2)],{type:"application/json"});const u=URL.createObjectURL(b);const el=document.createElement("a");el.href=u;el.download="file-mcp-jobs.json";el.click();URL.revokeObjectURL(u);return;}setPending({action:a as PA["action"],jobIds:ids,label:{cancel:`Cancel ${ids.length} job(s)?`,retry:`Retry ${ids.length} job(s)?`,delete:`Delete ${ids.length} job(s)?`}[a]??a});}} columnPickerEnabled tableId="file-mcp-jobs"/>
          <div className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground">
            <span>Total Records: {filtered.length}</span>
            <div className="flex items-center gap-2">
              <select className="rounded border px-1 py-0.5 text-xs" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}} aria-label="Page size">{[10,25,50,100].map(n=><option key={n} value={n}>{n}</option>)}</select>
              <button className="rounded border px-2 py-1 text-xs disabled:opacity-40" disabled={page<=1} onClick={()=>setPage(Math.max(1,page-1))}>Prev</button>
              <span>Page {page} of {Math.max(1,Math.ceil(filtered.length/pageSize))}</span>
              <button className="rounded border px-2 py-1 text-xs disabled:opacity-40" disabled={page*pageSize>=filtered.length} onClick={()=>setPage(page+1)}>Next</button>
            </div>
          </div>
          </>
        )}
      </div>
      <EntityDialog open={sel!==null} onOpenChange={o=>{if(!o)setSel(null);}} title={`Job detail ${String(sel?.job_id??"").slice(0,12)}`} fields={[]} values={{}} onChange={()=>{}} onSubmit={()=>setSel(null)} onCancel={()=>setSel(null)} mode="view" extra={sel?(
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 border-b pb-3">
            <Button type="button" variant="outline" size="sm" onClick={()=>void navigator.clipboard.writeText(sel.job_id)}>Copy Job ID</Button>
            <Button type="button" variant="outline" size="sm" disabled={!RETRYABLE.has(ns(sel.status))} onClick={()=>{setPending({action:"retry",jobIds:[sel.job_id],label:`Retry?`});setSel(null);}}>Retry</Button>
            <Button type="button" variant="outline" size="sm" disabled={!CANCELLABLE.has(ns(sel.status))} onClick={()=>{setPending({action:"cancel",jobIds:[sel.job_id],label:`Cancel?`});setSel(null);}}>Cancel</Button>
            <Button type="button" variant="destructive" size="sm" disabled={!TERMINAL.has(ns(sel.status))} onClick={()=>{setPending({action:"delete",jobIds:[sel.job_id],label:`Delete?`});setSel(null);}}>Delete</Button>
          </div>
          <div className="flex flex-wrap gap-1 border-b pb-2">{TABS.map(t=>(<button key={t.id} type="button" className={`rounded-t px-3 py-1 text-sm ${tab===t.id?"bg-primary text-primary-foreground font-medium":"text-muted-foreground hover:text-foreground"}`} onClick={()=>setTab(t.id)}>{t.label}</button>))}</div>
          <div className="min-h-[12rem]">{renderTab(sel,tab)}</div>
        </div>
      ):undefined}/>
      {pending?(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"><div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg space-y-4"><h2 className="text-lg font-semibold">{pending.label}</h2><p className="text-sm text-muted-foreground">{pending.action==="delete"?"This will permanently remove terminal jobs.":"This action will mutate live job state."}</p><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setPending(null)}>Close</Button><Button type="button" variant={pending.action==="delete"?"destructive":"default"} onClick={()=>void doAction(pending.action,pending.jobIds)}>Confirm</Button></div></div></div>):null}
    </div>
  );
}
