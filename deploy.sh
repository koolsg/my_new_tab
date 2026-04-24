#!/bin/bash

# =================================================================
# My Speed Dial - Stable Deployment Script
# 이 스크립트는 개발 폴더의 파일을 브라우저 로드용 고정 경로로 복사합니다.
# =================================================================

# 1. 설정
DEST_DIR="$HOME/.local/share/browser-extensions/my_new_tab"
SOURCE_DIR=$(dirname "$(readlink -f "$0")")

echo "📦 확장 프로그램 배포를 시작합니다..."
echo "📂 소스: $SOURCE_DIR"
echo "📂 대상: $DEST_DIR"

# 2. 대상 디렉토리 생성
mkdir -p "$DEST_DIR"

# 3. 필수 파일 목록
FILES=(
    "manifest.json"
    "background.js"
    "newtab.html"
    "newtab.js"
    "newtab.css"
)

# 4. 파일 복사
for FILE in "${FILES[@]}"; do
    if [ -f "$SOURCE_DIR/$FILE" ]; then
        cp "$SOURCE_DIR/$FILE" "$DEST_DIR/"
        echo "  ✅ $FILE 복사 완료"
    else
        echo "  ❌ $FILE 파일을 찾을 수 없습니다!"
    fi
done

# 5. 아이콘 폴더 복사
if [ -d "$SOURCE_DIR/icons" ]; then
    cp -r "$SOURCE_DIR/icons" "$DEST_DIR/"
    echo "  ✅ icons 폴더 복사 완료"
else
    echo "  ⚠️ icons 폴더를 찾을 수 없습니다!"
fi

echo ""
echo "✨ 배포가 완료되었습니다!"
echo "💡 브라우저(chrome://extensions)에서 확장을 한 번 '새로고침' 해주세요."
