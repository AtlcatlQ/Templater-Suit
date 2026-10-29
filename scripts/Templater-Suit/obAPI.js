module.exports = async function (tp) {
    const config = await tp.user["tS-config"](tp).load();
    const internal = tp.user["tS-obAPI"]();

    return {
        ...internal,

        // Configurable folder notices
        "createFolder": ({ notice = config.noticeOnFolderCreation, ...operationArgs } = {}) => internal.createFolder({
            ...operationArgs,
            notice,
        }),
        "create": ({ notice = config.noticeOnFolderCreation, ...operationArgs } = {}) => internal.create({
            ...operationArgs,
            notice,
        }),
        "copy": ({ notice = config.noticeOnFolderCreation, ...operationArgs } = {}) => internal.copy({
            ...operationArgs,
            notice,
        }),
        "relocate": ({ notice = config.noticeOnFolderCreation, ...operationArgs } = {}) => internal.relocate({
            ...operationArgs,
            notice,
        }),
        "move": ({ notice = config.noticeOnFolderCreation, ...operationArgs } = {}) => internal.move({
            ...operationArgs,
            notice,
        }),
        "rename": ({ notice = config.noticeOnFolderCreation, ...operationArgs } = {}) => internal.rename({
            ...operationArgs,
            notice,
        }),
    };
};