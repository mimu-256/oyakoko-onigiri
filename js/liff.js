var LIFF_ID = "2010802590-KMkAidDs";


(function() {
  var ReserveBtn = document.getElementById("reserve-submit");
  var statusEl = document.getElementById("liff-status");

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
        alert("LINEアプリから開いてください");
        setStatus("LINEアプリから開いてください");

        // location.href = "index.html";
        return;
      }

      setStatus("ラインから開いたよ");

      // ② ログイン済みか？
      if(!liff.isLoggedIn()) {
        liff.login();
        return;
      }

      // ③
      setStatus("LINEログイン済み");
      if(ReserveBtn) {
        ReserveBtn.disabled = false;
      }

      return liff.getProfile();
    })

    .then(function (profile) {
      if(!profile) {
        return;
      }
      // 名前をフォームに自動入力
      var nameInput = document.getElementById("r-name");
      if(nameInput && !nameInput.value) {
        // nameInput.value = "テスト";
        nameInput.value = profile.displayName;
      }
      setStatus(profile.displayName);

    })
    .catch(function (err) {
      console.error(err);
      setStatus("LIFF初期化エラー");
    });

  if(ReserveBtn) {
    // TODO : フォーム→ボタン？
    ReserveBtn.addEventListener("click", function(event) {
      event.preventDefault();
      setStatus("送信中・・・");
      ReserveBtn.disabled = true;

      // 情報取得
      var reserveInfo = {
        name: document.getElementById("r-name").value,
        tel: document.getElementById("r-tel").value,
        date: document.getElementById("r-date").value,
        hour: document.getElementById("r-hour").value,
        min : document.getElementById("r-min").value,
        order: document.getElementById("order_lines").value,
        total: document.getElementById("cart-subtotal").textContent,
      };

      liff
        .sendMessages([
          {
            type: "text",
            text: "【ご予約】\n名前：" + reserveInfo.name + "\n電話：\n" + reserveInfo.tel + "\n日時：\n" + reserveInfo.date + reserveInfo.hour + ":" + reserveInfo.min + "\nご注文 : \n" + reserveInfo.order +  "\n小計 : \n" + reserveInfo.total,
          },
        ])
        .then(function() {
          setStatus("送信しました。トークを確認してください");
        })
        .catch(function(err) {
          console.error(err);
          setStatus("送信失敗" + err.message);
        })
        .finally(function() {
          ReserveBtn.disabled = false;
        })
      });
  }


})();
