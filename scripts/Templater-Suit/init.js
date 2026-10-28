/**
 * @description Inicializa o reemplaza la configuración de Templater-Suit.
 * @param {Object} tp - Objeto de Templater.
 */
module.exports = async function (tp) {
    const config = tp.user["tS-config"](tp);
    const { confirm } = tp.user["tS-SimpleTP"](tp);

    if (config.exists()) {
        const confirmed = await confirm({
            placeholder: "Ya existe una configuración. ¿Deseas reemplazarla?",
        });
        if (confirmed !== true) { return; }
        await config.wizard({ force: true });
    } else {
        await config.wizard();
    }

    new Notice("Configuración de Templater-Suit guardada.", 5000);
};
