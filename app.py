from flask import Flask, render_template, request, jsonify
import openai
import os
from dotenv import load_dotenv

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')  # Serves the frontend

@app.route('/chat', methods=['POST'])
def chat():
    user_message = request.json.get("message")
    
    if not user_message:
        return jsonify({"error": "No message provided"}), 400
    
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",  
            messages=[{"role": "user", "content": user_message}]
        )
        bot_reply = response["choices"][0]["message"]["content"]
        return jsonify({"reply": bot_reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
