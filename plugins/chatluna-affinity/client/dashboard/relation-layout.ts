const RELATION_LIST_ITEM_HEIGHT = 36;
const RELATION_LIST_ITEM_GAP = 12;

export const RELATION_LIST_MAX_ITEMS = 8;

export function getRelationListMinHeight(itemCount: number) {
  const visibleItemCount = Math.min(
    RELATION_LIST_MAX_ITEMS,
    Math.max(0, itemCount),
  );

  return (
    visibleItemCount * RELATION_LIST_ITEM_HEIGHT +
    Math.max(0, visibleItemCount - 1) * RELATION_LIST_ITEM_GAP
  );
}
