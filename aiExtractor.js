/**
 * aiExtractor.js
 * Anthropic Claude API를 이용한 TDS 물성 데이터 추출
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-5';

// ──────────────────────────────────────────────
// 표준화 물성 항목 매핑 테이블
// ──────────────────────────────────────────────
const PROPERTY_STANDARD_MAP = {
  // 인장 강도
  'tensile strength': 'tensile_strength',
  'tensile stress': 'tensile_strength',
  'tensile strength at break': 'tensile_strength_break',
  'tensile strength at yield': 'tensile_strength_yield',
  'yield strength': 'tensile_strength_yield',
  '인장강도': 'tensile_strength',
  '인장 강도': 'tensile_strength',
  '항복강도': 'tensile_strength_yield',

  // 연신율
  'elongation': 'elongation',
  'elongation at break': 'elongation_break',
  'elongation at yield': 'elongation_yield',
  'strain at break': 'elongation_break',
  '연신율': 'elongation',
  '신율': 'elongation',
  '파단연신율': 'elongation_break',
  '항복연신율': 'elongation_yield',

  // 굴곡 강도
  'flexural strength': 'flexural_strength',
  'bending strength': 'flexural_strength',
  '굴곡강도': 'flexural_strength',
  '굴곡 강도': 'flexural_strength',

  // 굴곡 탄성률
  'flexural modulus': 'flexural_modulus',
  'bending modulus': 'flexural_modulus',
  '굴곡탄성률': 'flexural_modulus',
  '굴곡 탄성률': 'flexural_modulus',

  // 인장 탄성률
  'tensile modulus': 'tensile_modulus',
  "young's modulus": 'tensile_modulus',
  'elastic modulus': 'tensile_modulus',
  '인장탄성률': 'tensile_modulus',
  '탄성률': 'tensile_modulus',
  '영률': 'tensile_modulus',

  // 충격강도
  'izod impact': 'izod_impact',
  'izod notched': 'izod_impact_notched',
  'charpy impact': 'charpy_impact',
  'charpy notched': 'charpy_impact_notched',
  'impact strength': 'impact_strength',
  '충격강도': 'impact_strength',
  '아이조드충격강도': 'izod_impact',
  '샤르피충격강도': 'charpy_impact',

  // 열변형온도 / HDT
  'heat deflection temperature': 'hdt',
  'heat distortion temperature': 'hdt',
  'hdt': 'hdt',
  'deflection temperature': 'hdt',
  '열변형온도': 'hdt',
  '하중하 변형온도': 'hdt',

  // 비카트 연화점
  'vicat softening temperature': 'vicat_softening',
  'vicat softening point': 'vicat_softening',
  '비카트연화온도': 'vicat_softening',

  // 밀도
  'density': 'density',
  'specific gravity': 'specific_gravity',
  '밀도': 'density',
  '비중': 'specific_gravity',

  // 용융흐름지수
  'mfr': 'mfr',
  'mfi': 'mfr',
  'melt flow rate': 'mfr',
  'melt flow index': 'mfr',
  'melt mass flow rate': 'mfr',
  '용융흐름지수': 'mfr',
  '용융유량': 'mfr',

  // 수분흡수율
  'water absorption': 'water_absorption',
  'moisture absorption': 'water_absorption',
  '수분흡수율': 'water_absorption',
  '흡수율': 'water_absorption',

  // 경도
  'hardness': 'hardness',
  'rockwell hardness': 'hardness_rockwell',
  'shore hardness': 'hardness_shore',
  'ball indentation hardness': 'hardness_ball',
  '경도': 'hardness',
  '로크웰경도': 'hardness_rockwell',
  '쇼어경도': 'hardness_shore',

  // 연소성
  'flammability': 'flammability',
  'flame retardancy': 'flammability',
  'ul94': 'ul94',
  '연소성': 'flammability',

  // 수축률
  'mold shrinkage': 'mold_shrinkage',
  'shrinkage': 'mold_shrinkage',
  '성형수축률': 'mold_shrinkage',
  '수축률': 'mold_shrinkage',

  // 열전도율
  'thermal conductivity': 'thermal_conductivity',
  '열전도율': 'thermal_conductivity',

  // 선팽창계수
  'coefficient of linear thermal expansion': 'clte',
  'clte': 'clte',
  'cte': 'clte',
  '선팽창계수': 'clte',

  // 유리전이온도
  'glass transition temperature': 'tg',
  'tg': 'tg',
  '유리전이온도': 'tg',

  // 용융온도
  'melting point': 'melting_point',
  'melting temperature': 'melting_point',
  '용융온도': 'melting_point',
  '융점': 'melting_point',

  // 부피저항
  'volume resistivity': 'volume_resistivity',
  'electrical resistivity': 'volume_resistivity',
  '부피저항': 'volume_resistivity',

  // 표면저항
  'surface resistivity': 'surface_resistivity',
  '표면저항': 'surface_resistivity',

  // 유전상수
  'dielectric constant': 'dielectric_constant',
  'permittivity': 'dielectric_constant',
  '유전율': 'dielectric_constant',
};

/**
 * 물성 항목 이름 표준화
 */
