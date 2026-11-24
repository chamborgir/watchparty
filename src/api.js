const API = import.meta.env.VITE_API_URL ?? "";

export const typeOf = (file) => file.type || "video/mp4";

async function postJson(path, body) {
    const res = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        let detail = "";
        try {
            detail = (await res.json()).error || "";
        } catch {
            /* not JSON */
        }
        throw new Error(
            `Request failed (HTTP ${res.status}${detail ? ": " + detail : ""})`,
        );
    }
    return res.json();
}

export const signUpload = (roomId, file) =>
    postJson("/api/sign-upload", {
        roomId,
        filename: file.name,
        contentType: typeOf(file),
    });

// returns a temporary link the browser can play the private video from
export async function signView(key) {
    if (!key)
        throw new Error("This video has no stored file key. Upload it again.");
    const { url } = await postJson("/api/sign-view", { key });
    return url;
}

export function putWithProgress(url, file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", typeOf(file));
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress(e.loaded / e.total);
        };
        xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
                ? resolve()
                : reject(new Error(`Upload failed (${xhr.status})`));
        xhr.onerror = () =>
            reject(
                new Error(
                    "Network error during upload. Check the bucket CORS settings include this site's address.",
                ),
            );
        xhr.send(file);
    });
}

export async function removeObject(key) {
    if (!key) return;
    await postJson("/api/delete", { key });
}
