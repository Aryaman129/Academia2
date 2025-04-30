# Academia - SRM Student Portal

## Overview

Academia is a unified web application that provides SRM University students with easy access to their academic information. It automatically scrapes and displays attendance records, marks, and timetable data from the official SRM Academia portal in a more user-friendly interface.

## Features

- **Unified Dashboard**: View all your academic information in one place
- **Attendance Tracking**: Monitor your attendance percentages across all courses
- **Marks & Grades**: Access your internal and external marks
- **Interactive Timetable**: View your class schedule in an easy-to-read format
- **Persistent Login**: Stay logged in across sessions for quick access
- **Mobile-Friendly Design**: Access your data on any device

## Live Demo

The application is hosted at: [https://acadiaa.vercel.app/](https://acadiaa.vercel.app/)

## Usage Notes

- **First-time Login**: Initial login may take 2-3 minutes as the system scrapes and processes your data (As i am using free services)
- **Subsequent Logins**: Once your data is cached, future logins will be much faster (typically under 10 seconds)
- **Data Refresh**: Use the refresh button to update your attendance and marks data

## Architecture

The project uses a distributed architecture:

- **Frontend**: React-based UI hosted on Vercel
- **API Layer**: Handles authentication, data processing, and storage
- **Scraper Service**: Extracts data from the official SRM portal
- **Database**: Stores user data securely for quick access

## Technologies

- Frontend: React, TailwindCSS
- Backend: Flask, Python
- Data Extraction: Selenium, BeautifulSoup
- Database: Supabase (PostgreSQL)
- Deployment: Vercel, Railway, Koyeb

## Privacy & Security

- Your credentials are only used to access the official SRM portal
- Data is stored securely and associated only with your account
- No personal information is shared with third parties