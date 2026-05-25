import { createClient } from '@supabase/supabase-js';

function arrayBufferToHex(buffer) {
    return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet(context) {
    try {
        const { request, env } = context;

        if (!env.ATTACHMENTS_BUCKET) {
            throw new Error("R2 bucket binding 'ATTACHMENTS_BUCKET' not found.");
        }

        const url = new URL(request.url);
        const filename = url.searchParams.get('filename');

        if (!filename) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Missing required parameter: filename is required.',
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
        }

        const object = await env.ATTACHMENTS_BUCKET.get(filename);

        if (!object) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'File not found.',
                }),
                { status: 404, headers: { 'Content-Type': 'application/json' } },
            );
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);

        return new Response(object.body, { headers });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return new Response(
            JSON.stringify({
                success: false,
                error: 'Failed to download file.',
                message: errorMessage,
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
}

export async function onRequestDelete(context) {
    try {
        const { request, env } = context;

        if (!env.ATTACHMENTS_BUCKET) {
            throw new Error("R2 bucket binding 'ATTACHMENTS_BUCKET' not found.");
        }

        const url = new URL(request.url);
        const filename = url.searchParams.get('filename');
        const fileId = url.searchParams.get('id');

        if (!filename || !fileId) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Missing required parameters: filename and id are required.',
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
        }

        await env.ATTACHMENTS_BUCKET.delete(filename);

        const supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
        const { error } = await supabaseClient.from('files').delete().eq('id', fileId);

        if (error) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Failed to delete file record from database.',
                    message: error.message,
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } },
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'File deleted successfully.',
            }),
            { headers: { 'Content-Type': 'application/json' } },
        );
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return new Response(
            JSON.stringify({
                success: false,
                error: 'Failed to delete file.',
                message: errorMessage,
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
}

export async function onRequestPost(context) {
    try {
        const { request, env } = context;

        if (!env.ATTACHMENTS_BUCKET) {
            throw new Error("R2 bucket binding 'ATTACHMENTS_BUCKET' not found.");
        }

        const formData = await request.formData();
        const file = formData.get('file');
        const condo_id = formData.get('condo_id');

        if (!file || !(file instanceof File)) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: "No file uploaded or the uploaded item wasn't a file.",
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
        }

        if (!condo_id) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Missing required parameter: condo_id is required.',
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
        }

        const timestamp = Date.now();
        const fileBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('MD5', fileBuffer);
        const hash = arrayBufferToHex(hashBuffer);
        const fileExtension = file.name.split('.').pop() || 'bin';
        const uniqueFilename = `${timestamp}-${hash}.${fileExtension}`;

        const uploadedObject = await env.ATTACHMENTS_BUCKET.put(uniqueFilename, fileBuffer, {
            httpMetadata: {
                contentType: file.type,
                contentDisposition: `inline; filename="${file.name}"`,
            },
            customMetadata: {
                originalFilename: file.name,
            },
        });

        if (uploadedObject.key !== uniqueFilename) {
            throw new Error(
                'R2 upload failed: the returned key does not match the generated filename.',
            );
        }

        const fileUrl = `https://attachments.weekfuse.com/${uniqueFilename}`;
        const supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

        const { error } = await supabaseClient.from('files').insert({
            condo_id,
            url: fileUrl,
            name: file.name,
            type: file.type,
            size: file.size,
        });

        if (error) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Failed to save file in database.',
                    message: error.message,
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } },
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                url: fileUrl,
                name: file.name,
                type: file.type,
                size: file.size,
            }),
            { headers: { 'Content-Type': 'application/json' } },
        );
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return new Response(
            JSON.stringify({
                success: false,
                error: 'Failed to upload file.',
                message: errorMessage,
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
}
