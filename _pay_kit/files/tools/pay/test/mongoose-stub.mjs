// 시험 전용: 아주 작은 메모리 mongoose 흉내. 실제 서버에서는 쓰지 않습니다.
// 아주 작은 메모리 mongoose 흉내(테스트 전용)
let seq = 0;
const oid = () => (++seq).toString(16).padStart(24, 'a');
const get = (o, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);
function match(doc, f) {
  return Object.entries(f || {}).every(([k, cond]) => {
    const v = get(doc, k);
    if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
      if ('$gt' in cond && !(v > cond.$gt)) return false;
      if ('$in' in cond && !cond.$in.includes(v)) return false;
      if ('$ne' in cond && v === cond.$ne) return false;
      return true;
    }
    return String(v) === String(cond);
  });
}
class Q {
  constructor(p) { this.p = p; }
  sort() { return this; } limit() { return this; } select() { return this; } populate() { return this; }
  lean() { return this.p.then((r) => (Array.isArray(r) ? r.map((d) => ({ ...d })) : r && { ...d(r) })); }
  then(a, b) { return this.p.then(a, b); }
}
const d = (x) => x;
class Schema { constructor(def) { this.def = def; this.uniques = []; } index(fields, opt = {}) { if (opt.unique) this.uniques.push(Object.keys(fields)); return this; } }
Schema.Types = { ObjectId: 'ObjectId' };
function model(name, schema) {
  const rows = [];
  class M {
    constructor(data) {
      for (const [k, def] of Object.entries(schema.def)) if (def && 'default' in def) this[k] = Array.isArray(def.default) ? [] : def.default;
      Object.assign(this, data); if (!this._id) this._id = oid();
    }
    async save() { const i = rows.findIndex((r) => r._id === this._id); this.updatedAt = new Date(); if (i < 0) { this.createdAt = new Date(); rows.push(this); } return this; }
    static async create(data) {
      for (const [k, def] of Object.entries(schema.def)) if (def?.unique && rows.some((r) => r[k] === data[k])) { const e = new Error('dup'); e.code = 11000; throw e; }
      for (const ks of schema.uniques) if (rows.some((r) => ks.every((k) => String(r[k]) === String(data[k])))) { const e = new Error('dup'); e.code = 11000; throw e; }
      return new M(data).save();
    }
    static find(f) { return new Q(Promise.resolve(rows.filter((r) => match(r, f)))); }
    static findOne(f) { return new Q(Promise.resolve(rows.find((r) => match(r, f)) || null)); }
    static async updateOne(f, u, opt = {}) {
      const r = rows.find((x) => match(x, f));
      if (r) { Object.assign(r, u.$set || {}); return { matched: 1 }; }
      if (opt.upsert) { await M.create({ ...(u.$setOnInsert || {}), ...(u.$set || {}) }); return { upserted: 1 }; }
      return { matched: 0 };
    }
  }
  M.rows = rows; M.modelName = name; return M;
}
export default { Schema, model, Types: { ObjectId: 'ObjectId' }, isValidObjectId: (s) => /^[0-9a-f]{24}$/.test(s) };
