module.exports = async function (tp) {
    const config = await tp.user["tS-config"](tp).load();
    const internal = tp.user["tS-SimpleTP"](tp);

    return {
        ...internal,

        // Configurable date methods
        "date": (from = "", format = config.defaultDateFormat) => internal.date(from, format),

        // Configurable system methods
        "prompt": ({
            abortOnCancel = config.abortOnCancel,
            ...options
        } = {}) => internal.prompt({ ...options, abortOnCancel }),
        "suggester": ({
            abortOnCancel = config.abortOnCancel,
            placeholder = config.defaultSelectorPlaceholder,
            limit = config.defaultSelectorLimit,
            ...options
        } = {}) => internal.suggester({
            ...options,
            abortOnCancel,
            placeholder,
            limit,
        }),
        "multi": ({
            abortOnCancel = config.abortOnCancel,
            placeholder = config.defaultSelectorPlaceholder,
            limit = config.defaultSelectorLimit,
            ...options
        } = {}) => internal.multi({
            ...options,
            abortOnCancel,
            placeholder,
            limit,
        }),
        "pickFolder": ({
            abortOnCancel = config.abortOnCancel,
            limit = config.defaultSelectorLimit,
            ...options
        } = {}) => internal.pickFolder({
            ...options,
            abortOnCancel,
            limit,
        }),
        "pickFile": ({
            abortOnCancel = config.abortOnCancel,
            limit = config.defaultSelectorLimit,
            ...options
        } = {}) => internal.pickFile({
            ...options,
            abortOnCancel,
            limit,
        }),
        "pickNote": ({
            abortOnCancel = config.abortOnCancel,
            limit = config.defaultSelectorLimit,
            ...options
        } = {}) => internal.pickNote({
            ...options,
            abortOnCancel,
            limit,
        }),
        "pickFileBy": ({
            abortOnCancel = config.abortOnCancel,
            placeholder = config.defaultSelectorPlaceholder,
            limit = config.defaultSelectorLimit,
            ...options
        } = {}) => internal.pickFileBy({
            ...options,
            abortOnCancel,
            placeholder,
            limit,
        }),
        "confirm": ({
            abortOnCancel = config.abortOnCancel,
            ...options
        } = {}) => internal.confirm({ ...options, abortOnCancel }),
    };
};