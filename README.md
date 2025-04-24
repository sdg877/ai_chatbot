Chatbot Web App - completed March 2025


Description
For this project, I built a chatbot web application using Flask, MongoDB, and OpenAI's API. The app allows users to interact with an AI-powered chatbot and stores previous conversations for logged-in users.

Deployment Links
Github Link
Deployed Link

Timeframe
This project took me approximately 20 hours to complete.
Technologies Used
Flask 
MongoDB
OpenAI API (gpt-3.5-turbo) 
Python Anywhere (deployment) 
HTML, CSS, JavaScript 
Flask-Login 
dotenv 
pymongo 
uuid 
werkzeug.security

Code Process
Environment Setup: Configured environment variables using `dotenv`, set up Flask, and established a connection to MongoDB. 
User Authentication: Implemented user registration and login functionality using Flask-Login and password hashing with `werkzeug.security`. 
Chat Interface: Created a web interface using HTML, CSS, and JavaScript for user interaction with the chatbot. 
OpenAI API Integration: Integrated the OpenAI API to generate chatbot responses based on user input. 
Conversation Management: Developed functionality to store and retrieve conversation history in MongoDB, including unique conversation IDs and user associations. 
Conversation Features: Added features such as renaming conversations, deleting conversations, and loading previous conversations. 
Search Functionality: Implemented a search feature to find specific messages within conversations. 
Deployment: Deployed the application on Python Anywhere. 
Front End Enhancement: Added a menu toggle for mobile view, and implemented a welcome message on new chats. 



Challenges
Only displaying the welcome message before the user has started the chat: Initially, the welcome message was appearing even after the user had begun a conversation, causing confusion. This required careful state management in the JavaScript code to ensure the message was only shown when the conversation was truly new and the chatbox was empty. 
Subject generation: Generating relevant and concise subjects from the user's first message proved challenging. The OpenAI API had to be prompted specifically for subject generation, and the response had to be parsed to extract the subject cleanly. This process needed to be robust enough to handle various user inputs and API responses. 
Stopping a new chat from generating when the user types a second message: Initially, every message sent by the user triggered the generation of a new subject, even within the same conversation. I had to implement logic to ensure subject generation only occurred for the very first user message in a new chat, and not for subsequent messages within that conversation.

Wins 
Successfully integrated Flask, MongoDB, and OpenAI API to create a functional chatbot application. 
Implemented user authentication and conversation management features. 
Deployed the application on Python Anywhere, making it accessible online. 
Developed a user-friendly interface with search and conversation history management. Successfully implemented conversation renaming and deletion. 
Implemented a welcome message, and improved mobile view. 
Successfully resolved the challenges related to the welcome message display and new chat subject handling. 


Key learnings 
Deepened understanding of Flask, MongoDB, and OpenAI API integration.
Learned about user authentication and session management using Flask-Login. 
Improved skills in asynchronous JavaScript programming. 
Gained experience in deploying web applications on Python Anywhere. 
Learned how to handle edge cases in API calls and database operations. 


Bugs
Occasional issues with MongoDB connection stability on Python Anywhere. 
Minor UI inconsistencies across different browsers. 
Edge cases where conversation subject generation could fail. 
Search functionality may not always return the most relevant results. 

Future improvements
Implement more advanced AI models for better chatbot responses.
Enhance the UI/UX with more interactive elements and styling. 
Add more robust error handling and logging. 
Implement real-time updates using WebSockets. 
Add user profile management features. 
Improve search result relevancy. 
Add more robust input sanitisation. 
Add unit and integration tests. 
Add image and file upload capabilities.


Screenshots
![Desktop No Message](https://github.com/user-attachments/assets/4e049c19-0654-465c-8c00-291d3454955b)

Guest User 

![Chat Not Logged In](https://github.com/user-attachments/assets/8f78b3af-8eae-4a1a-b9af-63c53809a548)

Guest User - Chat started





