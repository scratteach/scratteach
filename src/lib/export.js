/**
 * HTMLエクスポート: scratchblocks SVGをインライン埋め込み
 */
export const exportToHTML = (conversation) => {
  const { title, messages, createdAt } = conversation;
  const dateStr = new Date(createdAt).toLocaleDateString('ja-JP');

  const messagesHTML = messages
    .map((msg) => {
      if (msg.role === 'user') {
        return `
        <div class="message user-message">
          <div class="message-bubble user-bubble">
            ${escapeHtml(msg.content)}
          </div>
          <div class="message-time">${formatTime(msg.timestamp)}</div>
        </div>`;
      } else {
        const parsed = msg.parsed || { explanation: msg.content, blocks: null, reason: null, hint: null };
        let blocksSVG = '';

        if (parsed.blocks && window.scratchblocks) {
          try {
            const doc = window.scratchblocks.parse(parsed.blocks, { languages: ['ja', 'en'] });
            const svg = window.scratchblocks.render(doc, { style: 'scratch3', scale: 1 });
            blocksSVG = svg.outerHTML;
          } catch (e) {
            blocksSVG = `<pre class="blocks-code">${escapeHtml(parsed.blocks)}</pre>`;
          }
        }

        return `
        <div class="message ai-message">
          <div class="message-bubble ai-bubble">
            <div class="explanation">${escapeHtml(parsed.explanation || '').replace(/\n/g, '<br>')}</div>
            ${blocksSVG ? `
            <div class="blocks-section">
              <div class="section-label">ブロック</div>
              <div class="blocks-container">${blocksSVG}</div>
            </div>` : ''}
            ${parsed.reason ? `
            <div class="reason-section">
              <div class="section-label">なぜこう書くの？</div>
              <div class="reason-text">${escapeHtml(parsed.reason).replace(/\n/g, '<br>')}</div>
            </div>` : ''}
            ${parsed.hint ? `
            <div class="hint-section">
              <div class="section-label">子供への伝え方ヒント</div>
              <div class="hint-text">${escapeHtml(parsed.hint).replace(/\n/g, '<br>')}</div>
            </div>` : ''}
          </div>
          <div class="message-time">${formatTime(msg.timestamp)}</div>
        </div>`;
      }
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scratteach - ${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Noto Sans JP', 'Hiragino Sans', 'Meiryo', sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }
    .header {
      background: #FF6600;
      color: white;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header h1 { font-size: 20px; font-weight: 700; }
    .header .subtitle { font-size: 13px; opacity: 0.9; }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 24px 16px;
    }
    .meta {
      font-size: 13px;
      color: #666;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #ddd;
    }
    .message { margin-bottom: 20px; }
    .user-message { display: flex; flex-direction: column; align-items: flex-end; }
    .ai-message { display: flex; flex-direction: column; align-items: flex-start; }
    .message-bubble {
      max-width: 80%;
      padding: 12px 16px;
      border-radius: 16px;
    }
    .user-bubble {
      background: #FF6600;
      color: white;
      border-top-right-radius: 4px;
    }
    .ai-bubble {
      background: white;
      border: 1px solid #e5e7eb;
      border-top-left-radius: 4px;
      max-width: 100%;
    }
    .message-time { font-size: 11px; color: #999; margin-top: 4px; }
    .explanation { font-size: 15px; line-height: 1.7; }
    .blocks-section, .reason-section, .hint-section {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #f0f0f0;
    }
    .section-label {
      font-size: 11px;
      font-weight: 600;
      color: #FF6600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    .blocks-container { overflow-x: auto; }
    .blocks-container svg { max-width: 100%; height: auto; display: block; }
    .blocks-code {
      background: #f5f5f5;
      padding: 12px;
      border-radius: 8px;
      font-size: 13px;
      white-space: pre-wrap;
    }
    .reason-text, .hint-text { font-size: 14px; color: #555; line-height: 1.6; }
    .hint-section { background: #fff8f0; border-radius: 8px; padding: 10px 12px; }
    .footer {
      text-align: center;
      padding: 24px;
      font-size: 12px;
      color: #999;
      border-top: 1px solid #eee;
      margin-top: 40px;
    }
    @media print {
      body { background: white; }
      .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Scratteach - スクラッティーチ</h1>
      <div class="subtitle">Scratchプログラミング専用AIチャット</div>
    </div>
  </div>
  <div class="container">
    <div class="meta">
      <strong>${escapeHtml(title)}</strong><br>
      作成日: ${dateStr}
    </div>
    <div class="messages">
      ${messagesHTML}
    </div>
  </div>
  <div class="footer">
    Scratteach (スクラッティーチ) でエクスポートされました - ${new Date().toLocaleDateString('ja-JP')}
  </div>
</body>
</html>`;

  return html;
};

export const downloadAsHTML = (html, filename) => {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const shareOrDownload = async (conversation) => {
  const html = exportToHTML(conversation);
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeTitle = conversation.title.replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龥]/g, '-').slice(0, 30);
  const filename = `scratteach-${safeTitle}-${dateStr}.html`;

  if (navigator.share) {
    try {
      const file = new File([html], filename, { type: 'text/html' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Scratteach - ${conversation.title}`,
          files: [file],
        });
        return;
      }
    } catch (e) {
      // Fallback to download
    }

    try {
      await navigator.share({
        title: `Scratteach - ${conversation.title}`,
        text: `Scratchプログラミングの会話履歴: ${conversation.title}`,
      });
      return;
    } catch (e) {
      // Fallback to download
    }
  }

  downloadAsHTML(html, filename);
};

export const printConversation = () => {
  window.print();
};

const escapeHtml = (text) => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
