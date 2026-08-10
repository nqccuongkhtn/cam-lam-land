// Giải mã thực thể HTML → chữ thật. Dùng cho nội dung lấy từ RSS/nguồn báo có thể còn lẫn
// entity chưa giải mã: SỐ thập phân (&#7879; = ệ), SỐ hex (&#x1EC7;) và entity TÊN (&aacute; = á, &nbsp; ...).
// An toàn SSR (không đụng DOM). Nội dung sau khi giải mã được render dạng TEXT (React tự escape) nên không có rủi ro XSS.
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™', deg: '°', middot: '·', bull: '•', euro: '€', times: '×', divide: '÷',
  // Latin có dấu — hay gặp ở RSS báo tiếng Việt
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å',
  egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë',
  igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï',
  ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö',
  ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü',
  yacute: 'ý', yuml: 'ÿ', ntilde: 'ñ', ccedil: 'ç',
  Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Atilde: 'Ã',
  Egrave: 'È', Eacute: 'É', Ecirc: 'Ê',
  Igrave: 'Ì', Iacute: 'Í',
  Ograve: 'Ò', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ',
  Ugrave: 'Ù', Uacute: 'Ú', Yacute: 'Ý', Ntilde: 'Ñ', Ccedil: 'Ç',
};

export function decodeEntities(input?: string | null): string {
  const s = input == null ? '' : String(input);
  if (s.indexOf('&') < 0) return s; // không có entity → khỏi xử lý
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => { const n = parseInt(h, 16); return n > 0 && n <= 0x10FFFF ? String.fromCodePoint(n) : m; })
    .replace(/&#(\d+);/g, (m, d) => { const n = parseInt(d, 10); return n > 0 && n <= 0x10FFFF ? String.fromCodePoint(n) : m; })
    .replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (m, name) => (Object.prototype.hasOwnProperty.call(NAMED, name) ? NAMED[name] : m));
}
