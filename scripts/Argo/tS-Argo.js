/**
 * @description Librería para gestión de JSON en Obsidian.
 * @param {Object} tp - (Importa ObAPI)
 * @returns {class} Argo, gestor de JSON en Obsidian.
 */

module.exports = function (tp) {
    const {
        content, rewrite, copy: copyFile, file, create: createFile,
        pathInfo, parsePath, requirePath, resolvePath,
    } = tp.user["tS-obAPI"]();

    const fail = (message) => {
        new Notice(message, 5000);
        throw new Error(message);
    };

    const requireJSONPath = (path = "") => {
        const { extension } = pathInfo(path);
        if (extension?.toLowerCase() !== "json") {
            fail(`La ruta va a un archivo que no es un JSON.`);
        }
        return requirePath(path);
    };

    const parse = (path, raw) => {
        try {
            return JSON.parse(raw);
        } catch {
            fail(`El archivo "${path}" no es un JSON válido.`);
        }
    };

    // TODO: boceto/esquema embebido (`sketch`) — clave reservada + validación frente a entradas; más adelante.

    const Argo = class {
        #data;
        #synced;

        constructor({ path = "", data = {}, replacer = null, spaces = 2, readyPath = false, basePath = "" } = {}) {
            this.path = readyPath ? path : resolvePath({ path: requireJSONPath(path), basePath });
            this.#data = structuredClone(data);
            this.replacer = replacer ?? null;
            this.spaces = spaces ?? 2;
            this.#synced = true;
        }

        #touch(fn) {
            fn(this.#data);
            this.#synced = false;
            return this;
        }

        #requireCollection() {
            if (typeof this.#data !== "object" || this.#data === null) {
                fail(`Argo: la raíz debe ser un objeto o un array.`);
            }
        }

        #requireObject() {
            this.#requireCollection();
            if (this.isArray) { fail(`Argo: se esperaba un objeto, no un array.`); }
        }

        #requireArray() {
            if (!this.isArray) { fail(`Argo: se esperaba un array.`); }
        }

        // --- Estáticos ---
        static async create({ path = "", data = {}, replacer = null, spaces = 2, basePath = "" } = {}) {
            const db = new Argo({ path, data, replacer, spaces, basePath });
            if (file({ path: db.path })) { fail(`El archivo "${db.path}" ya existe.`); }
            await createFile({
                path: db.path,
                data: JSON.stringify(db.#data, db.replacer, db.spaces),
            });
            return db;
        }

        static async read({ path = "", ensure = false, data = {}, replacer = null, spaces = 2, basePath = "" } = {}) {
            path = resolvePath({ path: requireJSONPath(path), basePath });
            if (file({ path })) {
                return new Argo({
                    path,
                    data: parse(path, await content({ path })),
                    replacer,
                    spaces,
                    readyPath: true,
                });
            }
            if (ensure) { return Argo.create({ path, data, replacer, spaces }); }
            fail(`El archivo "${path}" no existe.`);
        }

        static exists({ path = "", basePath = "" } = {}) {
            return Boolean(file({ path: resolvePath({ path: requireJSONPath(path), basePath }) }));
        }

        static async copy({ source = "", destination = "", strict = false, basePath = "" } = {}) {
            const fromPath = async (path) => {
                path = requireJSONPath(path);
                path = resolvePath({ path, basePath });
                if (!file({ path })) { fail(`El archivo "${path}" no existe.`); }
                destination = destination.trim()
                    ? resolvePath({ path: destination, basePath })
                    : destination;
                const copied = await copyFile({ source: path, destination });
                return Argo.read({ path: copied.path });
            };

            const fromInstance = async (db) => {
                if (strict) {
                    if (!(await db.checkSync())) {
                        fail(`La base "${db.path}" no está sincronizada con el disco.`);
                    }
                    destination = destination.trim()
                        ? resolvePath({ path: destination, basePath })
                        : destination;
                    const copied = await copyFile({ source: db.path, destination });
                    return new Argo({
                        path: copied.path,
                        data: db.clone(),
                        replacer: db.replacer,
                        spaces: db.spaces,
                        readyPath: true,
                    });
                }

                let dest = destination.trim();
                if (dest) {
                    dest = resolvePath({ path: requireJSONPath(dest), basePath });
                } else {
                    const { folder, name, extension = "json" } = pathInfo(db.path);
                    for (let n = 1; ; n++) {
                        dest = parsePath({ folder, name: `${name}${n}`, extension });
                        if (!file({ path: dest })) { break; }
                    }
                }

                return Argo.create({
                    path: dest,
                    data: db.clone(),
                    replacer: db.replacer,
                    spaces: db.spaces,
                });
            };

            switch (typeof source) {
                case "string":
                    return fromPath(source);
                case "object":
                    if (source instanceof Argo) { return fromInstance(source); }
                // fallthrough
                default:
                    fail(`Argo.copy: el origen debe ser una ruta o una instancia de Argo.`);
            }
        }

        // --- Getters ---
        get isArray() { return Array.isArray(this.#data); }

        get size() {
            this.#requireCollection();
            if (this.isArray) { return this.#data.length; }
            return Object.keys(this.#data).length;
        }

        get keys() {
            this.#requireObject();
            return Object.keys(this.#data);
        }

        // --- Contenido ---
        clone() { return structuredClone(this.#data); }

        replace(data) {
            if (typeof data !== "object" || data === null) {
                fail(`Argo.replace: solo se aceptan objetos o arrays.`);
            }
            this.#data = structuredClone(data);
            this.#synced = false;
            return this;
        }

        async checkSync() {
            if (!file({ path: this.path })) {
                this.#synced = false;
                return this.#synced;
            }
            try {
                const disk = JSON.parse(await content({ path: this.path }));
                this.#synced = JSON.stringify(disk, this.replacer) === JSON.stringify(this.#data, this.replacer);
            } catch {
                this.#synced = false;
            }
            return this.#synced;
        }

        has(key) {
            this.#requireCollection();
            if (this.isArray) {
                return Number.isInteger(key) && key >= 0 && key < this.#data.length;
            }
            return Object.hasOwn(this.#data, key);
        }

        get(key) {
            this.#requireCollection();
            if (!this.has(key)) { return undefined; }
            return structuredClone(this.#data[key]);
        }

        // objeto: alta (error si key existe); array: alias de push
        add(key, value) {
            this.#requireCollection();
            if (this.isArray) {
                return value === undefined ? this.push(key) : this.push(key, value);
            }
            if (value === undefined) { fail(`Argo.add: se requiere un value.`); }
            if (typeof key === "number") { fail(`Argo.add: en un objeto la clave no puede ser un número.`); }
            if (Object.hasOwn(this.#data, key)) { fail(`Argo.add: la clave "${key}" ya existe.`); }
            return this.#touch((data) => { data[key] = structuredClone(value); });
        }

        // objeto: upsert (key no numérica); array: índice en 0..size
        set(key, value) {
            this.#requireCollection();
            if (this.isArray) {
                if (!Number.isInteger(key) || key < 0 || key > this.#data.length) {
                    fail(`Argo.set: el índice debe ser un entero entre 0 y ${this.#data.length - 1}.`);
                }
                return this.#touch((data) => { data[key] = structuredClone(value); });
            }
            if (typeof key === "number") { fail(`Argo.set: en un objeto la clave no puede ser un número.`); }
            return this.#touch((data) => { data[key] = structuredClone(value); });
        }

        delete(key) {
            this.#requireCollection();
            const label = this.isArray ? `índice ${key}` : `clave "${key}"`;
            if (!this.has(key)) {
                new Notice(`Argo.delete: ${label} (sin cambios)`, 5000);
                return this;
            }
            this.#touch((data) => {
                if (this.isArray) { data.splice(key, 1); }
                else { delete data[key]; }
            });
            new Notice(`Argo.delete: eliminado ${label}`, 5000);
            return this;
        }

        push(...items) {
            this.#requireArray();
            return this.#touch((data) => {
                for (const item of items) { data.push(structuredClone(item)); }
            });
        }

        pop() {
            this.#requireArray();
            if (this.#data.length === 0) { fail(`Argo.pop: el array está vacío.`); }
            const item = this.#data.pop();
            this.#synced = false;
            return structuredClone(item);
        }

        shift() {
            this.#requireArray();
            if (this.#data.length === 0) { fail(`Argo.shift: el array está vacío.`); }
            const item = this.#data.shift();
            this.#synced = false;
            return structuredClone(item);
        }

        unshift(...items) {
            this.#requireArray();
            return this.#touch((data) => {
                data.unshift(...items.map((item) => structuredClone(item)));
            });
        }

        // --- Consulta / transformación ---
        sort(compareFn) {
            this.#requireCollection();
            return this.#touch((data) => {
                if (Array.isArray(data)) {
                    data.sort(compareFn);
                    return;
                }

                const keys = Object.keys(data).sort(compareFn);
                const ordered = keys.map((key) => [key, data[key]]);

                for (const key of Object.keys(data)) {
                    delete data[key];
                }
                for (const [key, value] of ordered) {
                    data[key] = value;
                }
            });
        }

        filter(fn) {
            this.#requireCollection();
            if (typeof fn !== "function") { fail(`Argo.filter: se requiere una función.`); }
            if (this.isArray) {
                return this.#data
                    .filter((item, index) => fn(structuredClone(item), index))
                    .map((item) => structuredClone(item));
            }
            const filtered = {};
            for (const [key, value] of Object.entries(this.#data)) {
                if (fn(structuredClone(value), key)) {
                    filtered[key] = structuredClone(value);
                }
            }
            return filtered;
        }

        map(fn) {
            this.#requireCollection();
            if (typeof fn !== "function") { fail(`Argo.map: se requiere una función.`); }
            if (this.isArray) {
                return this.#data.map((item, index) => fn(structuredClone(item), index));
            }
            const mapped = {};
            for (const [key, value] of Object.entries(this.#data)) {
                mapped[key] = fn(structuredClone(value), key);
            }
            return mapped;
        }

        find(fn) {
            this.#requireArray();
            if (typeof fn !== "function") { fail(`Argo.find: se requiere una función.`); }
            const item = this.#data.find((el, index) => fn(structuredClone(el), index));
            return item === undefined ? undefined : structuredClone(item);
        }

        join(separator = ",") {
            this.#requireArray();
            return this.#data.join(separator);
        }

        // --- Archivo ---
        async reload() {
            if (await this.checkSync()) { return this; }
            this.#data = parse(this.path, await content({ path: this.path }));
            this.#synced = true;
            return this;
        }

        async write(force = false) {
            if (!force && await this.checkSync()) { return this; }
            const payload = JSON.stringify(this.#data, this.replacer, this.spaces);
            if (file({ path: this.path })) {
                await rewrite({ path: this.path, data: payload });
            } else {
                await createFile({ path: this.path, data: payload });
            }
            this.#synced = true;
            return this;
        }

        async copy({ destination = "", strict = false, basePath = "" } = {}) {
            return Argo.copy({ source: this, destination, strict, basePath });
        }
    };

    return Argo;
};
