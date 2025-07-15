import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../../lib/supabase';

const fetchCurrentUser = async () => {
    const {
        data: { user },
    } = await supabaseClient.auth.getUser();

    return user;
};

export const useUser = () => {
    return useQuery({
        queryKey: ['currentUser'],
        queryFn: fetchCurrentUser,
        staleTime: 1000 * 60 * 60, // 60 minutes
        cacheTime: 1000 * 60 * 60, // Cache for 60 minutes
    });
};
// Functions for login, logout, and register
const loginUser = async ({ email, password }) => {
    let { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        throw new Error(error.message);
    }
    return data.user;
};

const signInWithOAuth = async ({ provider }) => {
    let redirectURL = `${import.meta.env.VITE_PUBLIC_URL}/auth`;

    let { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: redirectURL,
        },
    });

    if (error) {
        throw new Error(error.message);
    }
    return data.user;
};

const logoutUser = async () => {
    await supabaseClient.auth.signOut();
};

const registerUser = async ({ email, password, inviteToken }) => {
    // base URL
    let redirectURL = `${import.meta.env.VITE_PUBLIC_URL}/auth`;

    // If an invitation token exists, append it to the URL
    if (inviteToken) {
        redirectURL += `?invitation_token=${inviteToken}`;
    }

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: redirectURL,
        },
    });

    if (error) {
        console.log(error);
        throw new Error(error.message);
    }

    return data.user;
};

// Hooks for mutations
export const useLoginUser = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: loginUser,
        onSuccess: async (data) => {
            await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
            await queryClient.setQueryData('currentUser', data);
        },
    });
};

export const useSignInWithOAuth = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: signInWithOAuth,
        onSuccess: async (data) => {
            await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
            await queryClient.setQueryData('currentUser', data);
        },
    });
};

export const useLogout = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: logoutUser,
        onSuccess: async () => {
            await queryClient.invalidateQueries();
        },
    });
};

export const useRegisterUser = () => {
    return useMutation({
        mutationFn: registerUser,
        onSuccess: async () => {
            return true;
        },
    });
};
