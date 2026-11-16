/** 보물 상자·증명서: 서버 완주 성공일 때만 축하·수령·지급 완료 */
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

  /** @returns {'paid'|'demoUnpaid'} */
  function rewardPointsStatus(reward) {
    return reward && reward.server ? "paid" : "demoUnpaid";
  }

  function expectedPrizePoints(prizes) {
    return (prizes || []).reduce((total, item) => total + (Number(item && item.points) || 0), 0);
  }

  root.BomulRewardChestUi = {
    rewardTitleKind,
    rewardSubKind,
    rewardHintKind,
    rewardPointsStatus,
    expectedPrizePoints,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
