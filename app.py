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

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "your_default_secret_key")


client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())

try:
    client.server_info()
    print("MongoDB connection successful")
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")
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
    user_data = {"_id": user_id, "username": username, "password": password_hash}
    users_collection.insert_one(user_data)

    user = User(user_data)
    login_user(user)

    return jsonify({"message": "User registered and logged in successfully"})


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        user_data = users_collection.find_one({"username": username})

        if user_data and check_password_hash(user_data["password"], password):
            user = User(user_data)
            login_user(user)

            if current_user.is_authenticated:
                return jsonify({"message": "Logged in successfully"})
            else:
                return jsonify({"error": "Authentication failed"}), 401

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
        logging.error("Database collection 'chats' is not available.")
        return jsonify({"error": "Database connection error"}), 500

    user_message = request.json.get("message")
    conversation_id = request.json.get("conversation_id")
    conversation_name = request.json.get("conversation_name")
    subject = request.json.get("subject")

    if not user_message:
        return jsonify({"error": "Message is required"}), 400

    is_new_conversation = False
    if conversation_id is None:
        is_new_conversation = True
        conversation_id = str(uuid.uuid4())

    if is_new_conversation and subject is None:
        try:

            prompt = f"Generate a very short (3-5 word) title for this user message: '{user_message}'"
            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=15,
                temperature=0.5,
            )
            subject = response.choices[0].message.content.strip().strip("'\".")
        except Exception as e:
            logging.error(f"Error generating subject using OpenAI: {e}")
            subject = "New Chat"
    elif not is_new_conversation and subject is None:
        pass

    chat_history = []
    try:
        query = {"conversation_id": conversation_id}
        if current_user.is_authenticated:
            query["user_id"] = str(current_user.id)
        chat_history = list(chats.find(query))
        if not is_new_conversation and subject is None and chat_history:
            first_message = chat_history[0]
            subject = first_message.get("subject", "Chat History")

    except Exception as e:
        logging.error(
            f"Database error retrieving chat history for {conversation_id}: {e}"
        )
        return jsonify({"error": "Database error retrieving chat history"}), 500

    messages = []

    # ** ADD THE SYSTEM MESSAGE FOR UK CONTEXT / BRITISH ENGLISH / METRICS **
    messages.append(
        {
            "role": "system",
            "content": "You are a helpful assistant interacting with a user based in the UK (specifically Mitcham, England). Please ensure all your responses strictly adhere to UK conventions: \
                    1. Language: Use British English spelling, grammar, and vocabulary (e.g., colour, centre, realise, organise, tyre, programme, lift, flat, motorway, postcode). \
                    2. Units: Primarily use metric units (e.g., km, m, cm, kg, g, litres, °C). Where appropriate for common UK usage, imperial units like miles (for road distances/speed), pints (for beer/milk), and feet/inches (for height) may be used or mentioned alongside metric. Avoid Fahrenheit, US gallons, lbs/oz unless specifically requested. \
                    3. Formatting: Use UK date format (DD/MM/YYYY). Use £ (GBP Sterling) for currency. \
                    4. Context: Frame examples, cultural references, and place names with a UK audience in mind. Assume local context where appropriate (e.g., knowledge of common UK retailers, institutions, locations relevant to South London/Surrey).",
        }
    )

    for item in chat_history:
        if item.get("user"):
            messages.append({"role": "user", "content": item["user"]})
        if item.get("bot"):
            messages.append({"role": "assistant", "content": item["bot"]})

    messages.append({"role": "user", "content": user_message})

    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo", messages=messages
        )
        bot_reply = response.choices[0].message.content

    except Exception as e:
        logging.error(f"Error calling OpenAI API: {e}")
        return (
            jsonify(
                {
                    "error": "AI assistant is currently unavailable. Please try again later."
                }
            ),
            500,
        )

    try:
        conversation_data = {
            "conversation_id": conversation_id,
            "user": user_message,
            "bot": bot_reply,
            "subject": subject,
        }

        if current_user.is_authenticated:
            conversation_data["user_id"] = str(current_user.id)
        if conversation_name:
            conversation_data["conversation_name"] = conversation_name

        chats.insert_one(conversation_data)

    except Exception as e:
        logging.error(
            f"Database error storing chat interaction for {conversation_id}: {e}"
        )

    response_data = {
        "reply": bot_reply,
        "conversation_id": conversation_id,
        "subject": subject,
    }
    return jsonify(response_data)

