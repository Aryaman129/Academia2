# Academia - SRM Student Portal

## Overview

Academia is a unified web application that provides SRM University students with easy access to their academic information. It automatically scrapes and displays attendance records, marks, and timetable data from the official SRM Academia portal in a more user-friendly interface.

This project aims to solve the common frustrations students face with the official portal by providing a faster, more intuitive experience while maintaining all the essential functionality.

## Features

- **Unified Dashboard**: View all your academic information in one place
- **Attendance Tracking**: Monitor your attendance percentages across all courses with visual indicators for classes at risk
- **Attendance Prediction**: Intelligent system that predicts future attendance based on your current status
- **Marks & Grades**: Access your internal and external marks with detailed breakdowns
- **Interactive Timetable**: View your class schedule in an easy-to-read format with color-coding for different class types
- **Persistent Login**: Stay logged in across sessions for quick access (using secure token-based authentication)
- **Mobile-Friendly Design**: Access your data on any device with a responsive interface
- **Offline Access**: View previously loaded data even without an internet connection
- **Real-time Updates**: Get notified when your attendance or marks change

## Live Demo

The application is hosted at: [https://acadiaa.vercel.app/](https://acadiaa.vercel.app/)

## Usage Notes

- **First-time Login**: Initial login may take 2-3 minutes as the system scrapes and processes your data (As I am using free services)
- **Subsequent Logins**: Once your data is cached, future logins will be much faster (typically under 10 seconds)
- **Data Refresh**: Use the refresh button to update your attendance and marks data
- **Browser Support**: Works best on Chrome, Firefox, and Edge browsers
- **Mobile Experience**: Fully optimized for mobile devices with touch-friendly controls

## How It Works

1. **Authentication**: Users log in with their SRM Academia credentials
2. **Data Extraction**: The system securely logs into the official portal and extracts the relevant data
3. **Data Processing**: Raw data is processed, analyzed, and structured for optimal presentation
4. **Storage**: Processed data is securely stored for quick access in future sessions
5. **Presentation**: The frontend displays the information in an intuitive, user-friendly interface
6. **Updates**: Users can manually refresh their data or wait for automatic updates

## Architecture

The project uses a distributed microservices architecture:

- **Frontend**: React-based UI hosted on Vercel
  - Responsive design using TailwindCSS
  - Client-side state management with React Context
  - Progressive Web App (PWA) capabilities for offline access

- **API Layer**: Handles authentication, data processing, and storage
  - Flask-based RESTful API
  - JWT authentication for secure access
  - WebSocket support for real-time updates

- **Scraper Service**: Extracts data from the official SRM portal
  - Headless browser automation with Selenium
  - Intelligent parsing with BeautifulSoup
  - Distributed scraping across multiple services for reliability

- **Database**: Stores user data securely for quick access
  - PostgreSQL database via Supabase
  - Efficient data modeling for quick queries
  - Encrypted storage of sensitive information

## Technologies

- **Frontend**:
  - React 18
  - TailwindCSS
  - React Router
  - Progressive Web App (PWA)

- **Backend**:
  - Flask
  - Python 3.9+
  - Socket.IO
  - JWT Authentication

- **Data Extraction**:
  - Selenium WebDriver
  - BeautifulSoup4
  - Chrome/Chromium (headless mode)

- **Database**:
  - Supabase (PostgreSQL)
  - Row-level security

- **Deployment**:
  - Vercel (Frontend)
  - Railway (Scraper Service)
  - Koyeb (API Service)

## Privacy & Security

- Your credentials are only used to access the official SRM portal
- Passwords are securely stored using industry-standard encryption
- All data transmission occurs over HTTPS
- Data is stored securely and associated only with your account
- No personal information is shared with third parties
- You can request deletion of your account and data at any time

## Future Enhancements

- **Deadline Reminders**: Get notifications for upcoming assignment deadlines
- **Grade Prediction**: Estimate your final grades based on current performance
- **Attendance Planning**: Calculate how many classes you can miss while maintaining minimum attendance
- **Dark Mode**: Toggle between light and dark themes
- **Multiple Language Support**: Interface in multiple languages including Tamil and Hindi

## Feedback & Contributions

We welcome feedback and contributions to improve Academia. If you encounter any issues or have suggestions, please reach out to the development team.