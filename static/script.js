document.addEventListener("DOMContentLoaded", init);

function init() {
    console.log("Initializing script...");

    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    const chatBox = document.getElementById("chat-box");
    const newChatButton = document.getElementById("new-chat-button");
    const searchButton = document.getElementById("search-button");
    const searchInput = document.getElementById("search-input");
    const registerForm = document.getElementById("register-form");
    const loginForm = document.getElementById("login-form");
    const subjectInput = document.getElementById("subject-input");
    const registerSubmit = document.getElementById("register-submit");
    const loginSubmit = document.getElementById("login-submit");
    const toggleAuth = document.getElementById("toggle-auth");

    let currentConversationId = null;
    let currentConversationName = null;
    let currentSubject = null;
    let isNewChat = false;  // Flag for new chat.

    const userLoggedIn = !!document.querySelector(".user-info");

    if (userLoggedIn) fetchConversations();

    if (newChatButton) newChatButton.addEventListener("click", startNewChat);
    if (chatForm && chatInput && chatBox)
        chatForm.addEventListener("submit", handleChatSubmit);
    if (searchButton && searchInput)
        searchButton.addEventListener("click", handleSearch);
    if (registerSubmit && registerForm)
        registerSubmit.addEventListener("click", handleRegister);
    if (loginSubmit && loginForm)
        loginSubmit.addEventListener("click", handleLogin);
    if (toggleAuth) toggleAuth.addEventListener("click", handleToggle);

    function fetchConversations() {
      // Only fetch if the user is logged in
      if (!userLoggedIn) {
        const conversationsListContent = document.getElementById("conversations-list-content");
        if (conversationsListContent) {
          conversationsListContent.innerHTML = "<p>No conversations available. Please log in.</p>";
        }
        return; // Don't proceed further if not logged in
      }
    
      fetch("/conversations")
        .then((response) => response.json())
        .then((conversations) => {
          const conversationsListContent = document.getElementById("conversations-list-content");
          if (!conversationsListContent) return;
    
          // Clear the previous list
          conversationsListContent.innerHTML = "";
    
          if (conversations.length === 0) {
            conversationsListContent.innerHTML = "<p>No conversations found.</p>";
            return;
          }
    
          conversations.forEach((conversation) => {
            const conversationDiv = document.createElement("div");
            conversationDiv.classList.add("conversation-item");
    
            // Container for text and buttons
            const contentContainer = document.createElement("div");
            contentContainer.style.display = "flex";
            contentContainer.style.alignItems = "center";
            contentContainer.style.justifyContent = "space-between"; // Align text left, buttons right
    
            const textDiv = document.createElement("div");
            textDiv.textContent =
              conversation.subject ||
              conversation.conversation_name ||
              `Conversation: ${conversation.conversation_id.substring(0, 8)}`;
    
            textDiv.contentEditable = false;
            textDiv.addEventListener("keydown", (event) => {
              if (event.key === "Enter") {
                event.preventDefault();
    
                if (document.activeElement === chatInput) {
                  handleChatSubmit(event);
                } else {
                  textDiv.contentEditable = false;
                  if (
                    textDiv.textContent !==
                    (conversation.subject ||
                      conversation.conversation_name ||
                      `Conversation: ${conversation.conversation_id.substring(0, 8)}`)
                  ) {
                    renameConversation(conversation.conversation_id, textDiv.textContent);
                  }
                }
              }
            });
    
            contentContainer.appendChild(textDiv);
    
            const buttonsContainer = document.createElement("div");
            buttonsContainer.style.display = "flex";
    
            const editButton = document.createElement("span");
            editButton.textContent = "✎";
            editButton.classList.add("edit-conversation");
            editButton.addEventListener("click", (event) => {
              event.stopPropagation();
              textDiv.contentEditable = true;
              textDiv.focus();
            });
    
            buttonsContainer.appendChild(editButton);
    
            const deleteButton = document.createElement("span");
            deleteButton.textContent = "✖";
            deleteButton.classList.add("delete-conversation");
            deleteButton.dataset.conversationId = conversation.conversation_id;
            deleteButton.addEventListener("click", (event) => {
              event.stopPropagation();
              deleteConversation(conversation.conversation_id);
            });
    
            buttonsContainer.appendChild(deleteButton);
    
            contentContainer.appendChild(buttonsContainer);
            conversationDiv.appendChild(contentContainer);
    
            conversationDiv.dataset.conversationId = conversation.conversation_id;
    
            conversationDiv.addEventListener("click", () => loadConversation(conversation.conversation_id));
    
            conversationsListContent.appendChild(conversationDiv);
          });
        })
        .catch((error) => {
          console.error("Error fetching conversations:", error);
        });
    }
    

    function handleChatSubmit(event) {
        event.preventDefault();
        const message = chatInput.value.trim();
        if (!message) return;

        displayMessage("user", message);
        chatInput.value = "";

        // If it's a new chat, create a new conversation.
        if (isNewChat) {
            if (subjectInput) {
                currentSubject = subjectInput.value.trim();
                if (!currentSubject) {
                    displayMessage("error", "Please provide a subject for this conversation.");
                    return;
                }
            }
        }

        // If there's no existing conversation ID, start a new chat.
        if (!currentConversationId) {
            currentConversationId = localStorage.getItem("conversationId");
        }

        fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message,
                conversation_id: currentConversationId,
                conversation_name: userLoggedIn ? currentConversationName : null,
                subject: isNewChat ? currentSubject : null, // Only send subject if it's a new chat.
            }),
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.reply) {
                    displayMessage("bot", data.reply);
                    if (!currentConversationId) {
                        currentConversationId = data.conversation_id;
                        localStorage.setItem("conversationId", currentConversationId);
                    }
                    if (userLoggedIn) {
                        fetchConversations();
                    }
                    if (isNewChat) {
                        currentSubject = data.subject;
                        document.getElementById("conversation-subject").textContent = "Subject: " + data.subject;
                    }
                    isNewChat = false; // Reset the flag after the new chat.
                } else if (data.error) {
                    displayMessage("error", "Error: " + data.error);
                }
            })
            .catch((error) => console.error("Error sending message:", error));
    }

    function displayMessage(sender, message) {
        if (!chatBox) return;
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message", sender);
        messageDiv.textContent = message;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function deleteConversation(conversationId) {
        fetch("/delete_conversation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversation_id: conversationId }),
        })
            .then(() => fetchConversations())
            .catch((error) => console.error("Error deleting conversation:", error));
    }

    function loadConversation(conversationId) {
        fetch("/load_conversation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversation_id: conversationId }),
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.error) {
                    displayMessage("error", "Error: " + data.error);
                } else {
                    chatBox.innerHTML = "";
                    data.forEach((message) => {
                        if (message.user) displayMessage("user", message.user);
                        if (message.bot) displayMessage("bot", message.bot);
                    });
                    currentConversationId = conversationId; // Set the current conversation ID.
                    isNewChat = false; // It's not a new chat anymore.
                    if (data.subject) {
                        currentSubject = data.subject;
                        document.getElementById("conversation-subject").textContent = "Subject: " + currentSubject;
                    }
                }
            })
            .catch((error) => console.error("Error loading conversation:", error));
    }

    function startNewChat() {
        currentConversationId = null;
        currentSubject = null;
        isNewChat = true; // Mark the chat as new
        localStorage.removeItem("conversationId"); // Clear local storage.
        if (chatBox) chatBox.innerHTML = ""; // Clear chat box
        if (subjectInput) {
            subjectInput.style.display = "block"; // Show subject input
            subjectInput.disabled = false; // Enable the input
        }
    }

    function handleSearch() {
        const searchTerm = searchInput.value.trim();
        if (!searchTerm) return;

        fetch("/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ search_term: searchTerm }),
        })
            .then((response) => response.json())
            .then((results) => {
                let searchResultsDiv = document.getElementById("search-results");
                if (!searchResultsDiv) {
                    searchResultsDiv = document.createElement("div");
                    searchResultsDiv.id = "search-results";
                    document.body.appendChild(searchResultsDiv);
                }

                searchResultsDiv.innerHTML =
                    results.length === 0
                        ? "<p>No results found.</p>"
                        : results
                            .map(
                                (result) => `
                                    <div>
                                        <p><strong>User:</strong> ${result.user}</p>
                                        <p><strong>Bot:</strong> ${result.bot}</p>
                                        <p><strong>Subject:</strong> ${
                                            result.subject || "N/A"
                                        }</p>
                                        <p><strong>Conversation ID:</strong> ${
                                            result.conversation_id
                                        }</p>
                                        <hr>
                                    </div>
                                `
                            )
                            .join("");
            })
            .catch((error) => console.error("Error searching:", error));
    }

    function handleRegister(event) {
        event.preventDefault();
        const username = document.getElementById("register-username").value;
        const password = document.getElementById("register-password").value;

        fetch("/register", {
            method: "POST",
            body: new URLSearchParams({ username, password }),
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.message) {
                    window.location.href = "/";
                } else {
                    document.getElementById("auth-message").textContent =
                        data.error || "Unknown response";
                }
            })
            .catch((error) => console.error("Error during registration:", error));
    }

    function handleLogin(event) {
        event.preventDefault();
        const username = document.getElementById("login-username").value;
        const password = document.getElementById("login-password").value;

        fetch("/login", {
            method: "POST",
            body: new URLSearchParams({ username, password }),
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.message) {
                    window.location.href = "/";
                } else {
                    document.getElementById("auth-message").textContent =
                        data.error || "Login failed";
                }
            })
            .catch((error) => console.error("Error during login:", error));
    }

    function handleToggle() {
        if (loginForm.style.display === "none") {
            loginForm.style.display = "block";
            registerForm.style.display = "none";
            toggleAuth.textContent = "Switch to Register";
        } else {
            loginForm.style.display = "none";
            registerForm.style.display = "block";
            toggleAuth.textContent = "Switch to Login";
        }
    }
}
