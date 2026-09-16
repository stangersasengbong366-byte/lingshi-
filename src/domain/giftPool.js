function giftKey(item) {
  return item?._sourceKey || `${item?.type ?? "赠课"}-${item?.name ?? ""}`;
}

function unique(items) {
  const map = new Map();
  items.forEach((item) => map.set(giftKey(item), item));
  return [...map.values()];
}

export function preserveGiftPoolOnProductDelete(products, productId, preservedItems = [], preservedPhysicalItems = []) {
  const target = products.find((product) => product.id === productId);
  const remaining = products.filter((product) => product.id !== productId);
  if (!target || !remaining.length) return { products: remaining, carrierId: null };

  const carrier = remaining[0];
  const pooledItems = preservedItems
    .filter((item) => item?.type === "赠课" && item?.name)
    .map((item) => ({ ...item, poolGrade: target.grade }));
  const pooledPhysicalItems = preservedPhysicalItems
    .filter((item) => item?.type !== "赠课" && item?.name)
    .map((item) => ({ ...item, poolGrade: target.grade }));
  const deletedItems = (target.giftPoolDeletedItems ?? []).filter((item) => item?.grade && item?.key);
  const deletedMap = new Map([
    ...(carrier.giftPoolDeletedItems ?? []),
    ...deletedItems,
  ].map((item) => [`${item.grade}:${item.key}`, item]));
  const physicalDeletedMap = new Map([
    ...(carrier.physicalGiftPoolDeletedItems ?? []),
    ...(target.physicalGiftPoolDeletedItems ?? []),
  ].filter((item) => item?.grade && item?.key).map((item) => [`${item.grade}:${item.key}`, item]));
  return {
    carrierId: carrier.id,
    products: remaining.map((product) => product.id === carrier.id ? {
      ...product,
      giftPoolItems: unique([
        ...(product.giftPoolItems ?? []),
        ...(target.giftPoolItems ?? []),
        ...pooledItems,
      ]),
      giftPoolDeletedItems: [...deletedMap.values()],
      physicalGiftPoolItems: unique([
        ...(product.physicalGiftPoolItems ?? []),
        ...(target.physicalGiftPoolItems ?? []),
        ...pooledPhysicalItems,
      ]),
      physicalGiftPoolDeletedItems: [...physicalDeletedMap.values()],
    } : product),
  };
}
