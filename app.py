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
import logging
from bson.objectid import ObjectId

# Load environment variables
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "your_default_secret_key")

# Set up MongoDB connection
client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())

try:
    client.server_info()  # Check if the MongoDB connection is successful
    print("MongoDB connection successful")
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")
db = client.chat_history
chats = db.chats
users_collection = db.users

# Initialize Flask-Login
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

    # Check if the username already exists in the database
    if users_collection.find_one({"username": username}):
        return jsonify({"error": "Username already exists"}), 400

    # Hash the password and create a new user
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
    if chats is None:
        return jsonify({"error": "Database error"}), 500  # MongoDB connection check

    user_message = request.json.get("message")
    conversation_id = request.json.get("conversation_id")
    conversation_name = request.json.get("conversation_name")
    subject = request.json.get("subject")

    if not user_message:
        return jsonify({"error": "Message is required"}), 400  # Ensure a message is provided

    # Generate a new conversation ID if one doesn't exist
    if conversation_id is None:
        conversation_id = str(uuid.uuid4())

    # If subject is None, generate it (Avoid adding the prompt to the conversation)
    if subject is None:
        try:
            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": f"Generate a short title for this message: '{user_message}'"}],
                max_tokens=30,
            )
            subject = response.choices[0].message.content.strip().strip('"')
        except Exception as e:
            logging.error(f"Error generating subject: {e}")
            subject = "New Conversation"

    # Retrieve the conversation history from MongoDB if `conversation_id` exists
    try:
        query = {"conversation_id": conversation_id}
        if current_user.is_authenticated:
            query["user_id"] = str(current_user.id)

        chat_history = list(chats.find(query))
    except Exception as e:
        logging.error(f"Database error retrieving chat history: {e}")
        return jsonify({"error": "Database error retrieving chat history"}), 500

    # Prepare chat history for OpenAI API
    messages = []
    for item in chat_history:
        if "user" in item and "bot" in item:
            messages.append({"role": "user", "content": item["user"]})
            messages.append({"role": "assistant", "content": item["bot"]})
        elif "user" in item:
            messages.append({"role": "user", "content": item["user"]})
        elif "bot" in item:
            messages.append({"role": "assistant", "content": item["bot"]})

    # Add the new user message to the conversation
    messages.append({"role": "user", "content": user_message})

    try:
        # Call the OpenAI API to get the bot's response
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo", messages=messages
        )
        bot_reply = response.choices[0].message.content

        # Store the conversation in MongoDB
        conversation_data = {
            "user": user_message,
            "bot": bot_reply,
            "conversation_id": conversation_id,
            "conversation_name": conversation_name,
            "subject": subject,
        }

        if current_user.is_authenticated:
            conversation_data["user_id"] = str(current_user.id)

        try:
            chats.insert_one(conversation_data)
        except Exception as e:
            logging.error(f"Database error storing chat: {e}")
            return jsonify({"error": "Database error storing chat"}), 500

        return jsonify(
            {"reply": bot_reply, "conversation_id": conversation_id, "subject": subject}
        )
    except Exception as e:
        logging.error(f"Error in OpenAI API call: {e}")
        return jsonify({"error": "OpenAI API error"}), 500


@app.route("/conversations", methods=["GET"])
@login_required
def conversations():
    try:
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
    except Exception as e:
        logging.error(f"Error fetching conversations: {e}")
        return jsonify({"error": "Failed to fetch conversations"}), 500


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
        results = list(
            chats.find(
                {
                    "$or": [
                        {"user": {"$regex": search_term, "$options": "i"}},
                        {"bot": {"$regex": search_term, "$options": "i"}},
                        {"subject": {"$regex": search_term, "$options": "i"}},
                    ]
                },
                {"_id": 0},
            )
        )
    return jsonify(results)


@app.route("/load_conversation", methods=["POST"])
def load_conversation():
    conversation_id = request.json.get("conversation_id")

    if not conversation_id:
        return jsonify({"error": "Conversation ID is required"}), 400

    messages = list(
        chats.find(
            {"conversation_id": conversation_id, "user_id": str(current_user.id)},
            {"_id": 0},
        )
    )

    return jsonify(messages)


@app.route("/delete_conversation", methods=["POST"])
@login_required
def delete_conversation():
    conversation_id = request.json.get("conversation_id")
    if conversation_id:
        chats.delete_many(
            {"conversation_id": conversation_id, "user_id": str(current_user.id)}
        )
        return jsonify({"message": "Conversation deleted"})
    return jsonify({"error": "Conversation ID missing"}), 400


@app.route("/rename_conversation", methods=["POST"])
@login_required
def rename_conversation():
    conversation_id = request.json.get("conversation_id")
    new_name = request.json.get("new_name")

    if conversation_id and new_name:
        try:
            chats.update_many(
                {"conversation_id": conversation_id, "user_id": str(current_user.id)},
                {"$set": {"conversation_name": new_name}},
            )
            return jsonify({"message": "Conversation renamed"})
        except Exception as e:
            logging.error(f"Error renaming: {e}")
            return jsonify({"error": f"Error renaming: {e}"}), 500

    return jsonify({"error": "Conversation ID or new name missing"}), 400


if __name__ == "__main__":
    app.run(debug=True, port=5001)
