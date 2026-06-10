/**
 * 지각컷 — 판단 규칙 모음 (단 하나의 "레시피 책")
 * --------------------------------------------------------------------------------
 * 좌석·시간대 → 🔴🟡🟢 신호·라벨·추천·설명을 정하는 규칙을 여기 한곳에 모았다.
 * API Route(서버)와 화면(page.tsx)이 모두 이 파일을 가져다 쓴다.
 * (bus.ts 의 규칙을 그대로 옮긴 것 — 결과는 동일)
 */

// ── 신호 타입 ─────────────────────────────────────────────────────────────
export type Signal = "🟢" | "🟡" | "🔴";

// ── 1) 한국 시각(KST) 기준 '시' 구하기 (분 50↑ 이면 다음 시로 보정) ─────────
// ★개선점★ 그냥 new Date().getHours() 를 쓰면, 배포 서버(Vercel)가 외국(UTC)일 때
//   시간이 9시간 어긋난다. 그래서 항상 한국시간(UTC+9)으로 계산하도록 바꿨다.
export function nowHourAdjusted(): number {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000); // UTC + 9시간 = 한국시간
  let h = kst.getUTCHours();
  const m = kst.getUTCMinutes();
  if (m >= 50) h = (h + 1) % 24; // 50분 이상이면 거의 다음 시
  return h;
}

// ── 1.5) 한국 시각(KST) 기준 '요일' 구하기 (0=일 … 6=토) ───────────────────
export function nowDayKst(): number {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000); // 한국시간
  return kst.getUTCDay(); // 0=일요일, 1=월 … 6=토요일
}

// ── 2) 시 → 시간대 종류 (요일별로 피크 기준이 다름) ────────────────────────
// day 를 안 넘기면 오늘 요일(KST)을 자동으로 사용한다.
export function classifyTime(
  h: number,
  day: number = nowDayKst(),
): "피크" | "피크직전후" | "비피크" {
  // 토요일: 11~15시만 피크, 나머지 비피크 (직전후 없음)
  if (day === 6) return h >= 11 && h <= 15 ? "피크" : "비피크";
  // 일요일: 12~15시만 피크, 나머지 비피크 (직전후 없음)
  if (day === 0) return h >= 12 && h <= 15 ? "피크" : "비피크";
  // 평일(월~금): 기존 그대로
  if (h === 7 || h === 8 || h === 9) return "피크";
  if (h >= 18 && h <= 20) return "피크";
  if (h === 6 || h === 10 || h === 17 || h === 21) return "피크직전후";
  return "비피크";
}

// ── 3) ★핵심★ 좌석 + 시간대 → 신호 (좌석 3단계: 0 / 1~10 / 11~15 / 16+) ─────
export function judge(seats: number, hour: number): Signal {
  if (seats === 0) return "🔴";
  const t = classifyTime(hour);
  if (seats >= 16) return t === "피크" ? "🟡" : "🟢";
  if (seats >= 11) return t === "비피크" ? "🟢" : "🟡";
  return t === "피크" ? "🔴" : "🟡";
}

// ── 4) 신호 + 좌석 → 한 줄 판정 문구 (탑승 중심, 반말) ─────────────────────
// ★🟡(노랑)는 좌석에 따라 둘로 갈린다★
//   - 10석 이하(타기 아슬)  → "서둘러도 아슬아슬해!"
//   - 11석 이상(탈 만함)    → "지금 나가면 탈 수 있어!"
export function verdict(sig: Signal, seats: number): string {
  if (sig === "🔴") return "이번 차는 못 타!";
  if (sig === "🟢") return "완전 탑승 가능!";
  return seats <= 10 ? "서둘러도 아슬아슬해!" : "지금 나가면 탈 수 있어!";
}

// ── 5) 설명 (반말) ─────────────────────────────────────────────────────────
export function describe(sig: Signal, seats: number): string {
  if (sig === "🔴") return "지각 확정… 다음 차도 어렵네";
  if (sig === "🟢") return "여유롭게 출근~ 스트레스 걱정 없네";
  return seats <= 10 ? "간당간당… 자리 얼마 없어!" : "간당간당… 지금 뛰면 탈 수도?";
}

// ── 6) 신호 순위(정렬용): 🟢=0 < 🟡=1 < 🔴=2 ──────────────────────────────
export function sigRank(sig: Signal): number {
  return sig === "🟢" ? 0 : sig === "🟡" ? 1 : 2;
}

