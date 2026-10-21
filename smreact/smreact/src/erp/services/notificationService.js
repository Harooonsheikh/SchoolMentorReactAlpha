import axios from "axios";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  "https://alphaapi.schoolmentor.ai";

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: false,
});

/* Login stores these in sessionStorage as "UserID" / "branchID"
   (see src/index.js + src/Pages/auth/LoginScreen.jsx). Send them on
   every request as the UserId / BranchID headers the API expects. */
api.interceptors.request.use((config) => {
  const u = sessionStorage.getItem("UserID");
  const b = sessionStorage.getItem("branchID");
  if (u) config.headers["UserId"]   = u;
  if (b) config.headers["BranchID"] = b;
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
