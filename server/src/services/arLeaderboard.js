const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function seoulParts(date) {
  const shifted = new Date(date.getTime() + SEOUL_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

function seoulMidnight(year, month, day) {
  return new Date(Date.UTC(year, month, day) - SEOUL_OFFSET_MS);
}

/** 이번 주: 월요일 00:00 ~ 다음 월요일 00:00 (Asia/Seoul) */
export function seoulWeekRange(now = new Date()) {
  const parts = seoulParts(now);
  const mondayShift = parts.weekday === 0 ? 6 : parts.weekday - 1;
  const start = seoulMidnight(parts.year, parts.month, parts.day - mondayShift);
  const end = new Date(start.getTime() + WEEK_MS);
  const startLabel = seoulParts(start);
  const endLabel = seoulParts(new Date(end.getTime() - 1));
  return {
    start,
    end,
    label: `${startLabel.month + 1}/${startLabel.day}–${endLabel.month + 1}/${endLabel.day}`,
  };
}

/** 가장 이른 현장 인증부터 완주 시각까지의 밀리초. 인증이 없으면 null */
export function elapsedFromCheckins(checkins, finishedAt) {
  const times = (checkins || [])
    .map((item) => new Date(item.at).getTime())
    .filter((value) => Number.isFinite(value));
  const end = new Date(finishedAt).getTime();
  if (!times.length || !Number.isFinite(end)) return null;
  const start = Math.min(...times);
  if (end < start) return null;
  return end - start;
}

/** 짧은 완주 시간 순. 같으면 먼저 끝난 순. */
export function rankWeekly(rows) {
  return [...rows]
    .filter((row) => Number.isFinite(row.elapsedMs) && row.elapsedMs >= 0)
    .sort((a, b) => a.elapsedMs - b.elapsedMs || new Date(a.finishedAt) - new Date(b.finishedAt))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
