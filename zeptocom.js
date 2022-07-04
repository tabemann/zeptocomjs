// import * as xterm from './node_modules/xterm/lib/xterm.js';
// import * as addonFit from './node_modules/xterm-addon-fit/lib/xterm-addon-fit.js';

let ackCount = 0;
let nakCount = 0;
let interruptCount = 0;
let workingDir = null;
let term = null;
let port = null;
let history = [];
let currentHistoryIdx = 0;
let mecrispOkCount = 0;
let globalSymbols = new Map();
let currentData = [];
let triggerClose = false;
let triggerAbort = false;
let portReader = null;
let portWriter = null;
let sending = null;
let receiving = null;

function writeTerm(data) {
    term.write(data);
    currentData.push(data);
}

function delay(ms) {
    return new Promise(resolve => {
        setTimeout(() => { resolve('') }, ms);
    })
}

function getTargetType() {
    const targetTypeSelect = document.getElementById('targetType');
    return targetTypeSelect.value;
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

function errorMsg(msg) {
    writeTerm('\x1B[31;1m' + msg + '\x1B[0m');
}

function infoMsg(msg) {
    writeTerm('\x1B[33;1m' + msg + '\x1B[0m');
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
		errorMsg('Canceled\r\n');
		return null;
	    }
	    const file = await getFile(parts[1].trim().split(/\//),
				       [workingDir]);
	    if(!file) {
		errorMsg(parts[1].trim() + ': file not found\r\n');
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
		errorMsg('Canceled\r\n');
		return null;
	    }
	    const file = await getFile(parts[1].trim().split(/\//),
				       [workingDir])
	    if(!file) {
		errorMsg(parts[1].trim() + ': file not found\r\n');
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

async function writeLine(line) {
    const encoder = new TextEncoder();
    line = line + '\r';
    while(portWriter && line.length > 128) {
	await portWriter.write(encoder.encode(line.substring(0, 128)));
	await delay(20);
	line = line.substring(128);
    }
    if(portWriter && line.length) {
	await portWriter.write(encoder.encode(line));
    }
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

async function writeText(text) {
    sending = true;
    const sendButton = document.getElementById('send');
    const promptButton = document.getElementById('prompt');
    const interruptButton = document.getElementById('interrupt');
    const timeoutCheckbox = document.getElementById('timeout');
    const timeoutEnabled = timeoutCheckbox.checked;
    const timeoutMsInput = document.getElementById('timeoutMs');
    const timeoutMs = timeoutMsInput.value;
    sendButton.disabled = true;
    promptButton.disabled = true;
    let lines = await expandLines(text.split(/\r?\n/),
				  [globalSymbols, new Map()]);
    if(!lines) {
	sendButton.disabled = false;
	promptButton.disabled = false;
	sending = false;
	triggerAbort = false;
	return;
    }
    stripCheckbox = document.getElementById('strip');
    if(stripCheckbox.checked) {
	lines = stripCode(lines);
    }
    let currentAckCount = ackCount;
    let currentNakCount = nakCount;
    let currentInterruptCount = interruptCount;
    interruptButton.disabled = false;
    for(const line of lines) {
	if(triggerAbort) {
	    if(portWriter) {
		portWriter.releaseLock();
		portWriter = null;
	    }
	    break;
	}
	portWriter = port.writable.getWriter();
	try {
	    await writeLine(line);
	    if(lines.length > 1) {
		let timedOut = false;
		let myTimeout;
		if(timeoutEnabled) {
		    myTimeout = setTimeout(() => {
			timedOut = true;
		    }, timeoutMs);
		}
		while(ackCount === currentAckCount &&
		      nakCount === currentNakCount &&
		      interruptCount === currentInterruptCount &&
		      !timedOut) {
		    await delay(0);
		}
		currentAckCount = ackCount;
		if(interruptCount !== currentInterruptCount) {
		    errorMsg('Interrupted\r\n');
		    break;
		}
		if(timedOut) {
		    errorMsg('Timed out\r\n');
		    break;
		}
		if(nakCount !== currentNakCount) {
		    break;
		}
		if(timeoutEnabled) {
		    clearTimeout(myTimeout);
		}
	    }
	} catch(error) {
	} finally {
	    if(portWriter) {
		portWriter.releaseLock();
		portWriter = null;
	    }
	}
    }
    triggerAbort = false;
    sendButton.disabled = false;
    promptButton.disabled = false;
    interruptButton.disabled = true;
    sending = false;
}

async function clearArea() {
    const area = document.getElementById('area');
    area.value = '';
}

async function appendFile() {
    const fileHandles = await window.showOpenFilePicker({});
    if(fileHandles.length !== 1) {
	return;
    }
    const file = await fileHandles[0].getFile();
    const fileLines = await slurpFile(file);
    const area = document.getElementById('area');
    const areaLines = area.value.split(/\r?\n/);
    area.value = areaLines.concat(fileLines).join('\n');
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
    infoMsg('New global symbols loaded\r\n');
}

async function saveTerminal() {
    try {
	const fileHandle = await window.showSaveFilePicker({});
	const writable = await fileHandle.createWritable();
	for(const item of currentData) {
	    await writable.write(item);
	}
	await writable.close();
    } catch(e) {
    }
}

async function saveEdit() {
    try {
	const fileHandle = await window.showSaveFilePicker({});
	const area = document.getElementById('area');
	const writable = await fileHandle.createWritable();
	await writable.write(area.value);
	await writable.close();
    } catch(e) {
    }
}

async function expandIncludes() {
    const area = document.getElementById('area');
    const lines = await expandLines(area.value.split(/\r?\n/), [new Map()]);
    if(!lines) {
	return;
    }
    area.value = lines.join('\n');
}

function addToHistory(line) {
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
	await writeText(lineInput.value);
	lineInput.value = '';
    }
}

function interrupt() {
    interruptCount++;
}

async function connect() {
    const baudSelect = document.getElementById('baud');
    const dataBitsSelect = document.getElementById('dataBits');
    const stopBitsSelect = document.getElementById('stopBits');
    const paritySelect = document.getElementById('parity');
    const flowControlSelect = document.getElementById('flowControl');
    const newlineModeSelect = document.getElementById('newlineMode');
    port = await navigator.serial.requestPort({ filters: [] });
    await port.open({ bufferSize: 65535,
		      baudRate: parseInt(baudSelect.value),
		      dataBits: parseInt(dataBitsSelect.value),
		      stopBits: parseInt(stopBitsSelect.value),
		      parity: paritySelect.value,
		      flowControlSelect: flowControlSelect.value });
    const connectButton = document.getElementById('connect');
    connectButton.disabled = true;
    baudSelect.disabled = true;
    dataBitsSelect.disabled = true;
    stopBitsSelect.disabled = true;
    paritySelect.disabled = true;
    flowControlSelect.disabled = true;
    const sendButton = document.getElementById('send');
    const promptButton = document.getElementById('prompt');
    sendButton.disabled = false;
    promptButton.disabled = false;
    document.addEventListener('keydown', event => {
	if(event.key == 'q' &&
	   event.ctrlKey &&
	   !event.shiftKey &&
	   !event.metaKey &&
	   !event.altKey &&
	   port != null) {
	    interrupt();
	}
    });
    const disconnectButton = document.getElementById('disconnect');
    disconnectButton.disabled = false;
    infoMsg('Connected\r\n');
    while (!triggerClose && port.readable) {
	receiving = true;
	portReader = port.readable.getReader();
	try {
	    while (portReader) {
		const { value, done } = await portReader.read();
		if (done) {
		    break;
		}
		let fixedValue = [];
		if(getTargetType() === 'zeptoforth') {
		    for(let i = 0; i < value.length; i++) {
			if(value[i] === 0x06) {
			    ackCount++;
			}
			if(value[i] === 0x15) {
			    nakCount++;
			}
		    }
		}
		if(newlineMode.value === 'lf') {
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
		if(getTargetType() === 'mecrisp') {
		    for(let i = 0; i < fixedValue.length; i++) {
			if((fixedValue[i] === 0x20 &&
			    mecrispOkCount === 0) ||
			   (fixedValue[i] === 0x6F &&
			    mecrispOkCount === 1) ||
			   (fixedValue[i] === 0x6B &&
			    mecrispOkCount === 2) ||
			   (fixedValue[i] === 0x2E &&
			    mecrispOkCount === 3)) {
			    mecrispOkCount++;
			} else if(fixedValue[i] === 0x20 &&
				  mecrispOkCount === 1) {
			} else if((fixedValue[i] === 0x0D ||
				   fixedValue[i] === 0x0A) &&
				  mecrispOkCount === 4) {
			    ackCount++;
			    mecrispOkCount = 0;
			} else {
			    mecrispOkCount = 0;
			}
		    }
		}
		writeTerm(fixedValue);
		term.scrollToBottom();
	    }
	} finally {
	    if(portReader) {
		portReader.releaseLock();
		portReader = null;
	    }
	}
    }
    triggerClose = false;
    receiving = false;
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

async function disconnect() {
    const sendButton = document.getElementById('send');
    const promptButton = document.getElementById('prompt');
    const interruptButton = document.getElementById('interrupt');
    const disconnectButton = document.getElementById('disconnect');
    sendButton.disabled = true;
    promptButton.disabled = true;
    interruptButton.disabled = true;
    disconnectButton.disabled = true;
    interruptCount++;
    const isSending = sending;
    const isReceiving = receiving;
    triggerClose = true;
    triggerAbort = true;
    if(portReader) {
	await portReader.cancel();
	if(portReader) {
	    portReader.releaseLock();
	    portReader = null;
	}
    }
    port.readable.cancel();
    if(portWriter) {
	await portWriter.abort();
	if(portWriter) {
	    portWriter.releaseLock();
	    portWriter = null;
	}
    }
    port.writable.abort();
    while(isSending && triggerAbort) {
	await delay(10);
    }
    while(isReceiving && triggerClose) {
	await delay(10);
    }
    port.close();
    port = null;
    triggerAbort = false;
    triggerClose = false;
    const connectButton = document.getElementById('connect');
    const baudSelect = document.getElementById('baud');
    const dataBitsSelect = document.getElementById('dataBits');
    const stopBitsSelect = document.getElementById('stopBits');
    const paritySelect = document.getElementById('parity');
    const flowControlSelect = document.getElementById('flowControl');
    connectButton.disabled = false;
    baudSelect.disabled = false;
    dataBitsSelect.disabled = false;
    stopBitsSelect.disabled = false;
    paritySelect.disabled = false;
    flowControlSelect.disabled = false;
    infoMsg('Disconnected\r\n');
}

function help() {
    const helpLines =
	  ["\r\n",
	   "Help\r\n",
	   "\r\n",
	   "Enter at the REPL line or '>>>' uploads the contents of the REPL line to the target. 'Send' uploades the contents of the edit area to the target. 'Interrupt' or Control-Q interrupts the current upload to the target. 'Clear' clears the contents of the edit area.\r\n\r\n",
	   "Up and Down Arrow navigate the history of the REPL line, with the Up Arrow navigating to the next oldest entry in the history, and Down Arrow navigating to the next newest entry in the history.\r\n\r\n",
	   "'Connect' queries the user for a serial device to select, and if successful connects zeptocom.js to that serial device. 'Baud' specifies the baud rate, 'Data Bits' specifies the number of data bits, 'Stop Bits' specifies the number of stop bits, 'Parity' specifies the parity, and 'Flow Control' specifies the flow control to use; these must all be set prior to clicking 'Connect', and the defaults are good ones - in most cases one will not need any setting other than 115200 baud, 8 data bits, 1 stop bits, no parity, and no flow control.\r\n\r\n",
	   "'Disconnect' ends the connection with the current serial device, and interrupts any data transfer that may be currently on-going.\r\n\r\n",
	   "'Target Type' specifies the particular target type to support; the current options are 'zeptoforth' and 'Mecrisp'; note that proper selection of this option is necessary for proper functioning of zeptocom.js with a given target. 'Newline Mode' sets the newline mode to either CRLF (the default for zeptoforth) or LR (the default for Mecrisp); setting the 'Target Type' automatically sets the 'Newline Mode'.\r\n\r\n",
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
	infoMsg(line);
    }
}

function license() {
    const licenseLines =
	  ["\r\n",
	   "License\r\n",
	   "\r\n",
	   "Copyright (c) 2022 Travis Bemann\r\n",
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
	infoMsg(line);
    }
}

function populateArea() {
    const area = document.getElementById('area');
    area.value =
	["\\ Put your Forth code to upload here.",
	 "\\ ",
	 "\\ Clicking 'Send' will upload the contents of this area to the target.",
	 "",
	 ""].join('\r\n');
}

function getCursorPos(input) {
    if('selectionStart' in input && document.activeElement === input) {
        return {
            start: input.selectionStart,
            end: input.selectionEnd
        };
    } else if(input.createTextRange) {
        let sel = document.selection.createRange();
        if(sel.parentElement() === input) {
            let range = input.createTextRange();
            range.moveToBookmark(sel.getBookmark());
            for (let len = 0;
                     range.compareEndPoints("EndToStart", range) > 0;
                     range.moveEnd("character", -1)) {
                len++;
            }
            range.setEndPoint("StartToStart", input.createTextRange());
            for (let pos = { start: 0, end: len };
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

function inputAreaEnter() {
    const area = document.getElementById('area');
    const { start, end } = getCursorPos(area);
    const startString = area.value.substring(0, start);
    const endString = area.value.substring(end, area.value.length);
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
    area.value = startString + '\r\n' + indentString + endString;
    const finalIndex = start + (indentIndex - startIndex) + 2;
    setCursorPos(area, finalIndex, finalIndex);
}

function inputAreaTab() {
    const area = document.getElementById('area');
    const { start, end } = getCursorPos(area);
    const startString = area.value.substring(0, start);
    const endString = area.value.substring(end, area.value.length);
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
    area.value = startString + indentString + endString;
    const finalIndex = start + indentString.length;
    setCursorPos(area, finalIndex, finalIndex);
}

function startTerminal() {
    term = new Terminal();
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    terminalPane = document.getElementById('terminal');
    term.open(terminalPane);
    term.setOption('bellStyle', 'both');
    term.setOption('cursorStyle', 'block');
    infoMsg('Welcome to zeptocom.js\r\n')
    infoMsg('Copyright (c) 2022 Travis Bemann\r\n');
    infoMsg('zeptocom.js comes with ABSOLUTELY NO WARRANTY: ' +
	    'it is licensed under the terms of the MIT license.\r\n');
    populateArea();
    const baudSelect = document.getElementById('baud');
    for(let i = 0; i < baudSelect.options.length; i++) {
	if(baudSelect.options[i].value == '115200') {
	    baudSelect.selectedIndex = i;
	    break;
	}
    }
    const targetTypeSelect = document.getElementById('targetType');
    targetTypeSelect.selectedIndex = 0;
    const newlineModeSelect = document.getElementById('newlineMode');
    newlineModeSelect.selectedIndex = 0;
    const dataBitsSelect = document.getElementById('dataBits');
    dataBitsSelect.selectedIndex = 0;
    const stopBitsSelect = document.getElementById('stopBits');
    stopBitsSelect.selectedIndex = 0;
    const paritySelect = document.getElementById('parity');
    paritySelect.selectedIndex = 0;
    const flowControlSelect = document .getElementById('flowControl');
    flowControlSelect.selectedIndex = 0;
    targetTypeSelect.addEventListener('change', () => {
	if(targetTypeSelect.value === 'mecrisp') {
	    newlineMode.selectedIndex = 1;
	} else if(targetTypeSelect.value === 'zeptoforth') {
	    newlineMode.selectedIndex = 0;
	}
    });
    const clearTerminalButton = document.getElementById('clearTerminal');
    clearTerminalButton.addEventListener('click', () => {
	term.clear();
	term.reset();
	currentData = [];
    });
    const saveTerminalButton = document.getElementById('saveTerminal');
    saveTerminalButton.addEventListener('click', async () => {
	await saveTerminal();
    });
    const saveEditButton = document.getElementById('saveEdit');
    saveEditButton.addEventListener('click', async () => {
	await saveEdit();
    });
    const connectButton = document.getElementById('connect');
    connectButton.addEventListener('click', async () => {
	try {
	    await connect();
	} catch(e) {
	}
    });
    const disconnectButton = document.getElementById('disconnect');
    disconnectButton.addEventListener('click', async () => {
	await disconnect();
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
    document.addEventListener('keydown', event => {
	if(event.key == 'q' &&
	   event.ctrlKey &&
	   !event.shiftKey &&
	   !event.metaKey &&
	   !event.altKey &&
	   port != null) {
	    interrupt();
	}
    });
    const interruptButton = document.getElementById('interrupt');
    interruptButton.addEventListener('click', event => {
	if(port) {
	    interrupt();
	}
    });
    const promptButton = document.getElementById('prompt');
    promptButton.addEventListener('click', event => {
	if(port) {
	    sendEntry();
	}
    });
    lineInput.addEventListener('keyup', event => {
	if(port && event.key === 'Enter') {
	    sendEntry();
	}
    });
    lineInput.addEventListener('keydown', async event => {
	if(history.length > 0) {
	    if(event.key === 'ArrowUp') {
		currentHistoryIdx =
		    Math.min(currentHistoryIdx + 1, history.length - 1);
		lineInput.value = history[currentHistoryIdx];
		const end = lineInput.value.length;
		lineInput.setSelectionRange(end, end);
		lineInput.focus();
	    } else if(event.key === 'ArrowDown') {
		currentHistoryIdx =
		    Math.max(currentHistoryIdx - 1, -1);
		if(currentHistoryIdx > -1) {
		    lineInput.value = history[currentHistoryIdx];
		} else {
		    lineInput.value = '';
		}
		const end = lineInput.value.length;
		lineInput.setSelectionRange(end, end);
		lineInput.focus();
	    }
	}
    });
    const area = document.getElementById('area');
    const sendButton = document.getElementById('send');
    sendButton.addEventListener('click', async () => {
	if(port) {
	    await writeText(area.value);
	}
    });
    area.addEventListener('keypress', async event => {
	if(event.key === 'Enter') {
	    inputAreaEnter();
	    event.preventDefault();
	}
    });
    area.addEventListener('keydown', async event => {
	if(event.key === 'Tab') {
	    inputAreaTab();
	    event.preventDefault();
	}
    });
    fitAddon.fit();
    resizeObserver = new ResizeObserver(debounce(e => {
	fitAddon.fit();
    }));
    resizeObserver.observe(terminalPane, {});
}

