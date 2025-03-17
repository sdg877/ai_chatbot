from flask import Flask, render_template, request, jsonify
import openai
import os
from dotenv import load_dotenv
from pymongo import MongoClient
import certifi
import uuid

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")
mongo_uri = os.getenv("DATABASE_URL")

app = Flask(__name__)

client = MongoClient(mongo_uri, tlsCAFile=certifi.where())
db = client.chat_history
chats = db.chats

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    user_message = request.json.get("message")
    conversation_id = request.json.get("conversation_id")

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    user_id = request.remote_addr

    if not conversation_id:
        conversation_id = str(uuid.uuid4())

    history = list(chats.find({"user_id": user_id, "conversation_id": conversation_id}, {"_id": 0}))
    messages = [{"role": "user", "content": h["user"]} for h in history] + \
               [{"role": "assistant", "content": h["bot"]} for h in history] + \
               [{"role": "user", "content": user_message}]

    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages
        )
        bot_reply = response.choices[0].message.content

        chats.insert_one({
            "user": user_message,
            "bot": bot_reply,
            "user_id": user_id,
            "conversation_id": conversation_id
        })

        return jsonify({"reply": bot_reply, "conversation_id": conversation_id})
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/conversations', methods=['GET'])
def conversations():
    user_id = request.remote_addr
    conversations = list(chats.distinct("conversation_id", {"user_id": user_id}))
    return jsonify(conversations)

if __name__ == '__main__':
    app.run(debug=True)