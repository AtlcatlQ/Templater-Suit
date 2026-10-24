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

const resolvePath = ({ path = "", basePath = "" } = {}) => {
    const normalizeSeparators = (value = "") => String(value ?? "")
        .normalize("NFC")
        .replace(/\\/g, "/");
    const requestedPath = normalizeSeparators(path);
    const requestedBasePath = normalizeSeparators(basePath);
    const isRootPath = requestedPath.startsWith("/");
    const segments = (isRootPath
        ? requestedPath
        : `${requestedBasePath}/${requestedPath}`
    ).split("/");
    const resolvedSegments = [];

    for (const segment of segments) {
        if (!segment || segment === ".") { continue; }
        if (segment === "..") {
            if (!resolvedSegments.length) {
                throw new Error("La ruta intenta salir de la raíz de la vault.");
            }
            resolvedSegments.pop();
            continue;
        }
        resolvedSegments.push(segment);
    }

    return resolvedSegments.join("/");
};

const pathInfo = (path = "") => {
    const regex = /^(?:(?<folder>.*)[\\/])?(?<name>[^\\/]+?)(?:\.(?<extension>[^.\\/]+))?$/;
    if (!regex.test(path)) {
        fail(`La ruta de archivo "${path}" no es válida.`);
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

const resolve = ({ path = "", basePath = "" } = {}) => resolvePath({ path: requirePath(path.trim()), basePath });

const requireFile = ({ path = "", basePath = "" } = {}) => {
    const resolvedPath = resolve({ path, basePath });
    const fileObject = vault.getFileByPath(resolvedPath);
    if (!fileObject) {
        fail(`El archivo "${path}" no existe.`);
    }
    return fileObject;
};

const normalizeFolder = (folder = "") => {
    const normalized = normalizePath(folder);
    return (!normalized || normalized === ".") ? "" : normalized;
};

const validateCollisionOptions = ({ overwrite = false, increment = false } = {}) => {
    if (overwrite && increment) {
        fail(`Las opciones "overwrite" e "increment" son mutuamente excluyentes.`);
    }
};

const incrementedPath = (path = "") => {
    const { folder, name, extension } = pathInfo(path);
    const normalizedExtension = extension || "md";
    const suffix = name.match(/ \((\d+)\)$/);
    const baseName = name.replace(/ \(\d+\)$/, "");
    const firstIndex = suffix ? Number(suffix[1]) + 1 : 1;
    for (let index = firstIndex; ; index++) {
        const candidate = parsePath({
            folder,
            name: `${baseName} (${index})`,
            extension: normalizedExtension,
        });
        if (!ObAPI.file({ path: candidate })) { return candidate; }
    }
};

// API de Obsidian Simplificada.
const ObAPI = {
    // STORAGE
    // (Necesitan ser wrappers para que no perder el `this` de app)
    "load": (key) => app.loadLocalStorage(key),
    "save": (key, data) => app.saveLocalStorage(key, data),

    // GETTERS (Archivos y Carpetas)
    "file": ({ path = "", basePath = "" } = {}) => vault.getFileByPath(resolve({ path, basePath })),
    "folder": ({ path = "", basePath = "" } = {}) => {
        const folder = normalizeFolder(resolvePath({ path, basePath }));
        return folder === "" ? vault.getRoot() : vault.getFolderByPath(folder);
    },
    "root": () => vault.getRoot(),
    "content": async ({ path = "", basePath = "" } = {}) => await vault.read(requireFile({ path, basePath })),

    // path helpers
    "normalizePath": normalizePath,
    "resolvePath": resolvePath,
    "pathInfo": pathInfo,
    "parsePath": parsePath,
    "requirePath": requirePath,
    "fail": fail,
    "attempt": attempt,

    // CONSTRUCTORS
    "create": async ({ path = "", data = "", options = {}, overwrite = false, increment = false, basePath = "" } = {}) => {
        validateCollisionOptions({ overwrite, increment });
        path = resolvePath({ path, basePath });
        const { folder, name, extension } = pathInfo(path);
        const newPath = parsePath({ folder, name, extension: extension || "md" });
        if (increment) {
            const incremented = incrementedPath(newPath);
            await ObAPI.createFolder({ path: folder });
            return await vault.create(incremented, data, options);
        }
        const existingFile = ObAPI.file({ path: newPath });
        if (existingFile) {
            if (!overwrite) { fail(`El archivo "${newPath}" ya existe.`); }
            await vault.modify(existingFile, data, options);
            return existingFile;
        }
        await ObAPI.createFolder({ path: folder });
        return await vault.create(newPath, data, options);
    },

    "createFolder": async ({ path = "", notice = false, basePath = "" } = {}) => {
        path = resolvePath({ path, basePath });
        if (!path) {
        return ObAPI.folder({ path: "" });
        }
        const existed = Boolean(ObAPI.folder({ path }));
        const folders = path.split("/").filter(Boolean);
        for (let i = 1; i <= folders.length; i++) {
            const folder = folders.slice(0, i).join("/");
            if (!ObAPI.folder({ path: folder })) {
                await vault.createFolder(folder);
            }
        }
        if (notice && !existed) {
            new Notice(`Carpeta creada: "${path}".`, 3000);
        }
        return ObAPI.folder({ path });
    },

    // OPERATIONS
    "copy": async ({ source = "", destination = "", overwrite = false, increment = false, basePath = "" } = {}) => {
        validateCollisionOptions({ overwrite, increment });
        const sourcePath = resolve({ path: source, basePath });
        const fileObject = requireFile({ path: sourcePath });
        if (!destination.trim()) {
            // El destino derivado ya está resuelto desde la raíz de la vault: no se recombina con basePath.
            destination = fileObject.path;
            increment = true;
        } else {
            destination = resolvePath({ path: destination, basePath });
        }
        const { folder, name, extension } = pathInfo(destination);
        const newPath = parsePath({ folder, name, extension: extension || "md" });
        destination = increment ? incrementedPath(newPath) : newPath;
        if (!increment && newPath === sourcePath) {
            new Notice(`La copia no se realizó: el destino es el mismo que el origen.`, 3000);
            return fileObject;
        }
        if (ObAPI.folder({ path: destination })) {
            fail(`El destino "${destination}" es una carpeta.`);
        }
        const existingFile = ObAPI.file({ path: destination });
        if (existingFile && overwrite) {
            await vault.modify(existingFile, await vault.read(fileObject));
            return existingFile;
        }
        if (existingFile) {
            fail(`El archivo "${destination}" ya existe.`);
        }
        await ObAPI.createFolder({ path: folder });
        await vault.copy(fileObject, destination);
        return requireFile({ path: destination });
    },

    // Rename
    "relocate": async ({ source = "", newPath = "", overwrite = false, increment = false, basePath = "" } = {}) => {
        validateCollisionOptions({ overwrite, increment });
        const sourcePath = resolve({ path: source, basePath });
        const fileObject = requireFile({ path: sourcePath });
        let { folder, name, extension } = pathInfo(resolvePath({ path: newPath, basePath }));
        if (!extension) { extension = fileObject.extension || "md"; }
        newPath = parsePath({ folder, name, extension });
        if (increment) { newPath = incrementedPath(newPath); }
        if (ObAPI.folder({ path: newPath })) {
            fail(`El destino "${newPath}" es una carpeta.`);
        }
        const existingFile = ObAPI.file({ path: newPath });
        if (existingFile && existingFile.path !== fileObject.path) {
            if (!overwrite) { fail(`El archivo "${newPath}" ya existe.`); }
            await vault.delete(existingFile);
        }
        if (newPath === fileObject.path) { return fileObject; }
        await ObAPI.createFolder({ path: folder });
        await fileManager.renameFile(fileObject, newPath);
        return requireFile({ path: newPath });
    },
    "move": async ({ source = "", folder = "", overwrite = false, increment = false, basePath = "" } = {}) => {
        // Sirve únicamente para cambiar la carpeta del archivo. No el nombre del archivo.
        validateCollisionOptions({ overwrite, increment });
        const fileObject = requireFile({ path: source, basePath });
        let { basename: name, extension } = fileObject;
        folder = normalizeFolder(folder);
        const newPath = parsePath({ folder, name, extension });
        return await ObAPI.relocate({ source, newPath, overwrite, increment, basePath });
    },
    "rename": async ({ source = "", title = "", overwrite = false, increment = false, basePath = "" } = {}) => {
        // Preferible cuando solo se desea cambiar el nombre del archivo.
        // Sin embargo, soporta también cambiar la carpeta del archivo.
        validateCollisionOptions({ overwrite, increment });
        const sourcePath = resolve({ path: source, basePath });
        const fileObject = requireFile({ path: sourcePath });
        let { basename: name, parent, extension } = fileObject;
        let folder = normalizeFolder(parent?.path ?? "");
        if (title !== "") {
            const titleInfo = pathInfo(requirePath(title));
            folder = titleInfo.folder || folder;
            name = titleInfo.name || name;
            extension = titleInfo.extension || extension;
        }
        const newPath = parsePath({ folder, name, extension });
        return await ObAPI.relocate({ source: sourcePath, newPath, overwrite, increment });
    },

    // Delete
    "trash": async ({ path = "", basePath = "" } = {}) => await fileManager.trashFile(requireFile({ path, basePath })),
    "delete": async ({ path = "", basePath = "" } = {}) => await vault.delete(requireFile({ path, basePath })),

    // Modify
    "rewrite": async ({ path = "", data = "", options = {}, basePath = "" } = {}) => await vault.modify(requireFile({ path, basePath }), data, options),
    "metadata": async ({ path = "", fn = (frontmatter) => { }, basePath = "" } = {}) => await fileManager.processFrontMatter(requireFile({ path, basePath }), fn),
    "append": async ({ path = "", data = "", options = {}, basePath = "" } = {}) => await vault.append(requireFile({ path, basePath }), data, options),
    "process": async ({ path = "", fn = (data) => { }, options = {}, basePath = "" } = {}) => await vault.process(requireFile({ path, basePath }), fn, options),
};

module.exports = function () {
    return ObAPI;
};
