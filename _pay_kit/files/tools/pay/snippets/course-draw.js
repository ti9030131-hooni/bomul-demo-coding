/* ═════════════════ 완주 보상 추첨(시즌마다 1인 1회) ═════════════════
   보물 상자를 열면 서버 /api/draw/entries 에 응모합니다. 이미 응모했으면 처음 응모한 코스를 알려 줍니다.
   서버에 추첨 기능이 없거나(미리보기·정적 실행) 연결이 안 되면 상품 설명만 보여 줍니다. */
const DRAW = { msg: "" };
document.head.insertAdjacentHTML("beforeend", `<style>.prize .draw-st{margin-top:6px;font-weight:600;color:var(--gold)}.prize .draw-st .act{margin-left:6px}</style>`);
async function syncDraw(){
  const el = document.querySelector("[data-draw-st]");
  if (!el || window.BOMUL_PREVIEW || !location.protocol.startsWith("http")) return;
  const set = html => { el.innerHTML = html; el.hidden = false; };
  if (DRAW.msg) { set(DRAW.msg); return; }
  const info = await fetchJson(`${API_BASE}/api/draw`, 4000);
  if (!info) return;                                          // 추첨 기능이 없는 서버
  const loginBtn = `<button class="act" data-act="login">로그인</button>`;
  const t = payToken();
  if (!t) { set(`로그인하면 추첨에 응모돼요. ${loginBtn}`); return; }
  try {
    const r = await fetch(`${API_BASE}/api/draw/entries`, { method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${t}` }, body: JSON.stringify({ courseId: C.id }) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { set(`로그인하면 추첨에 응모돼요. ${loginBtn}`); return; }
    if (r.ok) DRAW.msg = d.already
      ? `이미 「${esc(d.entry && d.entry.courseTitle || "다른 코스")}」 완주로 응모되어 있어요. 추첨은 시즌마다 한 사람당 한 번이에요.`
      : "이번 시즌 추첨에 응모되었어요. 추첨은 시즌마다 한 사람당 한 번이에요.";
    else if (d.code === "NEED_TICKET") DRAW.msg = `도전권이 있어야 응모할 수 있어요. <button class="act" data-act="pay">도전권 보기</button>`;
    else DRAW.msg = esc(d.message || "응모하지 못했어요. 잠시 뒤 다시 열어 주세요.");
    set(DRAW.msg);
    if (!r.ok) DRAW.msg = "";                                  // 실패는 다음에 다시 시도
  } catch(e){ /* 연결 실패: 설명만 보여 줌 */ }
}

