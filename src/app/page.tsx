"use client"; // 버튼 클릭·상태(useState)를 쓰니까 맨 위에 붙인다 (Next.js 규칙)

import { useEffect, useState } from "react";
import { DIRECTIONS, DESTINATIONS } from "@/lib/jigakcut"; // 방면 목록·노선번호는 규칙 책에서 재사용
import type { JudgedBus, Signal } from "@/lib/jigakcut"; // 버스 데이터 모양도 재사용

// ── 화면 설정값 ───────────────────────────────────────────────────────────
// 정류장 목록 — 나중에 여기 배열에 { name: "..." } 만 추가하면 드롭다운에 자동으로 늘어남
const STATIONS = [
  { name: "롯데캐슬스카이.이안두드림.백남준아트센터" },
  // 예: { name: "경기도박물관입구" },  ← 나중에 이렇게 추가
];
const STATION_NAME = STATIONS[0].name; // 결과 화면 표시용 (정류장 1개일 때)

// 이 정류장에 오는 버스 번호들 — 너무 길어서 앞 2개만 보여주고, 더 있으면 "외" 붙임
// (예: 노선이 5개여도 "5000, 5005 외" 처럼)
const ALL_BUS_NUMBERS = Object.values(DESTINATIONS).flat(); // 전체 노선 목록
// 방면마다 대표 번호 1개씩 (예: 서울역→5000, 강남→5001, 잠실→5600) → 서로 다른 방면 번호가 나옴
const REP_BY_DIRECTION = Object.values(DESTINATIONS).map((routes) => routes[0]);
const BUS_NUMBERS =
  ALL_BUS_NUMBERS.length > 2
    ? `${REP_BY_DIRECTION.slice(0, 2).join(", ")} 외` // 다른 방면 2개 + 외
    : ALL_BUS_NUMBERS.join(", "); // 2개 이하면 그냥 다 보여줌

// 신호 → 배경(채움)색 (Tailwind) — 원을 이 색으로 꽉 채운다
const SIG_BG: Record<Signal, string> = {
  "🟢": "bg-green-500",
  "🟡": "bg-yellow-400",
  "🔴": "bg-red-500",
};
// 신호 → 글자색 (Tailwind) — 글로우(box-shadow)가 이 색(currentColor)을 쓰도록
const SIG_TEXT: Record<Signal, string> = {
  "🟢": "text-green-500",
  "🟡": "text-yellow-400",
  "🔴": "text-red-500",
};

