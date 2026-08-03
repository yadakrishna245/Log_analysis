#!/bin/bash
# LogSherlock Pro - Ollama AI Setup Script (Linux/Mac)
# Run this script once to enable local AI features
# Your data never leaves your machine.

echo ""
echo "========================================"
echo "  LogSherlock Pro - AI Setup (Ollama)"
echo "========================================"
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "[!] Ollama not found. Installing..."
    curl -fsSL https://ollama.com/install.sh | sh
    if [ $? -ne 0 ]; then
        echo "[ERROR] Installation failed. Visit: https://ollama.com/download"
        exit 1
    fi
fi

echo "[OK] Ollama is installed"

# Check available RAM
TOTAL_RAM=$(free -g 2>/dev/null | awk '/^Mem:/{print $2}' || sysctl -n hw.memsize 2>/dev/null | awk '{print int($1/1073741824)}')
echo "[OK] System RAM: ${TOTAL_RAM}GB"

# Select model based on RAM
if [ "$TOTAL_RAM" -ge 32 ]; then
    MODEL="qwen3.5:9b"
    echo "[*] Recommended: $MODEL (best accuracy for ${TOTAL_RAM}GB)"
elif [ "$TOTAL_RAM" -ge 16 ]; then
    MODEL="qwen3.5:4b"
    echo "[*] Recommended: $MODEL (excellent accuracy for ${TOTAL_RAM}GB)"
else
    MODEL="llama3.2:1b"
    echo "[*] Recommended: $MODEL (good, lightweight for ${TOTAL_RAM}GB)"
fi

echo ""
read -p "Pull model '$MODEL'? (Y/n): " confirm
if [ "$confirm" = "n" ] || [ "$confirm" = "N" ]; then
    echo "Skipped. Run manually: ollama pull <model>"
    exit 0
fi

# Pull the model
echo ""
echo "[*] Downloading $MODEL ... (2-5 minutes)"
ollama pull $MODEL

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "  SUCCESS! AI is ready."
    echo "========================================"
    echo ""
    echo "Next steps:"
    echo "  1. Open your browser"
    echo "  2. Go to: chrome://flags/#unsafely-treat-insecure-origin-as-secure"
    echo "     (or edge://flags/... for Edge)"
    echo "  3. Add: http://localhost:11434"
    echo "  4. Set 'Enabled' -> Relaunch"
    echo "  5. Open: https://d3tv1czat55yad.cloudfront.net"
    echo "  6. Robot icon should show GREEN"
    echo ""
    echo "  Your data NEVER leaves your machine!"
else
    echo "[ERROR] Failed. Check internet connection."
fi
