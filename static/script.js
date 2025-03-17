document.addEventListener('DOMContentLoaded', function() {
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatBox = document.getElementById('chat-box');

    chatForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const message = chatInput.value;
        if (!message) return;

        displayMessage('user', message); // Display user message immediately
        chatInput.value = ''; // Clear input

        fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: message })
        })
        .then(response => response.json())
        .then(data => {
            if (data.reply) {
                displayMessage('bot', data.reply);
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
        chatBox.scrollTop = chatBox.scrollHeight; // Scroll to bottom
    }
});