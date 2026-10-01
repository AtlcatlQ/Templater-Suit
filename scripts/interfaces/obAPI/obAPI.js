/**
 * @description API de Obsidian Simplificada.
 */

const { vault, fileManager } = app;

const fail = (message, error) => {
    new Notice(message, 5000);
    throw error ?? new Error(message);
};

const attempt = async ({ fn, message, messageOnFail, fallback, fallbackMessage, error } = {}) => {
    const msg = messageOnFail ?? message ?? "La operación falló.";
    try {
        return await fn();
    } catch (err) {
        if (typeof fallback === "function") {
            try {
                return await fallback();
            } catch (fallbackErr) {
                if (fallbackMessage) { new Notice(fallbackMessage, 5000); }
                throw error ?? fallbackErr;
            }
        }
        new Notice(msg, 5000);
        throw error ?? err;
    }
};

/** Equivalente local de obsidian.normalizePath (rutas relativas a la vault). */
const normalizePath = (path = "") => {
    if (path == null) { return ""; }
    return String(path)
        .normalize("NFC")
        .replace(/\u00A0/g, " ")
        .replace(/[\\/]+/g, "/")
        .replace(/^\/+|\/+$/g, "");
};

const pathInfo = (path = "") => {
    const regex = /^(?:(?<folder>.*)[\\/])?(?<name>[^\\/]+?)(?:\.(?<extension>[^.\\/]+))?$/;
    if (!regex.test(path)) {
        fail(`La ruta "${path}" no es válida.`);
    }
    let groups = regex.exec(path)?.groups || {};
    if (!groups.folder) { groups.folder = ""; }
    return groups;
};

const parsePath = ({ folder = "", name, extension = "" } = {}) => {
    if (name === null || name === undefined || String(name).trim() === "") {
        fail(`El nombre del archivo no es válido.`);
    }
    const normalizedFolder = normalizePath(folder);
    let path = normalizedFolder ? `${normalizedFolder}/${name.trim()}` : name.trim();
    if (extension) { path += `.${extension}`.trim(); }
    return normalizePath(path);
};

const requirePath = (path = "") => parsePath(pathInfo(path));

const requireFile = (path = "") => {
    const fileObject = vault.getFileByPath(requirePath(path.trim()));
    if (!fileObject) {
        fail(`El archivo "${path}" no existe.`);
    }
    return fileObject;
};

const normalizeFolder = (folder = "") => {
    const normalized = normalizePath(folder);
    return (!normalized || normalized === ".") ? "" : normalized;
};

// API de Obsidian Simplificada.
const ObAPI = {
    // STORAGE
    // (Necesitan ser wrappers para que no perder el `this` de app)
    "load": (key) => app.loadLocalStorage(key),
    "save": (key, data) => app.saveLocalStorage(key, data),

    // GETTERS (Archivos y Carpetas)
    "file": (path = "") => vault.getFileByPath(requirePath(path.trim())),
    "folder": (path = "") => {
        const folder = normalizeFolder(path);
        return folder === "" ? vault.getRoot() : vault.getFolderByPath(folder);
    },
    "root": () => vault.getRoot(),
    "content": async (path = "") => await vault.read(requireFile(path)),

    // path helpers
    "normalizePath": normalizePath,
    "pathInfo": pathInfo,
    "parsePath": parsePath,
    "requirePath": requirePath,
    "fail": fail,
    "attempt": attempt,

    // CONSTRUCTORS
    "create": async ({ path = "", data = "", options = {} } = {}) => {
        const { folder, name, extension } = pathInfo(path);
        if (!ObAPI.folder(folder)) { await ObAPI.createFolder(folder); }
        const newPath = parsePath({ folder, name, extension: extension || "md" });
        return await vault.create(newPath, data, options);
    },

    "createFolder": async (path = "") => {
        path = normalizePath(path);
        if (!path) {
            new Notice(`Carpeta no proporcionada.`, 3000);
            return ObAPI.folder("");
        }
        const folders = path.split("/").filter(Boolean);
        for (let i = 1; i <= folders.length; i++) {
            const folder = folders.slice(0, i).join("/");
            if (!ObAPI.folder(folder)) {
                await vault.createFolder(folder);
            } else if (i === folders.length) {
                new Notice(`La carpeta "${path}" ya existe.`, 3000);
            }
        }
        return ObAPI.folder(path);
    },

    // OPERATIONS
    "copy": async ({ source = "", destination = "" } = {}) => {
        const fileObject = requireFile(source);
        if (!destination.trim()) {
            let { folder, name, extension } = pathInfo(fileObject.path);
            extension = extension || "md";
            for (let n = 1; ; n++) {
                destination = parsePath({ folder, name: `${name}${n}`, extension });
                if (!ObAPI.file(destination)) { break; }
            }
        } else if (requirePath(destination) === requirePath(source)) {
            new Notice(`El destino es el mismo que el origen.`, 3000);
            return fileObject;
        }
        const { folder, name, extension } = pathInfo(destination);
        if (!ObAPI.folder(folder)) { await ObAPI.createFolder(folder); }
        const newPath = parsePath({ folder, name, extension: extension || "md" });
        await vault.copy(fileObject, newPath);
        return requireFile(newPath);
    },

    // Rename
    "relocate": async ({ source = "", newPath = "" } = {}) => {
        const fileObject = requireFile(source);
        let { folder, name, extension } = pathInfo(requirePath(newPath));
        if (!ObAPI.folder(folder)) { await ObAPI.createFolder(folder); }
        if (!extension) { extension = fileObject.extension || "md"; }
        newPath = parsePath({ folder, name, extension });
        return await fileManager.renameFile(fileObject, newPath);
    },
    "move": async ({ source = "", folder = "" } = {}) => {
        // Sirve únicamente para cambiar la carpeta del archivo. No el nombre del archivo.
        const fileObject = requireFile(source);
        let { basename: name, extension } = fileObject;
        folder = normalizeFolder(folder);
        const newPath = parsePath({ folder, name, extension });
        return await ObAPI.relocate({ source, newPath });
    },
    "rename": async ({ source = "", title = "" } = {}) => {
        // Preferible cuando solo se desea cambiar el nombre del archivo.
        // Sin embargo, soporta también cambiar la carpeta del archivo.
        const fileObject = requireFile(source);
        let { basename: name, parent, extension } = fileObject;
        let folder = normalizeFolder(parent?.path ?? "");
        if (title !== "") {
            const titleInfo = pathInfo(requirePath(title));
            folder = titleInfo.folder || folder;
            name = titleInfo.name || name;
            extension = titleInfo.extension || extension;
        }
        const newPath = parsePath({ folder, name, extension });
        return await ObAPI.relocate({ source, newPath });
    },

    // Delete
    "trash": async (path) => await fileManager.trashFile(requireFile(path)),
    "delete": async (path) => await vault.delete(requireFile(path)),

    // Modify
    "rewrite": async ({ path = "", data = "", options = {} } = {}) => await vault.modify(requireFile(path), data, options),
    "metadata": async ({ path = "", fn = (frontmatter) => { } } = {}) => await fileManager.processFrontMatter(requireFile(path), fn),
    "append": async ({ path = "", data = "", options = {} } = {}) => await vault.append(requireFile(path), data, options),
    "process": async ({ path = "", fn = (data) => { }, options = {} } = {}) => await vault.process(requireFile(path), fn, options),
};

module.exports = function () {
    return ObAPI;
};
