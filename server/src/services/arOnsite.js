/*
 * 현장 GPS 인증 판정. DB·Express에 의존하지 않는 순수 함수입니다.
 * 데모 탁본은 허용하되, 적립금·상품·상금은 이 검사를 통과한 현장 완주만 줍니다.
 */

export const ONSITE_RULES = {
  maxAccuracyM: 80,
  accuracyBufferCapM: 50,
  minGapMs: 60_000,
  maxSpeedKmh: 150,
  futureSkewMs: 120_000,
};

export function haversineMeters(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r;
  const dLng = (bLng - aLng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function fail(reason, message) {
  return { ok: false, reason, message };
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * @param {{ id: string, lat: number|null, lng: number|null }} stop
 * @param {{ lat: number, lng: number, accuracy: number, at: number }} sample
 * @param {{ stopId: string, lat: number, lng: number, at: number } | null} previous
 * @param {number} now
 * @param {number} onsiteRadius
 */
export function judgeOnsiteCheckin({ stop, sample, previous = null, now = Date.now(), onsiteRadius = 120 }) {
  const lat = sample?.lat;
  const lng = sample?.lng;
  const accuracy = sample?.accuracy;
  const at = sample?.at;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return fail('invalid', '위치 값이 올바르지 않습니다.');
  }
  if (!isFiniteNumber(accuracy) || accuracy < 0) {
    return fail('invalid', '위치 정확도 값이 올바르지 않습니다.');
  }
  if (!isFiniteNumber(at)) {
    return fail('invalid', '시각 값이 올바르지 않습니다.');
  }
  if (at - now > ONSITE_RULES.futureSkewMs) {
    return fail('future', '기기 시각이 서버보다 너무 앞에 있습니다.');
  }
  if (!isFiniteNumber(stop?.lat) || !isFiniteNumber(stop?.lng)) {
    return fail('no-coords', '이 장소는 좌표가 없어 현장 인증을 할 수 없습니다.');
  }
  if (accuracy > ONSITE_RULES.maxAccuracyM) {
    return fail('accuracy', '위치 정확도가 낮아 현장 인증을 할 수 없습니다. 야외에서 다시 시도해 주세요.');
  }
  const distanceM = haversineMeters(lat, lng, stop.lat, stop.lng);
  const allowed = onsiteRadius + Math.min(accuracy, ONSITE_RULES.accuracyBufferCapM);
  if (distanceM > allowed) {
    return fail('far', '장소에서 너무 멀리 있어 현장 인증을 할 수 없습니다. 데모 모드로 체험할 수 있어요.');
  }

  if (previous && previous.stopId && previous.stopId !== stop.id && isFiniteNumber(previous.at)) {
    const dt = at - previous.at;
    if (dt < ONSITE_RULES.minGapMs) {
      return fail('too-fast', '이전 장소 인증 뒤 너무 빨리 이동했습니다. 잠시 뒤 다시 시도해 주세요.');
    }
    if (isFiniteNumber(previous.lat) && isFiniteNumber(previous.lng) && dt > 0) {
      const movedM = haversineMeters(previous.lat, previous.lng, lat, lng);
      const kmh = (movedM / 1000) / (dt / 3_600_000);
      if (kmh > ONSITE_RULES.maxSpeedKmh) {
        return fail('teleport', '이동 속도가 비정상적으로 빨라 현장 인증을 할 수 없습니다.');
      }
    }
  }

  return { ok: true, distanceM };
}

export function isCourseOnsiteComplete(stopIds, checkins) {
  if (!Array.isArray(stopIds) || stopIds.length === 0) return false;
  const ok = new Set((checkins || []).map((item) => item.stopId).filter(Boolean));
  return stopIds.every((id) => ok.has(id));
}

export function sumPrizePoints(prizes) {
  return (prizes || []).reduce((total, prize) => total + Math.max(0, Math.round(Number(prize?.points) || 0)), 0);
}

export const SHORT_COURSE_REWARD = 5000;
export const LONG_COURSE_REWARD = 10000;

function durationMinutes(value) {
  const text = String(value || '');
  const hours = text.match(/(\d+)\s*시간/);
  const mins = text.match(/(\d+)\s*분/);
  if (!hours && !mins) return null;
  return (hours ? Number(hours[1]) * 60 : 0) + (mins ? Number(mins[1]) : 0);
}

export function isShortCourse(course) {
  const n = (course?.stops || []).length;
  const blob = [course?.title, course?.summary, course?.duration, course?.ar?.duration, course?.text?.duration]
    .filter(Boolean)
    .join(' ');
  if (/반나절/.test(blob)) return true;
  const mins = durationMinutes(blob);
  if (mins != null && mins <= 120) return true;
  return n > 0 && n <= 3;
}

export function completionRewardPoints(course) {
  return isShortCourse(course) ? SHORT_COURSE_REWARD : LONG_COURSE_REWARD;
}

export function arStopId(stop, index) {
  const key = typeof stop?.ar?.key === 'string' ? stop.ar.key.trim() : '';
  return key || `s${index + 1}`;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function couponCode(prefix = 'BMP') {
  let body = '';
  for (let i = 0; i < 8; i += 1) body += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `${prefix}-${body.slice(0, 4)}-${body.slice(4)}`;
}
