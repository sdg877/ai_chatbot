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
    fetch("/conversations")
      .then((response) => response.json())
      .then((conversations) => {
        const conversationsListContent = document.getElementById(
          "conversations-list-content"
        );
        if (!conversationsListContent) return;
  
        conversationsListContent.innerHTML = "";
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
  
          textDiv.contentEditable = false; // Make it editable later
          textDiv.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault(); // Prevent new line
  
              if (document.activeElement === chatInput) {
                // If chat input has focus, send message
                handleChatSubmit(event);
              } else {
                // If conversation title has focus, update title
                textDiv.contentEditable = false; // Disable editing
                if (textDiv.textContent !== (conversation.subject || conversation.conversation_name || `Conversation: ${conversation.conversation_id.substring(0, 8)}`)) {
                  renameConversation(conversation.conversation_id, textDiv.textContent);
                }
              }
            }
          });
  
          contentContainer.appendChild(textDiv);
  
          // Buttons container
          const buttonsContainer = document.createElement("div");
          buttonsContainer.style.display = "flex";
  
          // Edit button
          const editButton = document.createElement("span");
          editButton.textContent = "✎"; // Or use an icon
          editButton.classList.add("edit-conversation");
          editButton.addEventListener("click", (event) => {
            event.stopPropagation();
            textDiv.contentEditable = true;
            textDiv.focus();
          });
  
          buttonsContainer.appendChild(editButton);
  
          // Delete button
          const deleteButton = document.createElement("span");
          deleteButton.textContent = "✖"; // Or use an icon
          deleteButton.classList.add("delete-conversation");
          deleteButton.dataset.conversationId = conversation.conversation_id;
          deleteButton.addEventListener("click", (event) => {
            event.stopPropagation(); // Prevent loading conversation
            deleteConversation(conversation.conversation_id);
          });
  
          buttonsContainer.appendChild(deleteButton);
  
          contentContainer.appendChild(buttonsContainer);
          conversationDiv.appendChild(contentContainer);
  
          // Add data-conversation-id attribute
          conversationDiv.dataset.conversationId = conversation.conversation_id;
  
          conversationDiv.addEventListener("click", () =>
            loadConversation(conversation.conversation_id)
          );
  
          conversationsListContent.appendChild(conversationDiv);
        });
      })
      .catch((error) => console.error("Error fetching conversations:", error));
  }
  
  function handleChatSubmit(event) {
    event.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;
  
    // Remove the subject input
    const subjectInput = document.getElementById("subject-input");
    if (subjectInput) {
      subjectInput.style.display = "none";
    }
  
    displayMessage("user", message);
    chatInput.value = "";
  
    fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        conversation_id: userLoggedIn ? currentConversationId : null,
        conversation_name: userLoggedIn ? currentConversationName : null,
        subject: currentSubject,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.reply) {
          displayMessage("bot", data.reply);
          if (userLoggedIn) {
            currentConversationId = data.conversation_id;
            fetchConversations();
          }
        } else if (data.error) {
          displayMessage("error", "Error: " + data.error);
        }
      })
      .catch((error) => console.error("Error sending message:", error));
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
  
  function renameConversation(conversationId, newName) {
    fetch("/rename_conversation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId, new_name: newName }),
    })
      .then(() => fetchConversations())
      .catch((error) => console.error("Error renaming conversation:", error));
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
        }
      })
      .catch((error) => console.error("Error loading conversation:", error));
  }
  function startNewChat() {
    currentConversationId = null;
    currentConversationName = null;
    currentSubject = null;
    if (chatBox) chatBox.innerHTML = "";
    if (subjectInput) subjectInput.disabled = false;
  }

  function displayMessage(sender, message) {
    if (!chatBox) return;
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", sender);
    messageDiv.textContent = message;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
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

  chatInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault(); // Prevent new line
      handleChatSubmit(event);
    }
  });

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
