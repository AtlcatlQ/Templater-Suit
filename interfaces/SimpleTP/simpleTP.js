/**
 * @description Templater Simplificado.
 * @param {Object} tp - Requiere importar el objeto de Templater, `tp
 * @returns {Object} Objeto de Utilidades para Templater.
 */

// Helpers de momentjs, no se exponen directamente.
const date = (from = "") => from ? moment(from, ["YYYY-[Q]Q", "GGGG-[W]WW", "YYYY-MM-DD", "YYYY-MM-DD[T]HH:mm"], false) : moment();
const time = (from = "") => from ? moment(from, "HH:mm", false) : moment();

module.exports = function (tp) {
    const obAPI = tp.user.obAPI();
    const { fail, attempt } = obAPI;
    const simpleTP = {
        // TEMPLATER

        // Config
        "active": tp.config.active_file,
        "target": tp.config.target_file,
        "mode": tp.config.run_mode,
        "template": tp.config.template_file,

        // Date (todos entregan un string, no un objeto momentjs)

        // offset es para operar sobre fechas con un OBJETO (más flexible que now).
        "offset": ({ from = "", duration, fromFormat, deliver = "YYYY-MM-DD" }) => tp.date.now(deliver, duration, from, fromFormat),
        // Se recomienda utilizar estas funciones para trabajar con fechas.
        // offset es solo para realizar operaciones sobre fechas.
        "quarter": (from = "") => date(from).format("YYYY-[Q]Q"),
        "week": (from = "") => date(from).format("GGGG-[W]WW"),
        "date": (from = "") => date(from).format("YYYY-MM-DD"),
        "yesterday": (from = "") => date(from).add(-1, "day").format("YYYY-MM-DD"),
        "tomorrow": (from = "") => date(from).add(1, "day").format("YYYY-MM-DD"),
        "datetime": (from = "") => date(from).format("YYYY-MM-DD[T]HH:mm"),
        "time": (from = "") => time(from).format("HH:mm"),

        // Files
        // getters
        "exists": async (path = "") => await tp.file.exists(path),
        "find": tp.file.find_tfile,
        "content": tp.file.content,

        // No se exponen los siguientes métodos, dado que los nombres de variable son demasiado comunes:
        // tp.file.path(), tp.file.folder(), tp.file.title, tp.file.tags

        // constructors
        // Es preferible no hacer la creación de archivos desde un script, sino desde el propio Obsidian.

        // operations
        // tp.file.rename() es menos robusto que ObAPI.rename()

        // content
        "inject": tp.file.cursor_append,
        "resolve": async (include_link = "") => await tp.file.include(include_link),
        "selected": tp.file.selection,

        // cursor
        "cursor": tp.file.cursor,

        // System
        "clip": async () => await tp.system.clipboard(),
        "fail": fail,
        "attempt": attempt,
        "prompt": async ({
            label = "Entrada de texto",
            initial = "",
            abortOnCancel = true,
            multiline = false,
            message,
            messageOnFail,
            fallback,
            fallbackMessage,
            error,
        } = {}) => await attempt({
            fn: () => tp.system.prompt(label, initial, abortOnCancel, multiline),
            message: message ?? `Entrada cancelada: ${label}`,
            messageOnFail,
            fallback,
            fallbackMessage,
            error,
        }),
        "suggester": async ({
            options = [],
            values = [],
            abortOnCancel = true,
            placeholder = "Select option...",
            limit = 10,
            initial,
            message,
            messageOnFail,
            fallback,
            fallbackMessage,
            error,
        } = {}) => await attempt({
            fn: () => tp.system.suggester(options, values, abortOnCancel, placeholder, limit, initial),
            message: message ?? `Selección cancelada: ${placeholder}`,
            messageOnFail,
            fallback,
            fallbackMessage,
            error,
        }),
        "multi": async ({
            options = [],
            values = [],
            abortOnCancel = true,
            placeholder = "Select options...",
            limit = 10,
            initial,
            message,
            messageOnFail,
            fallback,
            fallbackMessage,
            error,
        } = {}) => await attempt({
            fn: () => tp.system.multi_suggester(options, values, abortOnCancel, placeholder, limit, initial),
            message: message ?? `Selección múltiple cancelada: ${placeholder}`,
            messageOnFail,
            fallback,
            fallbackMessage,
            error,
        }),
        "confirm": async ({
            placeholder = "¿Sí o No?",
            abortOnCancel = false,
            initial,
        } = {}) => await simpleTP.suggester({
            options: ["⭕ Sí", "❌ No"],
            values: [true, false],
            abortOnCancel,
            placeholder,
            limit: 2,
            initial,
        }),

        // OBSIDIAN

        // Storage
        "load": obAPI.load,
        "save": obAPI.save,
        // Getters (No se exponen directamente, ya que todo se realiza en el archivo target.)
        // Constructors (Los archivos se crean desde el propio Obsidian, no desde un script.)

        // Operations
        "copy": async (path = "") => await obAPI.copy({ source: simpleTP["target"].path, destination: path }),

        // rename
        "relocate": async (newPath = "") => await obAPI.relocate({ source: simpleTP["target"].path, newPath }),
        "move": async (folder = "") => await obAPI.move({ source: simpleTP["target"].path, folder }),
        "rename": async (title = "") => await obAPI.rename({ source: simpleTP["target"].path, title }),

        // delete
        "delete": async () => await obAPI.delete(simpleTP["target"].path),
        "trash": async () => await obAPI.trash(simpleTP["target"].path),

        // modify
        "rewrite": async (data = "") => await obAPI.rewrite({ path: simpleTP["target"].path, data }),
        "metadata": async (fn = (frontmatter) => { }) => await obAPI.metadata({ path: simpleTP["target"].path, fn }),
        "append": async (data = "") => await obAPI.append({ path: simpleTP["target"].path, data }),
        "process": async (fn = (data) => { }, options = {}) => await obAPI.process({ path: simpleTP["target"].path, fn, options }),

        // Librerías Personalizadas
        "Argo": tp.user.Argo(tp),
        "Vasher": async () => await tp.user.Vasher(tp),
    };
    return simpleTP;
};
