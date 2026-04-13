/**
 * pdfReader.js
 * PDF 파일에서 텍스트를 추출하는 유틸리티
 * pdf.js 라이브러리 사용
 */

// pdf.js worker 설정
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/**
 * PDF 파일에서 전체 텍스트 추출
 * @param {File} file - PDF File 객체
 * @returns {Promise<string>} 추출된 텍스트
 */
async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;

  let fullText = '';

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // 텍스트 아이템을 y좌표 기준으로 행 그룹화
    const lines = groupTextItemsIntoLines(textContent.items);
    fullText += `--- Page ${pageNum} ---\n`;
    fullText += lines.join('\n') + '\n\n';
  }

  return fullText;
}

/**
 * PDF 텍스트 아이템을 좌표 기반으로 행으로 그룹화
 */
function groupTextItemsIntoLines(items) {
  if (!items || items.length === 0) return [];

  // y 좌표 기준 정렬 (페이지 위→아래)
  const sorted = [...items].sort((a, b) => {
    const ay = Math.round(a.transform[5]);
    const by = Math.round(b.transform[5]);
    if (ay !== by) return by - ay; // y 내림차순 (위에서 아래로)
    return a.transform[4] - b.transform[4]; // 같은 행은 x 오름차순
  });

  const lineMap = new Map();
  const Y_THRESHOLD = 3; // px 단위 허용 오차

  for (const item of sorted) {
    const y = Math.round(item.transform[5]);
    const text = item.str;
    if (!text.trim()) continue;

    // 기존 행에 속하는지 확인
    let matched = false;
    for (const [key] of lineMap) {
      if (Math.abs(key - y) <= Y_THRESHOLD) {
        lineMap.get(key).push({ x: item.transform[4], text });
        matched = true;
        break;
      }
    }
    if (!matched) {
      lineMap.set(y, [{ x: item.transform[4], text }]);
    }
  }

  // 각 행 내부를 x 좌표 순으로 정렬하여 텍스트 합치기
  const lines = [];
  for (const [, items] of [...lineMap.entries()].sort((a, b) => b[0] - a[0])) {
    items.sort((a, b) => a.x - b.x);
    const lineText = items.map(i => i.text).join('  ').trim();
    if (lineText) lines.push(lineText);
  }

  return lines;
}

/**
 * PDF File을 Base64로 인코딩
 * @param {File} file
 * @returns {Promise<string>} base64 string (data: 접두사 없이)
 */
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result.split(',')[1];
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 파일 크기를 읽기 쉬운 형식으로 변환
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
