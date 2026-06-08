import { useEffect, useRef, useState } from 'react';
import { renderScratchSVG } from '../lib/scratchRender.js';

const extractObsoleteTexts = (svgEl) => {
  const obsoleteEls = svgEl?.querySelectorAll('.sb3-obsolete');
  if (!obsoleteEls?.length) return [];
  return Array.from(obsoleteEls).map(el => {
    // テキストノードを結合してブロック名を取得
    const texts = Array.from(el.querySelectorAll('text'))
      .map(t => t.textContent?.trim())
      .filter(Boolean);
    return texts.join(' ') || '(不明なブロック)';
  });
};

export const useScratchBlocks = (code) => {
  const ref = useRef(null);
  const [isRendered, setIsRendered] = useState(false);
  const [renderError, setRenderError] = useState(null);
  const [invalidBlocks, setInvalidBlocks] = useState([]);

  useEffect(() => {
    if (!code || !ref.current) {
      setIsRendered(false);
      setInvalidBlocks([]);
      return;
    }

    setRenderError(null);
    setIsRendered(false);
    setInvalidBlocks([]);

    try {
      ref.current.innerHTML = '';
      // ブロックは常に一定の大きさ（やや小さめ）で描画する。コンテナ幅へ縮小すると
      // ブロックが読めないほど小さくなったりサイズがバラつくため、固定スケールにし、
      // 横にはみ出した分は親コンテナ(.scratch-block-container)の横スクロールで見せる。
      const svg = renderScratchSVG(code, 0.8);
      svg.style.display = 'block';

      ref.current.appendChild(svg);

      // レンダリング後に不正ブロック（sb3-obsolete）を検出
      const found = extractObsoleteTexts(svg);
      setInvalidBlocks(found);

      setIsRendered(true);
    } catch (err) {
      console.error('scratchblocks render error:', err);
      setRenderError('ブロックの表示に失敗しました');
    }
  }, [code]);

  return { ref, isRendered, renderError, invalidBlocks };
};
