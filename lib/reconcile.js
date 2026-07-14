export function overlayPending(serverTask, pendingPatches) {
  let task = { ...serverTask };
  for (const p of pendingPatches) {
    if (p.id !== serverTask.id) continue;
    task = { ...task, ...p.patch };
  }
  return task;
}

export function dropAcked(pendingPatches, ackedIds) {
  const acked = new Set(ackedIds);
  return pendingPatches.filter(p => !acked.has(p.patchId));
}