@app.route("/conversations", methods=["GET"])
@login_required
def conversations():
    try:
        user_id_str = str(current_user.id) # Get user ID once
        print(f"--- Fetching conversations for user_id: {user_id_str} ---") # Log user ID

        conversations_pipeline = list(
            chats.aggregate(
                [
                    # Stage 1: Match documents for the logged-in user
                    {"$match": {"user_id": user_id_str}},

                    # **** ADD THIS STAGE for consistent ordering ****
                    {
                       # Stage 2: Sort by _id BEFORE grouping
                       # Ensures $first consistently picks from the earliest message
                       '$sort': { '_id': 1 } # 1 for ascending order
                    },
                    # ***********************************************

                    {
                        # Stage 3: Group by conversation_id
                        "$group": {
                            "_id": "$conversation_id", # Group by the conversation ID
                            "name": {"$first": "$conversation_name"}, # Get name from the first message
                            "subject": {"$first": "$subject"},        # Get subject from the first message
                        }
                    },
                    # Optional: Sort the final list of conversations themselves
                    {
                        '$sort': {'_id': 1} # Sort conversations chronologically by their ID
                    }
                ]
            )
        )
        # --- Print the raw result from aggregation ---
        print(f"Raw aggregation result: {conversations_pipeline}")
        # -------------------------------------------

        formatted_conversations = [
            {
                "conversation_id": c["_id"],
                "conversation_name": c.get("name"), # Keep name separate
                 # Use the specific name if set, otherwise the subject, otherwise fallback
                "subject": c.get("name") or c.get("subject") or f"Chat {c['_id'][:8]}...",
            }
            for c in conversations_pipeline
        ]
        # --- Print the final list being sent ---
        print(f"Formatted conversations being sent: {formatted_conversations}")
        # ---------------------------------------

        return jsonify(formatted_conversations)
    except Exception as e:
        # Use variable defined outside try block if possible or provide default
        user_identifier = getattr(current_user, 'id', 'Unknown User')
        logging.error(f"Error fetching conversations for user {user_identifier}: {e}")
        return jsonify({"error": "Failed to fetch conversations"}), 500



# @app.route("/conversations", methods=["GET"])
# @login_required
# def conversations():
#     try:
#         user_id_str = str(current_user.id) # Get user ID once
#         print(f"--- Fetching conversations for user_id: {user_id_str} ---") # Log user ID

#         conversations_pipeline = list(
#             chats.aggregate(
#                 [
#                     {"$match": {"user_id": user_id_str}}, # Use the variable
#                     # {"$sort": {"timestamp": -1}}, # Add if you have timestamps
#                     {
#                         "$group": {
#                             "_id": "$conversation_id",
#                             "name": {"$first": "$conversation_name"},
#                             "subject": {"$first": "$subject"},
#                         }
#                     },
#                 ]
#             )
#         )
#         # --- Print the raw result from aggregation ---
#         print(f"Raw aggregation result: {conversations_pipeline}")
#         # -------------------------------------------

#         formatted_conversations = [
#             {
#                 "conversation_id": c["_id"],
#                 "conversation_name": c.get("name"),
#                 "subject": c.get("subject") or c.get("name") or f"Chat {c['_id'][:8]}...", # Adjusted fallback
#             }
#             for c in conversations_pipeline
#         ]
#         # --- Print the final list being sent ---
#         print(f"Formatted conversations being sent: {formatted_conversations}")
#         # ---------------------------------------

#         return jsonify(formatted_conversations)
#     except Exception as e:
#         logging.error(f"Error fetching conversations for user {user_id_str}: {e}") # Use variable
#         return jsonify({"error": "Failed to fetch conversations"}), 500
#     try:
#         conversations = list(
#             chats.aggregate(
#                 [
#                     {"$match": {"user_id": str(current_user.id)}},
#                     {
#                         "$group": {
#                             "_id": "$conversation_id",
#                             "name": {"$first": "$conversation_name"},
#                             "subject": {"$first": "$subject"},
#                         }
#                     },
#                 ]
#             )
#         )
#         return jsonify(
#             [
#                 {
#                     "conversation_id": c["_id"],
#                     "conversation_name": c["name"],
#                     "subject": c["subject"] if c["subject"] else c["_id"],
#                 }
#                 for c in conversations
#             ]
#         )
#     except Exception as e:
#         logging.error(f"Error fetching conversations: {e}")
#         return jsonify({"error": "Failed to fetch conversations"}), 500


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
