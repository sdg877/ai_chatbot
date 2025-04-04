let hasDisplayedWelcomeMessage = false; // Keep track if the initial welcome message was shown

// The init function now wraps most of the logic to keep the global scope cleaner
function init() {
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatBox = document.getElementById("chat-box");
  const newChatButton = document.getElementById("new-chat-button");
  const searchButton = document.getElementById("search-button");
  const searchInput = document.getElementById("search-input");
  const registerForm = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");
  const subjectInput = document.getElementById("subject-input"); // Used below
  const registerSubmit = document.getElementById("register-submit");
  const loginSubmit = document.getElementById("login-submit");
  const toggleAuth = document.getElementById("toggle-auth");
  const menuToggle = document.getElementById("menu-toggle");
  const closeMenu = document.getElementById("close-menu");
  const sidebar = document.getElementById("sidebar");

  let currentConversationId = null;
  let currentConversationName = null; // Used in fetch body
  let currentSubject = null;
  let isNewChat = true; // Tracks if the current interaction should start a new conversation

  const userLoggedIn = !!document.querySelector(".user-info");

  // --- Helper Functions ---

  // Function to show the typing indicator
  function showTypingIndicator() {
    if (!chatBox) return;
    // Remove any existing indicator first
    removeTypingIndicator();

    const indicatorDiv = document.createElement("div");
    indicatorDiv.classList.add("message", "bot", "typing-indicator");
    indicatorDiv.id = "typing-indicator"; // ID for easy removal
    // Simple dot animation (can be enhanced with CSS)
    indicatorDiv.innerHTML = `<span>.</span><span>.</span><span>.</span>`;
    chatBox.appendChild(indicatorDiv);
    chatBox.scrollTop = chatBox.scrollHeight; // Scroll down
  }

  // Function to remove the typing indicator
  function removeTypingIndicator() {
    const indicator = document.getElementById("typing-indicator");
    if (indicator) {
      indicator.remove();
    }
  }

  // Displays messages in the chatbox
  function displayMessage(sender, message) {
    if (!chatBox) return;
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", sender); // Applies 'user' or 'bot' class
    messageDiv.textContent = message;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight; // Scroll to the latest message
  }

  // Displays the initial welcome message and example prompts
  function displayWelcomeMessage() {
      if (!chatBox || chatBox.children.length > 0) return; // Only show if chatbox is empty

      const messageContainer = document.createElement("div");
      messageContainer.classList.add("bot-message"); // Use bot styling
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

      // Add click listeners to example prompts
      document.querySelectorAll(".example").forEach((item) => {
          item.addEventListener("click", function () {
              if (chatInput) {
                  chatInput.value = this.textContent;
                  chatInput.focus();
              }
          });
      });
  }

  // --- Event Handlers ---

  function handleChatSubmit(event) {
    event.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;

    // Remove welcome message if it exists
    const welcomeMessage = document.getElementById("welcome-message");
    if (welcomeMessage) {
      welcomeMessage.remove();
    }

    displayMessage("user", message);
    chatInput.value = ""; // Clear input after sending

    // Show typing indicator immediately after user message
    showTypingIndicator();

    let subjectToSend = null;
    if (isNewChat && subjectInput) {
        subjectToSend = subjectInput.value.trim();
        // Optional: Add validation if subject is required for new chats
        // if (!subjectToSend) {
        //   removeTypingIndicator(); // Remove indicator before showing error
        //   displayMessage("error", "Please provide a subject for new conversations.");
        //   return;
        // }
    }


    // Use localStorage conversationId if currentConversationId is not set yet
    const convIdToSend = currentConversationId || localStorage.getItem("conversationId");

    fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        conversation_id: convIdToSend, // Send current or stored ID
        conversation_name: userLoggedIn ? currentConversationName : null, // Send name if logged in
        subject: isNewChat ? subjectToSend : null, // Send subject only for new chats
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        // Remove typing indicator BEFORE displaying the bot's response or error
        removeTypingIndicator();

        if (data.reply) {
          displayMessage("bot", data.reply);
          if (!currentConversationId && data.conversation_id) {
            // If this was the first message of a new chat, store the returned ID
            currentConversationId = data.conversation_id;
            localStorage.setItem("conversationId", currentConversationId); // Persist for page refresh
            if (data.subject) {
                currentSubject = data.subject; // Store the subject determined by the backend if needed
                // Update UI if needed, e.g., a title area
                const subjectDisplay = document.getElementById("conversation-subject"); // Assuming you have an element with this ID
                if (subjectDisplay) subjectDisplay.textContent = "Subject: " + currentSubject;
            }
            // Refresh conversations list if logged in and a new chat was created
            if (userLoggedIn) fetchConversations();
          }
          isNewChat = false; // It's no longer a new chat after the first exchange
        } else if (data.error) {
          displayMessage("error", "Error: " + data.error);
        }
      })
      .catch((error) => {
        // Remove typing indicator in case of fetch error
        removeTypingIndicator();
        console.error("Error sending message:", error);
        displayMessage("error", "Sorry, something went wrong. Please try again."); // User-friendly error
      });
  }

  function startNewChat() {
    currentConversationId = null;
    currentSubject = null;
    isNewChat = true;
    localStorage.removeItem("conversationId"); // Clear stored ID for new chat

    if (chatBox) {
      chatBox.innerHTML = ""; // Clear chat box visual
    }
    // Reset subject input/display if applicable
    const subjectDisplay = document.getElementById("conversation-subject");
    if (subjectDisplay) subjectDisplay.textContent = "";
    if (subjectInput) subjectInput.value = ""; // Clear subject input field

    displayWelcomeMessage(); // Show the initial prompts again
    hasDisplayedWelcomeMessage = true; // Set flag as welcome is shown for this new chat
  }

  function fetchConversations() {
    const conversationsListContent = document.getElementById("conversations-list-content");
    if (!conversationsListContent) return;

    if (!userLoggedIn) {
        conversationsListContent.innerHTML = "<p>Please log in to see conversations.</p>";
        return;
    }

    fetch("/conversations")
      .then((response) => response.json())
      .then((conversations) => {
        conversationsListContent.innerHTML = ""; // Clear previous list

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
            textDiv.textContent = conversation.subject || conversation.conversation_name || `Conversation ${conversation.conversation_id.substring(0, 8)}`;
            textDiv.style.flexGrow = "1"; // Allow text to take available space
            textDiv.style.marginRight = "10px"; // Space before buttons
            textDiv.style.overflow = "hidden"; // Prevent long text overflowing
            textDiv.style.textOverflow = "ellipsis";
            textDiv.style.whiteSpace = "nowrap";


            contentContainer.appendChild(textDiv);

            const buttonsContainer = document.createElement("div");
            buttonsContainer.style.display = "flex";
            buttonsContainer.style.flexShrink = "0"; // Prevent buttons from shrinking

            // Note: Renaming functionality (edit button/logic) was removed as requested
            // because the renameConversation function was not defined in the original code.

            const deleteButton = document.createElement("span");
            deleteButton.textContent = "✖"; // Use a clear icon or text
            deleteButton.classList.add("delete-conversation");
            deleteButton.style.cursor = "pointer";
            deleteButton.style.marginLeft = "5px";
            deleteButton.title = "Delete Conversation"; // Tooltip
            deleteButton.dataset.conversationId = conversation.conversation_id;
            deleteButton.addEventListener("click", (event) => {
                event.stopPropagation(); // Prevent triggering loadConversation
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
            conversationsListContent.innerHTML = "<p>Error loading conversations.</p>";
        }
      });
  }

  function deleteConversation(conversationId) {
      fetch("/delete_conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_id: conversationId }),
      })
      .then(response => {
          if (!response.ok) {
              throw new Error('Failed to delete conversation');
          }
          return response.json();
      })
      .then(data => {
          // If the currently loaded chat was deleted, start a new one
          if (currentConversationId === conversationId) {
              startNewChat();
          }
          fetchConversations(); // Refresh the list
      })
      .catch((error) => {
          console.error("Error deleting conversation:", error);
          // Optionally display an error message to the user
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
        chatBox.innerHTML = ""; // Clear chatbox before loading

        if (data.error) {
          displayMessage("error", "Error loading conversation: " + data.error);
        } else {
            // Check if data is an array and has messages
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
            localStorage.setItem("conversationId", conversationId); // Store loaded ID
            isNewChat = false; // Loading an existing chat
            hasDisplayedWelcomeMessage = true; // Prevent welcome message from showing again

            // Update subject display
             currentSubject = data.subject || null; // Update currentSubject
             const subjectDisplay = document.getElementById("conversation-subject");
             if (subjectDisplay) {
                subjectDisplay.textContent = currentSubject ? "Subject: " + currentSubject : "";
            }

             // Clear subject input field when loading a chat
             if (subjectInput) {
                 subjectInput.value = currentSubject || "";
             }
        }
        chatBox.scrollTop = chatBox.scrollHeight; // Scroll to bottom after loading
      })
      .catch((error) => {
          console.error("Error loading conversation:", error);
          displayMessage("error", "Failed to load conversation.");
      });
  }

  function handleSearch() {
    const searchTerm = searchInput ? searchInput.value.trim() : "";
    if (!searchTerm) return;

    // Basic implementation - Consider adding loading state
    fetch("/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ search_term: searchTerm }),
    })
      .then((response) => response.json())
      .then((results) => {
        let searchResultsDiv = document.getElementById("search-results");
        if (!searchResultsDiv) {
          // Create if it doesn't exist - adjust based on your HTML structure
          console.warn("Search results container not found. Please add a div with id='search-results'.");
          // As a fallback, maybe append to body or a specific section
          searchResultsDiv = document.createElement("div");
          searchResultsDiv.id = "search-results";
          document.body.appendChild(searchResultsDiv); // Example fallback
        }

        searchResultsDiv.innerHTML = ""; // Clear previous results
        if (!results || results.length === 0) {
          searchResultsDiv.innerHTML = "<p>No results found.</p>";
        } else {
          searchResultsDiv.innerHTML = results
            .map(
              (result) => `
                    <div>
                        <p><strong>User:</strong> ${result.user || "N/A"}</p>
                        <p><strong>Bot:</strong> ${result.bot || "N/A"}</p>
                        <p><strong>Subject:</strong> ${result.subject || "N/A"}</p>
                        <p><strong>Conversation ID:</strong> ${result.conversation_id}</p>
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

  // --- Auth Handlers (if forms exist) ---
  function handleRegister(event) {
    event.preventDefault();
    const usernameInput = document.getElementById("register-username");
    const passwordInput = document.getElementById("register-password");
    const authMessage = document.getElementById("auth-message");

    if (!usernameInput || !passwordInput || !authMessage) return;

    const username = usernameInput.value;
    const password = passwordInput.value;

    fetch("/register", {
      method: "POST",
      // Send as form data
      body: new URLSearchParams({ username, password }),
       headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
       }
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.message) {
          window.location.href = "/"; // Redirect on success
        } else {
          authMessage.textContent = data.error || "Registration failed.";
          authMessage.style.color = 'red';
        }
      })
      .catch((error) => {
          console.error("Error during registration:", error);
          authMessage.textContent = "An error occurred during registration.";
          authMessage.style.color = 'red';
      });
  }

  function handleLogin(event) {
    event.preventDefault();
    const usernameInput = document.getElementById("login-username");
    const passwordInput = document.getElementById("login-password");
    const authMessage = document.getElementById("auth-message");

     if (!usernameInput || !passwordInput || !authMessage) return;

    const username = usernameInput.value;
    const password = passwordInput.value;

    fetch("/login", {
      method: "POST",
       body: new URLSearchParams({ username, password }),
       headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
       }
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.message) {
          window.location.href = "/"; // Redirect on success
        } else {
          authMessage.textContent = data.error || "Login failed.";
          authMessage.style.color = 'red';
        }
      })
      .catch((error) => {
          console.error("Error during login:", error);
          authMessage.textContent = "An error occurred during login.";
          authMessage.style.color = 'red';
      });
  }

  function handleToggle() {
    if (!loginForm || !registerForm || !toggleAuth) return;

    if (loginForm.style.display === "none") {
      loginForm.style.display = "block";
      registerForm.style.display = "none";
      toggleAuth.textContent = "Don't have an account? Register";
    } else {
      loginForm.style.display = "none";
      registerForm.style.display = "block";
      toggleAuth.textContent = "Already have an account? Login";
    }
     // Clear any previous error messages when toggling
     const authMessage = document.getElementById("auth-message");
     if(authMessage) authMessage.textContent = "";
  }


  // --- Initial Setup and Event Listeners ---

  if (userLoggedIn) {
    fetchConversations(); // Load user's conversations if logged in
  } else {
      // Handle view for logged-out users (e.g., disable saving, hide history)
      const conversationsListContent = document.getElementById("conversations-list-content");
       if(conversationsListContent) {
           conversationsListContent.innerHTML = "<p>Log in to save and view chat history.</p>";
       }
  }


  if (newChatButton) newChatButton.addEventListener("click", startNewChat);
  if (chatForm && chatInput && chatBox) chatForm.addEventListener("submit", handleChatSubmit);
  if (searchButton && searchInput) searchButton.addEventListener("click", handleSearch);

  // Only add auth listeners if the forms exist
  if (registerSubmit && registerForm) registerForm.addEventListener("submit", handleRegister); // Use submit event on form
  if (loginSubmit && loginForm) loginForm.addEventListener("submit", handleLogin); // Use submit event on form
  if (toggleAuth) toggleAuth.addEventListener("click", handleToggle);


  // Display the initial welcome message only if no conversation is loaded/exists
  // Check localStorage first if a previous chat was ongoing
  const storedConvId = localStorage.getItem("conversationId");
  if (!storedConvId && chatBox && !hasDisplayedWelcomeMessage) {
      displayWelcomeMessage();
      hasDisplayedWelcomeMessage = true;
  } else if (storedConvId) {
      // Optionally: You could auto-load the last conversation ID here
      // loadConversation(storedConvId);
      // Or just leave the chat blank until user interacts or loads manually
      isNewChat = false; // Not a new chat if an ID exists
      hasDisplayedWelcomeMessage = true; // Don't show welcome if restoring state potentially
  }


  // Sidebar Menu Toggle Logic
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

} // End of init function

// --- Global Event Listeners ---

// Initialize the application once the DOM is fully loaded
document.addEventListener("DOMContentLoaded", init);

// Listener for "Enter to Send" - Kept separate as requested
document.addEventListener("DOMContentLoaded", () => {
  const chatInput = document.getElementById("chat-input");
  const chatForm = document.getElementById("chat-form");

  if (chatInput && chatForm) {
    chatInput.addEventListener("keydown", function (event) {
      // Check if Enter is pressed WITHOUT the Shift key
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault(); // Prevent default behavior (new line)
        // Manually dispatch the submit event on the form
        chatForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      }
      // If Shift + Enter is pressed, the default behavior (new line) occurs
    });
  }
});