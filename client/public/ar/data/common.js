/*
 * 보물 여행 AR — 모든 코스가 함께 쓰는 설정
 *  - prizes   : 보물 상자를 열면 나오는 완주 상품 (예시 문구입니다. 운영 정책에 맞게 바꿔 주세요)
 *               icon: cert | point | draw,  points: 지급할 적립금,  go: cert(증명서) | shop(포인트 상품)
 *  - pointShop: 포인트로 교환하는 1~5등 상품 (필요 포인트는 예시입니다)
 *               icon: crown | gift | voucher | coffee | ticket
 * 적립금(포인트)은 코스와 상관없이 한 지갑에 쌓입니다.
 */
window.BOMUL_AR_COMMON = {
  prizes: [
    { icon: "cert",  title: "완주 증명서", desc: "코스를 완주한 탐험가 증명서입니다. 이름을 적어 A4로 인쇄할 수 있어요.", action: "증명서 보기", go: "cert" },
    { icon: "point", title: "보물 적립금", points: 500, desc: "현장 완주 적립금 500P입니다. 데모 모드 완주는 적립되지 않아요.", action: "포인트 상품 고르기", go: "shop" },
    { icon: "draw",  title: "완주 보상 추첨 응모", desc: "로그인한 회원은 결제·현장 체험 없이 계정당 무료 응모 1회(모든 시즌 통산)를 쓸 수 있어요. 도전권 완주 응모는 시즌마다 가능합니다. 1등 150만·2등 100만·3등 50만 원." },
  ],
  pointShop: [
    { id: "rank1", rank: 1, icon: "crown",   name: "80만~100만 원 상당 상품",   points: 1000000, desc: "80만~100만 원 상당의 상품 가운데 하나를 골라 받을 수 있어요." },
    { id: "rank2", rank: 2, icon: "gift",    name: "50만 원 상당 상품",         points: 500000,  desc: "50만 원 상당의 상품 가운데 하나를 골라 받을 수 있어요." },
    { id: "rank3", rank: 3, icon: "voucher", name: "백화점 상품권 10만 원",      points: 200000,  desc: "모바일 백화점 상품권으로 보내 드려요." },
    { id: "rank4", rank: 4, icon: "coffee",  name: "스타벅스 커피 쿠폰",         points: 50000,   desc: "모바일 쿠폰으로 보내 드려요." },
    { id: "rank5", rank: 5, icon: "ticket",  name: "편의점 모바일 상품권 5천 원", points: 20000,   desc: "모바일 상품권으로 보내 드려요." },
  ],
};
