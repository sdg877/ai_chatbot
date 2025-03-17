from flask import Flask, render_template, request, jsonify
import openai
import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")
mongo_uri = os.getenv("DATABASE_URL")  # Get MongoDB URI from .env

app = Flask(__name__)

# Initialize MongoDB client and database
client = MongoClient(mongo_uri)
db = client.chat_history  # Choose a database name
chats = db.chats  # Choose a collection name

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    user_message = request.json.get("message")

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": user_message}]
        )
        bot_reply = response.choices[0].message.content

        # Store chat history in MongoDB
        chats.insert_one({
            "user": user_message,
            "bot": bot_reply
        })

        return jsonify({"reply": bot_reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)