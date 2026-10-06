import { csvCell, toCsv } from './csv.js';

describe('CSV 匯出', () => {
  it('包含逗號、引號或換行的文字加上引號並跳脫', () => {
    expect(csvCell('王小明')).toBe('王小明');
    expect(csvCell('台北市, 中山區')).toBe('"台北市, 中山區"');
    expect(csvCell('他說"好"')).toBe('"他說""好"""');
    expect(csvCell('第一行\n第二行')).toBe('"第一行\n第二行"');
  });

  it('防止試算表公式注入：= + - @ 開頭的文字加上單引號，數字不受影響', () => {
    expect(csvCell('=HYPERLINK("http://evil.example","點我")')).toBe(
      '"\'=HYPERLINK(""http://evil.example"",""點我"")"',
    );
    expect(csvCell('+886912345678')).toBe("'+886912345678");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell(-100)).toBe('-100');
    expect(csvCell(null)).toBe('');
  });

  it('開頭有 BOM，列之間用 CRLF', () => {
    expect(toCsv(['編號', '金額'], [['P64-1', 100]])).toBe('﻿編號,金額\r\nP64-1,100\r\n');
  });
});
