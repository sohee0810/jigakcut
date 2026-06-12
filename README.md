# 🚦 지각컷 — 탈까? 말까?

## 한 줄 피치

정류장에서 "이 버스 탈 수 있나" 발 동동 구르는 통학생이, 지각컷을 열면, 탑승 가능성 신호로 기다릴지 포기할지를 5초 만에 결정한다.

## 누가 쓰는가

용인에서 서울로 주 3회 이상 통학하는 22세 대학생 이서연은, 아침 피크 시간 만차로 버스를 자주 놓쳐 기다릴지 포기할지 빠르게 판단하고 싶어 한다.

## 어떻게 쓰는가

- **입력** — 정류장 + 방면 + 도보 시간 선택
- **처리** — 실시간 좌석 + 시간대 + 도보 시간 → 신호 결정
- **출력** — 🔴🟡🟢 신호 표시 + 판정 문구 + 행동 추천

## 화면

<!-- 여기에 결과 화면 캡처를 넣을 예정 -->

> <img width="500" height="783" alt="image" src="https://github.com/user-attachments/assets/ccfec687-bc66-48f8-b124-ce088e44246c" />


## 실행 방법

**1. 코드 받기**

```bash
git clone https://github.com/sohee0810/jigakcut.git
cd jigakcut
```

**2. 패키지 설치**

```bash
npm install
```

**3. API 키 발급**

공공데이터포털([data.go.kr](https://www.data.go.kr))에서 "경기버스 도착정보 API"를 신청하고 키를 받습니다.

**4. `.env.local` 파일 만들고 키 넣기**

```bash
GBIS_API_KEY=발급받은_키
```

**5. 실행하기**

```bash
npm run dev
```

→ 브라우저에서 [localhost:3000](http://localhost:3000) 열기

## 다음 계획

- 정류장 확장
- 데이터 쌓이면 판단 정교화
