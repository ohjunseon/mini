# Google AdSense 활성화 가이드

## 1단계: Google AdSense 계정 생성
1. https://www.google.com/adsense 방문
2. 계정 생성 및 도메인 검증
3. 승인 대기 (일반적으로 24시간)

## 2단계: 광고 단위 생성
1. AdSense 대시보드 → "광고" → "신규 광고 단위"
2. **표시 광고** 선택
3. 광고 이름: `MiniGames Launcher`
4. 형식: "반응형"
5. 생성 → **Publisher ID** (ca-pub-...) + **Ad Slot ID** 획득

## 3단계: 스니펫 적용
현재 `index.html` 상단에 다음 두 부분을 추가합니다:

### A. 헤드에 스크립트 추가 (한 번만)
```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-YOUR_PUBLISHER_ID"
     crossorigin="anonymous"></script>
```
(`YOUR_PUBLISHER_ID` 부분을 실제 ID로 교체)

### B. 광고 영역에 광고 코드 추가
현재 위치: `index.html` line 302의 `<div class="ad" id="ad-slot">`

```html
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-YOUR_PUBLISHER_ID"
     data-ad-slot="YOUR_AD_SLOT_ID"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
<script>
     (adsbygoogle = window.adsbygoogle || []).push({});
</script>
```

## 현재 구현 상태
- ✅ 광고 영역 HTML 준비됨 (`<div class="ad">`)
- ✅ 스타일 정의됨 (`.ad` 클래스: 너비 100%, 최소높이)
- ⏳ 실제 스니펫: 사용자가 AdSense 계정에서 가져오기 필요

## 테스트
- 로컬에서는 광고가 표시되지 않습니다 (AdSense 정책)
- 배포 후 몇 시간이 지나면 광고 표시 시작
- 개발 중에는 `data-ad-client` 유효성 검증으로 에러 확인 가능