// ── 7) 방면(행선지) 설정 ──────────────────────────────────────────────────
export const DIRECTIONS = ["서울역", "강남", "잠실"] as const;

// 방면 → 노선번호 목록
export const DESTINATIONS: Record<string, string[]> = {
  "서울역": ["5000", "5005"],
  "강남": ["5001", "5003"],
  "잠실": ["5600"],
};

// 광역버스(직행좌석형) 종류 코드
export const GWANGYEOK = 11;

// 노선이름 맨 앞 숫자만 ("5005(예약)"→"5005", "5001A"→"5001")
export function baseNumber(routeName: string | number): string {
  return String(routeName).match(/^\d+/)?.[0] ?? "";
}

// 빈자리 값이 "진짜 숫자"인지 (""·null·-1 = 정보없음)
export function hasSeatInfo(v: string | number | null | undefined): boolean {
  if (v === "" || v == null) return false;
  return Number(v) >= 0;
}

// ── 8) 경기버스 API 응답 1건의 모양 (우리가 쓰는 필드만) ──────────────────
export type RawArrival = {
  routeName: string | number;
  routeTypeCd: string | number;
  remainSeatCnt1: string | number;
  predictTime1: string | number;
  locationNo1: string | number;
  remainSeatCnt2?: string | number; // 두 번째 도착 버스 (있을 때만)
  predictTime2?: string | number;
  locationNo2?: string | number;
  routeDestName?: string;
};

// 화면에 보낼, 판단까지 끝낸 버스 한 대
export type JudgedBus = {
  name: string;
  dest: string;
  seats: number;
  min: number; // 도착 예정(분). 999 = 미정
  pos: number; // 몇 정거장 전
  sig: Signal;
  label: string;
  desc: string;
};

// ── 9) ★메인★ API 응답(여러 버스) + 방면 → 판단된 버스 목록 + 대기중 목록 ──
export function processArrivals(
  rawList: RawArrival[],
  direction: string,
): { buses: JudgedBus[]; waiting: string[] } {
  const targetRoutes = DESTINATIONS[direction] ?? [];
  const hour = nowHourAdjusted();

  // (1) 광역버스(11) + 선택한 방면의 노선만 거른다
  const filtered = rawList.filter(
    (b) => Number(b.routeTypeCd) === GWANGYEOK && targetRoutes.includes(baseNumber(b.routeName)),
  );

  // 좌석/시간/위치 한 세트 → 판단된 버스 한 대로 만드는 도우미
  const toBus = (
    b: RawArrival,
    seatRaw: string | number | null | undefined,
    timeRaw: string | number | null | undefined,
    locRaw: string | number | null | undefined,
  ): JudgedBus => {
    const seats = Number(seatRaw);
    const sig = judge(seats, hour);
    return {
      name: String(b.routeName),
      dest: b.routeDestName ?? "",
      seats,
      min: timeRaw === "" || timeRaw == null ? 999 : Number(timeRaw),
      pos: locRaw === "" || locRaw == null ? 0 : Number(locRaw),
      sig,
      label: verdict(sig, seats),
      desc: describe(sig, seats),
    };
  };
  // 도착 시간이 진짜 있는지 (빈값/없음 제외)
  const hasTime = (v: string | number | null | undefined) => v !== "" && v != null;

  // (2) 각 노선의 1번째 + 2번째 도착 버스를 모두 만든다 → 판단 + 정렬
  const buses = filtered
    .flatMap((b) => {
      const list: JudgedBus[] = [];
      // 1번째 도착 (기존과 동일: 좌석정보 있으면 추가)
      if (hasSeatInfo(b.remainSeatCnt1)) {
        list.push(toBus(b, b.remainSeatCnt1, b.predictTime1, b.locationNo1));
      }
      // 2번째 도착 (좌석정보 + 도착시간 둘 다 있을 때만 — 가까운 버스 놓쳐도 다음 버스 표시용)
      if (hasSeatInfo(b.remainSeatCnt2) && hasTime(b.predictTime2)) {
        list.push(toBus(b, b.remainSeatCnt2, b.predictTime2, b.locationNo2));
      }
      return list;
    })
    .sort((a, c) => a.min - c.min); // 무조건 도착 시간 빠른 순 (신호와 무관)

  // (3) 1번째·2번째 모두 좌석정보 없는 노선 이름들 (대기중)
  const waiting = filtered
    .filter((b) => !hasSeatInfo(b.remainSeatCnt1) && !hasSeatInfo(b.remainSeatCnt2))
    .map((b) => String(b.routeName));

  return { buses, waiting };
}
