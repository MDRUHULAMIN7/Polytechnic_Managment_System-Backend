type TSubjectSearchQuery = {
  queryObj: Record<string, unknown>;
  baseCriteria: Record<string, unknown>;
};

export function buildSubjectSearchQuery(
  query: Record<string, unknown>,
): TSubjectSearchQuery {
  const searchTerm =
    typeof query.searchTerm === 'string' ? query.searchTerm.trim() : '';
  const searchConditions: Record<string, unknown>[] = [];
  const queryObj = { ...query };

  if (searchTerm) {
    searchConditions.push(
      { title: { $regex: searchTerm, $options: 'i' } },
      { prefix: { $regex: searchTerm, $options: 'i' } },
    );

    const numericSearchTerm = Number(searchTerm);
    if (!Number.isNaN(numericSearchTerm)) {
      searchConditions.push({ code: numericSearchTerm });
    }
  }

  return {
    queryObj,
    baseCriteria:
      searchConditions.length > 0
        ? { isDeleted: { $ne: true }, $or: searchConditions }
        : { isDeleted: { $ne: true } },
  };
}
