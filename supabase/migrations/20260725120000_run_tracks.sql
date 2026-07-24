-- Run route storage (TZ §5: реплей трека). A run session keeps a SIMPLIFIED
-- polyline (≤200 [lon, lat] pairs) — an aggregate of the run, consistent with
-- the «no per-rep rows» rule. Non-run sessions leave it null.
alter table public.sessions
  add column if not exists track jsonb;
