/**
 * 지각컷 — 서버 API Route  (주소: /api/buses?direction=강남)
 * --------------------------------------------------------------------------------
 * 브라우저가 이 주소를 부르면, 서버가 (키를 숨긴 채) 경기버스 API를 호출하고
 * lib/jigakcut.ts 의 판단 규칙으로 신호·추천을 계산해서 깔끔한 JSON으로 돌려준다.
 *
 * 흐름: 화면 → 여기(GET) → 경기버스 API → 판단(processArrivals) → 화면
 */

import { processArrivals, DESTINATIONS } from "@/lib/jigakcut";
import type { RawArrival } from "@/lib/jigakcut";

// 정류장은 지금 1개로 고정 (롯데캐슬스카이 = 신갈오거리 근처)
const STATION_ID = "228000681";
const STATION_NAME = "롯데캐슬스카이.이안두드림.백남준아트센터";

// 결과가 1개면 객체, 여러개면 배열로 오므로 → 항상 배열로 통일
function toArray(x: unknown): RawArrival[] {
  if (!x) return [];
  return Array.isArray(x) ? (x as RawArrival[]) : [x as RawArrival];
}

// 브라우저가 GET 으로 부를 때 실행되는 함수
export async function GET(request: Request) {
  // (1) 주소에서 ?direction=강남 부분을 꺼낸다
  const direction = new URL(request.url).searchParams.get("direction") ?? "";

  // (2) 모르는 방면이면 친절히 거절 (400 = 잘못된 요청)
  if (!DESTINATIONS[direction]) {
    return Response.json(
      { error: `모르는 방면이에요. (가능: ${Object.keys(DESTINATIONS).join(", ")})` },
      { status: 400 },
    );
  }

  // (3) 키 읽기 (.env.local 의 GBIS_API_KEY — 서버에서만 보임)
  const key = process.env.GBIS_API_KEY;
  if (!key) {
    return Response.json({ error: "서버에 API 키가 설정되지 않았어요." }, { status: 500 });
  }

  // (4) 경기버스 도착정보 API 호출 (no-store = 항상 최신 실시간 데이터)
  const url =
    `https://apis.data.go.kr/6410000/busarrivalservice/v2/getBusArrivalListv2` +
    `?serviceKey=${key}&stationId=${STATION_ID}&format=json`;

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    return Response.json({ error: "버스 정보 서버에 연결하지 못했어요." }, { status: 502 });
  }

  const text = await res.text();

  // (5) 키 인증 실패(401/403) 처리
  if (res.status === 401 || res.status === 403 || text.includes("Unauthorized") || text.includes("Forbidden")) {
    return Response.json(
      { error: `버스 API 인증 실패 (HTTP ${res.status}). 키/서비스 승인을 확인하세요.` },
      { status: 502 },
    );
  }

  // (6) JSON 으로 변환 (혹시 JSON 이 아니면 에러)
  let json: { response?: { msgBody?: { busArrivalList?: unknown } } };
  try {
    json = JSON.parse(text);
  } catch {
    return Response.json({ error: "버스 API 응답을 읽지 못했어요." }, { status: 502 });
  }

  // (7) 응답에서 버스 목록을 꺼내 → 판단 규칙 적용
  const rawList = toArray(json?.response?.msgBody?.busArrivalList);
  const { buses, waiting } = processArrivals(rawList, direction);

  // (8) 화면에 보낼 깔끔한 결과
  return Response.json({
    station: STATION_NAME,
    direction,
    buses, // 판단까지 끝난 버스들 (신호·좌석·추천 포함)
    waiting, // 아직 도착정보 없는 버스 이름들
  });
}
