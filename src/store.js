export const CLIENT_ID = crypto.randomUUID();

export const getName = () => localStorage.getItem("wp:name") || "";
export const setName = (n) => localStorage.setItem("wp:name", n.trim());

export const getRecent = () => {
    try {
        return JSON.parse(localStorage.getItem("wp:recent") || "[]");
    } catch {
        return [];
    }
};

export const pushRecent = (room) => {
    const list = getRecent().filter((r) => r.code !== room.code);
    list.unshift({ code: room.code, name: room.name });
    localStorage.setItem("wp:recent", JSON.stringify(list.slice(0, 8)));
};

export const removeRecent = (code) => {
    const list = getRecent().filter((r) => r.code !== code);
    localStorage.setItem("wp:recent", JSON.stringify(list));
};

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const makeCode = () =>
    Array.from(
        crypto.getRandomValues(new Uint8Array(6)),
        (b) => ALPHABET[b % ALPHABET.length],
    ).join("");

export const formatSize = (bytes) => {
    if (!bytes) return "";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
    }
    return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
};
