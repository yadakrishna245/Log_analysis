#!/bin/bash
echo "============================================"
echo " LogSherlock Pro - Starting Up"
echo "============================================"
echo ""
echo "[1/3] Installing dependencies..."
pip install -r requirements.txt
echo ""
echo "[2/3] Initializing database..."
python init_db.py
echo ""
echo "[3/3] Starting server on port 5000..."
python app.py
