export function applyVideoPhaseLimits(product, subject, rows, entitlement) {
  const limits = product.subjectVideoPhaseLimits?.[subject] ?? product.videoPhaseLimits;
  if (!limits || !Object.keys(limits).length) return rows.slice(0, entitlement || undefined);
  const used = {};
  const selected = rows.filter((row) => {
    const limit = Number(limits[row.quarter]);
    if (!Number.isFinite(limit)) return true;
    used[row.quarter] = used[row.quarter] ?? 0;
    if (used[row.quarter] >= limit) return false;
    used[row.quarter] += 1;
    return true;
  });
  return selected.slice(0, entitlement || undefined);
}
