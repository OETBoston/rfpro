#!/bin/bash
echo $"\n[INFO] Starting Bootstrap Process..."

# File paths
SOURCE_FILE="system-prompt.txt"  # File to read data from
TARGET_FILE="./lib/chatbot-api/functions/websocket-chat/index.mjs"  # File to modify

START_COMMENT="    // <DO NOT DELETE THIS COMMENT: START OF SYSTEM PROMPT, ANYTHING BETWEEN THESE LINES WILL BE DELETED>"
END_COMMENT="    // <<DO NOT DELETE THIS COMMENT: END OF SYSTEM PROMPT, ANYTHING BETWEEN THESE LINES WILL BE DELETED>"

# Read data from the source file and escape quotes
SYSTEM_PROMPT=$(tr '\n' ' ' < "$SOURCE_FILE" | sed 's/"/\\"/g')

# Prepare the content to be added with newline and tabs
SYSTEM_PROMPT_DECLARATION="\t\tsystemPrompt = \"$SYSTEM_PROMPT\";"

# Use awk to process the file
awk -v start="$START_COMMENT" -v end="$END_COMMENT" -v new_content="$SYSTEM_PROMPT_DECLARATION" '
  $0 == start {in_block = 1; print; next}
  $0 == end {in_block = 0; print new_content; print; next}
  !in_block {print}
' "$TARGET_FILE" > tmpfile && mv tmpfile "$TARGET_FILE"

echo "[INFO] $TARGET_FILE has been bootstrapped on line $LINE_NUMBER with data from $SOURCE_FILE."