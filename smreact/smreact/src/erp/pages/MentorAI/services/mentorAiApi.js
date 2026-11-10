// src/erp/pages/MentorAI/services/mentorAiApi.js

import axios from "axios";

export const MENTOR_AI_BASE = process.env.REACT_APP_MENTOR_AI_URL || "https://ai.schoolmentor.ai";

/* Server kabhi kabhi http://IP:8000/media/... bhejta hai. Usay https domain par badal do. */
export const secureMentorUrl = (u) =>
  u ? String(u).replace(
    /^http:\/\/(50\.190\.164\.42|ai\.schoolmentor\.ai)(:8000)?/i,
    MENTOR_AI_BASE
  ) : u;

// const mentorAiApi = axios.create({
//     baseURL: MENTOR_AI_BASE,
// });


const mentorAiApi = axios.create({
    baseURL: MENTOR_AI_BASE,
});

let tokenPromise = null;

export function fetchFreshMentorToken() {
    if (!tokenPromise) {
        const formData = new FormData();
        formData.append("branch", sessionStorage.getItem("branchID"));
        formData.append("user", sessionStorage.getItem("UserID"));
        formData.append("principal", sessionStorage.getItem("accountType") === "School Head");

        tokenPromise = axios
            .post(`${MENTOR_AI_BASE}/ai/api/auth/token/`, formData)
            .then(({ data }) => {
                localStorage.setItem("mentor_ai_access", data.access);
                localStorage.setItem("mentor_ai_refresh", data.refresh);
                localStorage.setItem("mentor_ai_user", JSON.stringify(data.user));
                return data.access;
            })
            .finally(() => { tokenPromise = null; });
    }
    return tokenPromise;
}

mentorAiApi.interceptors.response.use(
    (res) => res,
    async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && original && !original._retried) {
            original._retried = true;
            try {
                const token = await fetchFreshMentorToken();
                original.headers = original.headers || {};
                original.headers.Authorization = `Bearer ${token}`;
                return mentorAiApi(original);
            } catch (e) {
                return Promise.reject(error);
            }
        }
        return Promise.reject(error);
    }
);
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