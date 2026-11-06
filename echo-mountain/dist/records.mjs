const KEY='echo-mountain-records-v1';
export function loadRecords(storage) {
  try { const data=JSON.parse(storage.getItem(KEY)||'{}'); return data && typeof data==='object' && !Array.isArray(data) ? data : {}; }
  catch { return {}; }
}
export function saveRun(storage,run) {
  if (!['crashed','finished'].includes(run.phase)) return loadRecords(storage);
  const records=loadRecords(storage),old=records[run.difficulty]||{};
  const item={distance:run.y,x:run.x,score:Math.floor(run.score),phase:run.phase,seed:run.course.seed};
  records[run.difficulty]={last:item,best:!old.best || !Number.isFinite(old.best.distance) || item.distance>old.best.distance ? item : old.best};
  try { storage.setItem(KEY,JSON.stringify(records)); } catch { /* The current run remains playable without storage. */ }
  return records;
}
export function validRecord(record, course) {
  return record && Number.isFinite(record.distance) && record.distance>=0 && (course.endless||record.distance<=course.length) && Number.isFinite(record.x) && record.x>=0 && record.x<=course.width;
}
