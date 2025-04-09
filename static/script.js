let hasDisplayedWelcomeMessage = false;

function init() {
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
  const menuToggle = document.getElementById("menu-toggle");
  const closeMenu = document.getElementById("close-menu");
  const sidebar = document.getElementById("sidebar");

  let currentConversationId = null;
  let currentConversationName = null;
  let currentSubject = null;
  let isNewChat = true;

  const userLoggedIn = !!document.querySelector(".user-info");

  function showTypingIndicator() {
    if (!chatBox) return;
    removeTypingIndicator();

    const indicatorDiv = document.createElement("div");
    indicatorDiv.classList.add("message", "bot", "typing-indicator");
    indicatorDiv.id = "typing-indicator";
    indicatorDiv.innerHTML = `<span>.</span><span>.</span><span>.</span>`;
    chatBox.appendChild(indicatorDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function removeTypingIndicator() {
    const indicator = document.getElementById("typing-indicator");
    if (indicator) {
      indicator.remove();
    }
  }

  function displayMessage(sender, message) {
    if (!chatBox) return;
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", sender);
    messageDiv.textContent = message;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function displayWelcomeMessage() {
    if (!chatBox || chatBox.children.length > 0) return;

    const messageContainer = document.createElement("div");
    messageContainer.classList.add("bot-message");
    messageContainer.id = "welcome-message";
    messageContainer.innerHTML = `
            <p><strong>How can I help today?</strong></p>
            <ul id="example-prompts">
                <li class="example">Tell me a fun fact!</li>
                <li class="example">What's the weather like today?</li>
                <li class="example">Can you explain recursion?</li>
            </ul>
      `;
    chatBox.appendChild(messageContainer);

    document.querySelectorAll(".example").forEach((item) => {
      item.addEventListener("click", function () {
        if (chatInput) {
          chatInput.value = this.textContent;
          chatInput.focus();
        }
      });
    });
  }

  function handleChatSubmit(event) {
    event.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;

    const welcomeMessage = document.getElementById("welcome-message");
    if (welcomeMessage) {
      welcomeMessage.remove();
    }

    displayMessage("user", message);
    chatInput.value = "";

    showTypingIndicator();

    let subjectToSend = null;
    if (isNewChat && subjectInput) {
      subjectToSend = subjectInput.value.trim();
    }

    const convIdToSend =
      currentConversationId || localStorage.getItem("conversationId");

    fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        conversation_id: convIdToSend,
        conversation_name: userLoggedIn ? currentConversationName : null,
        subject: isNewChat ? subjectToSend : null,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        removeTypingIndicator();

        if (data.reply) {
          displayMessage("bot", data.reply);
          if (!currentConversationId && data.conversation_id) {
            currentConversationId = data.conversation_id;
            localStorage.setItem("conversationId", currentConversationId);
            if (data.subject) {
              currentSubject = data.subject;
              const subjectDisplay = document.getElementById(
                "conversation-subject"
              );
              if (subjectDisplay)
                subjectDisplay.textContent = "Subject: " + currentSubject;
            }

            if (userLoggedIn) fetchConversations();
          }
          isNewChat = false;
        } else if (data.error) {
          displayMessage("error", "Error: " + data.error);
        }
      })
      .catch((error) => {
        removeTypingIndicator();
        console.error("Error sending message:", error);
        displayMessage(
          "error",
          "Sorry, something went wrong. Please try again."
        );
      });
  }

  function startNewChat() {
    currentConversationId = null;
    currentSubject = null;
    isNewChat = true;
    localStorage.removeItem("conversationId");

    if (chatBox) {
      chatBox.innerHTML = "";
    }

    const subjectDisplay = document.getElementById("conversation-subject");
    if (subjectDisplay) subjectDisplay.textContent = "";
    if (subjectInput) subjectInput.value = "";

    displayWelcomeMessage();
    hasDisplayedWelcomeMessage = true;
  }

  function fetchConversations() {
    const conversationsListContent = document.getElementById(
      "conversations-list-content"
    );
    if (!conversationsListContent) return;

    if (!userLoggedIn) {
      conversationsListContent.innerHTML =
        "<p>Please log in to see conversations.</p>";
      return;
    }

    fetch("/conversations")
      .then((response) => response.json())
      .then((conversations) => {
        conversationsListContent.innerHTML = "";

        if (!conversations || conversations.length === 0) {
          conversationsListContent.innerHTML = "<p>No conversations found.</p>";
          return;
        }

        conversations.forEach((conversation) => {
          const conversationDiv = document.createElement("div");
          conversationDiv.classList.add("conversation-item");
          conversationDiv.dataset.conversationId = conversation.conversation_id;

          const contentContainer = document.createElement("div");
          contentContainer.style.display = "flex";
          contentContainer.style.alignItems = "center";
          contentContainer.style.justifyContent = "space-between";

          const textDiv = document.createElement("div");
          textDiv.textContent =
            conversation.subject ||
            conversation.conversation_name ||
            `Conversation ${conversation.conversation_id.substring(0, 8)}`;
          textDiv.style.flexGrow = "1";
          textDiv.style.marginRight = "10px";
          textDiv.style.overflow = "hidden";
          textDiv.style.textOverflow = "ellipsis";
          textDiv.style.whiteSpace = "nowrap";

          contentContainer.appendChild(textDiv);

          const buttonsContainer = document.createElement("div");
          buttonsContainer.style.display = "flex";
          buttonsContainer.style.flexShrink = "0";

          const deleteButton = document.createElement("span");
          deleteButton.textContent = "✖";
          deleteButton.classList.add("delete-conversation");
          deleteButton.style.cursor = "pointer";
          deleteButton.style.marginLeft = "5px";
          deleteButton.title = "Delete Conversation";
          deleteButton.dataset.conversationId = conversation.conversation_id;
          deleteButton.addEventListener("click", (event) => {
            event.stopPropagation();
            if (confirm("Are you sure you want to delete this conversation?")) {
              deleteConversation(conversation.conversation_id);
            }
          });

          buttonsContainer.appendChild(deleteButton);
          contentContainer.appendChild(buttonsContainer);
          conversationDiv.appendChild(contentContainer);

          conversationDiv.addEventListener("click", () =>
            loadConversation(conversation.conversation_id)
          );

          conversationsListContent.appendChild(conversationDiv);
        });
      })
      .catch((error) => {
        console.error("Error fetching conversations:", error);
        if (conversationsListContent) {
          conversationsListContent.innerHTML =
            "<p>Error loading conversations.</p>";
        }
      });
  }

  function deleteConversation(conversationId) {
    fetch("/delete_conversation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to delete conversation");
        }
        return response.json();
      })
      .then((data) => {
        if (currentConversationId === conversationId) {
          startNewChat();
        }
        fetchConversations();
      })
      .catch((error) => {
        console.error("Error deleting conversation:", error);
      });
  }

  function loadConversation(conversationId) {
    fetch("/load_conversation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (!chatBox) return;
        chatBox.innerHTML = "";

        if (data.error) {
          displayMessage("error", "Error loading conversation: " + data.error);
        } else {
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            data.messages.forEach((message) => {
              if (message.user) displayMessage("user", message.user);
              if (message.bot) displayMessage("bot", message.bot);
            });
          } else {
            // Handle empty conversation - maybe display a placeholder or do nothing
            // console.log("Loaded conversation is empty.");
            // Don't display welcome message here, it's loading an existing (empty) chat
          }

          currentConversationId = conversationId;
          localStorage.setItem("conversationId", conversationId);
          isNewChat = false;
          hasDisplayedWelcomeMessage = true;

          currentSubject = data.subject || null;
          const subjectDisplay = document.getElementById(
            "conversation-subject"
          );
          if (subjectDisplay) {
            subjectDisplay.textContent = currentSubject
              ? "Subject: " + currentSubject
              : "";
          }

          if (subjectInput) {
            subjectInput.value = currentSubject || "";
          }
        }
        chatBox.scrollTop = chatBox.scrollHeight;
      })
      .catch((error) => {
        console.error("Error loading conversation:", error);
        displayMessage("error", "Failed to load conversation.");
      });
  }

  function handleSearch() {
    const searchTerm = searchInput ? searchInput.value.trim() : "";
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
          console.warn(
            "Search results container not found. Please add a div with id='search-results'."
          );
          searchResultsDiv = document.createElement("div");
          searchResultsDiv.id = "search-results";
          document.body.appendChild(searchResultsDiv);
        }

        searchResultsDiv.innerHTML = "";
        if (!results || results.length === 0) {
          searchResultsDiv.innerHTML = "<p>No results found.</p>";
        } else {
          searchResultsDiv.innerHTML = results
            .map(
              (result) => `
                    <div>
                        <p><strong>User:</strong> ${result.user || "N/A"}</p>
                        <p><strong>Bot:</strong> ${result.bot || "N/A"}</p>
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
        }
      })
      .catch((error) => {
        console.error("Error searching:", error);
        let searchResultsDiv = document.getElementById("search-results");
        if (searchResultsDiv) {
          searchResultsDiv.innerHTML = "<p>Error during search.</p>";
        }
      });
  }

  function handleRegister(event) {
    event.preventDefault();
    const usernameInput = document.getElementById("register-username");
    const passwordInput = document.getElementById("register-password");
    const authMessage = document.getElementById("auth-message");

    if (!usernameInput || !passwordInput) {
      console.error("Register username or password input not found!");
      return;
    }
    if (!authMessage) {
      console.warn("auth-message element not found for displaying errors.");
    }

    const username = usernameInput.value;
    const password = passwordInput.value;

    fetch("/register", {
      method: "POST",
      body: new URLSearchParams({ username, password }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.message) {
          window.location.href = "/";
        } else {
          if (authMessage) {
            authMessage.textContent = data.error || "Registration failed.";
            authMessage.style.color = "red";
          } else {
            alert(data.error || "Registration failed.");
          }
        }
      })
      .catch((error) => {
        console.error("Error during registration fetch:", error);
        if (authMessage) {
          authMessage.textContent = "An error occurred during registration.";
          authMessage.style.color = "red";
        } else {
          alert("An error occurred during registration.");
        }
      });
  }

  function handleLogin(event) {
    event.preventDefault();
    const usernameInput = document.getElementById("login-username");
    const passwordInput = document.getElementById("login-password");
    const authMessage = document.getElementById("auth-message");

    if (!usernameInput || !passwordInput) {
      console.error("Login username or password input not found!");
      return;
    }
    if (!authMessage) {
      console.warn("auth-message element not found for displaying errors.");
    }

    const username = usernameInput.value;
    const password = passwordInput.value;

    fetch("/login", {
      method: "POST",
      body: new URLSearchParams({ username, password }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.message) {
          window.location.href = "/";
        } else {
          if (authMessage) {
            authMessage.textContent = data.error || "Login failed.";
            authMessage.style.color = "red";
          } else {
            alert(data.error || "Login failed."); // Fallback alert
          }
        }
      })
      .catch((error) => {
        console.error("Error during login fetch:", error);
        if (authMessage) {
          authMessage.textContent = "An error occurred during login.";
          authMessage.style.color = "red";
        } else {
          alert("An error occurred during login.");
        }
      });
  }

  function handleToggle() {
    if (!loginForm || !registerForm || !toggleAuth) {
      console.error(
        "Toggle failed: Missing loginForm, registerForm, or toggleAuth element."
      );
      return;
    }

    if (loginForm.style.display === "none") {
      loginForm.style.display = "block";
      registerForm.style.display = "none";
      toggleAuth.textContent = "Don't have an account? Register";
    } else {
      loginForm.style.display = "none";
      registerForm.style.display = "block";
      toggleAuth.textContent = "Already have an account? Login";
    }
    const authMessage = document.getElementById("auth-message");
    if (authMessage) {
      authMessage.textContent = "";
    } else {
      console.warn("auth-message element not found for clearing.");
    }
  }

  if (userLoggedIn) {
    fetchConversations();
  } else {
    const conversationsListContent = document.getElementById(
      "conversations-list-content"
    );
    if (conversationsListContent) {
      conversationsListContent.innerHTML =
        "<p>Log in to save and view chat history.</p>";
    }
  }

  if (newChatButton) newChatButton.addEventListener("click", startNewChat);
  if (chatForm && chatInput && chatBox)
    chatForm.addEventListener("submit", handleChatSubmit);
  if (searchButton && searchInput)
    searchButton.addEventListener("click", handleSearch);

  if (registerSubmit && registerForm) {
    registerSubmit.addEventListener("click", handleRegister);
  } else {
    console.log(
      ">>> Conditions NOT MET for attaching REGISTER listener (Button or Form missing) <<<"
    );
  }

  if (loginSubmit && loginForm) {
    loginSubmit.addEventListener("click", handleLogin);
  } else {
    console.log(
      ">>> Conditions NOT MET for attaching LOGIN listener (Button or Form missing) <<<"
    );
  }

  if (toggleAuth) {
    toggleAuth.addEventListener("click", handleToggle);
  } else {
    console.log(">>> Conditions NOT MET for attaching TOGGLE listener <<<");
  }

  const storedConvId = localStorage.getItem("conversationId");
  if (!storedConvId && chatBox && !hasDisplayedWelcomeMessage) {
    displayWelcomeMessage();
    hasDisplayedWelcomeMessage = true;
  } else if (storedConvId) {
    isNewChat = false;
    hasDisplayedWelcomeMessage = true;
  }

  if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", function () {
      sidebar.classList.add("active");
    });
  }

  if (closeMenu && sidebar) {
    closeMenu.addEventListener("click", function () {
      sidebar.classList.remove("active");
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  init();
});

document.addEventListener("DOMContentLoaded", () => {
  const chatInput = document.getElementById("chat-input");
  const chatForm = document.getElementById("chat-form");

  if (chatInput && chatForm) {
    chatInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        chatForm.dispatchEvent(
          new Event("submit", { cancelable: true, bubbles: true })
        );
      }
    });
  }
});
