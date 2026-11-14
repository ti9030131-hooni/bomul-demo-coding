/* ═════════════════ 도전권(결제) ═════════════════
   서버 /api/pay/config 의 mode 가 inicis·mock 일 때만 작동합니다. off·서버 없음·미리보기는 지금처럼 모두 무료.
   앞의 freeTrialStops 곳(기본 1곳)은 무료 체험이고, 그다음 보물부터는 도전권이 있어야 AR 탁본을 열 수 있어요.
   이미 탁본한 보물은 언제든 다시 볼 수 있어요. 결제 화면: /pay.html?course=코스아이디 */
const PASS = { mode:"off", trial:1, allowed:null, reason:"", loading:true, products:[], expiresAt:null, p:null };
function payToken(){ try { return localStorage.getItem("token") || sessionStorage.getItem("token"); } catch(e){ return null; } }
async function checkPass(){
  PASS.loading = true;
  try {
    if (window.BOMUL_PREVIEW || !location.protocol.startsWith("http")) return;
    const cfg = await fetchJson(`${API_BASE}/api/pay/config`, 4000);
    if (!cfg || (cfg.mode !== "inicis" && cfg.mode !== "mock")) { PASS.mode = "off"; return; }
    PASS.mode = cfg.mode; PASS.products = cfg.products || [];
    PASS.trial = Number.isFinite(cfg.freeTrialStops) ? cfg.freeTrialStops : 1;
    const t = payToken();
    if (!t) { PASS.allowed = false; PASS.reason = "login"; return; }
    const r = await fetch(`${API_BASE}/api/pay/access/${encodeURIComponent(C.id)}`, { headers:{ Authorization:`Bearer ${t}` } });
    if (r.status === 401) { PASS.allowed = false; PASS.reason = "login"; return; }
    const d = await r.json();
    PASS.allowed = !!d.allowed; PASS.reason = d.reason || ""; PASS.expiresAt = d.expiresAt || null;
  } catch(e){ PASS.allowed = null; PASS.reason = "error"; }
  finally { PASS.loading = false; }
}
PASS.p = checkPass().then(() => { if (current === "v-stop" && typeof curStop === "number") passNote(curStop); });
function needsPass(i){ return PASS.mode !== "off" && i >= PASS.trial && !save.done[STOPS[i].id] && PASS.allowed !== true; }
const wonP = n => Number(n).toLocaleString("ko-KR") + "원";
function passNote(i){
  const el = $("#passNote"); if (!el) return;
  el.hidden = !needsPass(i);
  if (!el.hidden) el.textContent = `🔒 ${PASS.trial ? `첫 보물 ${PASS.trial}곳은 무료 체험이에요. ` : ""}이 보물은 도전권이 있어야 탁본할 수 있어요.`;
}
function passGate(i){
  const here = `/ar/course.html?id=${encodeURIComponent(C.id)}`;
  const go = url => { location.href = url; };
  if (PASS.reason === "login"){
    openModal(`<h3>회원가입 후 도전할 수 있어요</h3>
      <p>${PASS.trial ? `첫 보물 ${PASS.trial}곳은 무료로 체험할 수 있어요. ` : ""}${ORD[i]} 번째 보물부터는 로그인하고 도전권을 준비하면 이어서 탁본할 수 있어요.</p>
      <button class="btn" id="pgLogin">로그인</button><button class="btn line" id="pgSignup">회원가입</button><button class="btn line" id="pgNo">닫기</button>`);
    $("#pgLogin").addEventListener("click", () => go(`/login?next=${encodeURIComponent(here)}`));
    $("#pgSignup").addEventListener("click", () => go(`/signup?next=${encodeURIComponent(here)}`));
  } else if (PASS.reason === "error" || PASS.allowed == null){
    openModal(`<h3>도전권을 확인하지 못했어요</h3><p>인터넷 연결을 확인하고 다시 시도해 주세요.</p>
      <button class="btn" id="pgRetry">다시 시도</button><button class="btn line" id="pgNo">닫기</button>`);
    $("#pgRetry").addEventListener("click", async () => { closeModal(); PASS.p = checkPass(); await PASS.p; passNote(i); if (!needsPass(i)) openAR(i); else passGate(i); });
  } else {
    openModal(`<h3>도전권이 필요해요</h3>
      <p>${PASS.trial ? `「${esc(C.title)}」의 첫 보물 ${PASS.trial}곳은 무료 체험이에요. ` : ""}도전권이 있으면 남은 보물을 모두 탁본하고 완주 보상을 받을 수 있어요.</p>
      ${PASS.products.length ? `<dl>${PASS.products.map(p => `<dt>${esc(p.name)}</dt><dd>${wonP(p.price)}</dd>`).join("")}</dl>` : ""}
      <button class="btn" id="pgBuy">도전권 구매하기</button><button class="btn line" id="pgNo">나중에</button>`);
    $("#pgBuy").addEventListener("click", () => go(`/pay.html?course=${encodeURIComponent(C.id)}`));
  }
  $("#pgNo").addEventListener("click", closeModal);
}

