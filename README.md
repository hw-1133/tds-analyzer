# TDS Extractor

> TDS PDF를 업로드하면, AI가 물성 데이터를 추출하고 표준화하여 Excel로 정리해주는 웹 서비스

## 🚀 빠른 시작

### GitHub Pages 배포

1. 이 저장소를 GitHub에 push
2. Settings → Pages → Source: `main` 브랜치 루트 설정
3. 배포된 URL로 접속

### 로컬 실행

```bash
# 정적 파일 서버 실행 (CORS 문제 방지)
npx serve .
# 또는
python -m http.server 8080
```

브라우저에서 `http://localhost:8080` 접속

## 📁 프로젝트 구조

```
tds-extractor/
├── index.html          # 메인 페이지
├── css/
│   └── style.css       # 스타일시트
├── js/
│   ├── pdfReader.js    # PDF 텍스트 추출 (pdf.js)
│   ├── aiExtractor.js  # Claude API 호출 & 물성 추출
│   ├── excelExport.js  # Excel 내보내기 (SheetJS)
│   └── app.js          # 메인 애플리케이션 로직
└── README.md
```

## 📋 사용 방법

1. **API Key 입력** — Anthropic API Key (sk-ant-...) 입력 후 저장
2. **PDF 업로드** — TDS PDF 파일 드래그 앤 드롭 또는 선택 (최대 10개)
3. **분석 실행** — "분석 시작" 버튼 클릭
4. **결과 확인** — 추출된 물성 데이터를 표로 확인
5. **Excel 다운로드** — `.xlsx` 파일로 저장

## 📊 출력 데이터 구조

| 필드 | 설명 |
|------|------|
| manufacturer | 제조사명 |
| grade_name | 제품/Grade명 |
| property_name | 물성 항목 (표준화된 이름) |
| property_name_raw | 원문 물성 항목명 |
| value | 측정값 |
| unit | 단위 |
| condition | 시험 조건 |
| test_method | 시험 방법 (ISO/ASTM 등) |

## 🔧 표준화 물성 항목

| 원문 예시 | 표준화 이름 |
|-----------|-------------|
| Tensile Strength / 인장강도 | `tensile_strength` |
| Elongation / 연신율 / 신율 | `elongation` |
| Flexural Strength / 굴곡강도 | `flexural_strength` |
| HDT / Heat Deflection Temperature | `hdt` |
| Density / 밀도 | `density` |
| MFR / Melt Flow Rate / 용융흐름지수 | `mfr` |
| Izod Impact / 아이조드충격강도 | `izod_impact` |

## ⚠️ 주의사항

- API Key는 세션 스토리지에만 저장되며, 탭 종료 시 사라집니다
- 이미지 기반 PDF(스캔 문서)는 텍스트 추출이 불가할 수 있습니다
- AI는 문서에 명시된 데이터만 추출하며, 추정하지 않습니다
- Anthropic API 사용 비용이 발생할 수 있습니다

## 🛠 기술 스택

- **PDF 파싱**: [pdf.js](https://mozilla.github.io/pdf.js/) v3.11
- **AI 분석**: Anthropic Claude API (claude-opus-4-5)
- **Excel 생성**: [SheetJS](https://sheetjs.com/) v0.18
- **배포**: GitHub Pages (정적 웹)

## 🔮 향후 확장 계획

- [ ] IndexedDB 기반 로컬 데이터베이스 저장
- [ ] Grade 간 물성 비교 차트
- [ ] 다중 Grade 비교표 뷰
- [ ] OCR 지원 (이미지 PDF)
- [ ] 커스텀 물성 항목 매핑 설정
