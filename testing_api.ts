// npx ts-node testing_api.ts

// TODO: Use try/catch with the fetch and do proper error handling

interface lokaliseNamespace {
    [locale: string]: {
        [namespace: string]: {
            [key: string]: string
        }
    }
}

var namespaceCache:lokaliseNamespace = {}
var pendingFetches: { [key: string]: any } = {}

async function fetchNamespaceFromLokalise(locale: string, namespace: string): Promise<Object> {
    const url = `https://localization-api.gympass.com/v1/translation/${namespace}?format=flat`
    const headers = { "Accept-Language": locale } 
    const response = await fetch(url, { method: 'GET', headers: headers })

    if (!response.ok)
        throw new Error(response.statusText)

    const content = await response.json() as any
    return content[Object.keys(content)[0]]
}

function fetchNamespaceFromCache(locale: string, namespace: string): Object | undefined {
    if (namespaceCache[locale] == undefined)
        return undefined
    
    return namespaceCache[locale][namespace]
}

function addNamespaceToCache(locale: string, namespace: string, content: any): void {
    if (!namespaceCache[locale])
        namespaceCache[locale] = {}

    namespaceCache[locale][namespace] = content
}

async function fetchNamespace(locale: string, namespace: string): Promise<any> {
    const cachedNamespace = fetchNamespaceFromCache(locale, namespace)

    // Returns it if it's already cached
    if (cachedNamespace != undefined)
        return cachedNamespace

    // Checks if there's a fetch in progress and waits for it
    const cacheKey = `${locale}:${namespace}`
    if(pendingFetches[cacheKey] != undefined) {
        let retries = 0
        const maxRetries = 4
        const retryDelay = 500

        while(retries < maxRetries) {
            await wait(retryDelay)
            
            const cachedData = fetchNamespaceFromCache(locale, namespace)
            if (cachedData != undefined)
                return cachedData
            
            retries++
        }
    }

    pendingFetches[cacheKey] = true
    const fetchedNamespace = await fetchNamespaceFromLokalise(locale, namespace)
    addNamespaceToCache(locale, namespace, fetchedNamespace)
    
    return fetchedNamespace
}

async function getKey(keyWithNamespace: string, locale: string): Promise<any> {
    const namespace = keyWithNamespace.split(".")[0]
    const namespaceKeys: any = await fetchNamespace(locale, namespace)
    return namespaceKeys[keyWithNamespace]
}

async function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

Promise.all([
    getKey('clients_notifications.i2s.client.invite.title', 'pt-BR'),
    getKey('clients_notifications.i2s.apps.title', 'pt-BR',),
    getKey('clients_notifications.i2s.benefits.title', 'pt-BR',),
]).then(values => {
    console.log(namespaceCache)
    console.log(values)
})
