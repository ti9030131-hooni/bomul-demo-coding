/** 보물 상자 제목·부제: 서버 완주 성공일 때만 축하, 그 외는 현장 인증 안내 */
(function (root) {
  function rewardTitleKind(reward) {
    if (reward && reward.server) return "congrats";
    if (reward && reward.blocked === "login") return "login";
    return "needOnsite";
  }

  /** @returns {'congrats'|'login'|'demoNeedOnsite'|'needOnsite'|''} */
  function rewardSubKind(reward, localOnsiteComplete) {
    if (!reward) return "";
    if (reward.server) return "congrats";
    if (reward.blocked === "login") return "login";
    if (reward.blocked === "onsite" && !localOnsiteComplete) return "demoNeedOnsite";
    if (reward.blocked === "onsite") return "needOnsite";
    return "";
  }

  root.BomulRewardChestUi = { rewardTitleKind, rewardSubKind };
})(typeof globalThis !== "undefined" ? globalThis : this);
