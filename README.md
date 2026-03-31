# My Speed Dial — Chrome Extension

심플하고 아름다운 글래스모피즘 기반의 크롬 새 탭(Speed Dial) 확장 프로그램입니다.

## 주요 기능
- **글래스모피즘 디자인**: 투명하고 세련된 UI 레이아웃.
- **랜덤 배경화면**: Picsum Photos API를 통한 고해상도 랜덤 배경 (자동 새로고침 설정 가능).
- **스피드 다이얼**: 최대 30개의 사이트를 등록하고 드래그 앤 드롭으로 순서를 변경할 수 있습니다.
- **전용 설정 메뉴**: 그리드 열 개수, 카드 너비, 검색 엔진 등을 사용자화할 수 있습니다.
- **북마크 관리**: 표준 브라우저 북마크(`.html`) 파일을 가져오거나 내보낼 수 있습니다.

## 사용자 지정 가이드

### 1. 검색바 위치 조정 (미세 조정)
검색바의 높이를 원하는 대로 변경하려면 `newtab.css` 파일을 수정하세요.

- **파일 위치**: `newtab.css`
- **수정 위치**: `#search-wrapper` 선택자의 `top` 속성 (약 177~182라인)

```css
#search-wrapper {
  position: absolute;
  top: 20vh;  /* 이 값을 조정하세요 (예: 25vh, 200px 등) */
  width: 100%;
  max-width: 600px;
}
```
- `vh` 단위: 화면 높이에 대한 백분율 (20vh = 상단에서 20% 지점)
- `px` 단위: 픽셀 단위로 고정된 높이

### 2. 아이콘 그리드 위치 조정
아이콘(Speed Dial 카드)들의 전체적인 수직 위치는 `newtab.css`의 `#main` 또는 `#grid`에서 결정됩니다.

- **방법 A: 수직 정렬 방식 변경**
  `#main`의 `justify-content` 속성을 `center`(중앙)에서 `flex-start`(상단) 등으로 변경합니다.
- **방법 B: 특정 마진 추가**
  `#grid` 선택자에 `margin-top`을 추가하여 원하는 높이만큼 띄워줄 수 있습니다.

```css
#grid {
  display: grid;
  grid-template-columns: repeat(var(--cols), var(--card-width));
  gap: var(--gap);
  justify-content: center;
  margin-top: 10vh; /* 이 값을 추가하여 그리드 높이를 조절하세요 */
}
```

### 3. 그리드 레이아웃 조정
웹 화면의 설정(톱니바퀴 아이콘) 메뉴에서 직접 변경할 수 있습니다.
- **가로 열 개수**: 한 줄에 표시할 사이트 카드 개수.
- **카드 너비**: 사이트 카드의 가로 크기(px).

## 설치 방법
1. 이 리포지토리를 다운로드하거나 클론합니다.
2. 크롬 브라우저에서 `chrome://extensions/`로 이동합니다.
3. 우측 상단의 **'개발자 모드'**를 활성화합니다.
4. **'압축해제된 확장 프로그램을 로드합니다'** 버튼을 클릭하고 프로젝트 폴더를 선택합니다.

## 개발 정보
- **기술 스택**: HTML5, CSS3 (Vanilla), JavaScript (ES6+), Chrome Extension API
