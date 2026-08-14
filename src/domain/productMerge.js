export function mergeCloudProductChanges(cloudProducts, nextProducts, { upsertIds = [], deleteIds = [] } = {}) {
  const nextById = new Map(nextProducts.map((product) => [product.id, product]));
  const upsertSet = new Set(upsertIds);
  const deleteSet = new Set(deleteIds);
  const merged = cloudProducts
    .filter((product) => !deleteSet.has(product.id))
    .map((product) => upsertSet.has(product.id) && nextById.has(product.id)
      ? nextById.get(product.id)
      : product);
  const existingIds = new Set(merged.map((product) => product.id));
  for (const id of upsertSet) {
    if (!existingIds.has(id) && nextById.has(id)) merged.push(nextById.get(id));
  }
  return merged;
}

