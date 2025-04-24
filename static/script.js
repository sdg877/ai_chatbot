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
  let hasDisplayedWelcomeMessage = false;

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
    if (!chatBox) return;
    const hasMessages = chatBox.children.length > 0;
    const welcomeMessageDisplayed = document.getElementById("welcome-message"); 

    if (!hasMessages && !welcomeMessageDisplayed) { 
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
  }

  function sendMessage(userMessage) {
    fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: userMessage,
        conversation_id: conversationId,
      }),
    })
    .then(response => response.json()) 
    .then(data => {
      if (!conversationId) {
        conversationId = data.conversation_id; 
      }
    })
    .catch(error => {
      console.error('Error:', error);
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
      conversationsListContent.innerHTML = "";

      if (!conversations || conversations.length === 0) {
        conversationsListContent.innerHTML = "<p>No conversations found.</p>";
        return;
      }

      conversations.forEach((conversation) => {
        const conversationDiv = document.createElement("div");
        conversationDiv.dataset.conversationId = conversation.conversation_id;

        const contentContainer = document.createElement("div");
        contentContainer.classList.add("conversation-item");
        contentContainer.style.display = "flex";
        contentContainer.style.alignItems = "center";
        contentContainer.style.justifyContent = "space-between"; 

        const textDiv = document.createElement("div");
        textDiv.textContent =
          conversation.subject ||
          conversation.conversation_name ||
          `Chat ${conversation.conversation_id.substring(0, 8)}`;
        textDiv.style.flexGrow = "1";
        textDiv.style.marginRight = "10px";
        textDiv.style.overflow = "hidden";
        textDiv.style.textOverflow = "ellipsis";
        textDiv.style.whiteSpace = "nowrap";

        const iconsContainer = document.createElement("div");
        iconsContainer.classList.add("conversation-icons");
        iconsContainer.style.display = "flex";
        iconsContainer.style.alignItems = "center";
        iconsContainer.style.flexShrink = "0";

        const editButton = document.createElement("span");
        editButton.textContent = "✏️";
        editButton.classList.add("edit-conversation-button");
        editButton.style.cursor = "pointer";
        editButton.style.marginLeft = "5px";
        editButton.title = "Edit Subject";
        editButton.dataset.conversationId = conversation.conversation_id;
        editButton.addEventListener("click", (event) => {
          event.stopPropagation();
          startEditSubject(
            conversationDiv,
            conversation.conversation_id,
            textDiv.textContent
          );
        });
        iconsContainer.appendChild(editButton);

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
        iconsContainer.appendChild(deleteButton);

        contentContainer.appendChild(textDiv); // ✅ Only appended once now
        contentContainer.appendChild(iconsContainer);
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


function startEditSubject(conversationDiv, conversationId, currentSubject) {
    const contentContainer = conversationDiv.querySelector(':scope > div'); 
    contentContainer.innerHTML = '';

    const inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.value = currentSubject;
    inputField.classList.add('edit-subject-input');
    contentContainer.appendChild(inputField);

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.classList.add('edit-subject-save');
    saveButton.addEventListener('click', () => {
        const newSubject = inputField.value.trim();
        if (newSubject) {
            renameConversation(conversationId, newSubject, conversationDiv);
        } else {
            revertSubjectEdit(conversationDiv, currentSubject);
        }
    });
    contentContainer.appendChild(saveButton);

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.classList.add('edit-subject-cancel');
    cancelButton.addEventListener('click', () => {
        revertSubjectEdit(conversationDiv, currentSubject);
    });
    contentContainer.appendChild(cancelButton);
}

function revertSubjectEdit(conversationDiv, originalSubject) {
    const contentContainer = conversationDiv.querySelector(':scope > div');
    contentContainer.innerHTML = '';

    const textDiv = document.createElement("div");
    textDiv.textContent = originalSubject;
    textDiv.style.flexGrow = "1";
    textDiv.style.marginRight = "10px";
    textDiv.style.overflow = "hidden";
    textDiv.style.textOverflow = "ellipsis";
    textDiv.style.whiteSpace = "nowrap";
    contentContainer.appendChild(textDiv);

    const buttonsContainer = document.createElement("div");
    buttonsContainer.style.display = "flex";
    buttonsContainer.style.flexShrink = "0";

    const editButton = document.createElement("span");
    editButton.textContent = "✏️";
    editButton.classList.add("edit-conversation-button");
    editButton.style.cursor = "pointer";
    editButton.style.marginLeft = "5px";
    editButton.title = "Edit Subject";
    editButton.dataset.conversationId = conversationDiv.dataset.conversationId;
    editButton.addEventListener("click", (event) => {
        event.stopPropagation();
        startEditSubject(conversationDiv, conversationDiv.dataset.conversationId, originalSubject);
    });
    buttonsContainer.appendChild(editButton);

    const deleteButton = document.createElement("span");
    deleteButton.textContent = "✖";
    deleteButton.classList.add("delete-conversation");
    deleteButton.style.cursor = "pointer";
    deleteButton.style.marginLeft = "5px";
    deleteButton.title = "Delete Conversation";
    deleteButton.dataset.conversationId = conversationDiv.dataset.conversationId;
    deleteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        if (confirm("Are you sure you want to delete this conversation?")) {
            deleteConversation(conversationDiv.dataset.conversationId);
        }
    });
    buttonsContainer.appendChild(deleteButton);

    contentContainer.appendChild(buttonsContainer);
}

function renameConversation(conversationId, newName, conversationDiv) {
    fetch("/rename_conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, new_name: newName }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.message === "Conversation renamed") {
            // Update the sidebar display
            const contentContainer = conversationDiv.querySelector(':scope > div');
            contentContainer.innerHTML = '';

            const textDiv = document.createElement("div");
            textDiv.textContent = newName;
            textDiv.style.flexGrow = "1";
            textDiv.style.marginRight = "10px";
            textDiv.style.overflow = "hidden";
            textDiv.style.textOverflow = "ellipsis";
            textDiv.style.whiteSpace = "nowrap";
            contentContainer.appendChild(textDiv);

            const buttonsContainer = document.createElement("div");
            buttonsContainer.style.display = "flex";
            buttonsContainer.style.flexShrink = "0";

            const editButton = document.createElement("span");
            editButton.textContent = "✏️";
            editButton.classList.add("edit-conversation-button");
            editButton.style.cursor = "pointer";
            editButton.style.marginLeft = "5px";
            editButton.title = "Edit Subject";
            editButton.dataset.conversationId = conversationId;
            editButton.addEventListener("click", (event) => {
                event.stopPropagation();
                startEditSubject(conversationDiv, conversationId, newName);
            });
            buttonsContainer.appendChild(editButton);

            const deleteButton = document.createElement("span");
            deleteButton.textContent = "✖";
            deleteButton.classList.add("delete-conversation");
            deleteButton.style.cursor = "pointer";
            deleteButton.style.marginLeft = "5px";
            deleteButton.title = "Delete Conversation";
            deleteButton.dataset.conversationId = conversationId;
            deleteButton.addEventListener("click", (event) => {
                event.stopPropagation();
                if (confirm("Are you sure you want to delete this conversation?")) {
                    deleteConversation(conversationId);
                }
            });
            buttonsContainer.appendChild(deleteButton);

            contentContainer.appendChild(buttonsContainer);

            // Optionally update the currentSubject variable if the edited conversation is currently loaded
            if (currentConversationId === conversationId) {
                currentSubject = newName;
                const subjectDisplay = document.getElementById("conversation-subject");
                if (subjectDisplay) {
                    subjectDisplay.textContent = "Subject: " + currentSubject;
                }
            }

        } else {
            alert(data.error || "Failed to rename conversation.");
        }
    })
    .catch(error => {
        console.error("Error renaming conversation:", error);
        alert("Error renaming conversation.");
        revertSubjectEdit(conversationDiv, conversationDiv.querySelector(':scope > div > input').value);
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
      .then((messages) => {
        const chatBox = document.getElementById("chat-box");
        if (chatBox) {
          chatBox.innerHTML = ""; 
  
          messages.forEach((msg) => {
            if (msg.user) {
              displayMessage("user", msg.user);
            }
            if (msg.bot) {
              displayMessage("bot", msg.bot);
            }
          });
          chatBox.scrollTop = chatBox.scrollHeight;

          currentConversationId = conversationId;
  
          fetch("/conversations") 
            .then((response) => response.json())
            .then((conversations) => {
              const currentConv = conversations.find(
                (conv) => conv.conversation_id === conversationId
              );
              if (currentConv && currentConv.subject) {
                currentSubject = currentConv.subject;
                const subjectDisplay = document.getElementById(
                  "conversation-subject"
                );
                if (subjectDisplay) {
                  subjectDisplay.textContent = "Subject: " + currentSubject;
                }
              } else if (currentConv && currentConv.conversation_name) {
                currentSubject = currentConv.conversation_name;
                const subjectDisplay = document.getElementById(
                  "conversation-subject"
                );
                if (subjectDisplay) {
                  subjectDisplay.textContent = "Subject: " + currentSubject;
                } else {
                  currentSubject = `Chat ${conversationId.substring(0, 8)}...`;
                  const subjectDisplay = document.getElementById(
                    "conversation-subject"
                  );
                  if (subjectDisplay) {
                    subjectDisplay.textContent = "Subject: " + currentSubject;
                  }
                }
              } else {
                currentSubject = `Chat ${conversationId.substring(0, 8)}...`;
                const subjectDisplay = document.getElementById(
                  "conversation-subject"
                );
                if (subjectDisplay) {
                  subjectDisplay.textContent = "Subject: " + currentSubject;
                }
              }
            })
            .catch((error) =>
              console.error("Error fetching conversations after load:", error)
            );
        }
        isNewChat = false; 
      })
      .catch((error) => console.error("Error loading conversation:", error));
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
            alert(data.error || "Login failed."); 
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
  } else if (storedConvId) {
    isNewChat = false;
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
