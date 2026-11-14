/* ── 적립금 규칙 (2026-11 조정) ──
   · 현장 모드로 모든 보물을 탁본해 완주한 코스만 적립합니다(데모 모드 완주는 0P). 코스마다 한 번, 1P ≈ 1원.
   · 예전 규칙(완주 100,000P)으로 이 기기에 쌓인 포인트는 1/200 로 바꿉니다(100,000P → 500P). */
const POINTS_ONSITE_ONLY = true;
const POINTS_VERSION = 2, POINTS_RESCALE = 200;
if ((wallet.pv || 1) < POINTS_VERSION){
  const r = v => Math.round((v || 0) / POINTS_RESCALE);
  wallet.points = r(wallet.points);
  wallet.history = (wallet.history || []).map(h => Object.assign({}, h, { points: r(h.points) }));
  wallet.pv = POINTS_VERSION;
}
if (save.reward && !save.reward.pv){ save.reward.earned = Math.round((save.reward.earned || 0) / POINTS_RESCALE); save.reward.pv = POINTS_VERSION; }
const onsiteAll = () => STOPS.every(s => save.done[s.id] && save.done[s.id].onsite);
document.head.insertAdjacentHTML("beforeend", `<style>.prize .pts.off{background:transparent;border:1px dashed var(--gold-soft);color:var(--ink-2);font-size:15px}.prize .pts-note{margin:6px 0 0;font-size:13px}</style>`);
