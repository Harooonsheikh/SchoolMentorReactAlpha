import axios from "axios";
import { getBaseUrl } from "../../utils/apiConfig";

const api = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  config.baseURL = getBaseUrl();
  return config;
});

// Get logged-in user notifications
export const getUserNotifications = async (userId) => {
  try {
    const response = await api.get(
      `/api/AHM_Notification/user/${userId}`
    );

    return response.data;
  } catch (error) {
    console.error(
      "Get notifications error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Mark one notification as read.
// IMPORTANT: recipientId is the recipient row ID returned by the GET endpoint,
// not notificationID.
export const markNotificationRead = async (
  loginUserId,
  recipientId
) => {
  try {
    const response = await api.post(
      "/api/AHM_Notification/mark-read",
      {
        loginUserId: Number(loginUserId),
        recipientId: Number(recipientId),
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Mark notification read error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Mark all notifications as read
export const markAllNotificationsRead = async (loginUserId) => {
  try {
    const response = await api.post(
      "/api/AHM_Notification/mark-read",
      {
        loginUserId: Number(loginUserId),
        markAll: true,
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Mark all notifications error:",
      error.response?.data || error.message
    );
    throw error;
  }
};
