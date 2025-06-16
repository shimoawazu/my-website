window.hlx && window.hlx.sidekick && window.hlx.sidekick.add({
  id: 'submit-approval',
  button: {
    text: '承認依頼'
  },
  condition: (state) => state.env === 'preview',
  async callback(state) {
    // 任意項目生成
    const payload = {
      documentUrl: window.location.href,
      documentTitle: document.title,
      requester: window.hlx.sidekick && window.hlx.sidekick.user ? window.hlx.sidekick.user : '', // 取得可能ならログインユーザー
      requestDate: new Date().toISOString(),
      comment: '',           // 例: promptで入力させても良い（下記参照）
      storeOrLocale: '',     // 例: ページから取得する/ドロップダウン等組み合わせOK
      docId: '',             // 例: location.hrefや何らかのユニークIDロジック
      attachMetadata: {},    // 例: 任意のオブジェクト情報
    };

    // サンプル：コメントを都度入力させる場合
    payload.comment = window.prompt('コメント（任意）を入力してください', '');

    // サンプル：ストア名やロケールなども編集可能に
    payload.storeOrLocale = window.prompt('店舗名またはロケール（任意）を入力してください', '');

    // WebhookにPOST送信
    await fetch('https://your.webhook.url/for/approval', {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    window.alert('承認リクエストを送信しました');
  }
});