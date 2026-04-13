/**
 * excelExport.js
 * 추출된 물성 데이터를 Excel(.xlsx)로 내보내기
 * SheetJS(xlsx) 라이브러리 사용
 */

/**
 * 물성 데이터 배열을 Excel 파일로 다운로드
 * @param {Array} rows - 추출된 데이터 행 배열
 * @param {string} filename - 저장할 파일명
 */
function exportToExcel(rows, filename = 'TDS_properties.xlsx') {
  if (!rows || rows.length === 0) {
    alert('내보낼 데이터가 없습니다.');
    return;
  }

  const wb = XLSX.utils.book_new();

  // ── 시트 1: 전체 물성 데이터 (Raw) ──
  const rawHeaders = [
    '제조사 (Manufacturer)',
    'Grade/제품명',
    '물성 항목 (표준명)',
    '물성 항목 (원문)',
    '값 (Value)',
    '단위 (Unit)',
    '조건 (Condition)',
    '시험방법 (Test Method)',
    '소스 파일'
  ];

  const rawData = rows.map(r => [
    r.manufacturer || '',
    r.grade_name || '',
    r.property_name || '',
    r.property_name_raw || '',
    r.value || '',
    r.unit || '',
    r.condition || '',
    r.test_method || '',
    r.source_file || ''
  ]);

  const wsRaw = XLSX.utils.aoa_to_sheet([rawHeaders, ...rawData]);
  styleSheet(wsRaw, rawHeaders, rawData.length);
  XLSX.utils.book_append_sheet(wb, wsRaw, '전체 물성 데이터');

  // ── 시트 2: 제조사 × 물성 항목 피벗 ──
  const pivotWs = buildPivotSheet(rows);
  if (pivotWs) {
    XLSX.utils.book_append_sheet(wb, pivotWs, '비교표 (Pivot)');
  }

  // ── 시트 3: Grade별 요약 ──
  const summaryWs = buildSummarySheet(rows);
  if (summaryWs) {
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Grade별 요약');
  }

  // 파일 다운로드
  XLSX.writeFile(wb, filename);
}

/**
 * 컬럼 너비 및 헤더 스타일 적용
 */
function styleSheet(ws, headers, dataRows) {
  // 컬럼 너비 자동 조정
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...Array.from({ length: dataRows }, (_, r) => {
        const row = ws[XLSX.utils.encode_cell({ r: r + 1, c: i })];
        return row ? String(row.v || '').length : 0;
      })
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  });
  ws['!cols'] = colWidths;
}

/**
 * 피벗 시트 생성: Grade × 물성 항목 매트릭스
 */
function buildPivotSheet(rows) {
  if (!rows.length) return null;

  // 유니크 Grade 목록
  const grades = [...new Set(rows.map(r =>
    `${r.manufacturer || '?'} / ${r.grade_name || '?'}`
  ))];

  // 유니크 물성 항목 목록
  const properties = [...new Set(rows.map(r => r.property_name))].sort();

  if (grades.length === 0 || properties.length === 0) return null;

  // 빠른 조회 맵 생성
  const valueMap = new Map();
  for (const r of rows) {
    const key = `${r.manufacturer}__${r.grade_name}__${r.property_name}`;
    const existing = valueMap.get(key);
    // 여러 조건이 있으면 첫 번째 값만 사용 (+ 조건 표기)
    const displayVal = r.value + (r.unit ? ` ${r.unit}` : '') + (r.condition ? ` [${r.condition}]` : '');
    if (!existing) valueMap.set(key, displayVal);
  }

  // 헤더 행
  const header = ['Grade / 제조사', ...properties];
  const dataRows = grades.map(grade => {
    const [mfr, gradeN] = grade.split(' / ');
    const row = [grade];
    for (const prop of properties) {
      const key = `${mfr}__${gradeN}__${prop}`;
      row.push(valueMap.get(key) || '-');
    }
    return row;
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
  ws['!cols'] = [{ wch: 30 }, ...properties.map(() => ({ wch: 18 }))];
  return ws;
}

/**
 * Grade별 요약 시트 생성
 */
function buildSummarySheet(rows) {
  if (!rows.length) return null;

  // Grade별로 그룹화
  const gradeMap = new Map();
  for (const r of rows) {
    const key = `${r.manufacturer}||${r.grade_name}`;
    if (!gradeMap.has(key)) {
      gradeMap.set(key, {
        manufacturer: r.manufacturer,
        grade: r.grade_name,
        source: r.source_file,
        count: 0
      });
    }
    gradeMap.get(key).count++;
  }

  const headers = ['제조사', 'Grade명', '추출 물성 수', '소스 파일'];
  const data = [...gradeMap.values()].map(g => [
    g.manufacturer, g.grade, g.count, g.source
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 14 }, { wch: 40 }];
  return ws;
}
