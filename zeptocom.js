// Copyright (c) 2022-2023 Travis Bemann
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

let termTabs = [];
let currentTermTab = null;
let termTabCount = 0;
let workingDir = null;
let history = [];
let wordHistory = new Map();
let wordFlatHistory = new Set();
let currentHistoryIdx = 0;
let globalSymbols = new Map();
let currentEditTab = null;
let editTabs = [];
let editTabCount = 0;
let currentSelection = new Map();
let editTabFileName = new Map();
let editTabOrigName = new Map();
let exampleMap = new Map();
let oldExamplePlatform = null;
let libraryMap = new Map();
let oldLibraryPlatform = null;

function updateCode(platform, oldPlatform, dropdown, map) {
    if(oldPlatform) {
        if(exampleMap.has(oldPlatform)) {
            const old = map.get(oldPlatform);
            for(let i = old.length - 1; i >= 0; i--) {
                dropdown.options.remove(i);
            }
        }
    }
    if(map.has(platform)) {
        const entries = map.get(platform);
        for(const entry of entries) {
            const title = entry[0];
            const path = entry[1];
            dropdown.options.add(new Option(title, path),
                                 dropdown.options.length);
            dropdown.selectedIndex = -1;
        }
    }
}

function updateExamples(platform) {
    const examplesDropdown = document.getElementById('examples');
    updateCode(platform, oldExamplePlatform, examplesDropdown, exampleMap);
    oldExamplePlatform = platform;
}

function updateLibraries(platform) {
    const librariesDropdown = document.getElementById('libraries');
    updateCode(platform, oldLibraryPlatform, librariesDropdown, libraryMap);
    oldLibraryPlatform = platform;
}

function completeWordHistory(text) {
    if(wordFlatHistory.has(text)) {
        return text;
    }
    let current = wordHistory;
    for(let i = 0; i < text.length; i++) {
        current = current.get(text[i]);
        if(current === undefined) {
            return text;
        }
    }
    while(current.size === 1) {
        for(key of current.keys()) {
            text = text + key;
            current = current.get(key);
            if(wordFlatHistory.has(text)) {
                return text;
            }
        }
    }
    return text;
}

function addWordHistory(text) {
    if(text.length > 0) {
        let current = wordHistory;
        for(let i = 0; i < text.length; i++) {
            if(current.has(text[i])) {
                current = current.get(text[i]);
            } else {
                let newCurrent = new Map();
                current.set(text[i], newCurrent);
                current = newCurrent;
            }
        }
        wordFlatHistory.add(text);
    }
}

function delay(ms) {
    return new Promise(resolve => {
        setTimeout(() => { resolve('') }, ms);
    })
}

function saveConnectParams(termTab) {
    const baudSelect = document.getElementById('baud');
    const dataBitsSelect = document.getElementById('dataBits');
    const stopBitsSelect = document.getElementById('stopBits');
    const paritySelect = document.getElementById('parity');
    const flowControlSelect = document.getElementById('flowControl');
    const targetTypeSelect = document.getElementById('targetType');
    const newlineModeSelect = document.getElementById('newlineMode');
    const rebootButton = document.getElementById('reboot');
    const attentionButton = document.getElementById('attention');
    if(!termTab.port) {
	termTab.baud = parseInt(baudSelect.value);
	termTab.dataBits = parseInt(dataBitsSelect.value);
	termTab.stopBits = parseInt(stopBitsSelect.value);
	termTab.parity = paritySelect.value;
	termTab.flowControl = flowControlSelect.value;
    }
    termTab.targetType = targetTypeSelect.value;
    updateExamples(termTab.targetType);
    updateLibraries(termTab.targetType);
    termTab.newlineMode = newlineModeSelect.value;
    if(termTab.targetType === 'flashforth' &&
       termTab.compileState === undefined) {
        termTab.compileState = false;
    }
    rebootButton.disabled =
        !termTab.port || termTab.targetType !== 'zeptoforth';
    attentionButton.disabled =
        !termTab.port || termTab.targetType !== 'zeptoforth';
}

function updateConnectParams(termTab) {
    const baudSelect = document.getElementById('baud');
    const dataBitsSelect = document.getElementById('dataBits');
    const stopBitsSelect = document.getElementById('stopBits');
    const paritySelect = document.getElementById('parity');
    const flowControlSelect = document.getElementById('flowControl');
    const targetTypeSelect = document.getElementById('targetType');
    const newlineModeSelect = document.getElementById('newlineMode');
    const rebootButton = document.getElementById('reboot');
    const attentionButton = document.getElementById('attention');
    baudSelect.selectedIndex = 0;
    baudSelect.value = termTab.baud;
    dataBitsSelect.selectedIndex = 0;
    dataBitsSelect.value = termTab.dataBits;
    stopBitsSelect.selectedIndex = 0;
    stopBitsSelect.value = termTab.stopBits;
    paritySelect.selectedIndex = 0;
    paritySelect.value = termTab.parity;
    flowControlSelect.selectedIndex = 0;
    flowControlSelect.value = termTab.flowControl;
    targetTypeSelect.selectedIndex = 0;
    targetTypeSelect.value = termTab.targetType;
    updateExamples(termTab.targetType);
    updateLibraries(termTab.targetType);
    newlineModeSelect.selectedIndex = 0;
    newlineModeSelect.value = termTab.newlineMode;
    rebootButton.disabled =
        !termTab.port || termTab.targetType !== 'zeptoforth';
    attentionButton.disabled =
        !termTab.port || termTab.targetType !== 'zeptoforth';
}

function updateButtonEnable(termTab) {
    const connectButton = document.getElementById('connect');
    const disconnectButton = document.getElementById('disconnect');
    const baudSelect = document.getElementById('baud');
    const dataBitsSelect = document.getElementById('dataBits');
    const stopBitsSelect = document.getElementById('stopBits');
    const paritySelect = document.getElementById('parity');
    const flowControlSelect = document.getElementById('flowControl');
    const sendButton = document.getElementById('send');
    const sendFileButton = document.getElementById('sendFile');
    const rebootButton = document.getElementById('reboot');
    const attentionButton = document.getElementById('attention');
    const promptButton = document.getElementById('prompt');
    const interruptButton = document.getElementById('interrupt');
    if(termTab.port && !termTab.triggerClose && !termTab.triggerAbort) {
	connectButton.disabled = true;
	baudSelect.disabled = true;
	dataBitsSelect.disabled = true;
	stopBitsSelect.disabled = true;
	paritySelect.disabled = true;
	flowControlSelect.disabled = true
	disconnectButton.disabled = false;
	if(termTab.sending) {
	    sendButton.disabled = true;
	    sendFileButton.disabled = true;
	    promptButton.disabled = true;
	    interruptButton.disabled = false;
	} else {
	    sendButton.disabled = false;
	    sendFileButton.disabled = false;
	    promptButton.disabled = false;
	    interruptButton.disabled = true;
	}
        rebootButton.disabled = termTab.targetType !== 'zeptoforth';
        attentionButton.disabled = termTab.targetType !== 'zeptoforth';
    } else {
	sendButton.disabled = true;
	sendFileButton.disabled = true;
        rebootButton.disabled = true;
        attentionButton.disabled = true;
	promptButton.disabled = true;
	interruptButton.disabled = true;
	disconnectButton.disabled = true;
	connectButton.disabled = false;
	baudSelect.disabled = false;
	dataBitsSelect.disabled = false;
	stopBitsSelect.disabled = false;
	paritySelect.disabled = false;
	flowControlSelect.disabled = false;
    }
}

function currentTermId(type) {
    return 'termTab' + currentTermTab.tabId + type;
}

function currentEditId(type) {
    return currentEditTab + type;
}

function backTermTabUpdate(termTab) {
    const button =
	  document.getElementById('termTab' + termTab.tabId + 'Button');
    if(button) {
	button.classList.add('tab-edited');
    }
}

function foreTermTabUpdate(termTab) {
    const button =
	  document.getElementById('termTab' + termTab.tabId + 'Button');
    if(button) {
	button.classList.remove('tab-edited');
    }
}    

// function termTabSetTitle(title) {
//     const label = document.getElementById(currentTermId('Label'));
//     label.replaceChild(document.createTextNode(title), label.lastChild);
// }

async function termTabClick(event) {
    saveConnectParams(currentTermTab);
    
    const tabButtonClicked = event.target;
    const id = parseInt(event.target.dataset.id);

    for(const termTab of termTabs) {
	const tabButtonId = '#termTab' + termTab.tabId + 'Button'
	const tabButton = document.querySelector(tabButtonId);
	const tabId = '#termTab' + tabButton.dataset.id;
	const tab = document.querySelector(tabId);
	tabButton.classList.remove('tab-selected');
	tab.classList.add('tab-hidden');
    }
    
    document.querySelector('#termTab' + id).classList.remove('tab-hidden');
    document.querySelector('#termTab' + id + 'Button')
	.classList.add('tab-selected');
    for(const termTab of termTabs) {
	if(id == termTab.tabId) {
	    currentTermTab = termTab;
	}
    }

    updateConnectParams(currentTermTab);
    updateButtonEnable(currentTermTab);
    foreTermTabUpdate(currentTermTab);
    await delay(0);
    currentTermTab.fitAddon.fit();
};

