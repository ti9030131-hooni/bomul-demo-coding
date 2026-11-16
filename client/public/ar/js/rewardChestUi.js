/** 보물 상자 제목·부제·hint: 서버 완주 성공일 때만 축하·수령 완료 */
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

  /**
   * @returns {'hint'|'openedHint'|'demoOpened'|'needLogin'}
   * openedHint(수령 완료)는 reward.server 일 때만.
   */
  function rewardHintKind(reward, opened) {
    if (reward && reward.server) return "openedHint";
    if (reward && reward.blocked === "login") return "needLogin";
    if (reward && reward.blocked === "onsite") return "demoOpened";
    if (opened && reward) return "demoOpened";
    return "hint";
  }

  root.BomulRewardChestUi = { rewardTitleKind, rewardSubKind, rewardHintKind };
})(typeof globalThis !== "undefined" ? globalThis : this);
