module.exports = async function (tp) {
    const config = await tp.user["tS-config"](tp).load();
    const Argo = tp.user["tS-Argo"](tp);

    Argo.setNoticeOnFolderCreation(config.noticeOnFolderCreation ?? false);

    return Argo;
};