#!/usr/bin/env bash
# Prints the 16 ANSI colors as text and as swatches on the terminal background.
# Run inside the VS Code integrated terminal: bash preview/ansi.sh
names=(black red green yellow blue magenta cyan white)
for bright in 0 1; do
  for i in "${!names[@]}"; do
    code=$((30 + i + bright * 60))
    bg=$((40 + i + bright * 60))
    label=$([ "$bright" = 1 ] && echo "bright-${names[$i]}" || echo "${names[$i]}")
    printf '\e[%sm%-16s\e[0m \e[%sm      \e[0m  \e[1;%smbold\e[0m\n' "$code" "$label" "$bg" "$code"
  done
done
