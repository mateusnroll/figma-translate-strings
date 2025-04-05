"use strict";
// npx ts-node testing_api.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var namespaceCache = {};
var pendingFetches = {};
function fetchNamespaceFromLokalise(locale, namespace) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = `https://localization-api.gympass.com/v1/translation/${namespace}?format=flat`;
        const headers = { "Accept-Language": locale };
        const response = yield fetch(url, { method: 'GET', headers: headers });
        if (!response.ok)
            throw new Error(response.statusText);
        const content = yield response.json();
        return content[Object.keys(content)[0]];
    });
}
function fetchNamespaceFromCache(locale, namespace) {
    if (namespaceCache[locale] == undefined)
        return undefined;
    return namespaceCache[locale][namespace];
}
function addNamespaceToCache(locale, namespace, content) {
    if (!namespaceCache[locale])
        namespaceCache[locale] = {};
    namespaceCache[locale][namespace] = content;
}
function fetchNamespace(locale, namespace) {
    return __awaiter(this, void 0, void 0, function* () {
        const cachedNamespace = fetchNamespaceFromCache(locale, namespace);
        // Returns it if it's already cached
        if (cachedNamespace != undefined)
            return cachedNamespace;
        // Checks if there's a fetch in progress and waits for it
        const cacheKey = `${locale}:${namespace}`;
        if (pendingFetches[cacheKey] != undefined) {
            let retries = 0;
            const maxRetries = 4;
            const retryDelay = 500;
            while (retries < maxRetries) {
                yield wait(retryDelay);
                const cachedData = fetchNamespaceFromCache(locale, namespace);
                if (cachedData != undefined)
                    return cachedData;
                retries++;
            }
        }
        pendingFetches[cacheKey] = true;
        const fetchedNamespace = yield fetchNamespaceFromLokalise(locale, namespace);
        addNamespaceToCache(locale, namespace, fetchedNamespace);
        return fetchedNamespace;
    });
}
function getKey(keyWithNamespace, locale) {
    return __awaiter(this, void 0, void 0, function* () {
        const namespace = keyWithNamespace.split(".")[0];
        const namespaceKeys = yield fetchNamespace(locale, namespace);
        return namespaceKeys[keyWithNamespace];
    });
}
function wait(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise(resolve => setTimeout(resolve, ms));
    });
}
Promise.all([
    getKey('clients_notifications.i2s.client.invite.title', 'pt-BR'),
    getKey('clients_notifications.i2s.apps.title', 'pt-BR'),
    getKey('clients_notifications.i2s.benefits.title', 'pt-BR'),
]).then(values => {
    console.log(namespaceCache);
    console.log(values);
});
