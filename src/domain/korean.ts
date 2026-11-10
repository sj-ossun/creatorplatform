/** 받침에 맞춰 ‘로/으로’를 붙인다 (ㄹ 받침은 ‘로’). 한글이 아니면 ‘(으)로’ */
export function withRo(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return `${word}(으)로`;
  const final = code % 28;
  return `${word}${final === 0 || final === 8 ? '로' : '으로'}`;
}
