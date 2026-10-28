class Util {
    static #agentHas(keyword) {
        return navigator
            .userAgent
            .toLowerCase()
            .search(keyword.toLowerCase()) > -1;
    }

    static isIE() {
        return !!document.documentMode;
    }

    static isSafari() {
        return (!!window.ApplePaySetupFeature || !!window.safari) &&
            Util.#agentHas("Safari") &&
            !Util.#agentHas("Chrome") &&
            !Util.#agentHas("CriOS");
    }

    static isMobileSafari() {
        const ua = navigator.userAgent;
        const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
        const webkit = !!ua.match(/WebKit/i);

        return iOS && webkit && !ua.match(/CriOS/i);
    }

    static isChrome() {
        return Util.#agentHas("CriOS") ||
            Util.#agentHas("Chrome") ||
            !!window.chrome;
    }

    static isFirefox() {
        return Util.#agentHas("Firefox") ||
            Util.#agentHas("FxiOS") ||
            Util.#agentHas("Focus");
    }

    static isEdge() {
        return Util.#agentHas("Edg");
    }

    static isOpera() {
        return Util.#agentHas("OPR");
    }

    static isVivaldi() {
        return Util.#agentHas("Vivaldi");
    }
}
