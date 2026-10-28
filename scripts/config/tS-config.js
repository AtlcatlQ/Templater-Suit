/**
 * @description Servicio de configuración de Templater-Suit.
 * @param {Object} tp - Objeto de Templater.
 * @returns {Object} API de configuración.
 */
module.exports = function (tp) {
    const Argo = tp.user["tS-Argo"](tp);
    const { confirm, prompt } = tp.user["tS-SimpleTP"](tp);
    const path = `${tp.app.plugins.plugins["templater-obsidian"].settings.user_scripts_folder}/Templater-Suit/config.json`;
    const defaultConfig = {
        abortOnCancel: false,
        noticeOnFolderCreation: false,
        defaultSelectorLimit: 10,
        defaultSelectorPlaceholder: "Select option...",
        defaultDateFormat: "YYYY-MM-DD",
    };

    const validate = (value) => {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
            throw new Error("tS-config: la configuración debe ser un objeto JSON.");
        }

        const config = {};
        for (const [key, option] of Object.entries(value)) {
            switch (key) {
                case "abortOnCancel":
                case "noticeOnFolderCreation":
                    if (typeof option !== "boolean") {
                        throw new Error(`tS-config: "${key}" debe ser un booleano.`);
                    }
                    break;
                case "defaultSelectorLimit":
                    if (!Number.isInteger(option) || option <= 0) {
                        throw new Error(`tS-config: "${key}" debe ser un entero positivo.`);
                    }
                    break;
                case "defaultSelectorPlaceholder":
                case "defaultDateFormat":
                    if (typeof option !== "string") {
                        throw new Error(`tS-config: "${key}" debe ser una cadena.`);
                    }
                    break;
                default:
                    continue;
            }
            config[key] = option;
        }
        return config;
    };

    const ask = async (label, initial) => {
        const answer = await prompt({ label, initial });
        if (typeof answer !== "string") {
            throw new Error(`tS-config: se canceló o falló la pregunta "${label}".`);
        }
        return answer;
    };

    const askConfirm = async (placeholder, initial) => {
        const answer = await confirm({ placeholder, initial, abortOnCancel: true });
        if (typeof answer !== "boolean") {
            throw new Error(`tS-config: se canceló la confirmación "${placeholder}".`);
        }
        return answer;
    };

    const getPath = () => path;
    const exists = () => Argo.exists({ path });
    const defaults = () => ({ ...defaultConfig });

    const load = async () => {
        if (!exists()) { return {}; }
        return validate((await Argo.read({ path })).clone());
    };

    const wizard = async ({ force = false } = {}) => {
        if (exists() && force !== true) {
            throw new Error(`tS-config: "${path}" ya existe; se requiere force: true.`);
        }

        const initial = defaults();
        const config = validate({
            abortOnCancel: await askConfirm(
                "¿Abortar cuando se cancele un selector?",
                initial.abortOnCancel,
            ),
            noticeOnFolderCreation: await askConfirm(
                "¿Mostrar una Notice al crear carpetas?",
                initial.noticeOnFolderCreation,
            ),
            defaultSelectorLimit: Number(await ask(
                "Límite predeterminado de selectores",
                String(initial.defaultSelectorLimit),
            )),
            defaultSelectorPlaceholder: await ask(
                "Placeholder predeterminado de selectores",
                initial.defaultSelectorPlaceholder,
            ),
            defaultDateFormat: await ask(
                "Formato predeterminado de fecha",
                initial.defaultDateFormat,
            ),
        });

        if (exists()) {
            if (force !== true) {
                throw new Error(`tS-config: "${path}" ya existe; se requiere force: true.`);
            }
            await new Argo({ path, data: config }).write(true);
            return;
        }
        await Argo.create({ path, data: config });
    };

    return { getPath, exists, defaults, load, wizard };
};
