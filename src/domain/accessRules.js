export function isPublicEntrySearch(search = "") {
  const params = new URLSearchParams(search);
  return params.get("sales") === "1" || params.has("s") || params.get("share") === "1";
}