function standardizePropertyName(rawName) {
  if (!rawName) return rawName;
  const lower = rawName.toLowerCase().trim();
  // 직접 매핑
  if (PROPERTY_STANDARD_MAP[lower]) return PROPERTY_STANDARD_MAP[lower];
  // 부분 매핑
  for (const [key, val] of Object.entries(PROPERTY_STANDARD_MAP)) {
    if (lower.includes(key.toLowerCase())) return val;
  }
  // 매핑 없으면 snake_case 변환
  return rawName
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '_')
    .replace(/^_|_$/g, '');
}

// ──────────────────────────────────────────────
// AI 프롬프트
// ──────────────────────────────────────────────
function buildSystemPrompt() {
  return `You are a specialized material data extraction AI for Technical Data Sheets (TDS).

Your task is to extract physical/mechanical/thermal/electrical property data from TDS documents.

STRICT RULES:
1. Extract ONLY data that is explicitly present in the document. Never estimate or infer.
2. Prioritize data from tables over plain text.
3. If the same property appears under multiple test conditions, create a separate entry for each condition.
4. Preserve original units exactly as written.
5. Extract manufacturer name and grade/product name.

OUTPUT FORMAT — respond ONLY with valid JSON, no markdown, no explanation:
{
  "manufacturer": "Company name or empty string",
  "grade_name": "Product/Grade name or empty string",
  "properties": [
    {
      "property_name": "exact property name from document",
      "value": "numeric value or range as string",
      "unit": "unit as written",
      "condition": "test condition if any, else empty string",
      "test_method": "ISO/ASTM method if stated, else empty string"
    }
  ]
}

If no properties are found, return {"manufacturer":"","grade_name":"","properties":[]}.`;
}

function buildUserPrompt(textContent) {
  // 너무 긴 경우 앞 부분 우선 사용 (토큰 절약)
  const maxLength = 12000;
  const truncated = textContent.length > maxLength
    ? textContent.slice(0, maxLength) + '\n[... content truncated ...]'
    : textContent;

  return `Extract all material property data from the following TDS document text:\n\n${truncated}`;
}

// ──────────────────────────────────────────────
// API 호출
// ──────────────────────────────────────────────

/**
 * Claude API로 TDS 텍스트 분석
 * @param {string} pdfText - PDF에서 추출한 텍스트
 * @param {string} apiKey - Anthropic API 키
 * @param {string} fileName - 파일 이름 (fallback)
 * @returns {Promise<Object>} 정제된 결과 객체
 */
async function extractPropertiesFromText(pdfText, apiKey, fileName = '') {
  const body = {
    model: MODEL,
    max_tokens: 4096,
    system: buildSystemPrompt(),
    messages: [
      { role: 'user', content: buildUserPrompt(pdfText) }
    ]
  };

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `API Error: ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  // JSON 파싱
  let parsed;
  try {
    // 마크다운 코드블록 제거 후 파싱
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI 응답 파싱 오류: ' + rawText.slice(0, 200));
  }

  // 표준화 처리
  const manufacturer = parsed.manufacturer || guessManufacturerFromFilename(fileName);
  const gradeName = parsed.grade_name || guessGradeFromFilename(fileName);

  const rows = (parsed.properties || []).map(prop => ({
    manufacturer,
    grade_name: gradeName,
    property_name_raw: prop.property_name || '',
    property_name: standardizePropertyName(prop.property_name),
    value: String(prop.value || ''),
    unit: prop.unit || '',
    condition: prop.condition || '',
    test_method: prop.test_method || '',
    source_file: fileName
  }));

  return { manufacturer, grade_name: gradeName, rows };
}

/**
 * 파일명에서 제조사 추정 (fallback)
 */
function guessManufacturerFromFilename(filename) {
  const known = ['BASF', 'DuPont', 'Sabic', 'LG', 'Samsung', 'Lotte', 'Kolon',
    'Toray', 'DSM', 'Solvay', 'Lanxess', 'Celanese', 'Covestro', 'Evonik', 'Mitsubishi'];
  const upper = filename.toUpperCase();
  for (const mfr of known) {
    if (upper.includes(mfr.toUpperCase())) return mfr;
  }
  return '';
}

function guessGradeFromFilename(filename) {
  const base = filename.replace(/\.pdf$/i, '').trim();
  if (base.length < 50) return base;
  return '';
}