function editTabSetTitle(title) {
    const label = document.getElementById(currentEditId('Label'));
    label.replaceChild(document.createTextNode(title), label.lastChild);
}

function editTabSetFileName(fileName) {
    if(!editTabFileName.get(currentEditTab)) {
	editTabFileName.set(currentEditTab, fileName);
	editTabSetTitle(fileName);
    }
}

function editTabResetFileName(fileName) {
    editTabFileName.set(currentEditTab, fileName);
    editTabSetTitle(fileName);
}

function editTabClearFileName() {
    editTabFileName.set(currentEditTab, null)
    editTabSetTitle(editTabOrigName.get(currentEditTab));
}

function editTabChanged() {
    const button = document.getElementById(currentEditId('Button'));
    button.classList.add('tab-edited');
}

function editTabSaved() {
    const button = document.getElementById(currentEditId('Button'));
    button.classList.remove('tab-edited');
}    

function editTabClick(event) {
    const tabButtonClicked = event.target;
    const id = event.target.dataset.id;

    const prevTabAreaInput = document.getElementById(currentEditId('Area'));
    currentSelection.set(currentEditId('Area'), {
	start: prevTabAreaInput.selectionStart,
	end: prevTabAreaInput.selectionEnd
    });
    
    for(const i of editTabs) {
	const tabButtonId = '#editTab' + i + 'Button'
	const tabButton = document.querySelector(tabButtonId);
	const tabId = '#' + tabButton.dataset.id;
	const tab = document.querySelector(tabId);
	tabButton.classList.remove('tab-selected');
	tab.classList.add('tab-hidden');
    }
    
    document.querySelector('#' + id).classList.remove('tab-hidden');
    document.querySelector('#' + id + 'Button')
	.classList.add('tab-selected');
    currentEditTab = id;
    
    const nextTabAreaInput = document.getElementById(currentEditId('Area'));
    nextTabAreaInput.focus();
    
    if(currentSelection.has(currentEditId('Area'))) {
	const selection = currentSelection.get(currentEditId('Area'));
	if(selection.start && selection.end) {
	    nextTabAreaInput.selectionStart = selection.start;
	    nextTabAreaInput.selectionEnd = selection.end;
	}
    }
};

function writeTerm(termTab, data) {
    termTab.term.write(data);
    termTab.currentData.push(data);
    if(termTab !== currentTermTab) {
	backTermTabUpdate(termTab);
    }
}

function getTargetType() {
    const targetTypeSelect = document.getElementById('targetType');
    return targetTypeSelect.value;
}

function getCursorPos(input) {
    if('selectionStart' in input) {
        return {
            start: input.selectionStart,
            end: input.selectionEnd
        };
    } else if(input.createTextRange) {
        let sel = document.selection.createRange();
        if(sel.parentElement() === input) {
            let range = input.createTextRange();
            range.moveToBookmark(sel.getBookmark());
	    let len = 0;
            for (;
                 range.compareEndPoints("EndToStart", range) > 0;
                 range.moveEnd("character", -1)) {
                len++;
            }
            range.setEndPoint("StartToStart", input.createTextRange());
	    let pos = { start: 0, end: len }
            for (;
                 range.compareEndPoints("EndToStart", range) > 0;
                 range.moveEnd("character", -1)) {
                pos.start++;
                pos.end++;
            }
            return pos;
        }
    }
    return -1;
}

function setCursorPos(input, start, end) {
    if(arguments.length < 3) {
	end = start;
    }
    if("selectionStart" in input) {
        setTimeout(() => {
            input.selectionStart = start;
            input.selectionEnd = end;
        }, 1);
    } else if(input.createTextRange) {
        let range = input.createTextRange();
        range.moveStart("character", start);
        range.collapse();
        range.moveEnd("character", end - start);
        range.select();
    }
}

async function selectWorkingDir() {
    try {
	workingDir = await window.showDirectoryPicker({ mode: 'read' });
    } catch(e) {
    }
}

async function getWorkingDir() {
    if(!workingDir) {
	await selectWorkingDir();
    }
    return workingDir;
}

async function getFile(parts, dirPath) {
    if(parts.length == 1) {
	for await(const entry of dirPath[dirPath.length - 1].values()) {
	    if(entry.name === parts[0]) {
		if(entry.kind === 'file') {
		    return await entry.getFile();
		} else if(entry.kind === 'directory') {
		    return null;
		}
	    }
	}
	return null;
    } else {
	if(parts[0] === '.') {
	    return await getFile(parts.slice(1), dirPath);
	} else if(parts[0] === '..') {
	    if(dirPath.length > 1) {
		return await getFile(parts.slice(1),
				     dirPath.slice(0, dirPath.length - 1));
	    } else {
		return null;
	    }
	} else {
	    for await(const entry of dirPath[dirPath.length - 1].values()) {
		if(entry.name === parts[0]) {
		    if(entry.kind === 'file') {
			return null;
		    } else if(entry.kind === 'directory') {
			return await getFile(parts.slice(1),
					     dirPath.concat([entry]));
		    }
		}
	    }
	    return null;
	}
    }
}

async function slurpFile(file) {
    const decoder = new TextDecoder();
    const arrayBuffer = await file.arrayBuffer();
    const string = decoder.decode(arrayBuffer);
    return string.split(/\r?\n/);
}

function errorMsg(termTab, msg) {
    writeTerm(termTab, '\x1B[31;1m' + msg + '\x1B[0m');
}

function infoMsg(termTab, msg) {
    writeTerm(termTab, '\x1B[33;1m' + msg + '\x1B[0m');
}

function removeComment(line) {
    for(let i = 0; i < line.length; i++) {
	if(line[i] === '\\') {
	    if((i === 0 || line[i - 1] === ' ' || line[i - 1] === '\t') &&
	       (i === line.length - 1 || line[i + 1] === ' ' ||
		line[i + 1] === '\t')) {
		return line.substring(0, i);
	    }
	}
    }
    return line;
}

function parseSymbols(lines, symbols) {
    for(const line of lines) {
	const mainPart = removeComment(line).trim();
	if(mainPart.length > 0) {
	    for(let i = 0; i < mainPart.length; i++) {
		if(mainPart[i] === ' ' || mainPart[i] === '\t') {
		    const key = mainPart.substring(0, i);
		    const value =
			  mainPart.substring(i, mainPart.length).trim();
		    symbols.set(key, value);
		}
	    }
	}
    }
}

function lookupSymbol(symbol, symbolStack) {
    for(let i = symbolStack.length - 1; i >= 0; i--) {
	if(symbolStack[i].has(symbol)) {
	    return symbolStack[i].get(symbol);
	}
    }
    return symbol;
}

function isSymbolStackEmpty(symbolStack) {
    for(const symbols of symbolStack) {
	if(symbols.size > 0) {
	    return false;
	}
    }
    return true;
}

function applySymbols(line, symbolStack) {
    if(isSymbolStackEmpty(symbolStack)) {
	return line;
    }
    let newLine = ''
    let i = 0;
    while(i < line.length) {
	if(line[i] === ' ' || line[i] === '\t') {
	    newLine = newLine + line[i];
	    i++;
	} else {
	    let start = i;
	    while(i < line.length) {
		if(line[i] !== ' ' && line[i] !== '\t') {
		    i++;
		} else {
		    break;
		}
	    }
	    let symbol = line.substring(start, i);
	    newLine = newLine + lookupSymbol(symbol, symbolStack);
	}
    }
    return newLine;
}

