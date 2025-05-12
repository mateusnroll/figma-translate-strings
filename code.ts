// Shows the HTML page in "ui.html"
figma.showUI(__html__, { width: 400, height: 800, title: "Lokalise translator" });

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
figma.ui.onmessage =  async (msg: {type: string, targetLanguages: string}) => {
	if (msg.type === 'updateKeys')
		await updateKeys()
	
	if (msg.type === 'translate-to')
		await translate(msg.targetLanguages);
	
	figma.closePlugin();
}






// ##########################
// COMMON
// ##########################

function getLokaliseNodes(frame: FrameNode): Array<TextNode> {
	return frame
	.findAll(n => 
		n.type === 'TEXT' && 
		n.name.charAt(0) == '#') as TextNode[]
}

async function updateAllNodesFromLokalise(nodes: TextNode[], locale: string) {
	const keys: string[] = nodes.map(i => i.name);
	const results = await getKeys(keys, locale);
	
	await Promise.all(
		nodes.map(node => updateNode(node, results[node.name.substring(1)]))
	)
}

async function updateNode(node: TextNode, value: string) {
	const fontName: FontName = node.fontName as FontName
	await figma.loadFontAsync(fontName)
	
	console.log({name: node.name, value})
	node.characters = value
}

function getLokaliseNodesToUpdate(artboads: FrameNode[]): TextNode[] {
	let textNodes: TextNode[] = []
	
	for (const artboard of artboads) {
		const artboardTextNodes = getLokaliseNodes(artboard)
		textNodes.push(...artboardTextNodes)
	}
	
	return textNodes
}
	
	
	
	
// ##########################
// UDPATE KEYS
// ##########################
async function updateKeys() {
	const selectedArtboards = figma.currentPage.selection as FrameNode[]
	
	if (selectedArtboards.length == 0) 
		return figma.notify('Error: No artboard selected. Please select one.')
	
	const nonFrames = selectedArtboards.filter(i => i.type !== 'FRAME')
	if (nonFrames.length > 0)
		return figma.notify('Error: There are non-artboards in the seleciton. Please select only artboards')
	
	let textNodes: TextNode[] = getLokaliseNodesToUpdate(selectedArtboards)
	
	await updateAllNodesFromLokalise(textNodes, 'en_US')
}
	
	
	
	
	
	
// ##########################
// TRANSLATE
// ##########################
async function translate(targetLanguages: string) {
	const selectedArtboards = figma.currentPage.selection
	if (selectedArtboards.length == 0) 
		return figma.notify('Error: No artboard selected. Please select one.')
	if (selectedArtboards.length > 1) 
		return figma.notify('Error: Multiple artboards selected. Please select just one.')
	if (targetLanguages == '')
		return figma.notify('Error: Select at least one language.')
	if (selectedArtboards[0].type !== 'FRAME')
		return figma.notify('The current selection is not a Frame. Please select just one Frame.')
	
	const languages = targetLanguages.split(',')
	await translateManyFrames(selectedArtboards[0] as FrameNode, languages)
}

async function translateManyFrames(frame: FrameNode, targetLanguages: string[]) {
	await Promise.all(
		targetLanguages.map(async (lang, index) => {
			const offset = calculateOffset(frame, index)
			const duplicatedFrame = duplicateFrame(frame, `(${lang})`, offset)
			await translateFrame(duplicatedFrame, lang)
			// await updateAllNodesFromLokalise(getLokaliseNodes(duplicatedFrame), lang)
		})
	)
}

async function translateFrame(frame: FrameNode, targetLanguage: string) {
	let textNodes: TextNode[] = getLokaliseNodesToUpdate([frame])
	await updateAllNodesFromLokalise(textNodes, targetLanguage)
}

function duplicateFrame(originalFrame: FrameNode, appendName: string | undefined, offset: number): FrameNode {
	const duplicatedFrame = originalFrame.clone()
	duplicatedFrame.x = offset

	if (appendName != undefined)
		duplicatedFrame.name = `${originalFrame.name} ${appendName}`

	console.log(duplicatedFrame)

	return duplicatedFrame
}

