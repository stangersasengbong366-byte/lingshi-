export function normalizeVideoTrack(value) {
  const label = String(value || "").trim();
  if (/目标/.test(label)) return "目标班";
  if (/菁英|精英/.test(label)) return "菁英班";
  return "通用";
}

export function filterVideoRowsByTrack(rows, videoTrack) {
  const normalizedRows = rows.map((row) => ({ ...row, normalizedTrack: normalizeVideoTrack(row.layered) }));
  const hasExplicitTracks = normalizedRows.some((row) => row.normalizedTrack === "目标班" || row.normalizedTrack === "菁英班");
  if (!hasExplicitTracks) return rows;

  return normalizedRows
    .filter((row) => row.normalizedTrack === "通用" || row.normalizedTrack === videoTrack)
    .map(({ normalizedTrack, ...row }) => row);
}