export default function Home() {
  // 화면 상태들
  const [station, setStation] = useState<string | null>(null);
  const [stationOpen, setStationOpen] = useState(false); // 정류장 드롭다운 펼침 여부
  const [direction, setDirection] = useState<string | null>(null);
  // 정류장까지 걸어가는 시간(분). 0분 = "현재 시각"(필터 없음). 이 시간 안에 도착하는 버스는 제외
  const [walkTime, setWalkTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false); // 새로고침 아이콘 회전 중인지 (최소 시간 보장용)
  const [result, setResult] = useState<JudgedBus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 완료 화면 정보 (탑승 여부 누르면 채워짐 → 이게 있으면 '완료 화면'을 보여줌)
  const [done, setDone] = useState<{ emoji: string; title: string; message: string } | null>(
    null,
  );
  // 탑승 버튼에서 방금 누른 것 기억 (true=탔어 / false=못 탔어 / null=아직). 버튼 색 표시용
  const [picked, setPicked] = useState<boolean | null>(null);
  // 신호등 도움말(설명 박스) 열림 여부 — 신호등을 누르면 토글
  const [showHelp, setShowHelp] = useState(false);
  // 확인하기 누른 뒤 버스 연출 중인지 (true면 결과로 안 넘어가고 입력화면에서 버스 보여줌)
  const [submitting, setSubmitting] = useState(false);
  // 홈으로 누른 뒤 / 앱 처음 켤 때 스플래시(로고) 화면 보여주는 중인지 (처음엔 true)
  const [splash, setSplash] = useState(true);
  // 처음 켤 때는 길게(2초), 홈으로 때는 짧게(1.3초) 구분
  const [splashLong, setSplashLong] = useState(true);

  // 앱 처음 켜질 때도 스플래시 로고를 보여줬다가 사라지게 (처음엔 길게 2초)
  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 2000);
    return () => clearTimeout(t);
  }, []);

  // 정류장+행선지 둘 다 골라야(그리고 조회중 아닐 때) 확인 버튼 활성화
  const canSubmit = station !== null && direction !== null && !loading && !submitting;

  // ── 버스 불러오기 (확인하기 / 새로고침 둘 다 이 함수를 씀) ──────────────
  async function fetchBuses() {
    if (!direction) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/buses?direction=${encodeURIComponent(direction)}`);
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "버스 정보를 불러오지 못했어요.");
      else setResult(data.buses as JudgedBus[]);
    } catch {
      setError("서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  // 새로고침 버튼 전용 — 데이터 다시 불러오기 + 아이콘을 "최소 0.8초"는 확실히 돌린다
  // (데이터가 너무 빨리 와도 한 바퀴는 보이게! 더 오래 걸리면 loading 이 끝날 때까지 계속 돔)
  function handleRefresh() {
    setSpinning(true); // 회전 시작
    fetchBuses(); // 기능은 그대로 — 버스 다시 불러오기
    setTimeout(() => setSpinning(false), 1000); // 1초 뒤 멈춤 (버스 슝~ 연출 길이와 맞춤)
  }

  // 확인하기 (입력 화면) — 버스 슝~ 연출 1초 보여준 뒤 결과로 (데이터는 그 사이 미리 불러옴)
  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true); // 버스 연출 시작 (이 동안은 입력화면 유지)
    fetchBuses(); // 데이터 미리 불러오기
    setTimeout(() => setSubmitting(false), 1000); // 1초 뒤 연출 끝 → 결과 화면 표시
  }

  // 뒤로가기(←) — 입력 화면으로 (고른 값은 유지)
  function goBack() {
    setResult(null);
    setError(null);
    setPicked(null);
    setShowHelp(false);
  }

  // 홈으로(스플래시) — 로고 1.1초 보여준 뒤 입력 화면으로
  function goHomeWithSplash() {
    setSplashLong(false); // 홈으로 스플래시는 짧게(1.3초)
    goHome(); // 먼저 홈 상태로 초기화 (스플래시가 덮고 있어 안 보임)
    setSplash(true); // 스플래시 켜기 (이게 화면을 덮음)
    setTimeout(() => setSplash(false), 1300); // 1.3초 뒤 스플래시 닫기 → 바로 메인
  }

  // 홈으로 — 처음 입력 화면으로 (전부 초기화)
  function goHome() {
    setStation(null);
    setDirection(null);
    setResult(null);
    setError(null);
    setDone(null);
    setPicked(null);
    setShowHelp(false);
    setSubmitting(false);
  }

  // 탑승 버튼 클릭 — 먼저 색이 들어오게 표시(picked)한 뒤, 0.35초 있다가 기록+완료화면으로
  function handleBoarding(bus: JudgedBus, boarded: boolean) {
    if (picked !== null) return; // 이미 눌렀으면 중복 무시
    setPicked(boarded); // 버튼 색 바로 바뀜
    setTimeout(() => recordBoarding(bus, boarded), 650); // 색 보여준 뒤 완료 화면 (조금 더 여유있게)
  }

  // ★탑승 여부 기록★ — 데이터 저장 + 완료 화면으로
  function recordBoarding(bus: JudgedBus, boarded: boolean) {
    // (1) 저장할 기록 (시각 / 노선 / 좌석수 / 탑승여부 / 신호색)
    const record = {
      time: new Date().toISOString(),
      route: bus.name,
      seats: bus.seats,
      boarded,
      signal: bus.sig,
    };
    // (2) 브라우저 localStorage 에 차곡차곡 (새로고침해도 안 사라짐)
    try {
      const KEY = "jigakcut-records";
      const prev = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      prev.push(record);
      localStorage.setItem(KEY, JSON.stringify(prev));
    } catch {
      // 저장 실패해도 앱은 안 멈춤
    }
    console.log("📝 탑승 기록 저장:", record); // 개발 중 확인용
    // (3) 완료 화면 띄우기 (따뜻한 멘트만)
    setDone(
      boarded
        ? { emoji: "🎉", title: "탔다고?", message: "다행이야~ 오늘 하루 잘 보내!" }
        : { emoji: "🏃", title: "못 탔다고?", message: "괜찮아! 얼른 다른 걸로 가자!" },
    );
  }

  // 스플래시 로고 오버레이 (앱 시작 / 홈으로 때 공통으로 씀) — splash 일 때만
  const splashOverlay = splash ? (
    <div
      className="splash-overlay fixed inset-0 z-[60] bg-white flex items-center justify-center"
      style={{ animationDuration: splashLong ? "2s" : "1.3s" }}
    >
      <div
        className="splash-logo flex items-end gap-2"
        style={{ animationDuration: splashLong ? "2s" : "1.3s" }}
      >
        <h1
          className="text-5xl font-black tracking-tight flex items-end pt-6"
          style={{ fontFamily: "var(--font-recoche)" }}
        >
          <span className="relative inline-block">
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 -ml-3 w-[9px] h-[9px] rounded-full bg-red-500 text-red-500 signal-glow" />
            지
          </span>
          <span className="relative inline-block">
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 -ml-3 w-[9px] h-[9px] rounded-full bg-yellow-400 text-yellow-400 signal-glow" />
            각
          </span>
          <span>.</span>
          <span className="relative inline-block">
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 -ml-3 w-[9px] h-[9px] rounded-full bg-green-500 text-green-500 signal-glow" />
            컷
          </span>
        </h1>
        <p className="text-lg font-semibold pb-1">탈까? 말까?</p>
      </div>
    </div>
  ) : null;

  // 스플래시(로고)가 켜져 있으면 그것만 보여준다 (다른 화면은 그 동안 안 보임 → 깜빡임 방지)
  if (splash) return splashOverlay;

  // ════════════════════════════════════════════════════════════════════════
  //  화면 1: 완료 화면 (탑승 여부 누른 뒤)
  // ════════════════════════════════════════════════════════════════════════
  if (done) {
    return (
      <main key="done" className="fade-in min-h-screen bg-white text-black flex flex-col items-center px-6 py-10">
        {/* 홈으로 스플래시 — 로고가 짠 떴다가 스르륵 사라짐 (그 뒤 홈 화면으로) */}
        {splashOverlay}
        {/* 가운데: 아이콘 + 제목(크게) + 설명(작게) + 홈으로 */}
        <div className="flex-1 flex flex-col items-center justify-center text-center pb-20">
          {/* 로고 위와 동일한 신호등 점 3개 (9px·글로우) — 통일감 */}
          <div className="flex gap-2 mb-5">
            <span className="w-[9px] h-[9px] rounded-full bg-red-500 text-red-500 signal-glow" />
            <span className="w-[9px] h-[9px] rounded-full bg-yellow-400 text-yellow-400 signal-glow" />
            <span className="w-[9px] h-[9px] rounded-full bg-green-500 text-green-500 signal-glow" />
          </div>
          <p className="text-7xl mb-6">{done.emoji}</p>
          <p
            className="text-3xl font-extrabold mb-2"
            style={{ fontFamily: "var(--font-recoche)" }}
          >
            {done.title}
          </p>
          <p className="text-gray-500">{done.message}</p>
          {/* 확인하기 버튼과 동일한 크기·스타일 (w-full+max-w-md / py-4 / rounded-full / text-lg) */}
          <button
            onClick={goHomeWithSplash}
            className="mt-[24px] w-full max-w-md py-4 rounded-full text-lg font-bold bg-black text-white transition active:scale-95"
          >
            홈으로
          </button>
          {/* 안내문 — 홈으로 버튼 바로 아래 (입력화면 안내문과 동일 스타일/간격) */}
          <p className="text-[13px] text-[#c3c9d1] text-center mt-4">
            여러분의 선택이 지각컷의 혼잡도 정밀도를 높입니다
          </p>
        </div>
      </main>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  //  화면 2: 에러 화면
  // ════════════════════════════════════════════════════════════════════════
  if (error) {
    return (
      <main key="error" className="fade-in min-h-screen bg-white text-black flex flex-col items-center justify-center px-6 text-center">
        <p className="text-5xl mb-4">😢</p>
        <p className="text-gray-700">{error}</p>
        <button
          onClick={goBack}
          className="mt-8 py-3 px-8 rounded-full border border-gray-300 text-gray-700 transition active:scale-95"
        >
          ← 다시 선택하기
        </button>
      </main>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  //  화면 3: 결과 화면
  // ════════════════════════════════════════════════════════════════════════
  if (result && !submitting) {
    // 도보 시간 안에 도착하는 버스는 못 타니까 제외 (min = 도착 예정 분)
    const reachable = result.filter((b) => b.min >= walkTime);
    const best = reachable[0];
    const others = reachable.slice(1, 3); // 다른 버스 최대 2개

    return (
      <main key="result" className="fade-in min-h-screen bg-white text-black flex flex-col items-center px-6 py-6">
        {/* 새로고침 연출: 🚌💨 가 앱 프레임(가운데 컬럼) 안에서만 왼→오 슝~ (spinning 동안만) */}
        {spinning && (
          <div className="fixed inset-0 z-50 flex justify-center pointer-events-none">
            {/* 가운데 앱 폭만큼만 보이게 잘라냄(overflow-hidden) */}
            <div className="relative w-full max-w-md overflow-hidden">
              {/* 이 묶음이 left 로 가로지름. 안에 매연 💨 + 버스 🚌 (버스는 오른쪽 보게 뒤집기) */}
              <div className="bus-run absolute top-1/2 -translate-y-1/2 flex items-center gap-1">
                <span className="bus-puff text-4xl">💨</span>
                <span className="text-6xl scale-x-[-1]">🚌</span>
              </div>
            </div>
          </div>
        )}
        <div className="w-full max-w-md mt-10">
          {/* 상단 바: ← 뒤로가기 (왼쪽) / ↻ 새로고침 (오른쪽) — 둘 다 검정 선 아이콘 */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={goBack}
              aria-label="뒤로가기"
              className="text-2xl text-gray-600 transition active:scale-90"
            >
              ←
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              aria-label="새로고침"
              className="text-gray-600 disabled:opacity-40 transition active:scale-90"
            >
              {/* 새로고침 아이콘(원형 화살표). loading 또는 spinning 이면 빙글 돈다 */}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className={`w-6 h-6 transition-transform ${loading || spinning ? "animate-spin" : ""}`}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
            </button>
          </div>

          {/* ↓ 결과 내용 묶음 — 새로고침 중엔 확 줄었다·흐려졌다가(opacity↓+scale↓) 새 데이터로 또렷하게 */}
          <div
            className={`transition-all duration-200 ${
              loading || spinning ? "opacity-20 scale-95" : "opacity-100 scale-100"
            }`}
          >
          <p className="text-sm text-gray-500 mb-1">{STATION_NAME}</p>
          <h2 className="text-xl font-bold mb-6">{direction} 방면 🚌</h2>

          {/* 버스가 없을 때 — 카드 자리(신호등 원 위치)에 안내를 넣어 화면이 휑하지 않게 */}
          {!best ? (
            <section className="flex flex-col items-center text-center gap-4 py-10">
              {/* 신호등 원이 있던 자리에 흰 점선 원 + 🚦(신호등) */}
              <div className="w-32 h-32 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-5xl">
                🚦
              </div>
              {result.length === 0 ? (
                /* 운행 자체가 없을 때 — 한 줄 */
                <p className="text-gray-500 px-2 leading-relaxed">
                  지금 운행하는 {direction} 방면 버스가 없어요 😢
                </p>
              ) : (
                /* 도보시간 때문에 다 빠졌을 때 — 두 줄 (mt-4 로 살짝 아래로) */
                <div className="px-2 leading-relaxed mt-4">
                  <p className="text-gray-700 font-semibold">조금만 기다려주세요!</p>
                  <p className="text-sm text-gray-400 mt-1">
                    지금 나가도 탈 수 있는 버스가 없어요 😢
                  </p>
                </div>
              )}
            </section>
          ) : (
            <>
              {/* 메인 버스 — 크게 (설명 문구는 뺌) */}
              <section className="flex flex-col items-center text-center gap-3 py-6">
                {/* 신호등 원 + 오른쪽 도움말 팝업을 한 묶음(relative)으로 */}
                <div className="relative">
                  {/* 신호등 원: 누르면 도움말 토글. 모서리 ? 배지로 "누를 수 있어요" 힌트 */}
                  <button
                    onClick={() => setShowHelp((v) => !v)}
                    aria-label="신호등 설명 보기"
                    className={`${SIG_BG[best.sig]} ${SIG_TEXT[best.sig]} ${showHelp ? "glow-on" : ""} relative w-32 h-32 rounded-full flex flex-col items-center justify-center shadow-lg transition active:scale-95`}
                  >
                    {/* 원 안: 큰 좌석 숫자 + 작은 "잔여 좌석" (흰 글씨) */}
                    <span className="text-white text-5xl font-extrabold leading-none">{best.seats}</span>
                    <span className="text-white text-xs mt-1 font-medium">잔여 좌석</span>
                    {/* ? 힌트 배지 */}
                    <span className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-white text-gray-500 text-sm font-bold border border-gray-300 shadow flex items-center justify-center">
                      ?
                    </span>
                  </button>

                  {/* 신호등 도움말 팝업 — ? 배지 오른쪽에 뜸 (showHelp 일 때만) */}
                  {showHelp && (
                    <div className="absolute top-0 left-full ml-3 z-20 w-44 bg-gray-50 border border-gray-200 rounded-xl p-3 text-left text-xs text-gray-700 shadow-lg">
                      <button
                        onClick={() => setShowHelp(false)}
                        aria-label="닫기"
                        className="absolute top-1.5 right-2 text-gray-400 transition active:scale-90"
                      >
                        ✕
                      </button>
                      <p className="font-bold mb-2 text-gray-900">신호등이 뭐예요?</p>
                      <p className="mb-1">🟢 여유있게 탈 수 있어요</p>
                      <p className="mb-1">🟡 서둘러야 해요</p>
                      <p>🔴 포기하고 다른 길로 가요</p>
                    </div>
                  )}
                </div>
                {/* 메인 버스 번호 — 레코체로 강조, "번" 없이 */}
                {/* mt-4 = 신호등 원과 버스 번호 사이만 더 띄움 */}
                <p
                  className="text-2xl font-extrabold leading-none mt-4"
                  style={{ fontFamily: "var(--font-recoche)" }}
                >
                  {best.name}
                </p>
                {/* 신호 라벨 — 기본 폰트(프리텐다드). 레코체 안 씀 */}
                <p className="text-[21px] font-bold leading-none">{best.label}</p>
                {/* mt-1 = 좌석 줄을 라벨에서 아주 살짝 띄움 */}
                <p className="text-gray-700 leading-none mt-1">
                  📍 {best.pos}정거장 전 · ⏱️ {best.min}분 후
                </p>
              </section>

              {/* 다른 버스 — 작게. 0개여도 칸은 보여주고 안내 */}
              <section className="mt-8">
                <p className="text-sm text-gray-400 mb-2">다른 버스</p>
                {others.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {others.map((b) => (
                      <div
                        key={`${b.name}-${b.min}`}
                        className="flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-2"
                      >
                        <span className="text-xl">{b.sig}</span>
                        <span className="font-medium">{b.name}</span>
                        <span className="text-gray-500">· {b.seats}석</span>
                        <span className="text-gray-500">· {b.min}분 후</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 border border-gray-100 rounded-lg px-4 py-3 text-center">
                    도착 예정 정보가 없어요
                  </p>
                )}
              </section>

              {/* 맨 아래: 탑승 여부 (누르면 완료 화면으로) */}
              <section className="mt-10 text-center border-t border-gray-300 pt-6">
                <p className="text-[14px] text-gray-500 mb-5">이 버스 타셨나요?</p>
                <div className="flex gap-3">
                  {/* 탔어: 고르면 진한 초록, 못 탔어를 고르면 회색으로 흐려짐 */}
                  <button
                    onClick={() => handleBoarding(best, true)}
                    className={`flex-1 py-3 rounded-full font-semibold transition active:scale-95 ${
                      picked === true
                        ? "bg-green-500 text-white"
                        : picked === false
                          ? "bg-gray-100 text-gray-400"
                          : "bg-green-100 text-green-800"
                    }`}
                  >
                    탔어
                  </button>
                  {/* 못 탔어: 고르면 진한 빨강, 탔어를 고르면 회색으로 흐려짐 */}
                  <button
                    onClick={() => handleBoarding(best, false)}
                    className={`flex-1 py-3 rounded-full font-semibold transition active:scale-95 ${
                      picked === false
                        ? "bg-red-500 text-white"
                        : picked === true
                          ? "bg-gray-100 text-gray-400"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    못 탔어
                  </button>
                </div>
              </section>
            </>
          )}
          </div>
        </div>
      </main>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  //  화면 4: 입력 화면 (처음)
  // ════════════════════════════════════════════════════════════════════════
  return (
    <main key="input" className="fade-in min-h-screen bg-white text-black flex flex-col items-center justify-center px-6 py-10">
      {/* 앱 처음 켤 때 로고 스플래시 */}
      {splashOverlay}
      {/* 확인하기 연출: 🚌💨 가 앱 프레임 안에서 왼→오 슝~ (submitting 동안만) */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex justify-center pointer-events-none">
          <div className="relative w-full max-w-md overflow-hidden">
            <div className="bus-run absolute top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="bus-puff text-4xl">💨</span>
              <span className="text-6xl scale-x-[-1]">🚌</span>
            </div>
          </div>
        </div>
      )}
      <div
        className={`w-full max-w-md flex flex-col gap-8 transition-all duration-200 ${
          submitting ? "opacity-20 scale-95" : "opacity-100 scale-100"
        }`}
      >
        {/* 제목 — 지각.컷 + 탈까?말까? 를 한 줄로 */}
        <header className="text-center">
          <div className="flex items-end justify-center gap-2">
            {/* style 로 이 글자에만 레코체 폰트 적용 */}
            {/* pt-3 = 글자 위 신호등 점이 들어갈 여유 공간 */}
            <h1
              className="text-5xl font-black tracking-tight flex items-end pt-6"
              style={{ fontFamily: "var(--font-recoche)" }}
            >
              {/* 지(🔴) — relative 글자 위에 absolute 점을 모자처럼 얹는다 */}
              <span className="relative inline-block">
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 -ml-3 w-[9px] h-[9px] rounded-full bg-red-500 text-red-500 signal-glow" />
                지
              </span>
              {/* 각(🟡) */}
              <span className="relative inline-block">
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 -ml-3 w-[9px] h-[9px] rounded-full bg-yellow-400 text-yellow-400 signal-glow" />
                각
              </span>
              {/* 가운뎃점(.) — 점 없음 */}
              <span>.</span>
              {/* 컷(🟢) */}
              <span className="relative inline-block">
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 -ml-3 w-[9px] h-[9px] rounded-full bg-green-500 text-green-500 signal-glow" />
                컷
              </span>
            </h1>
            {/* 탈까?말까? 는 기본 폰트(프리텐다드 자리) 그대로 — 레코체 안 씀 */}
            <p className="text-lg font-semibold pb-1">탈까? 말까?</p>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            용인 → 서울 광역버스, 5초 안에 결정하세요
          </p>
        </header>

        {/* 정류장 선택 — 드롭다운 (눌러서 펼치고 고르기) */}
        <section>
          <p className="text-lg font-semibold mb-2">정류장</p>
          <div className="relative">
            {/* 펼치기 버튼 — 안 고르면 "정류장을 선택하세요", 고르면 그 이름 + ▼ */}
            <button
              onClick={() => setStationOpen((v) => !v)}
              className={`w-full text-left px-4 py-3 rounded-lg border flex items-center justify-between transition active:scale-[0.98] ${
                station ? "border-black" : "border-gray-300"
              }`}
            >
              <span className={station ? "text-black" : "text-gray-400"}>
                {station ?? "정류장을 선택하세요"}
                {station && (
                  <span className="text-xs text-[#c3c9d1] ml-1">({BUS_NUMBERS})</span>
                )}
              </span>
              {/* ▼ 화살표 — 펼치면 뒤집힘 */}
              <span className={`ml-2 text-gray-400 transition-transform ${stationOpen ? "rotate-180" : ""}`}>
                ▼
              </span>
            </button>

            {/* 펼쳐지는 목록 (stationOpen 일 때만) */}
            {stationOpen && (
              <div className="absolute left-0 right-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {STATIONS.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => {
                      setStation(s.name); // 선택
                      setStationOpen(false); // 목록 닫기
                    }}
                    className={`w-full text-left px-4 py-3 transition hover:bg-gray-50 active:scale-[0.98] ${
                      station === s.name ? "bg-gray-100 font-semibold" : ""
                    }`}
                  >
                    {station === s.name ? "✓ " : ""}
                    {s.name}
                    <span className="text-xs text-[#c3c9d1] ml-1">({BUS_NUMBERS})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 방면 선택 */}
        <section>
          <p className="text-lg font-semibold mb-2">어디로 가세요?</p>
          <div className="grid grid-cols-3 gap-2">
            {DIRECTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`py-3 rounded-lg border font-semibold transition active:scale-95 ${
                  direction === d
                    ? "border-black bg-black text-white"
                    : "border-gray-300 text-gray-700"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </section>

        {/* 도보 시간 슬라이더 — 정류장까지 걸리는 시간(0~30분) */}
        <section>
          <p className="text-lg font-semibold mb-2">정류장까지 얼마나 걸려요?</p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={30}
              value={walkTime}
              onChange={(e) => setWalkTime(Number(e.target.value))}
              className="flex-1 accent-black"
            />
            <span className="text-sm font-semibold w-16 text-right whitespace-nowrap">
              {walkTime === 0 ? "현재 시각" : `${walkTime}분`}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">도보 시간 안에 도착하는 버스는 빼고 보여줘요</p>
        </section>


        {/* 확인하기 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-4 rounded-full text-lg font-bold transition active:scale-95 disabled:active:scale-100 ${
            canSubmit ? "bg-black text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {loading || submitting ? "🚌 . . 탈 수 있을까?" : "확인하기"}
        </button>

        {/* 맨 아래 안내문 (디스클레이머) — -mt-4 로 확인하기 버튼과 더 가깝게 */}
        <p className="text-[13px] text-[#c3c9d1] text-center -mt-4">
          결과는 AI가 생성했으며 사용 전 확인이 필요합니다
        </p>
      </div>
    </main>
  );
}
