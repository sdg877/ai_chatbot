from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_login import (
    LoginManager,
    UserMixin,
    login_user,
    login_required,
    logout_user,
    current_user,
)
import openai
import os
from dotenv import load_dotenv
from pymongo import MongoClient
import certifi
import uuid
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")
mongo_uri = os.getenv("DATABASE_URL")

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "your_default_secret_key")

client = MongoClient(mongo_uri, tlsCAFile=certifi.where())
db = client.chat_history
chats = db.chats
users_collection = db.users

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"

class User(UserMixin):
    def __init__(self, user_data):
        self.id = str(user_data["_id"])
        self.username = user_data["username"]
        self.password_hash = user_data["password"]

@login_manager.user_loader
def load_user(user_id):
    user_data = users_collection.find_one({"_id": user_id})
    if user_data:
        return User(user_data)
    return None

@app.route("/register", methods=["POST"])
def register():
    username = request.form.get("username")
    password = request.form.get("password")

    if users_collection.find_one({"username": username}):
        return jsonify({"error": "Username already exists"}), 400

    password_hash = generate_password_hash(password)
    user_id = str(uuid.uuid4())
    users_collection.insert_one(
        {"_id": user_id, "username": username, "password": password_hash}
    )

    return jsonify({"message": "User registered successfully"})

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        user_data = users_collection.find_one({"username": username})
        if user_data and check_password_hash(user_data["password"], password):
            user = User(user_data)
            login_user(user)
            return jsonify({"message": "Logged in successfully"})
        return jsonify({"error": "Invalid username or password"}), 401
    return render_template("login.html")

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("index"))

@app.route("/")
def index():
    username = current_user.username if current_user.is_authenticated else None
    return render_template("index.html", username=username)

@app.route("/chat", methods=["POST"])
def chat():
    user_message = request.json.get("message")
    conversation_id = request.json.get("conversation_id")
    conversation_name = request.json.get("conversation_name")
    subject = request.json.get("subject")

    if not conversation_id:
        conversation_id = str(uuid.uuid4())

        if not subject:
            try:
                # Generate subject using OpenAI
                prompt = f"Generate a short title for this message: '{user_message}'"
                response = openai.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=30,  # Adjust as needed
                )
                subject = response.choices[0].message.content.strip().strip('"')
            except Exception as e:
                print(f"Error generating subject: {e}")
                subject = "New Conversation"  # Fallback title

    if not user_message:
        return jsonify([])

    messages = [{"role": "user", "content": user_message}]

    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo", messages=messages
        )
        bot_reply = response.choices[0].message.content

        if current_user.is_authenticated:
            chats.insert_one({
                "user": user_message,
                "bot": bot_reply,
                "user_id": str(current_user.id),
                "conversation_id": conversation_id,
                "conversation_name": conversation_name,
                "subject": subject,
            })

        return jsonify({"reply": bot_reply, "conversation_id": conversation_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/conversations", methods=["GET"])
@login_required
def conversations():
    conversations = list(
        chats.aggregate(
            [
                {"$match": {"user_id": str(current_user.id)}},
                {
                    "$group": {
                        "_id": "$conversation_id",
                        "name": {"$first": "$conversation_name"},
                        "subject": {"$first": "$subject"},
                    }
                },
            ]
        )
    )
    return jsonify(
        [
            {
                "conversation_id": c["_id"],
                "conversation_name": c["name"],
                "subject": c["subject"] if c["subject"] else c["_id"],
            }
            for c in conversations
        ]
    )

@app.route("/search", methods=["POST"])
def search():
    search_term = request.json.get("search_term")
    if current_user.is_authenticated:
        results = list(
            chats.find(
                {
                    "user_id": str(current_user.id),
                    "$or": [
                        {"user": {"$regex": search_term, "$options": "i"}},
                        {"bot": {"$regex": search_term, "$options": "i"}},
                        {"subject": {"$regex": search_term, "$options": "i"}},
                    ],
                },
                {"_id": 0},
            )
        )
    else:
        results = []
    return jsonify(results)

if __name__ == "__main__":
    app.run(debug=True, port=5001)