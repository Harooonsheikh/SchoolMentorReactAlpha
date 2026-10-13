// src/erp/pages/MentorAI/services/mentorAiApi.js

import axios from "axios";

export const MENTOR_AI_BASE = process.env.REACT_APP_MENTOR_AI_URL || "https://ai.schoolmentor.ai";

/* Server kabhi kabhi http://IP:8000/media/... bhejta hai. Usay https domain par badal do. */
export const secureMentorUrl = (u) =>
  u ? String(u).replace(
    /^http:\/\/(50\.190\.164\.42|ai\.schoolmentor\.ai)(:8000)?/i,
    MENTOR_AI_BASE
  ) : u;

const mentorAiApi = axios.create({
    baseURL: MENTOR_AI_BASE,
});
mentorAiApi.interceptors.request.use((config) => {

    const token = localStorage.getItem(
        "mentor_ai_access"
    );

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;

});


export default mentorAiApi;