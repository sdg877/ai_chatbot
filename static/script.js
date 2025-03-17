function init() {
    console.log("Initializing script...");

    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatBox = document.getElementById('chat-box');
    const newChatButton = document.getElementById('new-chat-button');
    const searchButton = document.getElementById('search-button');
    const searchInput = document.getElementById('search-input');
    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form');

    let currentConversationId = null;
    let currentConversationName = null;
    let currentSubject = null;

    function fetchConversations() {
        fetch('/conversations')
            .then(response => response.json())
            .then(conversations => {
                const conversationsList = document.getElementById('conversations-list-content');
                if (!conversationsList) return;
                conversationsList.innerHTML = '';
                conversations.forEach(conversation => {
                    const conversationButton = document.createElement('button');
                    conversationButton.textContent = conversation.subject || conversation.conversation_name || `Conversation: ${conversation.conversation_id.substring(0, 8)}`;
                    conversationButton.addEventListener('click', () => {
                        currentConversationId = conversation.conversation_id;
                        currentConversationName = conversation.conversation_name;
                        currentSubject = conversation.subject;
                        if (chatBox) chatBox.innerHTML = '';
                        loadConversation(conversation.conversation_id);
                    });
                    conversationsList.appendChild(conversationButton);
                });
            })
            .catch(error => console.error("Error fetching conversations:", error));
    }

    function loadConversation(conversationId) {
        fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversation_id: conversationId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                displayMessage('error', 'Error: ' + data.error);
            } else {
                data.forEach(message => {
                    if (message.user) {
                        displayMessage('user', message.user);
                    }
                    if (message.bot) {
                        displayMessage('bot', message.bot);
                    }
                });
            }
        })
        .catch(error => console.error("Error loading conversation:", error));
    }

    if (newChatButton) {
        newChatButton.addEventListener('click', () => {
            currentConversationId = null;
            currentConversationName = null;
            currentSubject = null;
            if (chatBox) chatBox.innerHTML = '';
            document.getElementById('subject-input').disabled = false; // Enable subject input for new chat
        });
    }

    if (chatForm && chatInput && chatBox) {
        chatForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const message = chatInput.value.trim();
            if (!message) return;

            displayMessage('user', message);
            chatInput.value = '';

            // Get subject from input field
            const subjectInput = document.getElementById('subject-input');
            if (subjectInput) {
                currentSubject = subjectInput.value.trim();
                subjectInput.disabled = true; // Disable subject input after first message
            }

            fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: message, 
                    conversation_id: currentConversationId, 
                    conversation_name: currentConversationName, 
                    subject: currentSubject 
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.reply) {
                    displayMessage('bot', data.reply);
                    currentConversationId = data.conversation_id;
                    fetchConversations();
                } else if (data.error) {
                    displayMessage('error', 'Error: ' + data.error);
                }
            })
            .catch(error => console.error("Error sending message:", error));
        });
    }

    function displayMessage(sender, message) {
        if (!chatBox) return;
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        messageDiv.textContent = message;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    if (searchButton && searchInput) {
        searchButton.addEventListener('click', () => {
            const searchTerm = searchInput.value.trim();
            if (!searchTerm) return;

            fetch('/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ search_term: searchTerm })
            })
            .then(response => response.json())
            .then(results => {
                let searchResultsDiv = document.getElementById('search-results');
                if (!searchResultsDiv) {
                    searchResultsDiv = document.createElement('div');
                    searchResultsDiv.id = "search-results";
                    document.body.appendChild(searchResultsDiv);
                }

                searchResultsDiv.innerHTML = results.length === 0 
                    ? '<p>No results found.</p>' 
                    : results.map(result => 
                        `<div>
                            <p><strong>User:</strong> ${result.user}</p>
                            <p><strong>Bot:</strong> ${result.bot}</p>
                            <p><strong>Subject:</strong> ${result.subject || 'N/A'}</p>
                            <p><strong>Conversation ID:</strong> ${result.conversation_id}</p>
                            <hr>
                        </div>`).join('');
            })
            .catch(error => console.error("Error searching:", error));
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const username = document.getElementById('register-username').value;
            const password = document.getElementById('register-password').value;

            fetch('/register', {
                method: 'POST',
                body: new URLSearchParams({ username, password })
            })
            .then(response => response.json())
            .then(data => {
                const authMessage = document.getElementById('auth-message');
                if (data.message) {
                    window.location.href = '/'; // Redirect after successful registration
                } else {
                    authMessage.textContent = data.error || 'Unknown response';
                }
            })
            .catch(error => console.error("Error during registration:", error));
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;

            fetch('/login', {
                method: 'POST',
                body: new URLSearchParams({ username, password })
            })
            .then(response => response.json())
            .then(data => {
                if (data.message) {
                    console.log('Login successful. Reloading...');
                    window.location.href = '/'; // Redirect to the main chat page
                } else {
                    const authMessage = document.getElementById('auth-message');
                    if (authMessage) authMessage.textContent = data.error || 'Login failed';
                }
            })
            .catch(error => console.error("Error during login:", error));
        });
    }

    fetchConversations();
}

function checkDOMReady() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}

checkDOMReady();