/**
 * firebase.js
 *
 * 공용 Firebase 유틸
 *
 * 전제:
 * 1) 이 파일보다 먼저 아래 CDN을 로드해 놔야 함:
 *    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
 *    <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
 *
 * 2) 이 파일은 전역으로 window.GameStats 를 만든다.
 *
 * 3) 사용 예 (각 게임 페이지 index.html 안):
 *
 *    const PAGE_ID = "mini1";
 *
 *    // 방문수 증가 + 표시
 *    GameStats.incrementVisitCount(PAGE_ID, (visitCount) => {
 *      visitsView.textContent = visitCount ?? "-";
 *    });
 *
 *    // 점수 저장
 *    GameStats.saveScore(PAGE_ID, nickname, reactionMs);
 *
 *    // TOP5 표시
 *    GameStats.listenTopScores(PAGE_ID, 5, (rows) => {
 *      rankList.innerHTML = "";
 *      if (!rows || rows.length === 0) {
 *        rankList.innerHTML = "<li>아직 기록이 없어요.</li>";
 *        return;
 *      }
 *      rows.forEach((item, idx) => {
 *        // mini1은 ms 단위(작을수록 빠름), 다른 게임은 점수(클수록 잘함)
 *        // 페이지 쪽에서 단위만 바꿔서 출력하면 된다.
 *        const li = document.createElement("li");
 *        li.textContent = `${idx+1}위: ${item.name} - ${item.score}`;
 *        rankList.appendChild(li);
 *      });
 *    });
 *
 * 4) 보안 규칙:
 *    - 지금은 클라이언트에서 직접 쓰고 읽도록 설계되어 있음
 *    - 실제 서비스 시에는 Realtime Database Rules와 Auth(익명 로그인 등)를
 *      반드시 걸어야 함.
 */

