document.addEventListener('DOMContentLoaded', function() {
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatBox = document.getElementById('chat-box');
    let currentConversationId = null;

    function fetchConversations() {
        fetch('/conversations')
            .then(response => response.json())
            .then(conversations => {
                const conversationsList = document.getElementById('conversations-list');
                conversationsList.innerHTML = '';
                conversations.forEach(conversationId => {
                    const conversationButton = document.createElement('button');
                    conversationButton.textContent = `Conversation: ${conversationId.substring(0, 8)}`;
                    conversationButton.addEventListener('click', () => {
                        currentConversationId = conversationId;
                        chatBox.innerHTML = '';
                        loadConversation(conversationId);
                    });
                    conversationsList.appendChild(conversationButton);
                });
            });
    }

    function loadConversation(conversationId) {
        fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: '', conversation_id: conversationId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.reply) {
                // This is a bit of a hack, but it works to load the conversation.
                // It makes a call to the /chat endpoint with an empty message
                // This will return all the messages in the conversation,
                // and then display them in the chat box.
                loadConversation(conversationId);
            } else if (data.error) {
                displayMessage('error', 'Error: ' + data.error);
            } else {
                //this is the case where the data is the conversation.
                fetch('/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ message: 'load conversation', conversation_id: conversationId })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.reply) {
                        //Do nothing, this is a hack to load the conversation.
                        console.log("conversation loaded");
                    } else if (data.error) {
                        displayMessage('error', 'Error: ' + data.error);
                    } else {
                        // this is the case where the data is the conversation.
                        data.forEach(message => {
                            displayMessage(message.role, message.content);
                        });
                    }
                });
            }
        });
    }

    document.getElementById('new-chat-button').addEventListener('click', () => {
        currentConversationId = null;
        chatBox.innerHTML = '';
        fetchConversations();
    });

    fetchConversations();

    chatForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const message = chatInput.value;
        if (!message) return;

        displayMessage('user', message);
        chatInput.value = '';

        fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: message, conversation_id: currentConversationId })
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
        .catch(error => {
            console.error('Error:', error);
            displayMessage('error', 'An unexpected error occurred.');
        });
    });

    function displayMessage(sender, message) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        messageDiv.textContent = message;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
});