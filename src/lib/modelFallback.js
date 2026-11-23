// エラーの種類を見分けて、待つ／同じモデルで投げ直す／次のモデルへ降りる を決める層。
//
// 見分けが要る理由：**429は2種類ある**。
// RPM（1分5回）に当たった429と、RPD（1日20回）を使い切った429は同じステータスで返る。
// 前者は十数秒で直り、後者はその日おしまい。取り違えると、混雑しただけで梯子を降りきって
// 一日中liteで動くか、枯れたモデルに延々と投げ続けるかのどちらかになる。
//
// 動作の方針（実機の待ち時間から決めた）：
//  ・429は1回目で即・次のモデルへ。移動窓なので投げ直しても窓は動いておらず、待つだけ無駄。
//    別モデルは別バケツなので待ち時間ゼロで通る。**動作は同じでも記録は分ける**
//    （RPD由来だけ「今日はおしまい」と覚える）。
//  ・503は同じモデルで3回まで投げ直す。通れば次のモデルのRPD（貴重な20）を使わずに済む。
//  ・500は1回だけ投げ直して、再発したら諦める。長すぎる入力などこちら側が原因のことがあり、
//    梯子を降りても同じ場所で落ちてRPDだけ溶ける。
//  ・404は即スキップして、そのモデルIDを恒久的に無効として覚える。

import { callGemini, GeminiAPIError } from './gemini.js';
import { planModels, markExhausted, markMissing, WAIT_BEFORE_DEMOTION } from './modelRouter.js';

const BUSY_MAX_TRIES = 3;
const BUSY_BACKOFF_MS = [1000, 3000, 7000];
const INTERNAL_MAX_TRIES = 2;
const DEMOTION_WAIT_MS = 25000;
// RetryInfo がこれ以下ならRPM（分あたり）とみなす。日次の待ちはこんなに短くならない。
const RPM_DELAY_LIMIT_SEC = 90;

const wait = ms => new Promise(r => setTimeout(r, ms));

function quotaKindFromDetails(error) {
  const items = Array.isArray(error?.details) ? error.details : [];
  const text = JSON.stringify(items);

  // QuotaFailure が「分あたり」と明示しているときだけRPM扱いにする。
  // 明示が無ければRPDとみなす（梯子があるのでRPMにはまず当たらないため）。
  if (/per[\s_-]?minute|perminute/i.test(text)) return 'rpm';
  if (/per[\s_-]?day|perday/i.test(text)) return 'rpd';

  const retry = items.find(d => String(d?.['@type'] || '').includes('RetryInfo'));
  const sec = parseFloat(String(retry?.retryDelay || '').replace('s', ''));
  if (Number.isFinite(sec)) return sec <= RPM_DELAY_LIMIT_SEC ? 'rpm' : 'rpd';

  return 'rpd';
}

/** @returns {'fatal'|'missing-model'|'rpd'|'rpm'|'busy'|'internal'} */
export function classifyGeminiError(err) {
  if (!(err instanceof GeminiAPIError)) return 'busy'; // 通信断など。投げ直す価値がある
  if (err.status === 401 || err.status === 400) return 'fatal';
  if (err.status === 404) return 'missing-model';
  if (err.status === 429) return quotaKindFromDetails(err.details);
  if (err.status === 500) return 'internal';
  if (err.status === 503) return 'busy';
  return 'busy';
}

/**
 * 工程に合ったモデルを選び、失敗したら方針に従って降りる。
 * @param {object} opts
 * @param {string} opts.job          JOB_LAYER のキー（plan/ask/summary/generate/fix/qa）
 * @param {function} [opts.onWait]   待つときに (秒, 理由) で呼ばれる。UIに出すため
 * @param {function} [opts.onModel]  実際に応答したモデルIDで呼ばれる。記録用
 * @returns {Promise<{text:string, model:string}>}
 */
export async function callWithFallback(messages, apiKey, {
  job = 'ask', blockLang = 'ja', systemPrompt = null, onWait = null, onModel = null,
  validate = null,
} = {}) {
  const { primary, demotion } = planModels(job);
  const rpmHit = [];
  let lastError = null;

  const runList = async (models) => {
    for (const model of models) {
      let busyTries = 0;
      let internalTries = 0;

      for (;;) {
        try {
          const text = await callGemini(messages, apiKey, model, blockLang, systemPrompt);
          // 形が壊れた返事（読めない JSON など）は通ったことにしない。混雑と同じく投げ直す。
          if (validate && !validate(text)) {
            console.info('[invalid]', model, text.length, JSON.stringify(text.slice(-40)));
            throw new GeminiAPIError(
              'AIの返事が途中で切れました。もう一度送ってください。', 0, 'INVALID_RESPONSE'
            );
          }
          if (onModel) onModel(model);
          return { text, model };
        } catch (err) {
          lastError = err;
          const kind = classifyGeminiError(err);

          // 429の実物の形を1行だけ残す。RetryInfo/QuotaFailure の形は後から確認できる。
          if (err instanceof GeminiAPIError && err.status === 429) {
            console.info('[quota]', model, kind, JSON.stringify(err.details?.details || null));
          }

          if (kind === 'fatal') throw err;

          if (kind === 'missing-model') { markMissing(model); break; }
          if (kind === 'rpd') { markExhausted(model); break; }
          if (kind === 'rpm') { rpmHit.push(model); break; }

          if (kind === 'busy') {
            if (++busyTries < BUSY_MAX_TRIES) {
              await wait(BUSY_BACKOFF_MS[busyTries - 1] ?? 7000);
              continue;
            }
            break;
          }

          // internal：梯子を降りない。降りても同じ場所で落ちてRPDだけ減る。
          if (++internalTries < INTERNAL_MAX_TRIES) { await wait(1000); continue; }
          throw err;
        }
      }
    }
    return null;
  };

  const first = await runList(primary);
  if (first) return first;

  // 賢い層が混雑で全滅したときは、層を降りる前に一度だけ待ってやり直す。
  // liteで生成するとQAゲートが作り直しを呼び、かえってRPDを食うため。
  if (WAIT_BEFORE_DEMOTION.has(job) && rpmHit.length) {
    if (onWait) onWait(Math.round(DEMOTION_WAIT_MS / 1000), 'AIの順番待ち');
    await wait(DEMOTION_WAIT_MS);
    const retried = await runList(rpmHit);
    if (retried) return retried;
  }

  const fallen = await runList(demotion);
  if (fallen) return fallen;

  throw lastError || new GeminiAPIError('使えるモデルがありませんでした。', 0, 'NO_MODEL_AVAILABLE');
}
