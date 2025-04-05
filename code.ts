// Shows the HTML page in "ui.html"
figma.showUI(__html__, { width: 400, height: 800, title: "Lokalise translator" });

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
figma.ui.onmessage =  async (msg: {type: string, targetLanguage: string}) => {
  if (msg.type === 'translate-to') {
    await translate('en-us', msg.targetLanguage);
  }

  figma.closePlugin();
};

async function translate(from: string, to: string) {
  const selectedArtboards = figma.currentPage.selection
  if (selectedArtboards.length == 0) 
    return figma.notify('Error: No artboard selected. Please select one.')
  if (selectedArtboards.length > 1) 
    return figma.notify('Error: Multiple artboards selected. Please select just one.')
  if (to == '')
    return figma.notify('Error: Target language is not set.')
  if (selectedArtboards[0].type !== 'FRAME')
    return figma.notify('The current selection is not a Frame. Please select just one Frame.')

  const duplicatedFrame: FrameNode = duplicateArtboard(selectedArtboards[0] as FrameNode, `(Lang: ${to})`)
  await translateMarkedStrings(duplicatedFrame, to)
}

function duplicateArtboard(originalFrame: FrameNode, appendName: string | undefined): FrameNode {
  const frameOffset: number = 80
  const duplicatedFrame = originalFrame.clone()
  
  duplicatedFrame.x = originalFrame.x + originalFrame.width + frameOffset

  if (appendName != undefined)
    duplicatedFrame.name = `${originalFrame.name} ${appendName}`

  return duplicatedFrame
}

async function translateMarkedStrings(frame: FrameNode, targetLanguage: string) {
 const layerMark = '#'

  let layers = frame
    .children
    .filter(l => l.type === 'TEXT')
    .filter(l => l.name.charAt(0) == '#')

  console.log(layers)
  
  await Promise.all(layers.map(node => translateTextNode(node, targetLanguage)))
}

async function translateTextNode(node: TextNode, targetLanguage: string) {
  console.log('here')

  const fontName: FontName = node.fontName as FontName
  await figma.loadFontAsync(fontName)

  node.characters = await getGoogleTranslation(node.characters, targetLanguage)
}

async function getGoogleTranslation(content: string, to: string) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${to}&dt=t&q=${encodeURIComponent(content)}`  
  
  try {
    const response = await fetch(url)
    if (!response.ok) 
      throw new Error(`HTTP error! Status: ${response.status}`)
    
    const data = await response.json()
    return data[0][0][0]
  } catch (error) {
    console.error("Translation failed: ", error)
  }
}