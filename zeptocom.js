let ackCount = 0;
let nakCount = 0;
let interruptCount = 0;
let workingDir = null;
let term = null;
let history = [];
let currentHistoryIdx = 0;
let mecrispOkCount = 0;

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
		return await getFile(parts.slice(1), dirPath.slice(1));
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
    term.write('\x1B[31;1m' + msg + '\x1B[0m');
}

async function expandLines(lines) {
    let allLines = [];
    for (const line of lines) {
	const parts = line.trim().split(/\s+/, 2);
	if(parts.length > 1 && parts[0] === '#include') {
	    const workingDir = await getWorkingDir();
	    const file = await getFile(parts[1].trim().split(/\//),
				       [workingDir]);
	    if(!file) {
		errorMsg(parts[1].trim() + ': file not found\r\n');
		return null;
	    }
	    const fileLines = await slurpFile(file);
	    const expandedLines = await expandLines(fileLines);
	    if (!expandedLines) {
		return null;
	    }
	    allLines = allLines.concat(expandedLines);
	} else {
	    allLines.push(line);
	}
    }
    return allLines;
}

async function writeLine(writer, line) {
    const encoder = new TextEncoder();
    line = line + '\r';
    while(line.length > 128) {
	await writer.write(encoder.encode(line.substring(0, 128)));
	await delay(20);
	line = line.substring(128);
    }
    if(line.length) {
	await writer.write(encoder.encode(line));
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

async function writeText(port, text) {
    const sendButton = document.getElementById("send");
    sendButton.disabled = true;
    let lines = await expandLines(text.split(/\r?\n/));
    if(!lines) {
	return;
    }
    stripCheckbox = document.getElementById('strip');
    if(stripCheckbox.checked) {
	lines = stripCode(lines);
    }
    let currentAckCount = ackCount;
    let currentNakCount = nakCount;
    let currentInterruptCount = interruptCount;
    for(const line of lines) {
	const writer = port.writable.getWriter();
	try {
	    await writeLine(writer, line);
	    if(lines.length > 1) {
		while(ackCount === currentAckCount &&
		      nakCount === currentNakCount &&
		      interruptCount === currentInterruptCount) {
		    await delay(0);
		}
		currentAckCount = ackCount;
		if(interruptCount !== currentInterruptCount) {
		    errorMsg('Interrupted\r\n');
		    break;
		}
		if(nakCount !== currentNakCount) {
		    break;
		}
	    }
	} catch(error) {
	} finally {
	    writer.releaseLock();
	}
    }
    sendButton.disabled = false;
}

async function clearArea() {
    const area = document.getElementById("area");
    area.value = '';
}

async function appendFile() {
    const fileHandles = await window.showOpenFilePicker({});
    if(fileHandles.length !== 1) {
	return;
    }
    const file = await fileHandles[0].getFile();
    const fileLines = await slurpFile(file);
    const area = document.getElementById("area");
    const areaLines = await expandLines(area.value.split(/\r?\n/));
    area.value = areaLines.concat(fileLines).join('\n');
}

async function expandIncludes() {
    const area = document.getElementById("area");
    const lines = await expandLines(area.value.split(/\r?\n/));
    if(!lines) {
	return;
    }
    area.value = lines.join('\n');
}

function addToHistory(line) {
    if(currentHistoryIdx !== -1) {
	if(history[currentHistoryIdx] === line) {
	    history = [line].concat(history.slice(0, currentHistoryIdx))
		.concat(history.slice(currentHistoryIdx + 1));
	} else {
	    history.unshift(line);
	}
    } else {
	history.unshift(line);
    }
    currentHistoryIdx = -1;
}

async function getSerial(term) {
    const baudInput = document.getElementById("baud");
    if (!baudInput.value) {
	return;
    }
    const port = await navigator.serial.requestPort({ filters: [] });
    await port.open({ baudRate: baudInput.value });
    const connectButton = document.getElementById("connect");
    const baudLabel = document.getElementById("baudLabel");
    connectButton.disabled = true;
    baudInput.disabled = true;
    const sendButton = document.getElementById("send");
    sendButton.disabled = false;
    document.addEventListener('keydown', async event => {
	if(event.key == 'q' &&
	   event.ctrlKey &&
	   !event.shiftKey &&
	   !event.metaKey &&
	   !event.altKey) {
	    interruptCount++;
	}
    });
    const lineNode = document.getElementById('line');
    lineNode.addEventListener('keyup', async event => {
	if(event.key === 'Enter') {
	    try {
		if(!sendButton.disabled) {
		    addToHistory(lineNode.value);
		    await writeText(port, lineNode.value);
		    lineNode.value = '';
		}
	    } catch(error) {
	    }
	}
    });
    lineNode.addEventListener('keydown', async event => {
	if(history.length > 0) {
	    if(event.key === 'ArrowUp') {
		currentHistoryIdx =
		    Math.min(currentHistoryIdx + 1, history.length - 1);
		lineNode.value = history[currentHistoryIdx];
		const end = lineNode.value.length;
		lineNode.setSelectionRange(end, end);
		lineNode.focus();
	    } else if(event.key === 'ArrowDown') {
		currentHistoryIdx =
		    Math.max(currentHistoryIdx - 1, -1);
		if(currentHistoryIdx > -1) {
		    lineNode.value = history[currentHistoryIdx];
		} else {
		    lineNode.value = '';
		}
		const end = lineNode.value.length;
		lineNode.setSelectionRange(end, end);
		lineNode.focus();
	    }
	}
    });
    const area = document.getElementById("area");
    sendButton.addEventListener('click', async () => {
	await writeText(port, area.value);
    });
    while (port.readable) {
	const reader = port.readable.getReader();
	try {
	    while (true) {
		const { value, done } = await reader.read();
		if (done) {
		    break;
		}
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
		if(getTargetType() === 'mecrisp') {
		    for(let i = 0; i < value.length; i++) {
			if(value[i] === 0x0A) {
			    if(mecrispOkCount === 4) {
				ackCount++;
			    }
			    mecrispOkCount = 0;
			    term.write(Uint8Array.from([0x0D, 0x0A]));
			} else {
			    if((value[i] === 0x20 && mecrispOkCount === 0) ||
			       (value[i] === 0x6F && mecrispOkCount === 1) ||
			       (value[i] === 0x6B && mecrispOkCount === 2) ||
			       (value[i] === 0x2E && mecrispOkCount === 3)) {
				mecrispOkCount++;
			    } else if(value[i] === 0x20 &&
				      mecrispOkCount === 1) {
			    } else {
				mecrispOkCount = 0;
			    }
			    term.write(value.slice(i, i + 1));
			}
		    }
		} else {
		    term.write(value);
		}
	    }
	} finally {
	    reader.releaseLock();
	}
    }
}

function startTerminal() {
    term = new Terminal();
    term.open(document.getElementById('terminal'));
    term.setOption('bellStyle', 'both');
    term.setOption('cursorStyle', 'block');
    term.write('Welcome to zeptocom.js\r\n')
    term.write('Copyright (c) 2022 Travis Bemann\r\n');
    term.write('zeptocom.js comes with ABSOLUTELY NO WARRANTY: ' +
	       'it is licensed under the terms of the MIT license\r\n');
    const targetTypeSelect = document.getElementById('targetType');
    targetTypeSelect.selectedIndex = 0;
    const connectButton = document.getElementById("connect");
    connectButton.addEventListener('click', () => {
	try {
	    getSerial(term);
	} catch(e) {
	}
    });
    const clearButton = document.getElementById("clear");
    clearButton.addEventListener('click', () => {
	try {
	    clearArea();
	} catch(e) {
	}
    });
    const appendFileButton = document.getElementById("appendFile");
    appendFileButton.addEventListener('click', () => {
	try {
	    appendFile();
	} catch(e) {
	}
    });
    const expandIncludesButton = document.getElementById("expandIncludes");
    expandIncludesButton.addEventListener('click', () => {
	try {
	    expandIncludes();
	} catch(e) {
	}
    });
    const setWorkingDirButton = document.getElementById("setWorkingDir");
    setWorkingDirButton.addEventListener('click', async () => {
	await selectWorkingDir();
    });
}

