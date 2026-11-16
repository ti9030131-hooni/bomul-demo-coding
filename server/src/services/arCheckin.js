/**
 * 현장 checkin 원자 기록.
 * 동일 user+course+stopId 는 한 번만 checkins 에 들어갑니다.
 */

function duplicateKey(err) {
  return Boolean(err && (err.code === 11000 || err.code === 11001));
}

/**
 * @param {{
 *   findOneAndUpdate: Function,
 *   findOne: Function,
 *   create: Function,
 * }} repo  ArProgress 모델 또는 동일 인터페이스
 */
export async function appendCheckinAtomic(repo, { userId, courseId, stopId, entry }) {
  const filter = { user: userId, courseId, 'checkins.stopId': { $ne: stopId } };
  const push = { $push: { checkins: entry } };

  let updated = await repo.findOneAndUpdate(filter, push, { new: true });
  if (updated) return { already: false, progress: updated };

  let existing = await repo.findOne({ user: userId, courseId });
  if (existing) {
    const has = (existing.checkins || []).some((item) => item.stopId === stopId);
    if (has) return { already: true, progress: existing };
    updated = await repo.findOneAndUpdate(filter, push, { new: true });
    if (updated) return { already: false, progress: updated };
    existing = await repo.findOne({ user: userId, courseId });
    return { already: true, progress: existing };
  }

  try {
    const created = await repo.create({ user: userId, courseId, checkins: [entry] });
    return { already: false, progress: created };
  } catch (err) {
    if (!duplicateKey(err)) throw err;
  }

  updated = await repo.findOneAndUpdate(filter, push, { new: true });
  if (updated) return { already: false, progress: updated };

  existing = await repo.findOne({ user: userId, courseId });
  return { already: true, progress: existing };
}

/** 단위 테스트용 인메모리 Progress 저장소 (문서 단위 직렬화 = Mongo 원자 갱신 흉내) */
export function createMemoryProgressRepo({ concurrent = false } = {}) {
  const docs = new Map();
  let chain = Promise.resolve();

  const keyOf = (user, courseId) => `${String(user)}::${courseId}`;

  const runExclusive = (fn) => {
    if (!concurrent) return fn();
    const next = chain.then(fn, fn);
    chain = next.then(() => undefined, () => undefined);
    return next;
  };

  return {
    async findOne(query) {
      return runExclusive(async () => {
        const doc = docs.get(keyOf(query.user, query.courseId));
        return doc ? structuredClone(doc) : null;
      });
    },
    async findOneAndUpdate(filter, update, _options) {
      return runExclusive(async () => {
        const key = keyOf(filter.user, filter.courseId);
        const doc = docs.get(key);
        if (!doc) return null;
        const stopClause = filter['checkins.stopId'];
        const stopNe = stopClause && typeof stopClause === 'object' && '$ne' in stopClause
          ? stopClause.$ne
          : stopClause;
        if (stopNe != null && (doc.checkins || []).some((c) => c.stopId === stopNe)) return null;
        if (update.$push?.checkins) {
          doc.checkins = [...(doc.checkins || []), structuredClone(update.$push.checkins)];
        }
        docs.set(key, doc);
        return structuredClone(doc);
      });
    },
    async create(doc) {
      return runExclusive(async () => {
        const key = keyOf(doc.user, doc.courseId);
        if (docs.has(key)) {
          const err = new Error('duplicate');
          err.code = 11000;
          throw err;
        }
        const saved = {
          user: doc.user,
          courseId: doc.courseId,
          checkins: structuredClone(doc.checkins || []),
        };
        docs.set(key, saved);
        return structuredClone(saved);
      });
    },
  };
}
