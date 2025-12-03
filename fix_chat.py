#!/usr/bin/env python3
import os

# Fix backend chat_routes.py
chat_path = r'c:\Users\shrey\OneDrive\Desktop\AI-loan-system\backend\app\routes\chat_routes.py'
with open(chat_path, 'r', encoding='utf-8') as f:
    txt = f.read()

old_response = 'response = "I\'d be happy to help you with your loan application! To determine the best loan amount and terms for you, I need some basic information. Let\'s start with your annual income - this helps me understand what loan amounts might work for your situation."'
new_response = 'response = "I\'d be happy to help you with your loan application! Let\'s start with your full name so I can set up your application. What\'s your full name?"'

if old_response in txt:
    txt = txt.replace(old_response, new_response)
    with open(chat_path, 'w', encoding='utf-8') as f:
        f.write(txt)
    print("✓ Backend chat_routes.py updated")
else:
    print("✗ Backend pattern not found")

# Fix frontend Chatbot.jsx
chatbot_path = r'c:\Users\shrey\OneDrive\Desktop\AI-loan-system\frontend\src\components\Chatbot.jsx'
with open(chatbot_path, 'r', encoding='utf-8') as f:
    txt = f.read()

old_greeting = '"Hello! I\'m your AI Loan Assistant. I can help you apply for a loan by asking some questions first, then guide you to fill out a detailed form. How can I help you today?"'
new_greeting = '"Hi! I\'m your AI Loan Assistant. To get started with your loan application, what\'s your full name?"'

if old_greeting in txt:
    txt = txt.replace(old_greeting, new_greeting)
    with open(chatbot_path, 'w', encoding='utf-8') as f:
        f.write(txt)
    print("✓ Frontend Chatbot.jsx updated")
else:
    print("✗ Frontend pattern not found")
