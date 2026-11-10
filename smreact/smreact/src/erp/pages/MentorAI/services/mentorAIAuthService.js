import mentorAiApi from "./mentorAiApi";


export const getMentorAIToken = async ({
    branch,
    user,
    principal
}) => {

    const formData = new FormData();

    formData.append("branch", branch);
    formData.append("user", user);
    formData.append("principal", principal);

    const response = await mentorAiApi.post(
        // "/ai/api/auth/token/",
        // formData

                "/ai/api/auth/token/",
        formData,
        { headers: { Authorization: undefined } }
    );

    return response.data;
};