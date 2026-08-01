var LIFF_ID = "2010802590-KMkAidDs";


(function() {
  var statusEl = document.getElementById("entry-status");

  function setStatus(msg) {
    if(statusEl) {
      statusEl.textContent = msg;
    }
  }
  liff
    .init({ liffId: LIFF_ID})
    .then(function(){
      // ①LINEアプリ内か？
      if(!liff.isInClient()) {
        setStatus("LINEアプリから開いてください");
        return;
      }

      // ② ログイン済みか？
      if(!liff.isLoggedIn()) {
        liff.login();
        return;
      }

      // ③
      location.href = "reserve.html";
    })

    .then(function (profile) {
      if(!profile) {
        return;
      }

    })
    .catch(function (err) {
      console.error(err);
      setStatus("LIFF初期化エラー");
    });
})();