function calculateOffset(frame: FrameNode, index: number): number {
	const spacing: number = 80
	return frame.x + ((index + 1) * (frame.width + spacing))
}









// ##########################
// LOKALISE
// ##########################

interface LokaliseNamespace {
	[locale: string]: {
		[namespace: string]: {
			[key: string]: string
		}
	}
}

interface LokaliseKey {
	[key: string]: string
}

var namespaceCache: LokaliseNamespace = {}
var pendingFetches: { [key: string]: any } = {}

async function fetchNamespaceFromLokalise(locale: string, namespace: string): Promise<Object> {
	const url = `https://localization-api.gympass.com/v1/translation/${namespace}?format=flat&Accept-Language=${locale}`
	const headers = { "Accept-Language": locale } 
	const response = await fetch(url, { method: 'GET'})
	
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

async function getSingleKey(keyWithNamespace: string, locale: string): Promise<LokaliseKey> {
	const namespace = keyWithNamespace.split(".")[0].substring(1)
	const namespaceKeys: any = await fetchNamespace(locale, namespace)
	return namespaceKeys[keyWithNamespace.substring(1)]
}

async function getKeys(keysWithNamespace: string[], locale: string): Promise<{ [key: string]: string }> {
	const entries = await Promise.all(
		keysWithNamespace.map(async key => ({
			key: key.substring(1),
			value: await getSingleKey(key, locale)
		}))
	)
	
	return entries.reduce((acc, { key, value }) => ({
		...acc,
		[key]: value
	}), {})
}

async function wait(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}


















// ##########################
// GOOGLE TRANSLATE
// ##########################
// async function translate(from: string, to: string) {
//   const selectedArtboards = figma.currentPage.selection
//   if (selectedArtboards.length == 0) 
//     return figma.notify('Error: No artboard selected. Please select one.')
//   if (selectedArtboards.length > 1) 
//     return figma.notify('Error: Multiple artboards selected. Please select just one.')
//   if (to == '')
//     return figma.notify('Error: Target language is not set.')
//   if (selectedArtboards[0].type !== 'FRAME')
//     return figma.notify('The current selection is not a Frame. Please select just one Frame.')

//   const duplicatedFrame: FrameNode = duplicateArtboard(selectedArtboards[0] as FrameNode, `(Lang: ${to})`)
//   await translateMarkedStrings(duplicatedFrame, to)
// }

// function duplicateArtboard(originalFrame: FrameNode, appendName: string | undefined): FrameNode {
//   const frameOffset: number = 80
//   const duplicatedFrame = originalFrame.clone()

//   duplicatedFrame.x = originalFrame.x + originalFrame.width + frameOffset

//   if (appendName != undefined)
//     duplicatedFrame.name = `${originalFrame.name} ${appendName}`

//   return duplicatedFrame
// }

// async function translateMarkedStrings(frame: FrameNode, targetLanguage: string) {
//  const layerMark = '#'

//   let layers = frame
//     .children
//     .filter(l => l.type === 'TEXT')
//     .filter(l => l.name.charAt(0) == '#')

//   console.log(layers)

//   await Promise.all(layers.map(node => translateTextNode(node, targetLanguage)))
// }

// async function translateTextNode(node: TextNode, targetLanguage: string) {
//   console.log('here')

//   const fontName: FontName = node.fontName as FontName
//   await figma.loadFontAsync(fontName)

//   node.characters = await getGoogleTranslation(node.characters, targetLanguage)
// }

// async function getGoogleTranslation(content: string, to: string) {
//   const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${to}&dt=t&q=${encodeURIComponent(content)}`  

//   try {
//     const response = await fetch(url)
//     if (!response.ok) 
//       throw new Error(`HTTP error! Status: ${response.status}`)

//     const data = await response.json()
//     return data[0][0][0]
//   } catch (error) {
//     console.error("Translation failed: ", error)
//   }
// }