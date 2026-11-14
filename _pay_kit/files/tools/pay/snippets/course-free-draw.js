/* ═════════════════ 완주 보상 추첨 · 무료 응모 ═════════════════
   결제하지 않아도 첫 보물(무료 체험)을 탁본하면 추첨에 1인 1회 무료로 응모할 수 있어요(구매 없이 응모).
   결제가 켜져 있고 아직 도전권이 없을 때만 보입니다. 서버: POST /api/draw/entries { courseId, source: "free" } */
document.head.insertAdjacentHTML("beforeend", `<style>.free-draw{margin:14px 0 4px;padding:12px 14px;border:1px dashed var(--gold-soft);border-radius:6px;text-align:left}.free-draw p{margin:0 0 10px;font-family:var(--sans);font-size:14px;line-height:1.6;color:var(--ink-2)}.free-st{font-family:var(--sans);font-weight:600;font-size:14px;color:var(--gold);margin:10px 0 0}</style>`);
const freeTrialN = () => Math.max(1, PASS.trial || 0);
const freeDrawOn = () => PASS.mode !== "off" && PASS.allowed !== true;
function freeDrawBtn(){
  return freeDrawOn() && STOPS.slice(0, freeTrialN()).some(s => save.done[s.id]) ? `<button class="btn line" id="pgFree">추첨에만 무료 응모하기</button>` : "";
}
function freeDrawNote(i){
  if (!freeDrawOn() || i >= freeTrialN()) return "";
  return `<div class="free-draw"><p>무료 체험을 마쳤어요. 결제하지 않아도 완주 보상 추첨(시즌마다 1인 1회)에 무료로 응모할 수 있어요.</p><button class="btn line" id="pgFree">추첨에 무료 응모하기</button></div>`;
}
async function enterFreeDraw(){
  const t = payToken();
  if (!t) return { login: true, msg: "로그인하면 무료로 응모할 수 있어요." };
  try {
    const r = await fetch(`${API_BASE}/api/draw/entries`, { method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${t}` }, body: JSON.stringify({ courseId: C.id, source: "free" }) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) return { login: true, msg: "로그인하면 무료로 응모할 수 있어요." };
    if (r.ok) return { ok: true, msg: d.already
      ? `이미 「${d.entry && d.entry.courseTitle || "다른 코스"}」에서 응모되어 있어요. 추첨은 시즌마다 한 사람당 한 번이에요.`
      : "완주 보상 추첨에 무료로 응모했어요. 추첨은 시즌마다 한 사람당 한 번이에요." };
    return { msg: d.message || "응모하지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  } catch(e){ return { msg: "연결이 원활하지 않아요. 잠시 뒤 다시 시도해 주세요." }; }
}
function bindFreeDraw(){
  const b = document.getElementById("pgFree"); if (!b) return;
  b.addEventListener("click", async () => {
    if (b.dataset.login) { location.href = `/login?next=${encodeURIComponent(`/ar/course.html?id=${encodeURIComponent(C.id)}`)}`; return; }
    b.disabled = true;
    const r = await enterFreeDraw();
    let st = b.parentElement.querySelector(".free-st");
    if (!st) { st = document.createElement("p"); st.className = "free-st"; st.setAttribute("role", "status"); b.after(st); }
    st.textContent = r.msg;
    if (r.login) { b.disabled = false; b.dataset.login = "1"; b.textContent = "로그인하고 무료 응모하기"; }
    else if (r.ok) b.remove();
    else b.disabled = false;
  });
}

