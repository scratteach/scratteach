import { useEffect, useRef, useState } from 'react';
import scratchblocks from 'scratchblocks';
import ja from 'scratchblocks/locales/ja.json';
import jaHira from 'scratchblocks/locales/ja-Hira.json';

scratchblocks.loadLanguages({ ja, 'ja-Hira': jaHira });

// Fix: Japanese CONTROL_STOP locale template is ' %1' (hash: '_'),
// but the block list notation '[すべて v] を止める' hashes to '_ を止める'.
// Without this alias the parser cannot find the block and falls back to
// the 'obsolete' category (red).  Adding the alias makes it resolve to
// 'control' (orange, #FFAB19) as intended.
for (const code of ['ja', 'ja-Hira']) {
  const lang = scratchblocks.allLanguages[code];
  if (lang?.blocksByHash?.['_']) {
    lang.blocksByHash['_ を止める'] = lang.blocksByHash['_'];
  }
}

export const useScratchBlocks = (code) => {
  const ref = useRef(null);
  const [isRendered, setIsRendered] = useState(false);
  const [renderError, setRenderError] = useState(null);

  useEffect(() => {
    if (!code || !ref.current) {
      setIsRendered(false);
      return;
    }

    setRenderError(null);
    setIsRendered(false);

    try {
      ref.current.innerHTML = '';
      const doc = scratchblocks.parse(code, { languages: ['ja', 'en'] });
      const svg = scratchblocks.render(doc, { style: 'scratch3', scale: 1 });

      svg.setAttribute('width', '100%');
      svg.style.maxWidth = '100%';
      svg.style.height = 'auto';
      svg.style.display = 'block';

      ref.current.appendChild(svg);
      setIsRendered(true);
    } catch (err) {
      console.error('scratchblocks render error:', err);
      setRenderError('ブロックの表示に失敗しました');
    }
  }, [code]);

  return { ref, isRendered, renderError };
};