(function () {
  ///////////////////////////////
  // 1. Firebase 초기화
  ///////////////////////////////

  // 이미 초기화 돼 있으면 또 안 하도록 방지
  // (firebase.apps는 v8 스타일에서 사용 가능, compat에도 유지)
  if (firebase.apps && firebase.apps.length === 0) {
    // ↓↓↓ 너의 실제 Firebase 설정값으로 교체해야 함 ↓↓↓
const firebaseConfig = {
  apiKey: "AIzaSyBUaMBfHTriFsW4ash4NGeNguIhNwNCT3g",
  authDomain: "easygame-d5325.firebaseapp.com",
  databaseURL: "https://easygame-d5325-default-rtdb.firebaseio.com",
  projectId: "easygame-d5325",
  storageBucket: "easygame-d5325.firebasestorage.app",
  messagingSenderId: "22994470435",
  appId: "1:22994470435:web:3eaed4d2ab26624b8e1396",
  measurementId: "G-B0098KQERE"
};
    firebase.initializeApp(firebaseConfig);
  } else if (!firebase.apps) {
    // 만약 firebase.apps가 없는 환경(예: 예전 CDN 혼합) 대비
    // 안전하게 한번 더 초기화 체크
    try {
const firebaseConfig = {
  apiKey: "AIzaSyBUaMBfHTriFsW4ash4NGeNguIhNwNCT3g",
  authDomain: "easygame-d5325.firebaseapp.com",
  databaseURL: "https://easygame-d5325-default-rtdb.firebaseio.com",
  projectId: "easygame-d5325",
  storageBucket: "easygame-d5325.firebasestorage.app",
  messagingSenderId: "22994470435",
  appId: "1:22994470435:web:3eaed4d2ab26624b8e1396",
  measurementId: "G-B0098KQERE"
};
      firebase.initializeApp(firebaseConfig);
    } catch (e) {
      // 이미 초기화됐으면 여기서 에러 날 수도 있으니 무시
    }
  }
  // 이제 firebase.app(), firebase.database() 사용 가능


  ///////////////////////////////
  // 2. 내부 유틸
  ///////////////////////////////

  /**
   * _safeNumber(v, fallback)
   * 숫자 아닌 값 들어오면 fallback 리턴
   */
  function _safeNumber(v, fallback) {
    const n = Number(v);
    if (isNaN(n)) return fallback;
    return n;
  }

  /**
   * _nowTs()
   * timestamp(ms)
   */
  function _nowTs() {
    return Date.now ? Date.now() : new Date().getTime();
  }

  /**
   * _sortScoresForPage(pageId, arr)
   * arr: [{name, score:Number, ts:Number}, ...]
   *
   * mini1:
   *   - 반응속도게임
   *   - score(ms) 낮을수록 잘함 -> 오름차순(as - bs)
   *
   * 기타:
   *   - 점수게임
   *   - score 높을수록 잘함 -> 내림차순(bs - as)
   */
  function _sortScoresForPage(pageId, arr) {
    const isReactionGame = (pageId === "mini1");

    arr.sort((a, b) => {
      const as = isNaN(a.score) ? 0 : a.score;
      const bs = isNaN(b.score) ? 0 : b.score;
      return isReactionGame ? (as - bs) : (bs - as);
    });

    return arr;
  }


  ///////////////////////////////
  // 3. 공개 API
  ///////////////////////////////

  /**
   * incrementVisitCount(pageId, callback)
   *
   * - DB 경로: visits/<pageId>
   * - 기능:
   *   1) 해당 pageId 방문수 1 증가 (transaction)
   *   2) 변경된 방문수를 계속 listen해서 callback으로 전달
   *
   * - callback(newValue:number)
   *   e.g. callback(15)
   *
   * 사용 예:
   *   GameStats.incrementVisitCount("mini1", (n)=>{ visitsView.textContent = n; });
   */
  function incrementVisitCount(pageId, callback) {
    const visitRef = firebase.database().ref("visits").child(pageId);

    // 1) 방문수 +1 (transaction으로 동시성 안전하게)
    visitRef.transaction(function (currentValue) {
      if (currentValue === null || currentValue === undefined) {
        return 1;
      }
      if (typeof currentValue !== "number") {
        return 1; // 비정상일 경우 리셋해서 1로
      }
      return currentValue + 1;
    });

    // 2) 실시간 변화 감지해서 UI에 반영
    visitRef.on("value", function (snapshot) {
      if (!snapshot.exists()) {
        callback(0);
      } else {
        callback(_safeNumber(snapshot.val(), 0));
      }
    });
  }

  /**
   * saveScore(pageId, name, scoreValue)
   *
   * - DB 경로: scores/<pageId>/<autoKey>
   * - 저장 형태:
   *   {
   *     name: "닉네임",
   *     score: 250,        // 반응속도(ms) 또는 점수
   *     ts:   1730000000000 // timestamp(ms)
   *   }
   *
   * 사용 예:
   *   GameStats.saveScore("mini1", "준성", 217)
   */
function saveScore(pageId, name, scoreValue) {
  const trimmedName = (name || "익명").toString().substring(0, 20);
  const numericScore = _safeNumber(scoreValue, 0);
  const pageScoresRef = firebase.database().ref("scores").child(pageId);

  const isReactionGame = (pageId === "mini1"); 
  // mini1은 낮을수록 더 잘한 기록
  // 나머지는 높을수록 더 잘한 기록

  // 1) 현재 pageId의 모든 점수 한 번 읽기
  pageScoresRef.once("value").then((snapshot) => {
    let existingKey = null;
    let existingScore = null;

    if (snapshot.exists()) {
      const all = snapshot.val();
      for (const key in all) {
        if (!Object.prototype.hasOwnProperty.call(all, key)) continue;
        const item = all[key];
        if (!item) continue;

        // 닉네임 매칭 (대소문자를 그대로 구분; 필요하면 toLowerCase()로 통일 가능)
        if ((item.name || "") === trimmedName) {
          existingKey = key;
          existingScore = _safeNumber(item.score, null);
          break;
        }
      }
    }

    // 우리가 새로 기록하려는 entry
    const newEntry = {
      name: trimmedName,
      score: numericScore,
      ts: _nowTs()
    };

    // 2) 기존 닉네임 없으면 그냥 push
    if (!existingKey) {
      pageScoresRef.push(newEntry);
      return;
    }

    // 3) 기존 닉네임이 있는데, 점수 비교해서 더 좋을 때만 update
    //    - mini1: lower is better
    //    - others: higher is better
    const oldScore = existingScore;

    // oldScore가 null이면 그냥 업데이트
    if (oldScore === null || oldScore === undefined || isNaN(oldScore)) {
      pageScoresRef.child(existingKey).update(newEntry);
      return;
    }

    let isBetter = false;
    if (isReactionGame) {
      // mini1: 숫자가 작을수록(반응속도 짧을수록) 더 잘한 거
      isBetter = numericScore < oldScore;
    } else {
      // 나머지: 숫자가 클수록 점수 높아서 더 잘한 거
      isBetter = numericScore > oldScore;
    }

    if (isBetter) {
      pageScoresRef.child(existingKey).update(newEntry);
    }
    // else: 기존 기록이 더 좋으면 아무 것도 안 함
  });
}

  /**
   * listenTopScores(pageId, limitCount, callback)
   *
   * - 특정 게임(pageId)의 점수목록을 실시간 구독.
   * - DB: scores/<pageId>
   * - 가져온 전체를 메모리에서 정렬한 뒤 상위 limitCount개만 전달.
   *
   * 정렬 규칙:
   *   pageId === "mini1" -> score 낮은 순 (빠른 반응속도 순위)
   *   그 외              -> score 높은 순 (일반 점수 랭킹)
   *
   * callback(topArray)
   *   topArray = [
   *     { name:"닉네임", score:123, ts:1730000000000 },
   *     ...
   *   ]
   */
  function listenTopScores(pageId, limitCount, callback) {
    const pageScoresRef = firebase.database().ref("scores").child(pageId);

    // value 리스너: 해당 pageId 전체 목록 스냅샷
    pageScoresRef.on("value", function (snapshot) {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }

      const raw = snapshot.val(); // { pushKey: {name, score, ts}, ...}
      const list = [];

      for (const key in raw) {
        if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
        const item = raw[key] || {};
        list.push({
          name: item.name || "익명",
          score: _safeNumber(item.score, 0),
          ts: _safeNumber(item.ts, 0)
        });
      }

      // 정렬 규칙(미니게임별 커스텀)
      _sortScoresForPage(pageId, list);

      // 상위 N개만 전달
      const top = list.slice(0, limitCount);
      callback(top);
    });
  }

  /**
   * (옵션) getStatsOnce(pageId)
   * - stats/<pageId> 한 번 읽어서 Promise로 리턴
   * - 아직 자동 갱신/계산은 안 넣었지만, 페이지에서
   *   평균/최고/플레이수 보여주고 싶을 때 쓸 수 있음.
   *
   * 사용 예:
   *   GameStats.getStatsOnce("mini1").then(data => {...})
   *
   * 반환:
   *   {
   *     topScore: number,
   *     avgScore: number,
   *     playCount: number,
   *     lastUpdate: number
   *   }
   *  또는 null
   */
  function getStatsOnce(pageId) {
    const statsRef = firebase.database().ref("stats").child(pageId);
    return statsRef.get().then(function(snapshot){
      if (!snapshot.exists()) return null;
      const val = snapshot.val() || {};
      return {
        topScore:   _safeNumber(val.topScore,   0),
        avgScore:   _safeNumber(val.avgScore,   0),
        playCount:  _safeNumber(val.playCount,  0),
        lastUpdate: _safeNumber(val.lastUpdate, 0)
      };
    });
  }

  // 필요한 경우 여기서 updateStats(pageId, newScore) 같은 것도 추가 가능:
  // - saveScore 호출 후에 평균/최고값/플레이수 갱신까지 자동 반영하고 싶으면
  //   compat 스타일 transaction / get / set / update 로 계산해주는 로직을
  //   여기에 넣으면 된다.
  //
  // 지금은 요구사항에서 mini1만 오름차순, 나머지 내림차순 정렬이 핵심이라
  // updateStats는 아직 넣지 않음.


  ///////////////////////////////
  // 4. 전역 export
  ///////////////////////////////

  window.GameStats = {
    incrementVisitCount,
    saveScore,
    listenTopScores,
    getStatsOnce
    // updateStats 나중에 넣을 수 있음
  };

})();