async function expandLines(lines, symbolStack) {
    let allLines = [];
    for (const line of lines) {
	const parts = line.trim().split(/\s+/, 2);
	if(parts.length > 1 && parts[0] === '#include') {
	    const workingDir = await getWorkingDir();
	    if(!workingDir) {
		errorMsg(currentTermTab, 'Canceled\r\n');
		return null;
	    }
	    const file = await getFile(parts[1].trim().split(/\//),
				       [workingDir]);
	    if(!file) {
		errorMsg(currentTermTab,
                         parts[1].trim() + ': File not found\r\n');
		return null;
	    }
	    const fileLines = await slurpFile(file);
	    const expandedLines =
		  await expandLines(fileLines, symbolStack.concat([new Map()]));
	    if (!expandedLines) {
		return null;
	    }
	    allLines = allLines.concat(expandedLines);
	} else if(parts.length > 1 && parts[0] === '#symbols') {
	    const workingDir = await getWorkingDir();
	    if(!workingDir) {
		errorMsg(currentTermTab, 'Canceled\r\n');
		return null;
	    }
	    const file = await getFile(parts[1].trim().split(/\//),
				       [workingDir])
	    if(!file) {
		errorMsg(currentTermTab,
                         parts[1].trim() + ': File not found\r\n');
		return null;
	    }
	    const fileLines = await slurpFile(file);
	    const expandedLines = await expandLines(fileLines, [new Map()]);
	    if (!expandedLines) {
		return null;
	    }
	    parseSymbols(expandedLines, symbolStack[symbolStack.length - 1]);
	} else {
	    allLines.push(applySymbols(line, symbolStack));
	}
    }
    return allLines;
}

async function writeLine(termTab, line) {
    const encoder = new TextEncoder();
    if(termTab.targetType === 'flashforth') {
        for(const part of line.trim().split(/\s/)) {
            const trimmedPart = part.trim();
            if(trimmedPart === ':' || trimmedPart === ':noname' ||
               trimmedPart === ']') {
                termTab.compileState = true;
            } else if(trimmedPart === ';' || trimmedPart === ';i' ||
                      trimmedPart === '[') {
                termTab.compileState = false;
            }
        }
        termTab.unknownCount = 0;
        termTab.compileOnlyCount = 0;
        termTab.lineLeft = line.length;
    }
    line = line + '\r';
    while(termTab.portWriter && line.length > 128) {
	await termTab.portWriter.write(encoder.encode(line.substring(0, 128)));
	await delay(20);
	line = line.substring(128);
    }
    if(termTab.portWriter && line.length) {
	await termTab.portWriter.write(encoder.encode(line));
    }
}

async function sendByte(termTab, b) {
    if(termTab.port.writable) {
        if(!termTab.portWriter) {
	    termTab.portWriter = termTab.port.writable.getWriter();
            await termTab.portWriter.write(Uint8Array.from([b]));
	    termTab.portWriter.releaseLock();
	    termTab.portWriter = null;
        } else {
            await termTab.portWriter.write(Uint8Array.from([b]));
        }
    }
}

async function sendCtrlC(termTab) {
    await sendByte(termTab, 0x03);
}

async function sendCtrlT(termTab) {
    await sendByte(termTab, 0x14);
}

function stripLine(line) {
    line = line.trim();
    if(line[0] == '\\') {
	return '';
    }
    return line;
}

function stripCode(lines) {
    const allLines = [];
    const noBlankLines = [];
    for(const line of lines) {
	allLines.push(stripLine(line));
    }
    for(const line of allLines) {
	if(line) {
	    noBlankLines.push(line);
	}
    }
    return noBlankLines;
}

async function disconnect(termTab, lost = false) {
    const sendButton = document.getElementById('send');
    const sendFileButton = document.getElementById('sendFile');
    const rebootButton = document.getElementById('reboot');
    const attentionButton = document.getElementById('attention');
    const promptButton = document.getElementById('prompt');
    const interruptButton = document.getElementById('interrupt');
    const disconnectButton = document.getElementById('disconnect');
    if(termTab === currentTermTab) {
	sendButton.disabled = true;
	sendFileButton.disabled = true;
        rebootButton.disabled = true;
        attentionButton.disabled = true;
	promptButton.disabled = true;
	interruptButton.disabled = true;
	disconnectButton.disabled = true;
    }
    if(!lost) {
	termTab.interruptCount++;
        await termTab.handleNak();
    }
    const isSending = termTab.sending;
    const isReceiving = termTab.receiving;
    termTab.triggerClose = true;
    termTab.triggerAbort = true;
    if(termTab.portReader) {
	await termTab.portReader.cancel();
	if(termTab.portReader) {
	    termTab.portReader.releaseLock();
	    termTab.portReader = null;
	}
    }
    if(termTab.port.readable) {
	termTab.port.readable.cancel();
    }
    if(termTab.portWriter) {
	await termTab.portWriter.abort();
	if(termTab.portWriter) {
	    termTab.portWriter.releaseLock();
	    termTab.portWriter = null;
	}
    }
    if(termTab.port.writable) {
	termTab.port.writable.abort();
    }
    while(isSending && termTab.triggerAbort) {
	await delay(10);
    }
    while(isReceiving && termTab.triggerClose) {
	await delay(10);
    }
    termTab.port.close();
    termTab.port = null;
    termTab.triggerAbort = false;
    termTab.triggerClose = false;
    const connectButton = document.getElementById('connect');
    const baudSelect = document.getElementById('baud');
    const dataBitsSelect = document.getElementById('dataBits');
    const stopBitsSelect = document.getElementById('stopBits');
    const paritySelect = document.getElementById('parity');
    const flowControlSelect = document.getElementById('flowControl');
    if(termTab === currentTermTab) {
	connectButton.disabled = false;
	baudSelect.disabled = false;
	dataBitsSelect.disabled = false;
	stopBitsSelect.disabled = false;
	paritySelect.disabled = false;
	flowControlSelect.disabled = false;
    }
    if(!lost) {
	infoMsg(termTab, 'Disconnected\r\n');
    } else {
	errorMsg(termTab, 'Connection lost\r\n');
    }
}

function endSend(termTab) {
    const sendButton = document.getElementById('send');
    const sendFileButton = document.getElementById('sendFile');
    const promptButton = document.getElementById('prompt');
    const interruptButton = document.getElementById('interrupt');
    if(termTab.timeout) {
        clearTimeout(termTab.timeout);
        termTab.timeout = null;
    }
    if(termTab.portWriter) {
	termTab.portWriter.releaseLock();
	termTab.portWriter = null;
    }
    if(termTab.port) {
	termTab.triggerAbort = false;
	if(termTab === currentTermTab) {
	    sendButton.disabled = false;
	    sendFileButton.disabled = false;
	    promptButton.disabled = false;
	    interruptButton.disabled = true;
	}
	termTab.sending = false;
    }
    termTab.handleAck = async () => {};
    termTab.handleNak = async () => {};
}

async function writeText(termTab, text) {
    termTab.sending = true;
    const sendButton = document.getElementById('send');
    const sendFileButton = document.getElementById('sendFile');
    const promptButton = document.getElementById('prompt');
    const interruptButton = document.getElementById('interrupt');
    const timeoutCheckbox = document.getElementById('timeout');
    const timeoutEnabled = timeoutCheckbox.checked;
    const timeoutMsInput = document.getElementById('timeoutMs');
    const timeoutMs = timeoutMsInput.value;
    if(termTab === currentTermTab) {
	sendButton.disabled = true;
	sendFileButton.disabled = true;
	promptButton.disabled = true;
    }
    let lines = await expandLines(text.split(/\r?\n/),
				  [globalSymbols, new Map()]);
    while(lines && (lines.length > 1 && lines[lines.length - 1] === '')) {
        lines = lines.slice(0, lines.length - 1);
    }
    if(!lines) {
	if(termTab === currentTermTab) {
	    sendButton.disabled = false;
	    sendFileButton.disabled = false;
	    promptButton.disabled = false;
	}
	termTab.sending = false;
	termtab.triggerAbort = false;
	return;
    }
    stripCheckbox = document.getElementById('strip');
    if(stripCheckbox.checked) {
	lines = stripCode(lines);
	if(lines.length == 0) {
	    lines = [''];
	}
    }
    let currentNakCount = termTab.nakCount;
    let currentInterruptCount = termTab.interruptCount;
    let currentRebootCount = termTab.rebootCount;
    let currentAttentionCount = termTab.attentionCount;
    let currentLostCount = termTab.lostCount;
    if(termTab === currentTermTab) {
	interruptButton.disabled = false;
    }
    if(termTab.port.writable) {
	termTab.portWriter = termTab.port.writable.getWriter();
    } else {
	termTab.triggerAbort = false;
	termTab.sending = false;
	await disconnect(termTab, true);
        return;
    }
    let linesLeft = lines.length;
    termTab.handleNak = async () => {};
    termTab.handleAck = async () => {
	if(termTab.timeout) {
	    clearTimeout(termTab.timeout);
            termTab.timeout = null;
	}
	if(termTab.triggerAbort) {
            endSend(termTab);
            return;
        }
        const line = lines[lines.length - linesLeft];
        linesLeft--;
	try {
	    await writeLine(termTab, line);
	    if(termTab.triggerAbort) {
                endSend(termTab);
                return;
            }
	    if(lines.length > 1 && linesLeft != 0) {
		if(timeoutEnabled) {
		    termTab.timeout = setTimeout(() => {
			errorMsg(termTab, 'Timed out\r\n');
                        if(termTab.targetType === 'flashforth') {
                            termTab.compileState = false;
                        }
                        endSend(termTab);
		    }, timeoutMs);
		}
                termTab.handleNak = async () => {
                    try {
		        if(termTab.lostCount !== currentLostCount) {
			    termTab.triggerAbort = false;
			    termTab.sending = false;
			    await disconnect(termTab, true);
		        } else if(termTab.interruptCount !==
                                  currentInterruptCount) {
			    errorMsg(termTab, 'Interrupted\r\n');
                            if(termTab.targetType === 'flashforth') {
                                termTab.compileState = false;
                            }
		        } else if(termTab.rebootCount !== currentRebootCount) {
                            errorMsg(termTab, 'Reboot\r\n');
                            if(termTab.targetype === 'flashforth') {
                                termTab.compileState = false;
                            }
                            await sendCtrlC(termTab);
                        } else if(termTab.attentionCount !==
                                  currentAttentionCount) {
                            errorMsg(termTab, 'Attention\r\n');
                            if(termTab.targetype === 'flashforth') {
                                termTab.compileState = false;
                            }
                            await sendCtrlT(termTab);
		        } else if(termTab.nakCount !== currentNakCount) {
                            errorMsg(termTab, 'Error\r\n');
                            if(termTab.targetType === 'flashforth') {
                                termTab.compileState = false;
                            }
		        }
                    } finally {
                        endSend(termTab);
                    }
                };
            } else {
                endSend(termTab);
            }
        } catch(e) {
            endSend(termTab);
        }
    };
    await termTab.handleAck();
}

async function clearArea() {
    const area = document.getElementById(currentEditId('Area'));
    area.value = '';
    area.selectionStart = null;
    area.selectionEnd = null;
    editTabSaved();
    editTabClearFileName();
}

async function appendFile() {
    const fileHandles = await window.showOpenFilePicker({});
    if(fileHandles.length !== 1) {
	return;
    }
    const file = await fileHandles[0].getFile();
    const fileLines = await slurpFile(file);
    const area = document.getElementById(currentEditId('Area'));
    const areaLines = area.value.split(/\r?\n/);
    let areaLinesTruncated = areaLines;
    if(areaLines[areaLines.length - 1] === '') {
	areaLinesTruncated = areaLines.slice(0, areaLines.length - 1);
    }
    const start = area.selectionStart;
    const end = area.selectionEnd;
    area.value = areaLinesTruncated.concat(fileLines).join('\n');
    if(areaLinesTruncated.length > 0 && fileLines.length > 0) {
	editTabChanged();
    } else if(fileLines.length > 0) {
	editTabSetFileName(file.name);
    }
    area.selectionStart = start;
    area.selectionEnd = end;
}

async function sendFile() {
    const fileHandles = await window.showOpenFilePicker({});
    if(fileHandles.length !== 1) {
	return;
    }
    const file = await fileHandles[0].getFile();
    const decoder = new TextDecoder();
    const arrayBuffer = await file.arrayBuffer();
    const string = decoder.decode(arrayBuffer);
    await writeText(currentTermTab, string);
}

async function setGlobalSymbols() {
    const fileHandles = await window.showOpenFilePicker({});
    if(fileHandles.length !== 1) {
	return;
    }
    const file = await fileHandles[0].getFile();
    const fileLines = await slurpFile(file);
    globalSymbols = new Map();
    parseSymbols(fileLines, globalSymbols);
    infoMsg(currentTermTab, 'New global symbols loaded\r\n');
}

async function saveTerminal(termTab) {
    try {
	const fileHandle = await window.showSaveFilePicker({});
	const writable = await fileHandle.createWritable();
	for(const item of termTab.currentData) {
	    await writable.write(item);
	}
	await writable.close();
    } catch(e) {
    }
}

async function saveEdit() {
    try {
	const fileHandle = await window.showSaveFilePicker({});
	const area = document.getElementById(currentEditId('Area'));
	editTabResetFileName(fileHandle.name);
	const writable = await fileHandle.createWritable();
	const saveFormatSelect = document.getElementById('saveFormat');
	const newline = saveFormatSelect.value === 'crlf' ? '\r\n' : '\n';
	await writable.write(area.value.split(/\r?\n/).join(newline));
	await writable.close();
	editTabSaved();
    } catch(e) {
    }
}

async function expandIncludes() {
    const area = document.getElementById(currentEditId('Area'));
    const lines = await expandLines(area.value.split(/\r?\n/), [new Map()]);
    if(!lines) {
	return;
    }
    area.value = lines.join('\n');
    editTabChanged();
}

function addToHistory(line) {
    for(const word of line.trim().split(/\s/)) {
        addWordHistory(word);
    }
    const historyDropdown = document.getElementById('history');
    let found = false;
    for(let i = 0; i < history.length; i++) {
	if(line === history[i]) {
	    historyDropdown.options.remove(i);
	    history = [line].concat(history.slice(0, i))
		.concat(history.slice(i + 1));
	    found = true;
	    break;
	}
    }
    if(!found) {
	history.unshift(line);
    }
    currentHistoryIdx = -1;
    if(historyDropdown.options.length > 0) {
	historyDropdown.options.add(new Option(line, line), 0);
    } else {
	historyDropdown.options.add(new Option(line, line), null);
    }
    historyDropdown.selectedIndex = -1;
}

async function sendEntry() {
    const promptButton = document.getElementById('prompt');
    const lineInput = document.getElementById('line');
    if(!promptButton.disabled) {
	addToHistory(lineInput.value);
        const currentLineInput = lineInput.value;
	lineInput.value = '';
	await writeText(currentTermTab, currentLineInput);
    }
}

async function interrupt(termTab) {
    termTab.interruptCount++;
    await termTab.handleNak();
}

async function reboot(termTab) {
    if(termTab.sending) {
        termTab.rebootCount++;
        await termTab.handleNak();
    } else {
        errorMsg(termTab, 'Reboot\r\n');
        await sendCtrlC(termTab);
    }
}

async function attention(termTab) {
    if(termTab.sending) {
        termTab.attentionCount++;
        await termTab.handleNak();
    } else {
        errorMsg(termTab, 'Attention\r\n');
        await sendCtrlT(termTab);
    }
}

async function connect(termTab) {
    saveConnectParams(termTab);
    termTab.lostCount = 0;
    termTab.port = await navigator.serial.requestPort({ filters: [] });
    await termTab.port.open({ bufferSize: 65535,
			      baudRate: termTab.baud,
			      dataBits: termTab.dataBits,
			      stopBits: termTab.stopBits,
			      parity: termTab.parity,
			      flowControlSelect: termTab.flowControl });
    const baudSelect = document.getElementById('baud');
    const dataBitsSelect = document.getElementById('dataBits');
    const stopBitsSelect = document.getElementById('stopBits');
    const paritySelect = document.getElementById('parity');
    const flowControlSelect = document.getElementById('flowControl');
    const connectButton = document.getElementById('connect');
    const sendButton = document.getElementById('send');
    const sendFileButton = document.getElementById('sendFile');
    const rebootButton = document.getElementById('reboot');
    const attentionButton = document.getElementById('attention');
    const promptButton = document.getElementById('prompt');
    const disconnectButton = document.getElementById('disconnect');
    if(termTab === currentTermTab) {
	connectButton.disabled = true;
	baudSelect.disabled = true;
	dataBitsSelect.disabled = true;
	stopBitsSelect.disabled = true;
	paritySelect.disabled = true;
	flowControlSelect.disabled = true
	sendButton.disabled = false;
	sendFileButton.disabled = false;
        rebootButton.disabled = termTab.targetType !== 'zeptoforth';
        attentionButton.disabled = termTab.targetType !== 'zeptoforth';
	promptButton.disabled = false;
	disconnectButton.disabled = false;
    };
    infoMsg(termTab, 'Connected\r\n');
    try {
	while (!termTab.triggerClose && termTab.port.readable) {
	    termTab.receiving = true;
	    termTab.portReader = termTab.port.readable.getReader();
	    try {
		while (termTab.portReader) {
                    let doHandleAck = false;
                    let doHandleNak = false;
		    const { value, done } = await termTab.portReader.read();
		    if (done) {
			break;
		    }
                    if(termTab.targetType === 'flashforth') {
                        if(value.length < termTab.lineLeft) {
                            termTab.lineLeft -= value.length;
                        } else {
                            const checkStart = termTab.lineLeft;
                            termTab.lineLeft = 0;
                            for(let i = checkStart; i < value.length; i++) {
                                if((value[i] === 0x20) &&
                                   ((termTab.compileOnlyCount < 2) ||
                                    (termTab.unknownCount < 2))) {
                                    termTab.compileOnlyCount = 1;
                                    termTab.unknownCount = 1;
                                } else if(value[i] ===
                                          " COMPILE ONLY\r\n".charCodeAt(termTab.compileOnlyCount)) {
                                    termTab.compileOnlyCount++;
                                    termTab.unknownCount = 0;
                                } else if(value[i] ===
                                          " ?\r\n".charCodeAt(termTab.unknownCount)) {
                                    termTab.compileOnlyCount = 0;
                                    termTab.unknownCount++;
                                } else {
                                    termTab.compileOnlyCount = 0;
                                    termTab.unknownCount = 0;
                                }
                            }
                        }
                    }
		    let fixedValue = [];
		    if(termTab.targetType === 'zeptoforth') {
			for(let i = 0; i < value.length; i++) {
			    if(value[i] === 0x06) {
				termTab.ackCount++;
                                doHandleAck = true;
			    }
			    if(value[i] === 0x15) {
				termTab.nakCount++;
                                doHandleNak = true;
			    }
			}
		    }
		    if(termTab.newlineMode === 'lf') {
			for(let i = 0; i < value.length; i++) {
			    if(value[i] === 0x0A) {
				fixedValue.push(0x0D);
				fixedValue.push(0x0A);
			    } else {
				fixedValue.push(value[i]);
			    }
			}
			fixedValue = Uint8Array.from(fixedValue);
		    } else {
			fixedValue = value;
		    }
		    if(termTab.targetType === 'mecrisp' ||
		       termTab.targetType === 'stm8eforth' ||
		       termTab.targetType === 'esp32forth' ||
                       termTab.targetType === 'flashforth') {
			for(let i = 0; i < fixedValue.length; i++) {
			    if((fixedValue[i] === 0x20 &&
				termTab.okCount === 0) ||
			       (fixedValue[i] === 0x6F &&
				termTab.okCount === 1) ||
			       (fixedValue[i] === 0x6B &&
				termTab.okCount === 2) ||
			       (fixedValue[i] === 0x2E &&
				termTab.okCount === 3 &&
				termTab.targetType === 'mecrisp') ||
			       (fixedValue[i] === 0x0D &&
				termTab.okCount === 3 &&
				termTab.targetType === 'esp32forth') ||
			       (fixedValue[i] === 0x0A &&
				termTab.okCount === 4 &&
				termTab.targetType === 'esp32forth') ||
			       (fixedValue[i] === 0x2D &&
				termTab.okCount === 5 &&
				termTab.targetType === 'esp32forth') ||
			       (fixedValue[i] === 0x2D &&
				termTab.okCount === 6 &&
				termTab.targetType === 'esp32forth') ||
			       (fixedValue[i] === 0x3E &&
				termTab.okCount === 7 &&
				termTab.targetType === 'esp32forth') ||
                               (fixedValue[i] === 0x3C &&
                                termTab.okCount === 3 &&
                                termTab.targetType === 'flashforth')) {
				termTab.okCount++;
			    } else if(fixedValue[i] === 0x20 &&
				      termTab.okCount === 8 &&
				      termTab.targetType === 'esp32forth') {
				termTab.ackCount++;
				termTab.okCount = 0;
                                doHandleAck = true;
			    } else if(fixedValue[i] === 0x20 &&
				      termTab.okCount === 1) {
                            } else if((fixedValue[i] === 0x0A) &&
                                      ((termTab.compileOnlyCount ===
                                        " COMPILE ONLY\r\n".length &&
                                        termTab.targetType === 'flashforth') ||
                                       (termTab.unknownCount ===
                                        " ?\r\n".length &&
                                        termTab.targetType === 'flashforth'))) {
				termTab.nakCount++;
                                termTab.compileOnlyCount = 0;
                                termTab.unknownCount = 0;
                                termTab.okCount = 0;
                                doHandleNak = true;
			    } else if((fixedValue[i] === 0x0A) &&
				      ((termTab.okCount === 4 &&
					termTab.targetType === 'mecrisp') ||
                                       (termTab.okCount === 4 &&
                                        termTab.targetType === 'flashforth' &&
                                        termTab.compileState !== true) ||
                                       (termTab.targetType === 'flashforth' &&
                                        termTab.compileState === true))) {
				termTab.ackCount++;
				termTab.okCount = 0;
                                doHandleAck = true;
                            } else if((fixedValue[i] === 0x0D ||
				       fixedValue[i] === 0x0A) &&
				       (termTab.okCount === 3 &&
					termTab.targetType === 'stm8eforth')) {
				termTab.ackCount++;
				termTab.okCount = 0;
                                doHandleAck = true;
                            } else if(termTab.okCount === 4 &&
                                      termTab.targetType === 'flashforth') {
                            } else if(termTab.okCount === 4 &&
                                      fixedValue[i] === 0x0D &&
                                      termTab.targetType === 'mecrisp') {
			    } else {
				termTab.okCount = 0;
			    }
			}
		    }
		    writeTerm(termTab, fixedValue);
		    termTab.term.scrollToBottom();
                    if(doHandleNak) {
                        await termTab.handleNak();
                    } else if(doHandleAck) {
                        await termTab.handleAck();
                    }
		}
	    } finally {
		if(termTab.portReader) {
		    termTab.portReader.releaseLock();
		    termTab.portReader = null;
		}
		termTab.receiving = false;
	    }
	}
	if(!termTab.port.readable) {
	    if(termTab.sending) {
		termTab.lostCount++;
                await termTab.handleNak();
	    } else {
		disconnect(termTab, true);
	    }
	}
    } catch(e) {
	if(termTab.sending) {
	    termTab.lostCount++;
            await termTab.handleNak();
	} else {
	    disconnect(termTab, true);
	}
    } finally {
	termTab.triggerClose = false;
    }
}

function debounce(func) {
    let timer;
    return event => {
	if(timer) {
	    clearTimeout(timer);
	}
	timer = setTimeout(func,100,event);
    };
}

function help() {
    const helpLines =
	  ["\r\n",
	   "Help\r\n",
	   "\r\n",
	   "Enter at the REPL line or '>>>' uploads the contents of the REPL line to the target. 'Send' uploads the contents of the edit area to the target, or if only a portion has been selected, just that portion. 'Send File' selects a file to send and then sends it, without loading it into the edit area. 'Interrupt' or Control-Q interrupts the current upload to the target. 'Clear' clears the contents of the edit area.\r\n\r\n",
	   "Up and Down Arrow navigate the history of the REPL line, with the Up Arrow navigating to the next oldest entry in the history, and Down Arrow navigating to the next newest entry in the history.\r\n\r\n",
           "Tab completes the word before the cursor or the currently-selected word in the REPL line. In an edit area Tab indents the cursor by two spaces or indents the currently-selected text by two spaces as a whole.\r\n\r\n",
	   "'Connect' queries the user for a serial device to select, and if successful connects zeptocom.js to that serial device. 'Baud' specifies the baud rate, 'Data Bits' specifies the number of data bits, 'Stop Bits' specifies the number of stop bits, 'Parity' specifies the parity, and 'Flow Control' specifies the flow control to use; these must all be set prior to clicking 'Connect', and the defaults are good ones - in most cases one will not need any setting other than 115200 baud, 8 data bits, 1 stop bits, no parity, and no flow control.\r\n\r\n",
	   "'Disconnect' ends the connection with the current serial device, and interrupts any data transfer that may be currently on-going.\r\n\r\n",
	   "'Target Type' specifies the particular target type to support; the current options are 'zeptoforth', 'Mecrisp', 'STM8 eForth', 'ESP32Forth', and 'FlashForth'; note that proper selection of this option is necessary for proper functioning of zeptocom.js with a given target. 'Newline Mode' sets the newline mode to either CRLF (the default for zeptoforth, ESP32Forth, or FlashForth) or LR (the default for Mecrisp or STM8 eForth); setting the 'Target Type' automatically sets the 'Newline Mode'.\r\n\r\n",
           "'Reboot' when a target type of 'zeptoforth' is selected sends Control-C to the microcontroller in an attempt to reboot it; this may or may not be successful, depending on the state of the microcontroller, but does not require the console to be listened to by the microcontroller.\r\n\r\n",
           "'Attention' when a target type of 'zeptoforth' is selected sends Control-T to the microcontroller to put it into an 'attention' state; it then listens for a character to be sent to carry out some action, even when the console is not being actively listened to by the microcontroller. The only command currently is 'z', which sends an exception to the main task in an attempt to return control to the REPL.\r\n\r\n",
	   "'Save Terminal' exactly saves the contents of the terminal to selected file. No attempt is made to convert newlines to the local newline settings.\r\n\r\n",
	   "'Save Edit' saves the contents of the edit area to a selected file. The newlines are converted to the newline format selected in 'Save Edit Format'.\r\n\r\n",
	   "'Append File' selects a file to append to the edit area.\r\n\r\n",
	   "'Expand Includes' expands all the '#include' and '#symbols' lines in the edit area and any files included by files so included.\r\n\r\n",
	   "'Set Working Directory' selects a working directory for use by '#include' and '#symbols'. Note that if '#include' or '#symbols' are invoked at any time without a working directory being set, the user will be queried to select a working directory.\r\n\r\n",
	   "Lines containing '#include' followed by a path relative to the working directory will be included in uploads; these lines can be present at the REPLline , in code uploaded from the edit area, and from within included files.\r\n\r\n",
	   "Lines containing '#symbols' followed by a path relative to the working directory will specify symbol files to be applied to uploads; these lines can be preset in the edit area and from within included files.\r\n\r\n",
	   "Global symbols are applied to all uploaded to the target, whether from the REPL line, the edit area, or included files; note that subsequent '#symbols' lines temporarily override global symbols within the context in which they are specified.\r\n\r\n",
	   "Symbol files consist of symbol replacement pairs separated by whitespace. They may also contain '\\' comments and '#include' lines.\r\n\r\n",
	   "'Strip Code', when selected, automatically removes whitespace and line comments, when possible, from uploaded code.\r\n\r\n",
	   "'Timeout', when selected, specifies a per-line timeout in milliseconds where if while uploading multiple lines of code the timeout for that line expires, upload will be automatically interrupted.\r\n",
	   "\r\n"];
    for(const line of helpLines) {
	infoMsg(currentTermTab, line);
    }
}

function license() {
    const licenseLines =
	  ["\r\n",
	   "License\r\n",
	   "\r\n",
	   "Copyright (c) 2022-2023 Travis Bemann\r\n",
	   "\r\n",
	   "Permission is hereby granted, free of charge, to any person obtaining a copy\r\n",
	   "of this software and associated documentation files (the \"Software\"), to deal\r\n",
	   "in the Software without restriction, including without limitation the rights\r\n",
	   "to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\r\n",
	   "copies of the Software, and to permit persons to whom the Software is\r\n",
	   "furnished to do so, subject to the following conditions:\r\n",
	   "\r\n",
	   "The above copyright notice and this permission notice shall be included in all\r\n",
	   "copies or substantial portions of the Software.\r\n",
	   "\r\n",
	   "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\r\n",
	   "IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\r\n",
	   "FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\r\n",
	   "AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\r\n",
	   "LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\r\n",
	   "OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\r\n",
	   "SOFTWARE.\r\n",
	   "\r\n"
	  ];
    for(const line of licenseLines) {
	infoMsg(currentTermTab, line);
    }
}

function populateArea() {
    const area = document.getElementById(currentEditId('Area'));
    area.value =
	["\\ Put your Forth code to upload here.",
	 "\\ ",
	 "\\ Clicking 'Send' without a selection will upload the contents of this area to the target.",
	 "\\ ",
	 "\\ Clicking 'Send' with a selection will upload just the selection to the target.",
	 "",
	 ""].join('\r\n');
}

function inputAreaEnter() {
    const area = document.getElementById(currentEditId('Area'));
    const { start, end } = getCursorPos(area);
    const startString = area.value.substring(0, start);
    let indentIndex = start;
    let startIndex = start;
    for(let i = start - 1; i >= 0; i--) {
	if(startString[i] === '\n') {
	    startIndex = i + 1;
	    break;
	}
	if(startString[i] !== ' ' && startString[i] !== '\t') {
	    indentIndex = i;
	}
	if(i === 0) {
	    startIndex = 0;
	}
    }
    const indentString = startString.substring(startIndex, indentIndex);
    area.focus();
    document.execCommand('insertText', false, '\n' + indentString);
    editTabChanged();
}

function insertIndent(area, start) {
    const startString = area.value.substring(0, start);
    let indentIndex = start;
    let startIndex = start;
    for(let i = start - 1; i >= 0; i--) {
	if(startString[i] === '\n') {
	    startIndex = i + 1;
	    break;
	}
	if(i === 0) {
	    startIndex = 0;
	}
    }
    let indentCount = 2 - ((indentIndex - startIndex) % 2);
    const indentString = indentCount == 1 ? ' ' : '  ';
    area.focus();
    document.execCommand('insertText', false, indentString);
    editTabChanged();
}

function indentRegion(area, start, end) {
    const startString = area.value.substring(0, start);
    let indentIndex = start;
    let startIndex = start;
    for(let i = start - 1; i >= 0; i--) {
	if(startString[i] === '\n') {
	    startIndex = i + 1;
	    break;
	}
	if(i === 0) {
	    startIndex = 0;
	}
    }
    area.focus();
    area.setSelectionRange(startIndex, end);
    const part = area.value.substring(startIndex, end);
    const lines = part.split(/\r?\n/).map(line => '  ' + line);
    document.execCommand('insertText', false, lines.join('\n'));
    area.setSelectionRange(start + 2,
			   end + (lines.length * 2));
    editTabChanged();
}

function inputAreaTab() {
    const area = document.getElementById(currentEditId('Area'));
    const { start, end } = getCursorPos(area);
    if(start == end) {
	insertIndent(area, start);
    } else {
	indentRegion(area, start, end);
    }
}

async function sendArea() {
    const area = document.getElementById(currentEditId('Area'));
    const { start, end } = getCursorPos(area);
    if(start !== end) {
	await writeText(currentTermTab, area.value.substring(start, end));
    } else {
	await writeText(currentTermTab, area.value);
    }
}

async function newTermTab(title) {
    if(currentTermTab) {
	saveConnectParams(currentTermTab);
    }
    const tabButtonId = 'termTab' + termTabCount + 'Button';
    const tabButton = document.createElement('div');
    tabButton.id = tabButtonId;
    tabButton.dataset.id = termTabCount;
    const tabLabel = document.createElement('label');
    const tabTitle = document.createTextNode(title);
    tabLabel.id = 'termTab' + termTabCount + 'Label';
    tabLabel.dataset.id = termTabCount;
    tabLabel.appendChild(tabTitle);
    tabButton.appendChild(tabLabel);
    tabButton.appendChild(document.createTextNode('  '));
    const tabRemoveLabel = document.createElement('label');
    const tabRemoveTitle = document.createTextNode('x');
    tabRemoveLabel.appendChild(tabRemoveTitle);
    tabButton.appendChild(tabRemoveLabel);
    const currentTermTabCount = termTabCount;
    const termTabHeaderDiv = document.getElementById('termTabHeader');
    tabButton.classList.add('tab');
    const addTermTabDiv = document.getElementById('addTermTab');
    termTabHeaderDiv.insertBefore(tabButton, addTermTabDiv);
    const termTabPanel = document.createElement('div');
    termTabPanel.id = 'termTab' + termTabCount;
    termTabPanel.classList.add('tab-panel');
    const terminalPane = document.createElement('div');
    terminalPane.id = 'termTab' + termTabCount + 'Term';
    terminalPane.name = 'termTab' + termTabCount + 'Term';
    terminalPane.style.width = '100%';
    terminalPane.style.flexGrow = 1;
    termTabPanel.appendChild(terminalPane);
    const termTabBodyDiv = document.getElementById('termTabBody');
    termTabBodyDiv.appendChild(termTabPanel);
    currentTermTab = 'termTab' + termTabCount;
    termTabCount++;
    tabButton.addEventListener('click', termTabClick);
    for(const termTab of termTabs) {
	const tabButtonId = '#termTab' + termTab.tabId + 'Button';
	const tabButton = document.querySelector(tabButtonId);
	const tabId = '#termTab' + termTab.tabId;
	const tab = document.querySelector(tabId);
	tabButton.classList.remove('tab-selected');
	tab.classList.add('tab-hidden');
    }
    document.querySelector('#termTab' + currentTermTabCount)
	.classList.remove('tab-hidden');
    tabButton.classList.add('tab-selected');
    const term = new Terminal();
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    const newTermTab = {
	tabId: currentTermTabCount,
	ackCount: 0,
	nakCount: 0,
	interruptCount: 0,
        rebootCount: 0,
        attentionCount: 0,
	lostCount: 0,
	workingDir: null,
	term: term,
	fitAddon: fitAddon,
	port: null,
	okCount: 0,
        compileOnlyCount: 0,
        unknownCount: 0,
        lineLeft: 0,
	currentData: [],
	triggerClose: false,
	triggerAbort: false,
	portReader: null,
	portWriter: null,
	sending: null,
	receiving: null,
        handleAck: async () => {},
        handleNak: async () => {},
        timeout: null
    };
    termTabs.push(newTermTab);
    currentTermTab = newTermTab;
    term.open(terminalPane);
    term.setOption('fontFamily', 'monospace');
    term.setOption('bellStyle', 'both');
    term.setOption('cursorStyle', 'block');
    await delay(0);
    fitAddon.fit();
    resizeObserver = new ResizeObserver(debounce(e => {
	if(newTermTab === currentTermTab) {
	    fitAddon.fit();
	}
    }));
    resizeObserver.observe(terminalPane, {});
    updateButtonEnable(newTermTab);
    tabRemoveLabel.addEventListener('click', event => {
	if(termTabs.length > 1) {
	    let nextTab = termTabs[0];
	    if(nextTab === newTermTab) {
		nextTab = termTabs[1];
	    }
	    for(const tab of termTabs) {
		if(tab === newTermTab) {
		    break;
		}
		nextTab = tab;
	    }
	    termTabs = termTabs.filter(tab => tab !== newTermTab);
	    tabButton.remove();
	    termTabPanel.remove();
	    for(const tab1 of termTabs) {
		const tabButtonId = '#termTab' + tab1.tabId + 'Button';
		const tabButton = document.querySelector(tabButtonId);
		const tabId = '#termTab' + tab1.tabId;
		const tab = document.querySelector(tabId);
		tabButton.classList.remove('tab-selected');
		tab.classList.add('tab-hidden');
	    }
	    document.querySelector('#termTab' + nextTab.tabId)
		.classList.remove('tab-hidden');
	    document.querySelector('#termTab' + nextTab.tabId + 'Button')
		.classList.add('tab-selected');
	    currentTermTab = nextTab;
	    foreTermTabUpdate(currentTermTab);
	    setTimeout(async () => {
		await disconnect(newTermTab);
		term.dispose();
		resizeObserver.disconnect();
	    }, 0);
            updateButtonEnable(currentTermTab);
	}
	event.stopPropagation();
	event.preventDefault();
    });
}

async function newEditTab(title, content = null) {
    const tabButtonId = 'editTab' + editTabCount + 'Button';
    const tabButton = document.createElement('div');
    tabButton.id = tabButtonId;
    tabButton.dataset.id = 'editTab' + editTabCount;
    const tabLabel = document.createElement('label');
    const tabTitle = document.createTextNode(title);
    tabLabel.id = 'editTab' + editTabCount + 'Label';
    tabLabel.dataset.id = 'editTab' + editTabCount;
    editTabFileName.set('editTab' + editTabCount, null);
    editTabOrigName.set('editTab' + editTabCount, title);
    tabLabel.appendChild(tabTitle);
    tabButton.appendChild(tabLabel);
    tabButton.appendChild(document.createTextNode('  '));
    const tabRemoveLabel = document.createElement('label');
    const tabRemoveTitle = document.createTextNode('x');
    tabRemoveLabel.appendChild(tabRemoveTitle);
    tabButton.appendChild(tabRemoveLabel);
    const currentEditTabCount = editTabCount;
    const editTabHeaderDiv = document.getElementById('editTabHeader');
    tabButton.classList.add('tab');
    const addEditTabDiv = document.getElementById('addEditTab');
    editTabHeaderDiv.insertBefore(tabButton, addEditTabDiv);
    const editTabPanel = document.createElement('div');
    editTabPanel.id = 'editTab' + editTabCount;
    editTabPanel.classList.add('tab-panel');
    const tabArea = document.createElement('textarea');
    tabArea.id = 'editTab' + editTabCount + 'Area';
    tabArea.name = 'editTab' + editTabCount + 'Area';
    tabArea.spellcheck = false;
    if(content) {
        tabArea.value = content;
    }
    tabArea.style.width = '100%';
    tabArea.style.fontFamily = 'monospace';
    tabArea.style.backgroundColor = '#444444';
    tabArea.style.color = '#FFFFFF';
    tabArea.style.flexGrow = 1;
    tabArea.addEventListener('keypress', event => {
	if(event.key === 'Enter') {
	    inputAreaEnter();
	    event.preventDefault();
	    event.stopPropagation();
	}
    });
    tabArea.addEventListener('keydown', event => {
	if(event.key === 'Tab') {
	    inputAreaTab();
	    event.preventDefault();
	    event.stopPropagation();
	}
    });
    tabArea.addEventListener('blur', event => {
	currentSelection.set(tabArea.id, {
	    start: tabArea.selectionStart,
	    end: tabArea.selectionEnd
	});
    });
    tabArea.addEventListener('focus', event => {
	if(currentSelection.has(tabArea.id)) {
	    const selection = currentSelection.get(tabArea.id);
	    tabArea.selectionStart = selection.start;
	    tabArea.selectionEnd = selection.end;
	}
    });
    tabArea.addEventListener('input', event => {
	editTabChanged();
    });
    editTabPanel.appendChild(tabArea);
    const editTabBodyDiv = document.getElementById('editTabBody');
    editTabBodyDiv.appendChild(editTabPanel);
    currentEditTab = 'editTab' + editTabCount;
    editTabs.push(editTabCount);
    editTabCount++;
    tabButton.addEventListener('click', editTabClick);
    for(const i of editTabs) {
	const tabButtonId = '#editTab' + i + 'Button';
	const tabButton = document.querySelector(tabButtonId);
	const tabId = '#editTab' + i;
	const tab = document.querySelector(tabId);
	const tabArea = document.querySelector(tabId + 'Area');
	tabButton.classList.remove('tab-selected');
	tab.classList.add('tab-hidden');
    }
    document.querySelector('#editTab' + currentEditTabCount)
	.classList.remove('tab-hidden');
    tabButton.classList.add('tab-selected');
    tabRemoveLabel.addEventListener('click', event => {
	if(editTabs.length > 1) {
	    let nextTab = editTabs[0];
	    if(nextTab === currentEditTabCount) {
		nextTab = editTabs[1];
	    }
	    for(const tab of editTabs) {
		if(tab === currentEditTabCount) {
		    break;
		}
		nextTab = tab;
	    }
	    editTabs = editTabs.filter(tab => tab !== currentEditTabCount);
	    tabButton.remove();
	    editTabPanel.remove();
	    for(const i of editTabs) {
		const tabButtonId = '#editTab' + i + 'Button';
		const tabButton = document.querySelector(tabButtonId);
		const tabId = '#editTab' + i;
		const tab = document.querySelector(tabId);
		const tabArea = document.querySelector(tabId + 'Area');
		tabButton.classList.remove('tab-selected');
		tab.classList.add('tab-hidden');
	    }
	    document.querySelector('#editTab' + nextTab)
		.classList.remove('tab-hidden');
	    document.querySelector('#editTab' + nextTab + 'Button')
		.classList.add('tab-selected');
	    currentEditTab = 'editTab' + nextTab;	    
	}
        tabArea.selectionStart = 0;
        tabArea.selectionEnd = tabArea.value.length;
        currentSelection.set(tabArea.id, {
	    start: tabArea.selectionStart,
	    end: tabArea.selectionEnd
        });
	event.stopPropagation();
	event.preventDefault();
    });
}

function historyPrev() {
    const lineInput = document.getElementById('line');
    if(history.length > 0) {
	currentHistoryIdx =
	    Math.min(currentHistoryIdx + 1, history.length - 1);
	lineInput.value = history[currentHistoryIdx];
	const end = lineInput.value.length;
	lineInput.setSelectionRange(end, end);
    }
}

function historyNext() {
    const lineInput = document.getElementById('line');
    if(history.length > 0) {
	currentHistoryIdx =
	    Math.max(currentHistoryIdx - 1, -1);
	if(currentHistoryIdx > -1) {
	    lineInput.value = history[currentHistoryIdx];
	} else {
	    lineInput.value = '';
	}
	const end = lineInput.value.length;
	lineInput.setSelectionRange(end, end);
    }
}

function tabComplete() {
    const lineInput = document.getElementById('line');
    let selectionStart = lineInput.selectionStart;
    if(selectionStart === lineInput.selectionEnd) {
        while(selectionStart) {
            const current = lineInput.value[selectionStart - 1];
            if(current === ' ' || current === '\t' ||
               current === '\n' || current === '\r') {
                break;
            } else {
                selectionStart--;
            }
        }
    }
    if(selectionStart === lineInput.selectionEnd) {
        return;
    }
    const textToComplete =
          lineInput.value.substring(selectionStart,
                                    lineInput.selectionEnd);
    const completedText = completeWordHistory(textToComplete);
    const beforeText =
          lineInput.value.substring(0, selectionStart);
    const afterText =
          lineInput.value.substring(lineInput.selectionEnd);
    const newCursorIndex =
          selectionStart + completedText.length;
    const oldSelectionStart = lineInput.selectionStart;
    const oldSelectionEnd = lineInput.selectionEnd;
    lineInput.value = beforeText + completedText + afterText;
    if(oldSelectionStart === oldSelectionEnd) {
        lineInput.setSelectionRange(newCursorIndex, newCursorIndex);
    } else {
        lineInput.setSelectionRange(oldSelectionStart, newCursorIndex);
    }
}

function populateCode(path, map, callback) {
    const req = new XMLHttpRequest();
    req.addEventListener("load", () => {
        const lines = req.responseText.split(/\r?\n/);
        for(const line of lines) {
            const parts = line.trim().split(/\\\s/, 1)[0].split(/\s+/);
            if(parts.length >= 3) {
                const platform = parts[0].trim();
                const path = parts[1].trim();
                const title = parts.slice(2).join(' ');
                if(map.has(platform)) {
                    map.get(platform).push([title, path]);
                } else {
                    entries = [[title, path]];
                    map.set(platform, entries);
                }
            }
        }
        callback();
    });
    req.addEventListener("error", () => {});
    req.addEventListener("abort", () => {});
    req.open('GET', path)
    req.send();
}

function populateExamples() {
    populateCode('examples/list.txt', exampleMap,
                 () => updateExamples('zeptoforth'));
}

function populateLibraries() {
    populateCode('lib/list.txt', libraryMap,
                 () => updateLibraries('zeptoforth'));
}

function loadCode(title, path) {
    const req = new XMLHttpRequest();
    req.addEventListener("load", () => {
        newEditTab(title, req.responseText);
    });
    req.addEventListener("error", () => {});
    req.addEventListener("abort", () => {});
    req.open('GET', path);
    req.send();
}

async function startTerminal() {
    populateExamples();
    populateLibraries();
    const baudSelect = document.getElementById('baud');
    for(let i = 0; i < baudSelect.options.length; i++) {
	if(baudSelect.options[i].value == '115200') {
	    baudSelect.selectedIndex = i;
	    break;
	}
    }
    const targetTypeSelect = document.getElementById('targetType');
    targetTypeSelect.selectedIndex = 0;
    targetTypeSelect.addEventListener('change', event => {
	saveConnectParams(currentTermTab);
    });
    const newlineModeSelect = document.getElementById('newlineMode');
    newlineModeSelect.selectedIndex = 0;
    newlineModeSelect.addEventListener('change', event => {
	saveConnectParams(currentTermTab);
    });
    const dataBitsSelect = document.getElementById('dataBits');
    dataBitsSelect.selectedIndex = 0;
    dataBitsSelect.addEventListener('change', event => {
	saveConnectParams(currentTermTab);
    });
    const stopBitsSelect = document.getElementById('stopBits');
    stopBitsSelect.selectedIndex = 0;
    stopBitsSelect.addEventListener('change', event => {
	saveConnectParams(currentTermTab);
    });
    const paritySelect = document.getElementById('parity');
    paritySelect.selectedIndex = 0;
    paritySelect.addEventListener('change', event => {
	saveConnectParams(currentTermTab);
    });
    const flowControlSelect = document .getElementById('flowControl');
    flowControlSelect.selectedIndex = 0;
    flowControlSelect.addEventListener('change', event => {
	saveConnectParams(currentTermTab);
    });
    const saveFormatSelect = document.getElementById('saveFormat');
    saveFormatSelect.selectedIndex = 1;
    targetTypeSelect.addEventListener('change', () => {
	if(targetTypeSelect.value === 'mecrisp' ||
	   targetTypeSelect.value === 'stm8eforth') {
	    newlineMode.selectedIndex = 1;
	} else if(targetTypeSelect.value === 'zeptoforth' ||
		  targetTypeSelect.value === 'esp32forth' ||
                  targetTypeSelect.value === 'flashforth') {
	    newlineMode.selectedIndex = 0;
	}
    });
    const clearTerminalButton = document.getElementById('clearTerminal');
    clearTerminalButton.addEventListener('click', () => {
	currentTermTab.term.clear();
	currentTermTab.term.reset();
	currentTermTab.currentData = [];
    });
    const saveTerminalButton = document.getElementById('saveTerminal');
    saveTerminalButton.addEventListener('click', async () => {
	await saveTerminal(currentTermTab);
    });
    const saveEditButton = document.getElementById('saveEdit');
    saveEditButton.addEventListener('click', async () => {
	await saveEdit();
    });
    const connectButton = document.getElementById('connect');
    connectButton.addEventListener('click', async () => {
	try {
	    await connect(currentTermTab);
	} catch(e) {
	}
    });
    const disconnectButton = document.getElementById('disconnect');
    disconnectButton.addEventListener('click', async () => {
	await disconnect(currentTermTab);
    });
    const clearButton = document.getElementById('clear');
    clearButton.addEventListener('click', () => {
	try {
	    clearArea();
	} catch(e) {
	}
    });
    const appendFileButton = document.getElementById('appendFile');
    appendFileButton.addEventListener('click', () => {
	try {
	    appendFile();
	} catch(e) {
	}
    });
    const expandIncludesButton = document.getElementById('expandIncludes');
    expandIncludesButton.addEventListener('click', () => {
	try {
	    expandIncludes();
	} catch(e) {
	}
    });
    const setWorkingDirButton = document.getElementById('setWorkingDir');
    setWorkingDirButton.addEventListener('click', async () => {
	await selectWorkingDir();
    });
    const setGlobalSymbolsButton = document.getElementById('setGlobalSymbols');
    setGlobalSymbolsButton.addEventListener('click', () => {
	try {
	    setGlobalSymbols();
	} catch(e) {
	}
    });
    const clearGlobalSymbolsButton =
	  document.getElementById('clearGlobalSymbols');
    clearGlobalSymbolsButton.addEventListener('click', () => {
	globalSymbols = new Map();
	infoMsg('Global symbols cleared\r\n');
    });
    const helpButton = document.getElementById('help');
    helpButton.addEventListener('click', () => {
	help();
    });
    const licenseButton = document.getElementById('license');
    licenseButton.addEventListener('click', () => {
	license();
    });
    const lineInput = document.getElementById('line');
    const historyDropdown = document.getElementById('history');
    historyDropdown.addEventListener('change', () => {
	currentHistoryIdx = historyDropdown.selectedIndex;
	lineInput.value = historyDropdown.value;
	historyDropdown.selectedIndex = -1;
    });
    document.addEventListener('keydown', async event => {
	if(event.key == 'q' &&
	   event.ctrlKey &&
	   !event.shiftKey &&
	   !event.metaKey &&
	   !event.altKey &&
	   currentTermTab.port != null) {
	    await interrupt(currentTermTab);
	}
    });
    const interruptButton = document.getElementById('interrupt');
    interruptButton.addEventListener('click', async event => {
	if(currentTermTab.port) {
	    await interrupt(currentTermTab);
	}
    });
    const rebootButton = document.getElementById('reboot');
    rebootButton.addEventListener('click', async event => {
        if(currentTermTab.port && currentTermTab.targetType === 'zeptoforth') {
            await reboot(currentTermTab);
        }
    });
    const attentionButton = document.getElementById('attention');
    attentionButton.addEventListener('click', async event => {
        if(currentTermTab.port && currentTermTab.targetType === 'zeptoforth') {
            await attention(currentTermTab);
        }
    });
    const promptButton = document.getElementById('prompt');
    promptButton.addEventListener('click', event => {
	if(currentTermTab.port) {
	    sendEntry();
	}
    });
    lineInput.addEventListener('keyup', event => {
	if(event.key === 'Enter') {
	    if(currentTermTab.port) {
		sendEntry();
	    }
	}
    });
    lineInput.addEventListener('keydown', event => {
	if(event.key === 'ArrowUp') {
            historyPrev();
            event.preventDefault();
            event.stopPropagation();
	} else if(event.key === 'ArrowDown') {
            historyNext();
            event.preventDefault();
            event.stopPropagation();
	} else if(event.key === 'Tab') {
            tabComplete();
            event.preventDefault();
            event.stopPropagation();
        }
    });
    const sendButton = document.getElementById('send');
    sendButton.addEventListener('click', event => {
	if(currentTermTab.port) {
	    sendArea();
	}
    });
    const sendFileButton = document.getElementById('sendFile');
    sendFileButton.addEventListener('click', event => {
	if(currentTermTab.port) {
	    sendFile();
	}
    });
    await newTermTab('Terminal 1');
    newEditTab('Edit 1');
    populateArea();
    const addTermTabDiv = document.getElementById('addTermTab');
    addTermTabDiv.addEventListener('click', event => {
	newTermTab('Terminal ' + (termTabCount + 1));
    });
    const addEditTabDiv = document.getElementById('addEditTab');
    addEditTabDiv.addEventListener('click', event => {
	newEditTab('Edit ' + (editTabCount + 1));
    });
    const examplesDropdown = document.getElementById('examples');
    examplesDropdown.addEventListener('change', () => {
        const selectedIndex = examplesDropdown.selectedIndex;
        const title = examplesDropdown.options[selectedIndex].text;
        const path = examplesDropdown.options[selectedIndex].value;
        loadCode(title, path);
	examplesDropdown.selectedIndex = -1;
    });
    const librariesDropdown = document.getElementById('libraries');
    librariesDropdown.addEventListener('change', () => {
        const selectedIndex = librariesDropdown.selectedIndex;
        const title = librariesDropdown.options[selectedIndex].text;
        const path = librariesDropdown.options[selectedIndex].value;
        loadCode(title, path);
	librariesDropdown.selectedIndex = -1;
    });
    infoMsg(currentTermTab, 'Welcome to zeptocom.js\r\n')
    infoMsg(currentTermTab, 'Copyright (c) 2022 Travis Bemann\r\n');
    infoMsg(currentTermTab,
	    'zeptocom.js comes with ABSOLUTELY NO WARRANTY: ' +
	    'it is licensed under the terms of the MIT license.\r\n');
}

