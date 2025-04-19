import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import io from 'socket.io-client';
import { showSuccessToast, showErrorToast, showWarningToast } from '../utils/toast';

// Get the API URL from environment variables or use the default
const API_URL = process.env.NODE_ENV === 'development'
  ? process.env.REACT_APP_LOCAL_API_URL || 'http://localhost:10000'
  : process.env.REACT_APP_API_URL || 'http://localhost:10000';

console.log('WebSocket connecting to:', API_URL);

const NotificationListener = () => {
  const { user } = useAuth() || { user: null };
  // Remove state to simplify component

  useEffect(() => {
    // Only connect if we have a user
    if (!user || !user.email) {
      console.log('No user logged in, skipping WebSocket connection');
      return;
    }

    // Create socket connection
    console.log(`Creating WebSocket connection to ${API_URL} for user ${user.email}`);
    const newSocket = io(API_URL, {
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      timeout: 10000 // 10 second connection timeout
    });

    // Log socket instance for debugging
    console.log('Socket instance created:', newSocket);

    // Set up event listeners
    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');

      // Subscribe to updates for this user
      newSocket.emit('subscribe', { email: user.email }, (response) => {
        console.log('Subscription response:', response);
        if (response && response.status === 'subscribed') {
          console.log(`Subscribed to updates for ${response.email}`);
        }
      });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });

    newSocket.on('connect_error', (error) => {
      console.log('WebSocket connection error:', error);
      // Don't show connection errors to the user to avoid spam
      // Just log them for debugging
    });

    newSocket.on('error', (error) => {
      console.log('WebSocket error:', error);
      // Don't show general socket errors to the user to avoid spam
    });

    // Only listen for deadline reminders
    newSocket.on('deadline_reminder', (data) => {
      console.log('Deadline reminder notification received:', data);
      if (data.email === user.email) {
        // Show notification for upcoming deadline
        showWarningToast(`Reminder: "${data.title}" is due ${data.dueText}`);
      }
    });

    // Listen for data updates to refresh the UI and show a notification
    newSocket.on('data_ready', (data) => {
      console.log('Data ready notification received:', data);
      if (data.email === user.email) {
        // Show a toast notification that data is ready
        showSuccessToast(`Your ${data.type || 'data'} has been updated!`);

        // Wait 2 seconds before triggering the initial refresh to allow database updates to complete
        console.log('Scheduling initial data refresh after 2 seconds');
        setTimeout(() => {
          console.log('Performing initial data refresh');
          window.dispatchEvent(new CustomEvent('refresh_data', { detail: { immediate: true } }));
        }, 2000);

        // Schedule another check after 10 seconds as a fallback
        setTimeout(() => {
          console.log('Performing follow-up data check after 10 seconds');
          window.dispatchEvent(new CustomEvent('refresh_data', { detail: { followUp: true } }));
        }, 10000);
      }
    });

    // Show error notifications to the user
    newSocket.on('data_error', (data) => {
      console.log('Data error notification received:', data);
      if (data.email === user.email) {
        // Show a toast notification for the error
        showErrorToast(`Error: ${data.error || 'An error occurred while updating your data'}`);
      }
    });

    // Clean up on unmount
    return () => {
      if (newSocket) {
        console.log('Closing WebSocket connection');
        newSocket.disconnect();
      }
    };
  }, [user]);

  // No visible UI - this is just a listener component
  return null;
};

export default NotificationListener;
